'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Region } from '@/types';
import Link from 'next/link';

export default function AdminRegionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [regions, setRegions] = useState<Region[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/'); return;
    }
    if (!loading && user) {
      getDocs(query(collection(db, 'regions'), orderBy('name', 'asc')))
        .then(snap => setRegions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Region[]))
        .finally(() => setDataLoading(false));
    }
  }, [user, loading]);

  const levelLabel = (level: number) => {
    const labels = ['Nasional', 'Regional', 'Kota'];
    return labels[level] ?? `Level ${level}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="gradient-hero px-6 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-white/80 hover:text-white">←</Link>
          <h1 className="text-xl font-bold text-white">Master Wilayah</h1>
        </div>
      </div>

      <div className="px-6 -mt-4 pb-8 space-y-3">
        {dataLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
          </div>
        ) : regions.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
            <p className="text-4xl mb-2">🗺️</p>
            <p className="text-gray-500">Belum ada data wilayah</p>
          </div>
        ) : (
          regions.map(region => (
            <div key={region.id} className="bg-white rounded-3xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl gradient-hero flex items-center justify-center text-xl">🗺️</div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{region.name}</p>
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-600 mt-0.5">
                    {levelLabel(region.level)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-mono">{region.id}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
