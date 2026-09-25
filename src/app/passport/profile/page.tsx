'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Customer } from '@/types';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function PassportProfilePage() {
  const { user, loading, signOutUser } = useAuth();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    birthDate: '',
    city: '',
  });

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    try {
      const q = query(collection(db, 'customers'), where('uid', '==', user?.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const c = { id: snap.docs[0].id, ...snap.docs[0].data() } as Customer;
        setCustomer(c);
        setFormData({
          fullName: c.fullName,
          birthDate: c.birthDate ?? '',
          city: c.city ?? '',
        });
      }
    } finally {
      setDataLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setSaving(true);
    setMessage('');
    try {
      await updateDoc(doc(db, 'customers', customer.id), {
        fullName: formData.fullName,
        birthDate: formData.birthDate,
        city: formData.city,
        updatedAt: new Date().toISOString(),
      });
      setMessage('Profil berhasil diperbarui');
    } catch (err) {
      setMessage('Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    router.replace('/login');
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
          <h1 className="text-xl font-bold text-[#2C5C59]">Akun Saya</h1>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 z-10 relative">
        <div className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-[#E2F0EF] text-[#6DB9B2] flex items-center justify-center text-2xl font-bold">
              {customer?.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-[#2C5C59] text-lg">{customer?.fullName}</p>
              <p className="text-sm text-gray-500">{customer?.phone}</p>
            </div>
          </div>

          {message && (
            <div className={`mb-6 p-3 rounded-xl text-sm font-medium ${
              message.includes('berhasil') ? 'bg-[#E2F0EF] text-[#2C5C59]' : 'bg-[#FAEBEC] text-[#D88C95]'
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">No. Handphone</label>
              <input
                type="text"
                disabled
                value={customer?.phone ?? ''}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all text-gray-700"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Lahir</label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kota Domisili</label>
              <input
                type="text"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all text-gray-700"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 mt-4 rounded-2xl bg-[#6DB9B2] text-white font-semibold disabled:opacity-50 hover:bg-[#5AA9A2] transition-colors shadow-sm"
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </form>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full py-4 rounded-2xl bg-white border border-gray-200 text-[#D88C95] font-semibold hover:bg-gray-50 transition-colors shadow-sm"
        >
          Keluar (Logout)
        </button>
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
        <Link href="/passport/profile" className="flex flex-col items-center gap-1 text-[#6DB9B2]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span className="text-[10px] font-medium">Akun</span>
        </Link>
      </div>
    </div>
  );
}
