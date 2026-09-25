import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { nanoid } from 'nanoid';
import { normalizePhone } from '@/lib/utils';

// Generate ULID-like ID
function generateId() {
  return nanoid(26).toUpperCase();
}

function generateMemberNo() {
  const prefix = 'KHF';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * POST /api/customers/register
 * Register a new customer after OTP verification.
 * Checks if an unclaimed customer doc already exists for this phone.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Firebase ID token
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const body = await request.json();
    const { fullName, birthDate, gender, city, consentVersion, password, phone } = body;

    const phoneNumber = phone;
    
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Nomor HP wajib diisi' }, { status: 400 });
    }

    if (!fullName) {
      return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password wajib diisi' }, { status: 400 });
    }

    const db = adminDb();

    // Check if unclaimed customer exists with this phone
    const existingQuery = await db
      .collection('customers')
      .where('phone', '==', phoneNumber)
      .where('status', '==', 'unclaimed')
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      // Claim existing customer document
      const customerDoc = existingQuery.docs[0];
      const customerId = customerDoc.id;

      await db.runTransaction(async (tx) => {
        tx.update(customerDoc.ref, {
          uid,
          fullName,
          birthDate: birthDate ?? null,
          gender: gender ?? null,
          city: city ?? null,
          status: 'active',
          claimedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Record consent
        const consentRef = db.collection('customerConsents').doc();
        tx.set(consentRef, {
          customerId,
          type: 'data_processing',
          version: consentVersion ?? '1.0',
          grantedAt: FieldValue.serverTimestamp(),
          channel: 'self_register',
        });
      });

      return NextResponse.json({ success: true, customerId, action: 'claimed' });
    }

    // Create new customer document
    const customerId = generateId();
    const qrToken = nanoid(32);
    const memberNo = generateMemberNo();

    await db.runTransaction(async (tx) => {
      const customerRef = db.collection('customers').doc(customerId);
      tx.set(customerRef, {
        id: customerId,
        publicId: customerId.slice(0, 8).toLowerCase(),
        uid,
        fullName,
        phone: phoneNumber,
        birthDate: birthDate ?? null,
        gender: gender ?? null,
        city: city ?? null,
        regionId: null,
        memberNo,
        registeredByBaId: null,
        registeredStoreId: null,
        status: 'active',
        claimedAt: FieldValue.serverTimestamp(),
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

      const consentRef = db.collection('customerConsents').doc();
      tx.set(consentRef, {
        customerId,
        type: 'data_processing',
        version: consentVersion ?? '1.0',
        grantedAt: FieldValue.serverTimestamp(),
        channel: 'self_register',
      });
    });

    // Set role claim and password/email for login
    const email = `${phoneNumber.replace('+', '')}@kahf.id`;
    await adminAuth().updateUser(uid, {
      email,
      password,
    }).catch(err => {
      console.warn('Failed to set email/password (might already exist):', err);
    });

    await adminAuth().setCustomUserClaims(uid, { role: 'customer' });

    return NextResponse.json({ success: true, customerId, action: 'created' });
  } catch (error) {
    console.error('[customer-register]', error);
    return NextResponse.json({ error: 'Gagal mendaftarkan customer' }, { status: 500 });
  }
}
