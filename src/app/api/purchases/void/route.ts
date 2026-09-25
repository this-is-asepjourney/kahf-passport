import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/purchases/void
 * Void a purchase (BA or admin only).
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);

    const allowedRoles = ['ba', 'admin_region', 'super_admin'];
    if (!allowedRoles.includes(decodedToken.role as string)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { purchaseId, reason } = body;

    if (!purchaseId || !reason) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const db = adminDb();
    const purchaseRef = db.collection('purchases').doc(purchaseId);
    const purchaseDoc = await purchaseRef.get();

    if (!purchaseDoc.exists) {
      return NextResponse.json({ error: 'Pembelian tidak ditemukan' }, { status: 404 });
    }

    const purchase = purchaseDoc.data()!;

    if (purchase.status === 'void') {
      return NextResponse.json({ error: 'Pembelian sudah divoid' }, { status: 409 });
    }

    // BA can only void their own store's purchases
    if (
      decodedToken.role === 'ba' &&
      purchase.storeId !== decodedToken.storeId
    ) {
      return NextResponse.json({ error: 'Tidak bisa void pembelian toko lain' }, { status: 403 });
    }

    await db.runTransaction(async (tx) => {
      // Void the purchase
      tx.update(purchaseRef, {
        status: 'void',
        voidReason: reason,
        voidedBy: decodedToken.uid,
        voidedAt: FieldValue.serverTimestamp(),
      });

      // Reverse customer totals
      const customerRef = db.collection('customers').doc(purchase.customerId);
      tx.update(customerRef, {
        purchaseCount: FieldValue.increment(-1),
        totalSpent: FieldValue.increment(-purchase.totalAmount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Audit log
      const auditRef = db.collection('auditLogs').doc();
      tx.set(auditRef, {
        userId: decodedToken.uid,
        action: 'void_purchase',
        subjectType: 'purchase',
        subjectId: purchaseId,
        meta: { reason, originalAmount: purchase.totalAmount },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[void-purchase]', error);
    return NextResponse.json({ error: 'Gagal void pembelian' }, { status: 500 });
  }
}
