'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import type { Customer } from '@/types';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react'; // Wait, let's just use standard text if lucide-react isn't installed. I will use standard SVG.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://khaf.app';

export default function QrPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user) loadCustomer();
  }, [user, loading]);

  const loadCustomer = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'customers'), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setCustomer({ id: snap.docs[0].id, ...snap.docs[0].data() } as Customer);
      }
    } finally {
      setDataLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!customer) return;
    setRegenerating(true);
    try {
      const idToken = await (await import('firebase/auth')).getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/qr', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ customerId: customer.id }),
      });
      const result = await res.json();
      if (res.ok) {
        setCustomer({ ...customer, qrTokenId: result.newToken });
      }
    } finally {
      setRegenerating(false);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-4 border-[#E8C5C8] border-t-[#6DB9B2] animate-spin" />
      </div>
    );
  }

  const qrUrl = customer ? `${APP_URL}/p/${customer.qrTokenId}` : '';

  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      {/* Background Shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#E8C5C8] rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#6DB9B2] rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      </div>

      {/* Header */}
      <div className="flex items-center px-6 pt-12 pb-4 z-10 relative">
        <Link href="/passport" className="text-[#2C5C59] p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12 z-10 relative -mt-10">
        <div className="text-center mb-8">
          <h2 className="text-sm text-[#2C5C59] font-medium tracking-widest mb-1 uppercase">Khaf</h2>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#6DB9B2] to-[#E8C5C8] tracking-tight">
            FIND ME<span className="text-[#E8C5C8]">✨</span>
          </h1>
        </div>

        <p className="text-sm text-gray-500 mb-8 max-w-xs text-center">
          Tunjukkan QR ini ke Beauty Advisor untuk mengakses Beauty Passport Anda.
        </p>

        {customer ? (
          <div className="flex flex-col items-center">
            {/* QR Code Container with Corner brackets styling (simulated) */}
            <div className="relative p-6 bg-white shadow-2xl shadow-[#6DB9B2]/20 rounded-3xl mb-8 animate-in border border-gray-100">
              <QRCode
                value={qrUrl}
                size={240}
                level="H"
                className="block"
                fgColor="#2C5C59"
              />
              
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#6DB9B2] rounded-tl-3xl"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#6DB9B2] rounded-tr-3xl"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#6DB9B2] rounded-bl-3xl"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#6DB9B2] rounded-br-3xl"></div>
            </div>

            <div className="text-center mb-8">
              <p className="text-lg font-bold text-[#2C5C59]">{customer.fullName}</p>
              <p className="text-sm text-gray-500">ID: {customer.memberNo}</p>
            </div>

            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="py-3 px-8 bg-white border-2 border-[#6DB9B2] rounded-full text-[#6DB9B2] font-semibold text-sm hover:bg-[#6DB9B2] hover:text-white transition-all disabled:opacity-50"
            >
              {regenerating ? 'Memperbarui...' : 'Perbarui QR'}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-500">Profil tidak ditemukan</p>
          </div>
        )}
      </div>
    </div>
  );
}
