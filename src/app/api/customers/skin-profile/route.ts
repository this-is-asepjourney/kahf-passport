import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/customers/skin-profile
 * Allows customer to fill out their own skin profile for the first time
 * and awards them loyalty points (e.g., 50 points).
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
    const role = decodedToken.role;

    if (role !== 'customer') {
      return NextResponse.json({ error: 'Hanya customer yang bisa mengisi ini' }, { status: 403 });
    }

    const body = await request.json();
    const { skinType, concerns, preferences } = body;

    if (!skinType) {
      return NextResponse.json({ error: 'Jenis kulit wajib diisi' }, { status: 400 });
    }

    const db = adminDb();

    // Get customer ID
    const custQ = await db.collection('customers').where('uid', '==', uid).limit(1).get();
    if (custQ.empty) {
      return NextResponse.json({ error: 'Customer tidak ditemukan' }, { status: 404 });
    }
    const customerId = custQ.docs[0].id;
    const customerName = custQ.docs[0].data().fullName;

    // Check if skin profile already exists
    const profileRef = db.collection('skinProfiles').doc(customerId);
    const profileDoc = await profileRef.get();
    
    const isFirstTime = !profileDoc.exists;

    await db.runTransaction(async (tx) => {
      // 1. Save Skin Profile
      tx.set(profileRef, {
        customerId,
        skinType,
        concerns: concerns || [],
        preferences: preferences || [],
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'customer',
      }, { merge: true });

      // 2. Award Points if First Time
      if (isFirstTime) {
        const bonusPoints = 50;

        // Add Ledger
        const ledgerRef = db.collection('loyaltyLedgers').doc();
        tx.set(ledgerRef, {
          customerId,
          points: bonusPoints,
          type: 'earn',
          source: 'skin_profile',
          description: 'Bonus melengkapi Skin Profile',
          createdAt: FieldValue.serverTimestamp(),
        });

        // Update Loyalty Account
        const accRef = db.collection('loyaltyAccounts').doc(customerId);
        const accDoc = await tx.get(accRef);
        
        let newTotal = bonusPoints;
        if (accDoc.exists) {
          newTotal = (accDoc.data()?.points || 0) + bonusPoints;
          tx.update(accRef, {
            points: FieldValue.increment(bonusPoints),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          tx.set(accRef, {
            customerId,
            customerNameSnapshot: customerName,
            points: bonusPoints,
            tier: 'Bronze',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // Update Tier based on new total
        let tier = 'Bronze';
        if (newTotal >= 5000) tier = 'Platinum';
        else if (newTotal >= 1500) tier = 'Gold';
        else if (newTotal >= 500) tier = 'Silver';

        if (accDoc.exists && accDoc.data()?.tier !== tier) {
          tx.update(accRef, { tier });
        } else if (!accDoc.exists) {
          tx.set(accRef, { tier }, { merge: true });
        }
      }
    });

    return NextResponse.json({ success: true, message: 'Skin profile disimpan', awardedPoints: isFirstTime ? 50 : 0 });
  } catch (error) {
    console.error('[customer-skin-profile]', error);
    return NextResponse.json({ error: 'Gagal menyimpan skin profile' }, { status: 500 });
  }
}
