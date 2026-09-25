import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { maskName } from '@/lib/utils';

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * /p/[token] — QR Gateway (Server Component)
 * Resolves the QR token and redirects based on caller's role.
 */
export default async function QrGatewayPage({ params }: Props) {
  const { token } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;

  const db = adminDb();

  // Get QR token document (server-side Admin SDK, bypasses Security Rules)
  const tokenDoc = await db.collection('qrTokens').doc(token).get();

  if (!tokenDoc.exists || !tokenDoc.data()?.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">QR Tidak Valid</h1>
          <p className="text-gray-500 text-sm">
            QR code ini sudah tidak aktif atau tidak ditemukan.
          </p>
        </div>
      </div>
    );
  }

  const { customerId } = tokenDoc.data()!;
  const customerDoc = await db.collection('customers').doc(customerId).get();

  if (!customerDoc.exists) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Customer Tidak Ditemukan</h1>
          <p className="text-gray-500 text-sm">Terjadi kesalahan. Hubungi counter Khaf terdekat.</p>
        </div>
      </div>
    );
  }

  const customer = customerDoc.data()!;

  // If no session, redirect to login with hint
  if (!sessionCookie) {
    redirect(`/login?qr=${token}&hint=${encodeURIComponent(maskName(customer.fullName))}`);
  }

  // Verify session
  let decodedToken;
  try {
    decodedToken = await adminAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    redirect(`/login?qr=${token}&hint=${encodeURIComponent(maskName(customer.fullName))}`);
  }

  const callerRole = decodedToken.role as string;
  const callerUid = decodedToken.uid;

  // BA/Admin → go to customer profile
  if (['ba', 'admin_region', 'super_admin'].includes(callerRole)) {
    redirect(`/ba/customers/${customerId}`);
  }

  // Customer owner → go to their passport
  if (callerUid === customer.uid) {
    redirect('/passport');
  }

  // Other customer viewing someone else's QR
  redirect(`/login?qr=${token}&hint=${encodeURIComponent(maskName(customer.fullName))}`);
}
