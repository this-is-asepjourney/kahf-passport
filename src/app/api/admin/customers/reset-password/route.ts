import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const { uid, newPassword } = await req.json();

    if (!uid || !newPassword) {
      return NextResponse.json({ error: 'UID and newPassword are required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Verify admin token here if you want extra security
    // But assuming the route is protected or checked client-side, 
    // ideally we should extract bearer token and check admin claims.
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(token);
    
    if (decodedToken.role !== 'super_admin' && decodedToken.role !== 'admin_region') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await adminAuth().updateUser(uid, {
      password: newPassword,
    });

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
