import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { nanoid } from 'nanoid';

/**
 * GET /api/purchases
 * Returns purchases based on the requester's role:
 * - customer: purchases for that customer
 * - ba: purchases handled by that BA
 * - admin: all purchases (optionally filtered)
 */
export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);
    const db = adminDb();

    if (decodedToken.role === 'customer') {
      const custSnap = await db
        .collection('customers')
        .where('uid', '==', decodedToken.uid)
        .limit(1)
        .get();

      if (custSnap.empty) {
        return NextResponse.json({ purchases: [] });
      }

      const customerId = custSnap.docs[0].id;
      const purchasesSnap = await db
        .collection('purchases')
        .where('customerId', '==', customerId)
        .orderBy('purchasedAt', 'desc')
        .get();

      const purchases = purchasesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        purchasedAt: doc.data().purchasedAt?.toDate?.()?.toISOString() ?? doc.data().purchasedAt,
      }));

      return NextResponse.json({ purchases });
    }

    if (decodedToken.role === 'ba') {
      const purchasesSnap = await db
        .collection('purchases')
        .where('baId', '==', decodedToken.uid)
        .orderBy('purchasedAt', 'desc')
        .limit(100)
        .get();

      const purchases = purchasesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        purchasedAt: doc.data().purchasedAt?.toDate?.()?.toISOString() ?? doc.data().purchasedAt,
      }));

      return NextResponse.json({ purchases });
    }

    // Admin or other roles: return recent purchases
    const purchasesSnap = await db
      .collection('purchases')
      .orderBy('purchasedAt', 'desc')
      .limit(200)
      .get();

    const purchases = purchasesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      purchasedAt: doc.data().purchasedAt?.toDate?.()?.toISOString() ?? doc.data().purchasedAt,
    }));

    return NextResponse.json({ purchases });
  } catch (error) {
    console.error('[get-purchases]', error);
    return NextResponse.json({ error: 'Gagal mengambil data transaksi' }, { status: 500 });
  }
}

