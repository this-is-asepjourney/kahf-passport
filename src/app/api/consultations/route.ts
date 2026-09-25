import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/consultations — BA records a consultation for a customer
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }
    const decodedToken = await adminAuth().verifyIdToken(authorization.split('Bearer ')[1]);
    if (!['ba', 'admin_region', 'super_admin'].includes(decodedToken.role as string)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, skinType, concerns, notes, recommendedProducts } = body;
    if (!customerId || !skinType || !concerns?.length) {
      return NextResponse.json({ error: 'Data konsultasi tidak lengkap' }, { status: 400 });
    }

    const db = adminDb();
    const baId = decodedToken.uid;
    const storeId = decodedToken.storeId as string;

    const [baUser, customerDoc, storeDoc] = await Promise.all([
      adminAuth().getUser(baId),
      db.collection('customers').doc(customerId).get(),
      storeId ? db.collection('stores').doc(storeId).get() : Promise.resolve(null),
    ]);

    if (!customerDoc.exists) {
      return NextResponse.json({ error: 'Customer tidak ditemukan' }, { status: 404 });
    }

    const customer = customerDoc.data()!;
    const consultationRef = db.collection('consultations').doc();

    // Create consultation
    await consultationRef.set({
      customerId,
      customerNameSnapshot: customer.fullName,
      baId,
      baNameSnapshot: baUser.displayName ?? baId,
      storeId: storeId ?? '',
      storeNameSnapshot: storeDoc?.data()?.name ?? '',
      skinType,
      concerns,
      notes: notes ?? '',
      recommendedProducts: recommendedProducts ?? [],
      createdAt: FieldValue.serverTimestamp(),
    });

    // Update skin profile
    const skinProfileRef = db.collection('skinProfiles').doc(customerId);
    await skinProfileRef.set({
      customerId,
      skinType,
      concerns,
      preferences: [],
      updatedAt: FieldValue.serverTimestamp(),
      updatedByBaId: baId,
    }, { merge: true });

    // Create recommendations if any
    if (recommendedProducts?.length) {
      const recoRef = db.collection('recommendations').doc();
      await recoRef.set({
        customerId,
        customerNameSnapshot: customer.fullName,
        baId,
        baNameSnapshot: baUser.displayName ?? baId,
        storeNameSnapshot: storeDoc?.data()?.name ?? '',
        consultationId: consultationRef.id,
        products: recommendedProducts,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true, consultationId: consultationRef.id });
  } catch (error) {
    console.error('[consultation]', error);
    return NextResponse.json({ error: 'Gagal menyimpan konsultasi' }, { status: 500 });
  }
}
