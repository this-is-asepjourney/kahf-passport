'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import type { Customer, Purchase } from '@/types';
import Link from 'next/link';
import { formatIDR, formatDateTime } from '@/lib/utils';

export default function PurchasesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    if (!user) return;
    try {
      const customersQ = query(collection(db, 'customers'), where('uid', '==', user.uid));
      const custSnap = await getDocs(customersQ);
      if (custSnap.empty) return;
      const cId = custSnap.docs[0].id;
      setCustomerId(cId);

      const purchasesQ = query(
        collection(db, 'purchases'),
        where('customerId', '==', cId),
        orderBy('purchasedAt', 'desc')
      );
      const purchasesSnap = await getDocs(purchasesQ);
      const allPurchases = purchasesSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        purchasedAt: d.data().purchasedAt?.toDate?.()?.toISOString() ?? d.data().purchasedAt,
      })) as Purchase[];
      setPurchases(allPurchases);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-4 border-[#E8C5C8] border-t-[#6DB9B2] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col relative">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#E8C5C8] rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      </div>

      {/* Header */}
      <div className="px-6 pt-12 pb-6 z-10 relative bg-white/50 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Link href="/passport" className="text-[#2C5C59] p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 className="text-xl font-bold text-[#2C5C59]">Riwayat Pembelian</h1>
        </div>
        <p className="text-gray-500 text-sm mt-1 ml-11">
          {purchases.filter(p => p.status === 'valid').length} transaksi valid
        </p>
      </div>

      <div className="px-6 py-6 space-y-4 z-10 relative">
        {purchases.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center border border-gray-100">
            <p className="text-5xl mb-3">🛒</p>
            <h2 className="font-bold text-[#2C5C59] mb-2">Belum Ada Riwayat</h2>
            <p className="text-sm text-gray-500">
              Pembelian Anda di counter Khaf akan muncul di sini
            </p>
          </div>
        ) : (
          purchases.map((purchase) => (
            <PurchaseCard key={purchase.id} purchase={purchase} />
          ))
        )}
      </div>
    </div>
  );
}

function PurchaseCard({ purchase }: { purchase: Purchase }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-white rounded-3xl shadow-sm overflow-hidden animate-in transition-all border border-gray-100 ${
        purchase.status === 'void' ? 'opacity-60' : ''
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 text-left focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E2F0EF] flex items-center justify-center text-[#6DB9B2] flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[#2C5C59] text-base">{purchase.storeNameSnapshot}</p>
              <p className="text-xs text-gray-500">{formatDateTime(purchase.purchasedAt)}</p>
              <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">No. {purchase.invoiceNo}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-[#6DB9B2]">{formatIDR(purchase.totalAmount)}</p>
            {purchase.status === 'void' ? (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] bg-red-50 text-red-600 font-medium border border-red-100">
                Void
              </span>
            ) : (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] bg-[#E2F0EF] text-[#6DB9B2] font-medium border border-[#6DB9B2]/20">
                Valid
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            {purchase.items.length} item · BA: <span className="font-medium">{purchase.baNameSnapshot}</span>
          </p>
          <span className="text-[#6DB9B2] bg-[#E2F0EF] p-1.5 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3 animate-in bg-gray-50/50">
          {purchase.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#2C5C59]">{item.productName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.sku} · {item.qty} × {formatIDR(item.unitPrice)}</p>
              </div>
              <p className="text-sm font-semibold text-[#6DB9B2]">{formatIDR(item.subtotal)}</p>
            </div>
          ))}
          <div className="pt-3 border-t border-dashed border-gray-200 flex justify-between">
            <p className="text-sm font-bold text-[#2C5C59]">Total</p>
            <p className="text-sm font-bold text-[#6DB9B2]">{formatIDR(purchase.totalAmount)}</p>
          </div>
          {purchase.status === 'void' && purchase.voidReason && (
            <div className="mt-3 p-3 rounded-2xl bg-red-50 border border-red-100">
              <p className="text-xs text-red-600 font-medium">Alasan void: {purchase.voidReason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
