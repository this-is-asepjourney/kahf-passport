'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { formatCompact, formatIDR } from '@/lib/utils';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
      return;
    }
    if (!loading) {
      // Simulate data loading
      setTimeout(() => setDataLoading(false), 500);
    }
  }, [user, loading, router]);

  if (loading || dataLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">National Dashboard</h1>
          <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
            1 Jan 2025 – 30 Apr 2025
          </span>
        </div>
        <div>
          <button className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-colors">
            Seluruh Indonesia <span className="text-gray-400 text-xs">▼</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#E2F0EF] text-[#2C5C59] flex items-center justify-center text-xl shrink-0">👥</div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Customer</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-0.5">125.680</h3>
            <p className="text-[10px] text-[#2C5C59] font-bold mt-1">+16% dari periode lalu</p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xl shrink-0">👩‍💼</div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Customer Baru</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-0.5">42.317</h3>
            <p className="text-[10px] text-[#2C5C59] font-bold mt-1">+32% dari periode lalu</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-xl shrink-0">🔄</div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Repeat Customer</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-0.5">38.921</h3>
            <p className="text-[10px] text-[#2C5C59] font-bold mt-1">+15% dari periode lalu</p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">✨</div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Customer Aktif</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-0.5">87.203</h3>
            <p className="text-[10px] text-[#2C5C59] font-bold mt-1">+10% dari periode lalu</p>
          </div>
        </div>
      </div>

      {/* Main Grid (4 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Customer Insight */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:col-span-1">
          <h2 className="font-bold text-gray-900 mb-6 text-sm">Customer Insight</h2>
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="relative w-40 h-40">
              {/* Custom SVG Donut Chart */}
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <path className="text-gray-100" strokeWidth="6" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-[#6DB9B2]" strokeWidth="6" strokeDasharray="34, 100" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-pink-400" strokeWidth="6" strokeDasharray="21, 100" strokeDashoffset="-34" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-blue-400" strokeWidth="6" strokeDasharray="22, 100" strokeDashoffset="-55" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-gray-300" strokeWidth="6" strokeDasharray="13, 100" strokeDashoffset="-77" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-lg font-bold text-gray-900">125.680</p>
                <p className="text-[9px] text-gray-500 uppercase font-bold">Total Customer</p>
              </div>
            </div>
            
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#6DB9B2]" /> <span className="text-gray-600">Customer Baru</span></div>
                <span className="text-gray-900 font-bold">34%</span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-pink-400" /> <span className="text-gray-600">Returning Customer</span></div>
                <span className="text-gray-900 font-bold">21%</span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-400" /> <span className="text-gray-600">Customer Aktif</span></div>
                <span className="text-gray-900 font-bold">22%</span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-gray-300" /> <span className="text-gray-600">Tidak Aktif</span></div>
                <span className="text-gray-900 font-bold">13%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Insight */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:col-span-1">
          <h2 className="font-bold text-gray-900 mb-2 text-sm">Product Insight</h2>
          <p className="text-[10px] text-gray-500 mb-6 font-medium">Top 5 Produk Paling Direkomendasikan</p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 w-24 truncate font-medium">1. Acnederm Series</span>
              <div className="flex-1 mx-3 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#6DB9B2] rounded-full" style={{ width: '28%' }} /></div>
              <span className="font-bold text-gray-900 w-6 text-right">28%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 w-24 truncate font-medium">2. Lightening Series</span>
              <div className="flex-1 mx-3 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#6DB9B2] opacity-80 rounded-full" style={{ width: '22%' }} /></div>
              <span className="font-bold text-gray-900 w-6 text-right">22%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 w-24 truncate font-medium">3. Colorfit</span>
              <div className="flex-1 mx-3 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#6DB9B2] opacity-60 rounded-full" style={{ width: '18%' }} /></div>
              <span className="font-bold text-gray-900 w-6 text-right">18%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 w-24 truncate font-medium">4. UV Shield</span>
              <div className="flex-1 mx-3 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#6DB9B2] opacity-50 rounded-full" style={{ width: '12%' }} /></div>
              <span className="font-bold text-gray-900 w-6 text-right">12%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 w-24 truncate font-medium">5. Velvet Matte</span>
              <div className="flex-1 mx-3 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#6DB9B2] opacity-40 rounded-full" style={{ width: '10%' }} /></div>
              <span className="font-bold text-gray-900 w-6 text-right">10%</span>
            </div>
          </div>
        </div>

        {/* BA Performance */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:col-span-1">
          <h2 className="font-bold text-gray-900 mb-6 text-sm">BA Performance</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">E</div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Total Konsultasi</p>
                  <p className="font-bold text-gray-900 text-sm">10.742 <span className="text-[10px] text-green-500 ml-1">+10%</span></p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-sm font-bold">R</div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Follow Up</p>
                  <p className="font-bold text-gray-900 text-sm">12.489 <span className="text-[10px] text-green-500 ml-1">+15%</span></p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E2F0EF] text-[#2C5C59] flex items-center justify-center text-sm font-bold">C</div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Conversion Rate</p>
                  <p className="font-bold text-gray-900 text-sm">68% <span className="text-[10px] text-green-500 ml-1">+5%</span></p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold">R</div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Repeat Purchase</p>
                  <p className="font-bold text-gray-900 text-sm">34% <span className="text-[10px] text-green-500 ml-1">+12%</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* National Report */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:col-span-1">
          <h2 className="font-bold text-gray-900 mb-4 text-sm">National Report</h2>
          <div className="w-full h-32 bg-blue-50/50 rounded-xl mb-4 flex items-center justify-center overflow-hidden relative">
            {/* Simple CSS Map Mockup */}
            <div className="absolute opacity-20 text-[100px] text-[#6DB9B2]">🗺️</div>
            <div className="z-10 bg-white/80 backdrop-blur px-3 py-1 rounded-md text-[10px] font-bold text-[#2C5C59]">
              Peta Indonesia
            </div>
          </div>
          
          <p className="text-[10px] text-gray-500 mb-3 font-medium">Top Region by Customer</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">1. Jawa Barat</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">2. Jawa Timur</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">3. DKI Jakarta</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">4. Jawa Tengah</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">5. Sumatera Utara</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
