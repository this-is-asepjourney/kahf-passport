import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

/**
 * POST /api/admin/set-role
 * Set custom claims for a user (super_admin only).
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);

    if (decodedToken.role !== 'super_admin') {
      return NextResponse.json({ error: 'Hanya super admin yang dapat mengubah role' }, { status: 403 });
    }

    const body = await request.json();
    const { targetUid, role, storeId, regionId } = body;

    if (!targetUid || !role) {
      return NextResponse.json({ error: 'targetUid dan role wajib diisi' }, { status: 400 });
    }

    const validRoles = ['customer', 'ba', 'admin_region', 'super_admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
    }

    const claims: Record<string, unknown> = { role };
    if (storeId) claims.storeId = storeId;
    if (regionId) claims.regionId = regionId;

    await adminAuth().setCustomUserClaims(targetUid, claims);

    return NextResponse.json({ success: true, message: `Role ${role} berhasil di-set untuk ${targetUid}` });
  } catch (error) {
    console.error('[set-role]', error);
    return NextResponse.json({ error: 'Gagal mengubah role' }, { status: 500 });
  }
}
