import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { normalizePhone } from '@/lib/utils';

/**
 * POST /api/auth/verify-otp
 * Verify WhatsApp OTP and return a Firebase custom token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, otp } = body;

    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Nomor HP dan OTP wajib diisi' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);
    const otpRef = adminDb().collection('_otpChallenges').doc(normalizedPhone);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return NextResponse.json(
        { error: 'OTP tidak ditemukan atau sudah kedaluwarsa' },
        { status: 400 }
      );
    }

    const data = otpDoc.data()!;

    // Check expiry
    if (Date.now() > data.expiresAt) {
      await otpRef.delete();
      return NextResponse.json({ error: 'OTP sudah kedaluwarsa' }, { status: 400 });
    }

    // Check attempts (max 3)
    if (data.attempts >= 3) {
      await otpRef.delete();
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Minta OTP baru.' },
        { status: 429 }
      );
    }

    // Verify OTP
    if (data.otp !== otp) {
      await otpRef.update({ attempts: FieldValue.increment(1) });
      return NextResponse.json({ error: 'OTP tidak valid' }, { status: 400 });
    }

    // OTP valid — delete challenge
    await otpRef.delete();

    // Find or create user by phone
    let uid: string;
    try {
      const existingUser = await adminAuth().getUserByPhoneNumber(normalizedPhone);
      uid = existingUser.uid;
    } catch {
      // User doesn't exist, create one
      const newUser = await adminAuth().createUser({
        phoneNumber: normalizedPhone,
        displayName: normalizedPhone,
      });
      uid = newUser.uid;

      // Set default role as customer
      await adminAuth().setCustomUserClaims(uid, { role: 'customer' });

      // Create user document
      await adminDb().collection('users').doc(uid).set({
        uid,
        phone: normalizedPhone,
        role: 'customer',
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp(),
      });
    }

    // Update last login
    await adminDb()
      .collection('users')
      .doc(uid)
      .update({ lastLoginAt: FieldValue.serverTimestamp() });

    // Create Firebase custom token for client sign-in
    const customToken = await adminAuth().createCustomToken(uid);

    return NextResponse.json({ success: true, customToken, uid });
  } catch (error) {
    console.error('[verify-otp]', error);
    return NextResponse.json({ error: 'Verifikasi OTP gagal' }, { status: 500 });
  }
}
