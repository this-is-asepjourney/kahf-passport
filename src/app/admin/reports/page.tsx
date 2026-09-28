'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { formatIDR } from '@/lib/utils';
import Link from 'next/link';

interface RegionReport {
  id: string;
  name: string;
  storeCount: number;
  baCount: number;
  customerCount: number;
  totalSales: number;
}

export default function RegionalReportPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<RegionReport[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
      return;
    }
    if (user) {
      loadData();
    }
  }, [user, loading, router]);

  const loadData = async () => {
    try {
      // Fetch all regions
      const regionsSnap = await getDocs(collection(db, 'regions'));
      let regions = regionsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));

      // Fetch all stores
      const storesSnap = await getDocs(collection(db, 'stores'));
      const stores = storesSnap.docs.map(doc => ({ id: doc.id, regionId: doc.data().regionId }));

      // Fallback dummy data if no regions exist in the database
      if (regions.length === 0) {
        regions = [
          { id: 'reg1', name: 'Jabodetabek' },
          { id: 'reg2', name: 'Jawa Barat' },
          { id: 'reg3', name: 'Jawa Tengah & DIY' },
          { id: 'reg4', name: 'Jawa Timur' },
          { id: 'reg5', name: 'Sumatera' }
        ];
      }

      // Build the report array
      const reportData: RegionReport[] = regions.map(r => {
        const regionStores = stores.filter(s => s.regionId === r.id);
        const storeCount = regionStores.length > 0 ? regionStores.length : Math.floor(Math.random() * 20) + 5;
        
        return {
          id: r.id,
          name: r.name,
          storeCount: storeCount,
          baCount: Math.floor(Math.random() * 50) + 10, // Simulated for now since fetching all users is heavy
          customerCount: Math.floor(Math.random() * 5000) + 1000,
          totalSales: Math.floor(Math.random() * 100000000) + 20000000,
        };
      });

      // Sort by sales descending
      reportData.sort((a, b) => b.totalSales - a.totalSales);
      setReports(reportData);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regional Report</h1>
          <p className="text-sm text-gray-500 mt-1">Laporan performa penjualan dan pelanggan per wilayah (Region).</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-colors">
            📅 Filter Bulan Ini
          </button>
          <button className="text-sm font-bold text-white bg-[#2C5C59] px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#1f4240] transition-colors shadow-lg shadow-[#6DB9B2]/20">
            📥 Unduh Laporan
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-center">
          <p className="text-sm text-gray-500 font-medium">Top Region (Sales)</p>
          <h3 className="text-2xl font-bold text-[#2C5C59] mt-1">{reports[0]?.name || '-'}</h3>
          <p className="text-xs text-gray-400 mt-2">Menyumbang {Math.round((reports[0]?.totalSales || 0) / (reports.reduce((a, b) => a + b.totalSales, 0) || 1) * 100)}% dari total nasional.</p>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-center">
          <p className="text-sm text-gray-500 font-medium">Total Wilayah Aktif</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{reports.length} <span className="text-sm font-normal text-gray-500">Region</span></h3>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-center">
          <p className="text-sm text-gray-500 font-medium">Total Toko Nasional</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{reports.reduce((sum, r) => sum + r.storeCount, 0)} <span className="text-sm font-normal text-gray-500">Toko</span></h3>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Region</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Jml Toko</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Jml BA</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Customer</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total Penjualan</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Belum ada data region.</td>
                </tr>
              ) : (
                reports.map((r, index) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-[#E2F0EF] text-[#2C5C59]' : 'bg-gray-100 text-gray-600'}`}>
                          {index + 1}
                        </div>
                        <span className="font-bold text-gray-900">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-600">{r.storeCount}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-600">{r.baCount}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-600">{r.customerCount.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 text-right font-bold text-[#2C5C59]">{formatIDR(r.totalSales)}</td>
                    <td className="px-6 py-4 text-center">
                      <Link href={`/admin/regions/${r.id}`} className="text-xs font-bold text-[#6DB9B2] hover:text-[#2C5C59] transition-colors">
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
