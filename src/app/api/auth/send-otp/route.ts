import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { nanoid } from 'nanoid';
import { normalizePhone } from '@/lib/utils';

/**
 * POST /api/auth/send-otp
 * Send WhatsApp OTP via Fonnte gateway
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Nomor HP wajib diisi' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store OTP in Firestore (temp collection)
    const otpRef = adminDb().collection('_otpChallenges').doc(normalizedPhone);
    await otpRef.set({
      otp,
      expiresAt,
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
    });

    const gatewayUrl = process.env.WHATSAPP_GATEWAY_URL;
    const token = process.env.WHATSAPP_GATEWAY_TOKEN;

    const message = `Kode OTP Khaf Passport Anda: *${otp}*\n\nBerlaku 5 menit. Jangan bagikan kode ini ke siapapun.`;

    if (gatewayUrl && token) {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: normalizedPhone,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error('WhatsApp gateway error');
      }
    } else {
      console.log('\n======================================');
      console.log(`[MOCK OTP] Dikirim ke ${normalizedPhone}`);
      console.log(`KODE OTP: ${otp}`);
      console.log('======================================\n');
    }

    return NextResponse.json({ success: true, message: 'OTP dikirim via WhatsApp' });
  } catch (error) {
    console.error('[send-otp]', error);
    return NextResponse.json({ error: 'Gagal mengirim OTP' }, { status: 500 });
  }
}
