'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { LoyaltyAccount, LoyaltyLedger, Reward, LoyaltyTier } from '@/types';
import { formatIDR } from '@/lib/utils';

const TIER_COLORS: Record<LoyaltyTier, { bg: string; text: string; border: string; icon: string }> = {
  bronze: { bg: 'bg-[#F5E6D3]', text: 'text-[#8B6914]', border: 'border-[#D4A574]', icon: '🥉' },
  silver: { bg: 'bg-[#E8E8E8]', text: 'text-[#606060]', border: 'border-[#C0C0C0]', icon: '🥈' },
  gold: { bg: 'bg-gradient-to-r from-[#F7E7CD] to-[#EBD3A9]', text: 'text-[#8C6D23]', border: 'border-[#E1C591]', icon: '⭐' },
  platinum: { bg: 'bg-gradient-to-r from-[#E2E8F0] to-[#CBD5E1]', text: 'text-[#334155]', border: 'border-[#94A3B8]', icon: '💎' },
};

const TIER_LABELS: Record<LoyaltyTier, string> = {
  bronze: 'Member Bronze', silver: 'Member Silver', gold: 'Member Gold', platinum: 'Member Platinum',
};

export default function LoyaltyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [ledger, setLedger] = useState<LoyaltyLedger[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [tab, setTab] = useState<'rewards' | 'history'>('rewards');

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    if (!user) return;
    try {
      const custQ = query(collection(db, 'customers'), where('uid', '==', user.uid));
      const custSnap = await getDocs(custQ);
      if (custSnap.empty) return;
      const cId = custSnap.docs[0].id;
      setCustomerId(cId);

      // Get loyalty account
      const accountDoc = await getDoc(doc(db, 'loyaltyAccounts', cId));
      if (accountDoc.exists()) {
        setAccount({ id: accountDoc.id, ...accountDoc.data() } as LoyaltyAccount);
      }

      // Get ledger
      const ledgerQ = query(
        collection(db, 'loyaltyLedgers'),
        where('customerId', '==', cId),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const ledgerSnap = await getDocs(ledgerQ);
      setLedger(ledgerSnap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? d.data().createdAt,
      })) as LoyaltyLedger[]);

      // Get available rewards
      const rewardsQ = query(collection(db, 'rewards'), where('isActive', '==', true));
      const rewardsSnap = await getDocs(rewardsQ);
      setRewards(rewardsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Reward[]);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleRedeem = async (rewardId: string) => {
    if (!customerId) return;
    setRedeeming(rewardId);
    try {
      const idToken = await (await import('firebase/auth')).getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ customerId, rewardId }),
      });
      const result = await res.json();
      if (res.ok) {
        alert('Berhasil menukar reward! 🎉');
        loadData();
      } else {
        alert(result.error ?? 'Gagal menukar');
      }
    } finally {
      setRedeeming(null);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-4 border-[#E8C5C8] border-t-[#6DB9B2] animate-spin" />
      </div>
    );
  }

  const tier = account?.tier ?? 'bronze';
  const tierStyle = TIER_COLORS[tier];

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 relative">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#E8C5C8] rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      </div>

      {/* Header */}
      <div className="px-6 pt-12 pb-6 z-10 relative bg-white/50 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Link href="/passport" className="text-[#2C5C59] p-2 -ml-2 rounded-full hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 className="text-xl font-bold text-[#2C5C59]">Loyalty & Reward</h1>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 z-10 relative">
        {/* Tier & Points Card */}
        <div className={`rounded-3xl p-6 shadow-sm border ${tierStyle.border} ${tierStyle.bg}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{tierStyle.icon}</span>
              <div>
                <p className={`font-bold text-lg ${tierStyle.text}`}>{TIER_LABELS[tier]}</p>
                <p className={`text-sm ${tierStyle.text} opacity-70`}>Total poin dikumpulkan: {account?.totalEarnedPoints ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/60 rounded-2xl p-4 text-center backdrop-blur-sm">
            <p className="text-sm text-gray-500 mb-1">Poin Tersedia</p>
            <p className="text-4xl font-bold text-[#2C5C59]">{account?.currentPoints ?? 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl bg-white shadow-sm overflow-hidden border border-gray-100">
          <button
            onClick={() => setTab('rewards')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'rewards' ? 'bg-[#6DB9B2] text-white' : 'text-gray-500'}`}
          >
            🎁 Tukar Reward
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'history' ? 'bg-[#6DB9B2] text-white' : 'text-gray-500'}`}
          >
            📜 Riwayat Poin
          </button>
        </div>

        {/* Rewards */}
        {tab === 'rewards' && (
          <div className="space-y-3">
            {rewards.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
                <p className="text-4xl mb-2">🎁</p>
                <p className="text-sm text-gray-500">Belum ada reward tersedia</p>
              </div>
            ) : (
              rewards.map((reward) => (
                <div key={reward.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#FDF4E1] flex items-center justify-center text-2xl flex-shrink-0">
                      🎁
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#2C5C59]">{reward.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{reward.description}</p>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-sm font-bold text-[#6DB9B2]">{reward.pointsCost} Poin</p>
                        <button
                          onClick={() => handleRedeem(reward.id)}
                          disabled={redeeming === reward.id || (account?.currentPoints ?? 0) < reward.pointsCost}
                          className="px-4 py-2 bg-[#6DB9B2] text-white text-xs font-semibold rounded-full disabled:opacity-40 hover:bg-[#5AA9A2] transition-colors"
                        >
                          {redeeming === reward.id ? '...' : 'Tukar'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* History */}
        {tab === 'history' && (
          <div className="space-y-3">
            {ledger.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
                <p className="text-4xl mb-2">📜</p>
                <p className="text-sm text-gray-500">Belum ada riwayat poin</p>
              </div>
            ) : (
              ledger.map((entry) => (
                <div key={entry.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${entry.type === 'earn' ? 'bg-[#E2F0EF] text-[#6DB9B2]' : 'bg-[#FAEBEC] text-[#D88C95]'}`}>
                    {entry.type === 'earn' ? '＋' : '−'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2C5C59] truncate">{entry.description}</p>
                    <p className="text-[10px] text-gray-400">{new Date(entry.createdAt).toLocaleDateString('id-ID')}</p>
                  </div>
                  <p className={`text-sm font-bold ${entry.points > 0 ? 'text-[#6DB9B2]' : 'text-[#D88C95]'}`}>
                    {entry.points > 0 ? '+' : ''}{entry.points}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
