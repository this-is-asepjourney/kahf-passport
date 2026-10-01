import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/admin/ba/[id]/toggle-status
 * Mengaktifkan atau menonaktifkan akun Beauty Advisor (enable/disable login)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);

    if (decodedToken.role !== 'super_admin' && decodedToken.role !== 'admin_region') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { isActive } = body;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Status isActive harus boolean' }, { status: 400 });
    }

    const db = adminDb();

    // 1. Disable / Enable di Firebase Auth
    try {
      await adminAuth().updateUser(id, {
        disabled: !isActive,
      });
    } catch (authErr) {
      console.warn('Auth disable update warning:', authErr);
    }

    // 2. Update status di Firestore
    const updates = {
      isActive,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await Promise.all([
      db.collection('baProfiles').doc(id).set(updates, { merge: true }),
      db.collection('users').doc(id).set(updates, { merge: true }),
    ]);

    // 3. Catat audit
    try {
      await db.collection('auditLogs').add({
        action: isActive ? 'activate_beauty_advisor' : 'deactivate_beauty_advisor',
        actorUid: decodedToken.uid,
        actorEmail: decodedToken.email || 'admin',
        targetUid: id,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn('Audit error:', auditErr);
    }

    return NextResponse.json({
      success: true,
      isActive,
      message: `Akun Beauty Advisor berhasil di${isActive ? 'aktifkan' : 'nonaktifkan'}!`,
    });
  } catch (error: any) {
    console.error('[POST /api/admin/ba/[id]/toggle-status]', error);
    return NextResponse.json(
      { error: error.message || 'Gagal mengubah status Beauty Advisor' },
      { status: 500 }
    );
  }
}
