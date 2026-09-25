import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { POINTS_PER_IDR, TIER_THRESHOLDS, type LoyaltyTier } from '@/types';

function calculateTier(totalPoints: number): LoyaltyTier {
  if (totalPoints >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (totalPoints >= TIER_THRESHOLDS.gold) return 'gold';
  if (totalPoints >= TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
}

/**
 * POST /api/loyalty/earn — Award points after a purchase
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }
    const decodedToken = await adminAuth().verifyIdToken(authorization.split('Bearer ')[1]);

    const body = await request.json();
    const { customerId, purchaseId, totalAmount } = body;
    if (!customerId || !totalAmount) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const db = adminDb();
    const pointsEarned = Math.floor(totalAmount / POINTS_PER_IDR);
    if (pointsEarned <= 0) {
      return NextResponse.json({ success: true, pointsEarned: 0 });
    }

    const accountRef = db.collection('loyaltyAccounts').doc(customerId);

    await db.runTransaction(async (tx) => {
      const accountDoc = await tx.get(accountRef);
      
      let currentPoints = 0;
      let totalEarned = 0;
      let totalRedeemed = 0;

      if (accountDoc.exists) {
        const data = accountDoc.data()!;
        currentPoints = data.currentPoints ?? 0;
        totalEarned = data.totalEarnedPoints ?? 0;
        totalRedeemed = data.totalRedeemedPoints ?? 0;
      }

      const newBalance = currentPoints + pointsEarned;
      const newTotalEarned = totalEarned + pointsEarned;
      const newTier = calculateTier(newTotalEarned);

      // Update or create account
      tx.set(accountRef, {
        customerId,
        currentPoints: newBalance,
        totalEarnedPoints: newTotalEarned,
        totalRedeemedPoints: totalRedeemed,
        tier: newTier,
        tierUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(accountDoc.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      }, { merge: true });

      // Write ledger entry
      const ledgerRef = db.collection('loyaltyLedgers').doc();
      tx.set(ledgerRef, {
        customerId,
        type: 'earn',
        points: pointsEarned,
        balance: newBalance,
        description: `Poin dari pembelian Rp ${totalAmount.toLocaleString('id-ID')}`,
        referenceType: 'purchase',
        referenceId: purchaseId ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true, pointsEarned });
  } catch (error) {
    console.error('[loyalty/earn]', error);
    return NextResponse.json({ error: 'Gagal menambah poin' }, { status: 500 });
  }
}
