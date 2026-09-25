'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import Link from 'next/link';
import { formatDate, formatIDR } from '@/lib/utils';
import type { DailyBaSummary } from '@/types';

interface BaEntry {
  uid: string;
  name: string;
  storeId: string;
  orders: number;
  sales: number;
  isActive: boolean;
}

export default function AdminBaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [baList, setBaList] = useState<BaEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/'); return;
    }
    if (!loading && user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    try {
      // Get BA profiles
      const baProfilesSnap = await getDocs(collection(db, 'baProfiles'));
      const profiles = baProfilesSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

      // Get today's BA summaries
      const today = new Date().toISOString().slice(0, 10);
      const summariesSnap = await getDocs(
        query(collection(db, 'dailyBaSummary'), where('date', '==', today))
      );
      const summaryMap = new Map<string, { orders: number; sales: number; baName: string }>();
      summariesSnap.docs.forEach(d => {
        const data = d.data() as DailyBaSummary;
        summaryMap.set(data.baId, { orders: data.orders, sales: data.sales, baName: data.baName });
      });

      const entries: BaEntry[] = profiles.map(profile => {
        const p = profile as Record<string, any>;
        const summary = summaryMap.get(p.uid as string);
        return {
          uid: p.uid as string,
          name: summary?.baName ?? p.uid as string,
          storeId: p.storeId as string,
          orders: summary?.orders ?? 0,
          sales: summary?.sales ?? 0,
          isActive: (p.isActive as boolean) ?? true,
        };
      });

      setBaList(entries.sort((a, b) => b.sales - a.sales));
    } finally {
      setDataLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="gradient-hero px-6 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-white/80 hover:text-white">←</Link>
          <h1 className="text-xl font-bold text-white">Brand Ambassador</h1>
        </div>
        <p className="text-white/60 text-sm mt-1 ml-8">Performa hari ini</p>
      </div>

      <div className="px-6 -mt-4 pb-8 space-y-3">
        {dataLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
          </div>
        ) : baList.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
            <p className="text-4xl mb-2">👩‍💼</p>
            <p className="text-gray-500">Belum ada Brand Ambassador</p>
          </div>
        ) : (
          baList.map((ba, i) => (
            <div key={ba.uid} className="bg-white rounded-3xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-yellow-400 text-white' :
                  i === 1 ? 'bg-gray-300 text-white' :
                  i === 2 ? 'bg-amber-600 text-white' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {i + 1}
                </div>
                <div className="w-12 h-12 rounded-2xl gradient-hero flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {ba.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{ba.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{ba.uid.slice(0, 12)}...</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-purple-700 text-sm">{formatIDR(ba.sales)}</p>
                  <p className="text-xs text-gray-400">{ba.orders} transaksi</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
