'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import type { Customer } from '@/types';

interface FollowUpItem extends Customer {
  daysSincePurchase: number;
}

export default function BaFollowUpPage() {
  const { user, loading } = useAuth();
  const [customers, setCustomers] = useState<FollowUpItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user) {
      loadFollowUps();
    }
  }, [user, loading]);

  const loadFollowUps = async () => {
    if (!user?.uid) return;
    try {
      // Find customers registered by this BA or who belong to this BA's store (simplification: registered by BA)
      const q = query(
        collection(db, 'customers'),
        where('registeredByBaId', '==', user.uid)
      );
      
      const snap = await getDocs(q);
      const now = new Date();
      
      const followUpList: FollowUpItem[] = [];
      
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.lastPurchaseAt) {
          const lastPurchase = data.lastPurchaseAt.toDate();
          const diffTime = Math.abs(now.getTime() - lastPurchase.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          // If they purchased > 25 days ago, they are due for follow up
          if (diffDays >= 25) {
            followUpList.push({
              id: doc.id,
              ...data,
              daysSincePurchase: diffDays
            } as FollowUpItem);
          }
        }
      });
      
      // Sort by longest days since purchase
      followUpList.sort((a, b) => b.daysSincePurchase - a.daysSincePurchase);
      
      setCustomers(followUpList);
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
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifikasi Follow Up</h1>
        <p className="text-sm text-gray-500 mt-1">Daftar pelanggan yang perlu dihubungi untuk repeat purchase ( {'>'} 25 hari sejak pembelian terakhir).</p>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {customers.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-5xl mb-4 block">🎉</span>
            <h3 className="text-lg font-bold text-gray-900">Semua Terkendali!</h3>
            <p className="text-gray-500 mt-1">Belum ada pelanggan yang masuk jadwal follow up hari ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {customers.map((c) => (
              <div key={c.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-lg shrink-0">
                    {c.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{c.fullName}</h3>
                    <p className="text-sm text-gray-500">{c.phone}</p>
                    <p className="text-xs text-orange-600 font-medium mt-1">
                      Waktunya Repurchase ({c.daysSincePurchase} hari sejak transaksi terakhir)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Link 
                    href={`https://wa.me/${c.phone.replace('+', '')}?text=Halo%20Kak%20${c.fullName},%20produk%20Kahf-nya%20masih%20ada?`}
                    target="_blank"
                    className="flex-1 md:flex-none text-center px-4 py-2.5 bg-green-50 text-green-600 font-semibold text-sm rounded-xl hover:bg-green-100 transition-colors"
                  >
                    Chat WA
                  </Link>
                  <Link 
                    href={`/ba/customers/${c.id}`}
                    className="flex-1 md:flex-none text-center px-4 py-2.5 bg-[#E2F0EF] text-[#2C5C59] font-semibold text-sm rounded-xl hover:bg-[#cbe6e3] transition-colors"
                  >
                    Profil
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
