import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * PATCH /api/admin/ba/[id]
 * Perbarui profil, penugasan counter, atau status aktif Beauty Advisor
 */
export async function PATCH(
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
    const { fullName, phone, employeeCode, storeId, isActive } = body;

    const db = adminDb();
    const updates: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (fullName !== undefined) {
      updates.fullName = fullName.trim();
      updates.name = fullName.trim();
    }
    if (phone !== undefined) {
      updates.phone = phone.trim();
    }
    if (employeeCode !== undefined) {
      updates.employeeCode = employeeCode.trim();
    }
    if (typeof isActive === 'boolean') {
      updates.isActive = isActive;
    }

    // Resolve store name jika storeId diubah
    let storeName = '';
    if (storeId) {
      updates.storeId = storeId.trim();
      const storeDoc = await db.collection('stores').doc(storeId.trim()).get();
      if (storeDoc.exists) {
        storeName = storeDoc.data()?.name || '';
        updates.storeNameSnapshot = storeName;
      }
    }

    // 1. Update di Firebase Auth (nama & status disable)
    try {
      const authUpdates: any = {};
      if (fullName) authUpdates.displayName = fullName.trim();
      if (typeof isActive === 'boolean') authUpdates.disabled = !isActive;
      if (Object.keys(authUpdates).length > 0) {
        await adminAuth().updateUser(id, authUpdates);
      }
      
      // Update custom claims jika storeId atau employeeCode berubah
      if (storeId || employeeCode) {
        await adminAuth().setCustomUserClaims(id, {
          role: 'ba',
          storeId: storeId ? storeId.trim() : undefined,
          employeeCode: employeeCode ? employeeCode.trim() : undefined,
        });
      }
    } catch (authErr) {
      console.warn('[PATCH /api/admin/ba/[id]] Auth update non-fatal:', authErr);
    }

    // 2. Update di Firestore baProfiles & users
    await Promise.all([
      db.collection('baProfiles').doc(id).set(updates, { merge: true }),
      db.collection('users').doc(id).set({
        ...updates,
        displayName: updates.fullName || undefined,
        phoneNumber: updates.phone || undefined,
        storeName: storeName || undefined,
      }, { merge: true }),
    ]);

    // 3. Catat ke audit log
    try {
      await db.collection('auditLogs').add({
        action: 'update_beauty_advisor',
        actorUid: decodedToken.uid,
        actorEmail: decodedToken.email || 'admin',
        targetUid: id,
        details: { updates },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn('Audit error:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Data Beauty Advisor berhasil diperbarui!',
    });
  } catch (error: any) {
    console.error('[PATCH /api/admin/ba/[id]]', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memperbarui data Beauty Advisor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/ba/[id]
 * Hapus akun Beauty Advisor dari Firebase Auth dan Firestore
 */
export async function DELETE(
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

    if (decodedToken.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Hanya Super Admin yang berhak menghapus akun Beauty Advisor' },
        { status: 403 }
      );
    }

    const db = adminDb();

    // 1. Hapus dari Firebase Auth
    try {
      await adminAuth().deleteUser(id);
    } catch (authErr: any) {
      console.warn('[DELETE /api/admin/ba/[id]] Auth delete error (might not exist):', authErr.message);
    }

    // 2. Hapus dari Firestore
    await Promise.all([
      db.collection('baProfiles').doc(id).delete(),
      db.collection('users').doc(id).delete(),
    ]);

    // 3. Audit log
    try {
      await db.collection('auditLogs').add({
        action: 'delete_beauty_advisor',
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
      message: 'Beauty Advisor berhasil dihapus dari sistem!',
    });
  } catch (error: any) {
    console.error('[DELETE /api/admin/ba/[id]]', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus akun Beauty Advisor' },
      { status: 500 }
    );
  }
}
