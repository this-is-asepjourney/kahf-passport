import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/admin/ba/[id]/reset-password
 * Reset password akun Beauty Advisor langsung dari Admin Dashboard
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
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password baru harus memiliki minimal 6 karakter' },
        { status: 400 }
      );
    }

    // Update password di Firebase Auth
    await adminAuth().updateUser(id, {
      password: newPassword,
    });

    // Catat ke audit log
    try {
      await adminDb().collection('auditLogs').add({
        action: 'reset_ba_password',
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
      message: 'Password akun Beauty Advisor berhasil diperbarui!',
      rawPassword: newPassword,
    });
  } catch (error: any) {
    console.error('[POST /api/admin/ba/[id]/reset-password]', error);
    return NextResponse.json(
      { error: error.message || 'Gagal mereset password Beauty Advisor' },
      { status: 500 }
    );
  }
}
