import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { nanoid } from 'nanoid';
import { FieldValue } from 'firebase-admin/firestore';
import { maskName } from '@/lib/utils';

/**
 * POST /api/qr/resolve
 * Resolve a QR token and determine redirect based on caller's role.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, idToken } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 400 });
    }

    const db = adminDb();

    // Get QR token doc
    const tokenDoc = await db.collection('qrTokens').doc(token).get();

    if (!tokenDoc.exists || !tokenDoc.data()?.isActive) {
      return NextResponse.json({ error: 'QR tidak valid atau sudah tidak aktif' }, { status: 404 });
    }

    const { customerId } = tokenDoc.data()!;
    const customerDoc = await db.collection('customers').doc(customerId).get();

    if (!customerDoc.exists) {
      return NextResponse.json({ error: 'Customer tidak ditemukan' }, { status: 404 });
    }

    const customer = customerDoc.data()!;

    // If no session token provided → prompt login
    if (!idToken) {
      return NextResponse.json({
        redirect: 'login',
        customerNameMasked: maskName(customer.fullName),
        customerId,
      });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({
        redirect: 'login',
        customerNameMasked: maskName(customer.fullName),
        customerId,
      });
    }

    const callerRole = decodedToken.role as string;
    const callerUid = decodedToken.uid;

    // BA/admin viewing the QR
    if (['ba', 'admin_region', 'super_admin'].includes(callerRole)) {
      return NextResponse.json({
        redirect: 'ba_customer',
        customerId,
      });
    }

    // Customer viewing their own QR
    if (callerUid === customer.uid) {
      return NextResponse.json({
        redirect: 'passport',
        customerId,
      });
    }

    // Other customer → prompt login with their own QR
    return NextResponse.json({
      redirect: 'login',
      customerNameMasked: maskName(customer.fullName),
      customerId,
    });
  } catch (error) {
    console.error('[qr-resolve]', error);
    return NextResponse.json({ error: 'Gagal memproses QR' }, { status: 500 });
  }
}

/**
 * POST /api/qr/regenerate
 * Revoke current QR token and generate a new one.
 */
export async function PUT(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);
    const body = await request.json();
    const { customerId } = body;

    const db = adminDb();
    const customerDoc = await db.collection('customers').doc(customerId).get();

    if (!customerDoc.exists) {
      return NextResponse.json({ error: 'Customer tidak ditemukan' }, { status: 404 });
    }

    const customer = customerDoc.data()!;

    // Only owner or admin can regenerate
    const isOwner = decodedToken.uid === customer.uid;
    const isAdmin = ['admin_region', 'super_admin'].includes(decodedToken.role as string);
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const oldToken = customer.qrTokenId;
    const newToken = nanoid(32);

    await db.runTransaction(async (tx) => {
      // Revoke old token
      if (oldToken) {
        const oldTokenRef = db.collection('qrTokens').doc(oldToken);
        tx.update(oldTokenRef, {
          isActive: false,
          revokedAt: FieldValue.serverTimestamp(),
        });
      }

      // Create new token
      const newTokenRef = db.collection('qrTokens').doc(newToken);
      tx.set(newTokenRef, {
        customerId,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        revokedAt: null,
      });

      // Update customer
      const customerRef = db.collection('customers').doc(customerId);
      tx.update(customerRef, {
        qrTokenId: newToken,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true, newToken });
  } catch (error) {
    console.error('[qr-regenerate]', error);
    return NextResponse.json({ error: 'Gagal regenerasi QR' }, { status: 500 });
  }
}