/**
 * POST /api/purchases
 * Records a purchase transaction.
 * Supports both:
 * 1. BA recording an in-store transaction on behalf of a customer.
 * 2. Customer checking out recommended products directly from Beauty Passport.
 * Atomically updates: purchases, customers, dailySalesSummary, dailyBaSummary,
 * dailyProductSummary, loyaltyAccounts, loyaltyLedgers, and recommendations.
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);
    const db = adminDb();

    const role = (decodedToken.role as string) || 'customer';
    const isCustomer = role === 'customer';
    const isBaOrAdmin = ['ba', 'admin_region', 'super_admin'].includes(role);

    if (!isCustomer && !isBaOrAdmin) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { items, recommendationId, paymentMethod = 'qris' } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Daftar produk tidak boleh kosong' }, { status: 400 });
    }

    let customerId = body.customerId;
    let storeId = body.storeId || (decodedToken.storeId as string) || '';
    let baId = isCustomer ? '' : decodedToken.uid;
    let baNameSnapshot = '';
    let storeNameSnapshot = '';
    let regionId = '';

    // ==========================================
    // 1. Resolve Customer Data
    // ==========================================
    let customerDoc: FirebaseFirestore.DocumentSnapshot;
    if (isCustomer) {
      const custQuery = await db
        .collection('customers')
        .where('uid', '==', decodedToken.uid)
        .limit(1)
        .get();

      if (custQuery.empty) {
        return NextResponse.json({ error: 'Profil customer tidak ditemukan' }, { status: 404 });
      }
      customerDoc = custQuery.docs[0];
      customerId = customerDoc.id;
    } else {
      if (!customerId) {
        return NextResponse.json({ error: 'Customer ID wajib diisi' }, { status: 400 });
      }
      customerDoc = await db.collection('customers').doc(customerId).get();
      if (!customerDoc.exists) {
        return NextResponse.json({ error: 'Customer tidak ditemukan' }, { status: 404 });
      }
    }

    const customer = customerDoc.data()!;

    // ==========================================
    // 2. Resolve BA and Store
    // ==========================================
    if (isCustomer) {
      // Find latest consultation to link BA and Store
      const latestConsultQuery = await db
        .collection('consultations')
        .where('customerId', '==', customerId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!latestConsultQuery.empty) {
        const consultData = latestConsultQuery.docs[0].data();
        baId = consultData.baId || '';
        baNameSnapshot = consultData.baNameSnapshot || '';
        storeId = consultData.storeId || '';
        storeNameSnapshot = consultData.storeNameSnapshot || '';
      }

      // If still missing store/BA, check customer document fields
      if (!storeId && customer.registeredStoreId) {
        storeId = customer.registeredStoreId;
      }
      if (!baId && customer.registeredBaId) {
        baId = customer.registeredBaId;
      }

      // Fallback to active store if empty
      if (!storeId) {
        const fallbackStoreSnap = await db.collection('stores').where('isActive', '==', true).limit(1).get();
        if (!fallbackStoreSnap.empty) {
          const sDoc = fallbackStoreSnap.docs[0];
          storeId = sDoc.id;
          storeNameSnapshot = sDoc.data().name || 'Kahf Official Store';
          regionId = sDoc.data().regionId || 'dki_jakarta';
        } else {
          const anyStoreSnap = await db.collection('stores').limit(1).get();
          if (!anyStoreSnap.empty) {
            const sDoc = anyStoreSnap.docs[0];
            storeId = sDoc.id;
            storeNameSnapshot = sDoc.data().name || 'Kahf Official Store';
            regionId = sDoc.data().regionId || 'dki_jakarta';
          }
        }
      }

      // If store found without name, fetch store details
      if (storeId && !storeNameSnapshot) {
        const storeDoc = await db.collection('stores').doc(storeId).get();
        if (storeDoc.exists) {
          storeNameSnapshot = storeDoc.data()?.name || 'Kahf Store';
          regionId = storeDoc.data()?.regionId || 'dki_jakarta';
        }
      }

      // If baId found without name, fetch BA name
      if (baId && !baNameSnapshot) {
        try {
          const baUser = await adminAuth().getUser(baId);
          baNameSnapshot = baUser.displayName || 'Kahf Beauty Advisor';
        } catch {
          baNameSnapshot = 'Kahf Beauty Advisor';
        }
      } else if (!baId) {
        baNameSnapshot = 'Kahf Online Advisor';
      }
    } else {
      // BA flow: verify store & BA user
      // 1. If storeId is not provided in body/token, look up in baProfiles or users
      if (!storeId) {
        const [baProfileDoc, userDoc] = await Promise.all([
          db.collection('baProfiles').doc(baId).get(),
          db.collection('users').doc(baId).get(),
        ]);
        if (baProfileDoc.exists && baProfileDoc.data()?.storeId) {
          storeId = baProfileDoc.data()!.storeId;
        } else if (userDoc.exists && userDoc.data()?.storeId) {
          storeId = userDoc.data()!.storeId;
        }
      }

      // 2. Check if store document exists
      let storeDoc = storeId ? await db.collection('stores').doc(storeId).get() : null;

      // 3. Robust fallback: if storeId not found or document missing, pick first available store
      if (!storeDoc || !storeDoc.exists) {
        const [activeStoreSnap, anyStoreSnap] = await Promise.all([
          db.collection('stores').where('isActive', '==', true).limit(1).get(),
          db.collection('stores').limit(1).get(),
        ]);

        if (!activeStoreSnap.empty) {
          storeDoc = activeStoreSnap.docs[0];
          storeId = storeDoc.id;
        } else if (!anyStoreSnap.empty) {
          storeDoc = anyStoreSnap.docs[0];
          storeId = storeDoc.id;
        } else {
          // If NO stores exist in database at all, auto-provision default store so transactions never fail!
          const defaultStoreRef = db.collection('stores').doc('store_kahf_flagship');
          await defaultStoreRef.set({
            id: 'store_kahf_flagship',
            name: 'Kahf Flagship Counter',
            code: 'KHF-JKT-01',
            city: 'Jakarta Selatan',
            regionId: 'dki_jakarta',
            address: 'Grand Indonesia Mall, Lantai UG',
            isActive: true,
            createdAt: FieldValue.serverTimestamp(),
          });
          storeDoc = await defaultStoreRef.get();
          storeId = defaultStoreRef.id;
        }

        // Save resolved storeId to baProfiles for future consistency
        await db.collection('baProfiles').doc(baId).set({ storeId }, { merge: true });
      }

      const storeData = storeDoc.data()!;
      storeNameSnapshot = storeData.name || 'Kahf Store';
      regionId = storeData.regionId || 'dki_jakarta';

      // Resolve BA user display name
      const baUser = await adminAuth().getUser(baId).catch(() => null);
      baNameSnapshot = baUser?.displayName || baId;
    }

    // ==========================================
    // 3. Resolve Items & Pricing
    // ==========================================
    const productIds = [...new Set(items.map((i: { productId: string }) => i.productId))].filter(Boolean);
    const productDocs = await Promise.all(
      productIds.map((id) => db.collection('products').doc(id as string).get())
    );
    const productMap = Object.fromEntries(
      productDocs.filter((d) => d.exists).map((doc) => [doc.id, doc.data()])
    );

    const resolvedItems = items.map(
      (item: { productId: string; productName?: string; sku?: string; qty: number; unitPrice?: number }) => {
        const product = productMap[item.productId];
        const unitPrice =
          item.unitPrice !== undefined && item.unitPrice > 0
            ? Number(item.unitPrice)
            : Number(product?.defaultPrice ?? 45000);
        const qty = Math.max(1, Number(item.qty || 1));
        const subtotal = qty * unitPrice;

        return {
          productId: item.productId,
          productName: product?.name || item.productName || 'Produk Kahf',
          sku: product?.sku || item.sku || 'KAHF-DEFAULT',
          qty,
          unitPrice,
          subtotal,
        };
      }
    );

    const totalAmount = resolvedItems.reduce(
      (sum: number, i: { subtotal: number }) => sum + i.subtotal,
      0
    );

    const invoiceNo =
      body.invoiceNo?.trim() ||
      `INV-${isCustomer ? 'REC-' : ''}${Date.now().toString().slice(-6)}-${nanoid(4).toUpperCase()}`;

    const purchaseDate = body.purchasedAt ? new Date(body.purchasedAt) : new Date();
    const dateStr = purchaseDate.toISOString().slice(0, 10);
    const purchaseId = nanoid(26).toUpperCase();

    // ==========================================
    // 4. Atomic Firestore Transaction
    // (ALL READS MUST PRECEDE ALL WRITES)
    // ==========================================
    const POINTS_PER_IDR = 10000;
    const pointsEarned = Math.floor(totalAmount / POINTS_PER_IDR);

    await db.runTransaction(async (tx) => {
      // -----------------------------------------------------------------
      // PHASE 1: ALL READS (Must execute BEFORE any write in transaction)
      // -----------------------------------------------------------------
      const loyaltyRef = db.collection('loyaltyAccounts').doc(customerId);
      const loyaltyDoc = await tx.get(loyaltyRef);

      const currentPoints = loyaltyDoc.exists ? (loyaltyDoc.data()?.currentPoints ?? 0) : 0;
      const totalEarned = loyaltyDoc.exists ? (loyaltyDoc.data()?.totalEarnedPoints ?? 0) : 0;
      const newBalance = currentPoints + pointsEarned;
      const newTotalEarned = totalEarned + pointsEarned;

      let tier = 'bronze';
      if (newTotalEarned >= 5000) tier = 'platinum';
      else if (newTotalEarned >= 1500) tier = 'gold';
      else if (newTotalEarned >= 500) tier = 'silver';

      // -----------------------------------------------------------------
      // PHASE 2: ALL WRITES (Set, Update, Delete)
      // -----------------------------------------------------------------
      // 1. Write purchase document
      const purchaseRef = db.collection('purchases').doc(purchaseId);
      tx.set(purchaseRef, {
        id: purchaseId,
        customerId,
        customerNameSnapshot: customer.fullName || 'Customer Kahf',
        customerPhoneSnapshot: customer.phone || '',
        storeId: storeId || 'store_online',
        storeNameSnapshot: storeNameSnapshot || 'Kahf Counter',
        regionId: regionId || 'dki_jakarta',
        baId: baId || 'ba_online',
        baNameSnapshot: baNameSnapshot || 'Kahf Beauty Advisor',
        invoiceNo,
        purchasedAt: Timestamp.fromDate(purchaseDate),
        totalAmount,
        status: 'valid',
        source: isCustomer ? 'customer_recommendation_checkout' : 'ba_assisted_sale',
        paymentMethod,
        voidReason: null,
        voidedBy: null,
        voidedAt: null,
        items: resolvedItems,
        createdAt: FieldValue.serverTimestamp(),
      });

      // 2. Update customer statistics
      const customerRef = db.collection('customers').doc(customerId);
      tx.update(customerRef, {
        lastPurchaseAt: FieldValue.serverTimestamp(),
        purchaseCount: FieldValue.increment(1),
        totalSpent: FieldValue.increment(totalAmount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 3. Increment Daily Sales Summary (Admin & Regional view)
      if (storeId) {
        const summaryId = `${dateStr}_${storeId}`;
        const summaryRef = db.collection('dailySalesSummary').doc(summaryId);
        tx.set(
          summaryRef,
          {
            date: dateStr,
            storeId,
            regionId: regionId || 'dki_jakarta',
            totalSales: FieldValue.increment(totalAmount),
            totalOrders: FieldValue.increment(1),
            totalQty: FieldValue.increment(
              resolvedItems.reduce((s: number, i: { qty: number }) => s + i.qty, 0)
            ),
            uniqueCustomers: FieldValue.increment(1),
          },
          { merge: true }
        );
      }

      // 4. Increment Daily BA Summary (BA Performance view)
      if (baId) {
        const baSummaryId = `${dateStr}_${baId}`;
        const baSummaryRef = db.collection('dailyBaSummary').doc(baSummaryId);
        tx.set(
          baSummaryRef,
          {
            date: dateStr,
            baId,
            baName: baNameSnapshot || baId,
            orders: FieldValue.increment(1),
            sales: FieldValue.increment(totalAmount),
          },
          { merge: true }
        );
      }

      // 5. Increment Daily Product Summary (Product Insight view)
      for (const item of resolvedItems) {
        const productSummaryId = `${dateStr}_${item.productId}`;
        const productSummaryRef = db.collection('dailyProductSummary').doc(productSummaryId);
        tx.set(
          productSummaryRef,
          {
            date: dateStr,
            productId: item.productId,
            productName: item.productName,
            regionId: regionId || 'dki_jakarta',
            qty: FieldValue.increment(item.qty),
            sales: FieldValue.increment(item.subtotal),
          },
          { merge: true }
        );
      }

      // 6. Award Loyalty Points
      if (pointsEarned > 0) {
        tx.set(
          loyaltyRef,
          {
            customerId,
            currentPoints: newBalance,
            totalEarnedPoints: newTotalEarned,
            totalRedeemedPoints: loyaltyDoc.exists ? (loyaltyDoc.data()?.totalRedeemedPoints ?? 0) : 0,
            tier,
            tierUpdatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            ...(loyaltyDoc.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
          },
          { merge: true }
        );

        // Record loyalty ledger transaction
        const ledgerRef = db.collection('loyaltyLedgers').doc();
        tx.set(ledgerRef, {
          customerId,
          type: 'earn',
          points: pointsEarned,
          balance: newBalance,
          description: isCustomer
            ? `Poin dari pembelian rekomendasi #${invoiceNo}`
            : `Poin dari pembelian #${invoiceNo}`,
          referenceType: 'purchase',
          referenceId: purchaseId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // 7. Update recommendation status if applicable
      if (recommendationId) {
        const recoRef = db.collection('recommendations').doc(recommendationId);
        tx.set(
          recoRef,
          {
            status: 'completed',
            purchasedAt: FieldValue.serverTimestamp(),
            purchaseId,
          },
          { merge: true }
        );
      }

      // 8. Audit Log
      const auditRef = db.collection('auditLogs').doc();
      tx.set(auditRef, {
        userId: decodedToken.uid,
        action: isCustomer ? 'customer_checkout_recommendation' : 'record_purchase',
        subjectType: 'purchase',
        subjectId: purchaseId,
        meta: {
          customerId,
          storeId,
          baId,
          invoiceNo,
          totalAmount,
          itemCount: resolvedItems.length,
          role,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    // ==========================================
    // 5. Post-Transaction: Repurchase Reminders
    // ==========================================
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + 30);
    const reminderDateStr = reminderDate.toISOString().slice(0, 10);

    const reminderBatch = db.batch();
    for (const item of resolvedItems) {
      const reminderRef = db.collection('reminders').doc();
      reminderBatch.set(reminderRef, {
        customerId,
        customerNameSnapshot: customer.fullName || 'Customer',
        customerPhone: customer.phone || '',
        productId: item.productId,
        productName: item.productName,
        reminderDate: reminderDateStr,
        status: 'pending',
        purchaseId,
        message: `Hai ${customer.fullName || 'Bro'}! Sudah 30 hari sejak pembelian ${item.productName}. Saatnya repurchase produk Kahf favoritmu! 🌿`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await reminderBatch.commit().catch((err) => console.warn('Reminder batch failed:', err));

    return NextResponse.json({
      success: true,
      purchaseId,
      invoiceNo,
      totalAmount,
      itemsCount: resolvedItems.length,
      pointsEarned,
      message: 'Transaksi pembelian berhasil diproses dan disinkronkan ke seluruh sistem!',
    });
  } catch (error: any) {
    console.error('[purchase-error]', error);
    return NextResponse.json(
      { error: error?.message || 'Gagal memproses transaksi pembelian' },
      { status: 500 }
    );
  }
}
