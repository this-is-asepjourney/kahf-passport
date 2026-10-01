'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import Link from 'next/link';
import { formatIDR } from '@/lib/utils';
import type { Purchase, Store } from '@/types';

interface BaEntry {
  uid: string;
  name: string;
  employeeCode?: string;
  storeId?: string;
  storeName?: string;
  orders: number;
  sales: number;
  isActive: boolean;
}

type PeriodFilter = 'today' | '7days' | 'month' | '30days' | 'all';

export default function AdminBaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [baList, setBaList] = useState<BaEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [search, setSearch] = useState('');

  // Raw data from Firestore
  const [rawProfiles, setRawProfiles] = useState<any[]>([]);
  const [rawPurchases, setRawPurchases] = useState<Purchase[]>([]);
  const [rawStores, setRawStores] = useState<Store[]>([]);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/'); return;
    }
    if (!loading && user) loadData();
  }, [user, loading, router]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      // Fetch all required data in parallel for zero delay
      const [baProfilesSnap, usersSnap, storesSnap, purchasesSnap] = await Promise.all([
        getDocs(collection(db, 'baProfiles')),
        getDocs(query(collection(db, 'users'), where('role', '==', 'ba'))),
        getDocs(collection(db, 'stores')),
        getDocs(collection(db, 'purchases')),
      ]);

      const profiles = baProfilesSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setRawProfiles(profiles);

      const userMap = new Map<string, string>();
      usersSnap.docs.forEach(d => {
        const u = d.data();
        userMap.set(d.id, u.name || u.displayName || u.email || d.id);
      });

      const stores = storesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Store[];
      setRawStores(stores);

      const purchases = purchasesSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        purchasedAt: d.data().purchasedAt?.toDate?.()?.toISOString() ?? d.data().purchasedAt,
      })) as Purchase[];
      setRawPurchases(purchases);

    } catch (err) {
      console.error('Failed to load BA performance data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  // Compute BA performance based on active period filter
  const computedBaList = useMemo<BaEntry[]>(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    // Filter purchases by period
    const filteredPurchases = rawPurchases.filter(p => {
      if (p.status !== 'valid') return false;
      const pTime = new Date(p.purchasedAt).getTime();
      const pDate = new Date(p.purchasedAt);

      if (period === 'today') return pTime >= todayStart;
      if (period === '7days') return pTime >= sevenDaysAgo;
      if (period === '30days') return pTime >= thirtyDaysAgo;
      if (period === 'month') return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
      return true; // 'all'
    });

    // Map store ID to store name
    const storeMap = new Map<string, string>();
    rawStores.forEach(s => storeMap.set(s.id, s.name));

    // Aggregate orders & sales per baId
    const baAggMap = new Map<string, { orders: number; sales: number; baNameSnapshot?: string }>();
    filteredPurchases.forEach(p => {
      if (!p.baId) return;
      const existing = baAggMap.get(p.baId) || { orders: 0, sales: 0, baNameSnapshot: p.baNameSnapshot };
      existing.orders += 1;
      existing.sales += p.totalAmount || 0;
      if (p.baNameSnapshot) existing.baNameSnapshot = p.baNameSnapshot;
      baAggMap.set(p.baId, existing);
    });

    // Merge with raw BA profiles
    const entries: BaEntry[] = rawProfiles.map(p => {
      const agg = baAggMap.get(p.uid);
      return {
        uid: p.uid,
        name: agg?.baNameSnapshot || p.name || `BA-${p.employeeCode || p.uid.slice(0, 5)}`,
        employeeCode: p.employeeCode,
        storeId: p.storeId,
        storeName: p.storeId ? storeMap.get(p.storeId) || p.storeId : '-',
        orders: agg?.orders || 0,
        sales: agg?.sales || 0,
        isActive: p.isActive !== false,
      };
    });

    // Sort by sales descending
    entries.sort((a, b) => b.sales - a.sales);

    // Apply search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      return entries.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.employeeCode && e.employeeCode.toLowerCase().includes(q)) ||
        (e.storeName && e.storeName.toLowerCase().includes(q))
      );
    }

    return entries;
  }, [rawProfiles, rawPurchases, rawStores, period, search]);

  const totalSales = computedBaList.reduce((sum, b) => sum + b.sales, 0);
  const totalOrders = computedBaList.reduce((sum, b) => sum + b.orders, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 bg-white rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              ←
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">BA Performance</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1 ml-11">
            Monitoring performa penjualan dan aktivitas Beauty Advisor di seluruh toko.
          </p>
        </div>

        {user?.role === 'super_admin' && (
          <Link
            href="/admin/users"
            className="px-4 py-2.5 bg-[#2C5C59] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#6DB9B2]/20 hover:bg-[#1f4240] transition-colors flex items-center gap-2"
          >
            ➕ Kelola Akses BA
          </Link>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Total Beauty Advisor</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{rawProfiles.length} BA</h3>
          <p className="text-[11px] text-[#2C5C59] font-semibold mt-1">
            {rawProfiles.filter(p => p.isActive !== false).length} aktif bertugas
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Total Transaksi ({period})</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{totalOrders.toLocaleString('id-ID')}</h3>
          <p className="text-[11px] text-gray-400 mt-1">Transaksi terverifikasi</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Total Omset Penjualan BA</p>
          <h3 className="text-2xl font-bold text-[#2C5C59] mt-1">{formatIDR(totalSales)}</h3>
          <p className="text-[11px] text-gray-400 mt-1">Akumulasi sesuai periode terpilih</p>
        </div>
      </div>

      {/* Table & Filters Card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        
        {/* Controls */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/40">
          {/* Period Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            <span className="text-xs font-bold text-gray-500 mr-1">Periode:</span>
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: '7days', label: '7 Hari' },
              { id: 'month', label: 'Bulan Ini' },
              { id: '30days', label: '30 Hari' },
              { id: 'all', label: 'Semua' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as PeriodFilter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  period === p.id
                    ? 'bg-[#2C5C59] text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama BA / kode / toko..."
              className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6DB9B2]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {dataLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
            </div>
          ) : computedBaList.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Belum ada data Beauty Advisor yang cocok.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Peringkat & BA</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Penempatan Toko</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Pesanan</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Penjualan</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {computedBaList.map((ba, idx) => (
                  <tr key={ba.uid} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-[#E2F0EF] text-[#2C5C59] border border-[#6DB9B2]/30' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{ba.name}</p>
                          <p className="text-[10px] text-gray-400">Kode: {ba.employeeCode || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-gray-700 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                        🏬 {ba.storeName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-800 text-sm">
                      {ba.orders.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-[#2C5C59] text-sm">
                      {formatIDR(ba.sales)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        ba.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {ba.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

    </div>
  );
}
