import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/loyalty/redeem — Redeem points for a reward
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }
    const decodedToken = await adminAuth().verifyIdToken(authorization.split('Bearer ')[1]);

    const body = await request.json();
    const { customerId, rewardId } = body;
    if (!customerId || !rewardId) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const db = adminDb();
    const [accountDoc, rewardDoc, customerDoc] = await Promise.all([
      db.collection('loyaltyAccounts').doc(customerId).get(),
      db.collection('rewards').doc(rewardId).get(),
      db.collection('customers').doc(customerId).get(),
    ]);

    if (!accountDoc.exists) {
      return NextResponse.json({ error: 'Akun loyalty tidak ditemukan' }, { status: 404 });
    }
    if (!rewardDoc.exists) {
      return NextResponse.json({ error: 'Reward tidak ditemukan' }, { status: 404 });
    }

    const account = accountDoc.data()!;
    const reward = rewardDoc.data()!;
    const customer = customerDoc.data()!;

    if (!reward.isActive || reward.stock <= 0) {
      return NextResponse.json({ error: 'Reward tidak tersedia' }, { status: 400 });
    }
    if (account.currentPoints < reward.pointsCost) {
      return NextResponse.json({ error: `Poin tidak cukup. Butuh ${reward.pointsCost}, tersedia ${account.currentPoints}` }, { status: 400 });
    }

    const newBalance = account.currentPoints - reward.pointsCost;

    await db.runTransaction(async (tx) => {
      // Deduct points
      tx.update(db.collection('loyaltyAccounts').doc(customerId), {
        currentPoints: newBalance,
        totalRedeemedPoints: FieldValue.increment(reward.pointsCost),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Decrement reward stock
      tx.update(db.collection('rewards').doc(rewardId), {
        stock: FieldValue.increment(-1),
      });

      // Write ledger
      const ledgerRef = db.collection('loyaltyLedgers').doc();
      tx.set(ledgerRef, {
        customerId,
        type: 'redeem',
        points: -reward.pointsCost,
        balance: newBalance,
        description: `Tukar reward: ${reward.name}`,
        referenceType: 'reward',
        referenceId: rewardId,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Write redemption record
      const redemptionRef = db.collection('rewardRedemptions').doc();
      tx.set(redemptionRef, {
        customerId,
        customerNameSnapshot: customer?.fullName ?? '',
        rewardId,
        rewardNameSnapshot: reward.name,
        pointsSpent: reward.pointsCost,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true, newBalance });
  } catch (error) {
    console.error('[loyalty/redeem]', error);
    return NextResponse.json({ error: 'Gagal menukar reward' }, { status: 500 });
  }
}
