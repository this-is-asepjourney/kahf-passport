'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SkinProfile, Consultation } from '@/types';

const SKIN_TYPE_LABELS: Record<string, string> = {
  normal: 'Normal', oily: 'Berminyak', dry: 'Kering',
  combination: 'Kombinasi', sensitive: 'Sensitif',
};

const CONCERN_ICONS: Record<string, string> = {
  jerawat: '🔴', kusam: '🌑', 'flek hitam': '⬛', kering: '🏜️',
  berminyak: '💧', pori: '⭕', kerutan: '〰️', sensitif: '🌸',
};

export default function SkinProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [skinProfile, setSkinProfile] = useState<SkinProfile | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    if (!user) return;
    try {
      // Find customer
      const custQ = query(collection(db, 'customers'), where('uid', '==', user.uid));
      const custSnap = await getDocs(custQ);
      if (custSnap.empty) return;
      const cId = custSnap.docs[0].id;
      setCustomerId(cId);

      // Get skin profile
      const profileDoc = await getDoc(doc(db, 'skinProfiles', cId));
      if (profileDoc.exists()) {
        setSkinProfile({ id: profileDoc.id, ...profileDoc.data() } as SkinProfile);
      }

      // Get consultations
      const consultQ = query(
        collection(db, 'consultations'),
        where('customerId', '==', cId),
        orderBy('createdAt', 'desc')
      );
      const consultSnap = await getDocs(consultQ);
      setConsultations(consultSnap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? d.data().createdAt,
      })) as Consultation[]);
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
          <h1 className="text-xl font-bold text-[#2C5C59]">Skin Profile</h1>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 z-10 relative">
        {/* Skin Profile Card */}
        {skinProfile ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#2C5C59] text-lg">Profil Kulit Saya</h2>
              <span className="text-xs text-gray-400">Diperbarui oleh BA</span>
            </div>

            {/* Skin Type */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#E2F0EF] flex items-center justify-center text-2xl">
                🧴
              </div>
              <div>
                <p className="text-sm text-gray-500">Jenis Kulit</p>
                <p className="text-lg font-bold text-[#2C5C59]">{SKIN_TYPE_LABELS[skinProfile.skinType] ?? skinProfile.skinType}</p>
              </div>
            </div>

            {/* Concerns */}
            <div>
              <p className="text-sm text-gray-500 mb-3">Concern</p>
              <div className="flex flex-wrap gap-2">
                {skinProfile.concerns.map((concern, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[#FAEBEC] text-[#D88C95] font-medium border border-[#D88C95]/20">
                    {CONCERN_ICONS[concern.toLowerCase()] ?? '💡'} {concern}
                  </span>
                ))}
              </div>
            </div>

            {/* Preferences */}
            {skinProfile.preferences?.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-3">Preferensi</p>
                <div className="flex flex-wrap gap-2">
                  {skinProfile.preferences.map((pref, i) => (
                    <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-[#E2F0EF] text-[#6DB9B2] font-medium border border-[#6DB9B2]/20">
                      {pref}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="text-5xl mb-4">🧴</div>
            <h2 className="font-bold text-[#2C5C59] mb-2">Belum Ada Skin Profile</h2>
            <p className="text-sm text-gray-500">Kunjungi Beauty Advisor kami di counter terdekat untuk mendapatkan analisis kulit gratis.</p>
          </div>
        )}

        {/* Consultation History */}
        <div>
          <h2 className="font-bold text-[#2C5C59] text-lg mb-4">Riwayat Konsultasi</h2>
          {consultations.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
              <p className="text-4xl mb-2">📋</p>
              <p className="text-sm text-gray-500">Belum ada riwayat konsultasi</p>
            </div>
          ) : (
            <div className="space-y-3">
              {consultations.map((c) => (
                <div key={c.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-[#2C5C59]">{c.storeNameSnapshot}</p>
                      <p className="text-xs text-gray-500">BA: {c.baNameSnapshot}</p>
                    </div>
                    <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString('id-ID')}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-[#E2F0EF] text-[#6DB9B2] font-medium">
                      {SKIN_TYPE_LABELS[c.skinType] ?? c.skinType}
                    </span>
                    {c.concerns.map((concern, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-[#FAEBEC] text-[#D88C95] font-medium">
                        {concern}
                      </span>
                    ))}
                  </div>

                  {c.notes && <p className="text-sm text-gray-600 mb-3">{c.notes}</p>}

                  {c.recommendedProducts?.length > 0 && (
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-500 mb-2 font-medium">Rekomendasi Produk:</p>
                      {c.recommendedProducts.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 py-2">
                          <div className="w-8 h-8 rounded-xl bg-[#E2F0EF] flex items-center justify-center text-sm">✨</div>
                          <div>
                            <p className="text-sm font-medium text-[#2C5C59]">{p.productName}</p>
                            <p className="text-[10px] text-gray-400">{p.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 safe-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <Link href="/passport" className="flex flex-col items-center gap-1 text-gray-400 hover:text-[#6DB9B2]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link href="/passport/qr" className="flex flex-col items-center gap-1 text-gray-400 hover:text-[#6DB9B2]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><rect width="8" height="8" x="3" y="3"/></svg>
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
