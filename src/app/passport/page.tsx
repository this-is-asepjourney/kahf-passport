'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { formatIDR, formatDate, formatCompact } from '@/lib/utils';
import type { Customer, Purchase } from '@/types';
import Link from 'next/link';

export default function PassportPage() {
  const { user, loading, signOutUser } = useAuth();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [recentPurchases, setRecentPurchases] = useState<Purchase[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    if (!loading && user?.role !== 'customer') {
      router.replace('/');
      return;
    }
    if (user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    if (!user) return;
    try {
      const customersQ = query(
        collection(db, 'customers'),
        where('uid', '==', user.uid)
      );
      const snap = await getDocs(customersQ);
      if (!snap.empty) {
        const customerData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Customer;
        setCustomer(customerData);

        const purchasesQ = query(
          collection(db, 'purchases'),
          where('customerId', '==', customerData.id),
          where('status', '==', 'valid'),
          orderBy('purchasedAt', 'desc'),
          limit(3)
        );
        const purchasesSnap = await getDocs(purchasesQ);
        const purchases = purchasesSnap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          purchasedAt: d.data().purchasedAt?.toDate?.()?.toISOString() ?? d.data().purchasedAt,
        })) as Purchase[];
        setRecentPurchases(purchases);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 rounded-full border-4 border-[#E8C5C8] border-t-[#6DB9B2] animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h2 className="text-xl font-bold text-[#2C5C59] mb-2">Profil Belum Lengkap</h2>
        <p className="text-gray-500 text-sm mb-6">
          Selesaikan pendaftaran untuk mendapatkan Beauty Passport Anda.
        </p>
        <Link href="/register" className="py-3 px-6 bg-[#6DB9B2] text-white rounded-full font-semibold">
          Lengkapi Data
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 relative overflow-hidden">
      {/* Background shape */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#E8C5C8] rounded-full mix-blend-multiply filter blur-[80px] opacity-40 -translate-y-1/2 translate-x-1/4 pointer-events-none" />

      {/* Header */}
      <div className="px-6 pt-12 pb-6 relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar Placeholder */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6DB9B2] to-[#E8C5C8] flex items-center justify-center text-white text-2xl font-bold shadow-md">
            {customer.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#2C5C59]">Halo, {customer.fullName.split(' ')[0]}! ✨</h1>
            <p className="text-sm text-gray-500">Ini adalah beauty passport kamu.</p>
          </div>
        </div>
        <Link href="/passport/qr" className="p-3 bg-white rounded-2xl shadow-sm text-[#6DB9B2] hover:bg-gray-50">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><rect width="8" height="8" x="3" y="3"/><rect width="8" height="8" x="13" y="3"/><rect width="8" height="8" x="13" y="13"/><path d="M3 13h8v8H3z"/></svg>
        </Link>
      </div>

      {/* Member Banner */}
      <div className="px-6 relative z-10 mb-8">
        <div className="bg-gradient-to-r from-[#F7E7CD] to-[#EBD3A9] rounded-2xl p-4 flex items-center justify-between shadow-sm border border-[#E1C591]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-xl">⭐</div>
            <div>
              <p className="font-bold text-[#8C6D23]">Member Gold</p>
              <p className="text-sm text-[#A68638] font-medium">1.250 Poin</p>
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8C6D23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>

      {/* Quick Menu */}
      <div className="px-6 relative z-10 mb-8">
        <h2 className="text-[#2C5C59] font-bold mb-4">Quick Menu</h2>
        <div className="grid grid-cols-3 gap-4">
          <Link href="/passport/purchases" className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm gap-2 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-[#E2F0EF] text-[#6DB9B2] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <span className="text-[10px] text-center font-medium text-[#2C5C59]">Riwayat Pembelian</span>
          </Link>
          <Link href="/passport/skin-profile" className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm gap-2 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-[#FAEBEC] text-[#D88C95] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <span className="text-[10px] text-center font-medium text-[#2C5C59]">Skin Profile</span>
          </Link>
          <Link href="/passport/skin-profile" className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm gap-2 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-[#E2F0EF] text-[#6DB9B2] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
            </div>
            <span className="text-[10px] text-center font-medium text-[#2C5C59]">Rekomendasi Personal</span>
          </Link>
          <Link href="/passport/loyalty" className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm gap-2 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-[#FDF4E1] text-[#E0A83A] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <span className="text-[10px] text-center font-medium text-[#2C5C59]">Loyalty & Reward</span>
          </Link>
          <Link href="/passport/profile" className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm gap-2 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-[#FAEBEC] text-[#D88C95] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span className="text-[10px] text-center font-medium text-[#2C5C59]">Profil Saya</span>
          </Link>
        </div>
      </div>

      {/* Beauty Journey */}
      <div className="px-6 relative z-10 mb-8">
        <h2 className="text-[#2C5C59] font-bold mb-4">Beauty Journey</h2>
        <div className="bg-gradient-to-r from-[#6DB9B2] to-[#9CD5D0] rounded-3xl p-5 flex items-center justify-between shadow-sm text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full translate-x-1/3 -translate-y-1/3"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <span className="text-2xl">🌱</span>
            </div>
            <div>
              <p className="font-semibold text-sm">Kulit lebih sehat,</p>
              <p className="text-xs text-white/90">percaya diri setiap hari<br/>bersama Khaf 🤍</p>
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative z-10"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>

      <div className="px-6 pb-8 text-center text-[#6DB9B2]/60 text-xs font-medium italic relative z-10">
        Your Beauty Journey<br/>Our Priority 🤍
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 safe-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <Link href="/passport" className="flex flex-col items-center gap-1 text-[#6DB9B2]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link href="/passport/qr" className="flex flex-col items-center gap-1 text-gray-400 hover:text-[#6DB9B2]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><rect width="8" height="8" x="3" y="3"/><rect width="8" height="8" x="13" y="3"/><rect width="8" height="8" x="13" y="13"/><path d="M3 13h8v8H3z"/></svg>
          <span className="text-[10px] font-medium">Passport</span>
        </Link>
        <div className="flex flex-col items-center gap-1 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span className="text-[10px] font-medium">Notifikasi</span>
        </div>
        <Link href="/passport/profile" className="flex flex-col items-center gap-1 text-gray-400 hover:text-[#6DB9B2]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span className="text-[10px] font-medium">Akun</span>
        </Link>
      </div>
    </div>
  );
}
