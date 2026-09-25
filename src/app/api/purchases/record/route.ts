import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { nanoid } from 'nanoid';

/**
 * POST /api/purchases/record
 * Record a new purchase (BA only).
 * Uses Firestore transaction to atomically write purchase + update summaries.
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);

    // Verify BA role
    if (!['ba', 'admin_region', 'super_admin'].includes(decodedToken.role as string)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const baId = decodedToken.uid;
    const storeId = decodedToken.storeId as string;

    if (!storeId) {
      return NextResponse.json({ error: 'BA tidak memiliki toko' }, { status: 400 });
    }

    const body = await request.json();
    const { customerId, invoiceNo, purchasedAt, items } = body;

    if (!customerId || !invoiceNo || !items?.length) {
      return NextResponse.json({ error: 'Data pembelian tidak lengkap' }, { status: 400 });
    }

    const db = adminDb();

    // Get BA profile & customer & store data
    const [baProfileDoc, customerDoc, storeDoc] = await Promise.all([
      db.collection('baProfiles').doc(baId).get(),
      db.collection('customers').doc(customerId).get(),
      db.collection('stores').doc(storeId).get(),
    ]);

    if (!customerDoc.exists) {
      return NextResponse.json({ error: 'Customer tidak ditemukan' }, { status: 404 });
    }
    if (!storeDoc.exists) {
      return NextResponse.json({ error: 'Toko tidak ditemukan' }, { status: 404 });
    }

    const customer = customerDoc.data()!;
    const store = storeDoc.data()!;

    // Check duplicate invoice in same store
    const invoiceDupeCheck = await db
      .collection('purchases')
      .where('storeId', '==', storeId)
      .where('invoiceNo', '==', invoiceNo)
      .where('status', '==', 'valid')
      .limit(1)
      .get();

    if (!invoiceDupeCheck.empty) {
      return NextResponse.json(
        { error: `No. struk ${invoiceNo} sudah ada di toko ini` },
        { status: 409 }
      );
    }

    // Fetch product details for each item
    const productIds = [...new Set(items.map((i: { productId: string }) => i.productId))];
    const productDocs = await Promise.all(
      productIds.map((id) => db.collection('products').doc(id as string).get())
    );
    const productMap = Object.fromEntries(
      productDocs.map((doc) => [doc.id, doc.data()])
    );

    // Get BA display name
    const baUser = await adminAuth().getUser(baId);

    // Calculate items with product snapshots
    const resolvedItems = items.map((item: { productId: string; qty: number; unitPrice: number }) => {
      const product = productMap[item.productId];
      return {
        productId: item.productId,
        productName: product?.name ?? 'Unknown',
        sku: product?.sku ?? '',
        qty: item.qty,
        unitPrice: item.unitPrice,
        subtotal: item.qty * item.unitPrice,
      };
    });

    const totalAmount = resolvedItems.reduce(
      (sum: number, i: { subtotal: number }) => sum + i.subtotal,
      0
    );

    const purchaseId = nanoid(26).toUpperCase();
    const dateStr = purchasedAt.slice(0, 10); // YYYY-MM-DD

    await db.runTransaction(async (tx) => {
      // 1. Write purchase document
      const purchaseRef = db.collection('purchases').doc(purchaseId);
      tx.set(purchaseRef, {
        id: purchaseId,
        customerId,
        customerNameSnapshot: customer.fullName,
        customerPhoneSnapshot: customer.phone,
        storeId,
        storeNameSnapshot: store.name,
        regionId: store.regionId,
        baId,
        baNameSnapshot: baUser.displayName ?? baId,
        invoiceNo,
        purchasedAt: Timestamp.fromDate(new Date(purchasedAt)),
        totalAmount,
        status: 'valid',
        voidReason: null,
        voidedBy: null,
        voidedAt: null,
        items: resolvedItems,
        createdAt: FieldValue.serverTimestamp(),
      });

      // 2. Update customer denormalized fields
      const customerRef = db.collection('customers').doc(customerId);
      tx.update(customerRef, {
        lastPurchaseAt: FieldValue.serverTimestamp(),
        purchaseCount: FieldValue.increment(1),
        totalSpent: FieldValue.increment(totalAmount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 3. Increment dailySalesSummary
      const summaryId = `${dateStr}_${storeId}`;
      const summaryRef = db.collection('dailySalesSummary').doc(summaryId);
      tx.set(
        summaryRef,
        {
          date: dateStr,
          storeId,
          regionId: store.regionId,
          totalSales: FieldValue.increment(totalAmount),
          totalOrders: FieldValue.increment(1),
          totalQty: FieldValue.increment(
            resolvedItems.reduce((s: number, i: { qty: number }) => s + i.qty, 0)
          ),
          uniqueCustomers: FieldValue.increment(1),
        },
        { merge: true }
      );

      // 4. Increment dailyBaSummary
      const baSummaryId = `${dateStr}_${baId}`;
      const baSummaryRef = db.collection('dailyBaSummary').doc(baSummaryId);
      tx.set(
        baSummaryRef,
        {
          date: dateStr,
          baId,
          baName: baUser.displayName ?? baId,
          orders: FieldValue.increment(1),
          sales: FieldValue.increment(totalAmount),
        },
        { merge: true }
      );

      // 5. Increment dailyProductSummary per product
      for (const item of resolvedItems) {
        const productSummaryId = `${dateStr}_${item.productId}`;
        const productSummaryRef = db.collection('dailyProductSummary').doc(productSummaryId);
        tx.set(
          productSummaryRef,
          {
            date: dateStr,
            productId: item.productId,
            productName: item.productName,
            regionId: store.regionId,
            qty: FieldValue.increment(item.qty),
            sales: FieldValue.increment(item.subtotal),
          },
          { merge: true }
        );
      }

      // 6. Audit log
      const auditRef = db.collection('auditLogs').doc();
      tx.set(auditRef, {
        userId: baId,
        action: 'record_purchase',
        subjectType: 'purchase',
        subjectId: purchaseId,
        meta: { customerId, storeId, invoiceNo, totalAmount },
        createdAt: FieldValue.serverTimestamp(),
      });

      // 7. Award loyalty points (1 point per 10.000 IDR)
      const POINTS_PER_IDR = 10000;
      const pointsEarned = Math.floor(totalAmount / POINTS_PER_IDR);
      if (pointsEarned > 0) {
        const loyaltyRef = db.collection('loyaltyAccounts').doc(customerId);
        const loyaltyDoc = await tx.get(loyaltyRef);
        const currentPoints = loyaltyDoc.exists ? (loyaltyDoc.data()?.currentPoints ?? 0) : 0;
        const totalEarned = loyaltyDoc.exists ? (loyaltyDoc.data()?.totalEarnedPoints ?? 0) : 0;
        const newBalance = currentPoints + pointsEarned;
        const newTotalEarned = totalEarned + pointsEarned;

        // Calculate tier
        let tier = 'bronze';
        if (newTotalEarned >= 5000) tier = 'platinum';
        else if (newTotalEarned >= 1500) tier = 'gold';
        else if (newTotalEarned >= 500) tier = 'silver';

        tx.set(loyaltyRef, {
          customerId,
          currentPoints: newBalance,
          totalEarnedPoints: newTotalEarned,
          totalRedeemedPoints: loyaltyDoc.exists ? (loyaltyDoc.data()?.totalRedeemedPoints ?? 0) : 0,
          tier,
          tierUpdatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          ...(loyaltyDoc.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        }, { merge: true });

        // Loyalty ledger entry
        const ledgerRef = db.collection('loyaltyLedgers').doc();
        tx.set(ledgerRef, {
          customerId,
          type: 'earn',
          points: pointsEarned,
          balance: newBalance,
          description: `Poin dari pembelian #${invoiceNo}`,
          referenceType: 'purchase',
          referenceId: purchaseId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });

    // After transaction: Create repurchase reminders (30 days from now)
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + 30);
    const reminderDateStr = reminderDate.toISOString().slice(0, 10);

    // Create one reminder per unique product purchased
    const uniqueProducts = resolvedItems.reduce((acc: Record<string, { productId: string; productName: string }>, item: { productId: string; productName: string }) => {
      acc[item.productId] = { productId: item.productId, productName: item.productName };
      return acc;
    }, {});

    const reminderBatch = db.batch();
    for (const product of Object.values(uniqueProducts) as { productId: string; productName: string }[]) {
      const reminderRef = db.collection('reminders').doc();
      reminderBatch.set(reminderRef, {
        customerId,
        customerNameSnapshot: customer.fullName,
        customerPhone: customer.phone,
        productId: product.productId,
        productName: product.productName,
        reminderDate: reminderDateStr,
        status: 'pending',
        purchaseId,
        message: `Hai ${customer.fullName}! Sudah 30 hari sejak pembelian ${product.productName}. Yuk repurchase di counter Khaf terdekat! 🛍️`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await reminderBatch.commit();

    return NextResponse.json({ success: true, purchaseId });
  } catch (error) {
    console.error('[record-purchase]', error);
    return NextResponse.json({ error: 'Gagal mencatat pembelian' }, { status: 500 });
  }
}
