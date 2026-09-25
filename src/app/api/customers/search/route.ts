import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { maskPhone } from '@/lib/utils';
import { normalizePhone } from '@/lib/utils';

/**
 * GET /api/customers/search?q=query
 * Search customers by phone or name (BA only).
 * Phone results are masked.
 */
export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);

    if (!['ba', 'admin_region', 'super_admin'].includes(decodedToken.role as string)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() ?? '';

    if (query.length < 3) {
      return NextResponse.json({ customers: [] });
    }

    const db = adminDb();
    let customers: unknown[] = [];

    // Detect if query looks like a phone number
    const isPhone = /^\+?[0-9]{7,}$/.test(query.replace(/\s/g, ''));

    if (isPhone) {
      const normalized = normalizePhone(query);
      const snap = await db
        .collection('customers')
        .where('phone', '==', normalized)
        .limit(5)
        .get();

      customers = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          fullName: data.fullName,
          phoneDisplay: maskPhone(data.phone),
          memberNo: data.memberNo,
          status: data.status,
          purchaseCount: data.purchaseCount,
          lastPurchaseAt: data.lastPurchaseAt?.toDate().toISOString() ?? null,
        };
      });
    } else {
      // Name search — Firestore doesn't support full-text, use prefix range query
      const snap = await db
        .collection('customers')
        .where('fullName', '>=', query)
        .where('fullName', '<=', query + '\uf8ff')
        .limit(10)
        .get();

      customers = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          fullName: data.fullName,
          phoneDisplay: maskPhone(data.phone),
          memberNo: data.memberNo,
          status: data.status,
          purchaseCount: data.purchaseCount,
          lastPurchaseAt: data.lastPurchaseAt?.toDate().toISOString() ?? null,
        };
      });
    }

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('[search-customers]', error);
    return NextResponse.json({ error: 'Gagal mencari customer' }, { status: 500 });
  }
}

/**
 * POST /api/customers/search (Quick register by BA)
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);

    if (!['ba', 'admin_region', 'super_admin'].includes(decodedToken.role as string)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { fullName, phone, city } = body;

    if (!fullName || !phone) {
      return NextResponse.json({ error: 'Nama dan nomor HP wajib diisi' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    const db = adminDb();

    // Check if customer with this phone already exists
    const existingQuery = await db
      .collection('customers')
      .where('phone', '==', normalizedPhone)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      const existing = existingQuery.docs[0];
      return NextResponse.json({
        customerId: existing.id,
        action: 'existing',
        message: 'Customer sudah terdaftar',
      });
    }

    // Create unclaimed customer
    const { nanoid } = await import('nanoid');
    const customerId = nanoid(26).toUpperCase();
    const qrToken = nanoid(32);
    const { FieldValue } = await import('firebase-admin/firestore');

    const memberPrefix = 'KHF';
    const memberNo = `${memberPrefix}${Date.now().toString(36).toUpperCase()}`;

    await db.runTransaction(async (tx) => {
      const customerRef = db.collection('customers').doc(customerId);
      tx.set(customerRef, {
        id: customerId,
        publicId: customerId.slice(0, 8).toLowerCase(),
        uid: null,
        fullName,
        phone: normalizedPhone,
        birthDate: null,
        gender: null,
        city: city ?? null,
        regionId: null,
        memberNo,
        registeredByBaId: decodedToken.uid,
        registeredStoreId: decodedToken.storeId ?? null,
        status: 'unclaimed',
        claimedAt: null,
        qrTokenId: qrToken,
        lastPurchaseAt: null,
        purchaseCount: 0,
        totalSpent: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const tokenRef = db.collection('qrTokens').doc(qrToken);
      tx.set(tokenRef, {
        customerId,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        revokedAt: null,
      });
    });

    return NextResponse.json({ customerId, action: 'created', qrToken });
  } catch (error) {
    console.error('[quick-register-customer]', error);
    return NextResponse.json({ error: 'Gagal mendaftarkan customer' }, { status: 500 });
  }
}
