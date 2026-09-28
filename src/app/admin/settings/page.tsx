'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola preferensi akun dan sistem administrasi.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 border-r border-gray-100 bg-gray-50/30 p-6 flex flex-col gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'profile'
                ? 'bg-[#E2F0EF] text-[#2C5C59]'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Profil Admin
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'security'
                ? 'bg-[#E2F0EF] text-[#2C5C59]'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Keamanan
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'notifications'
                ? 'bg-[#E2F0EF] text-[#2C5C59]'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Notifikasi
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'system'
                ? 'bg-[#E2F0EF] text-[#2C5C59]'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Sistem
          </button>
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6 md:p-8">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-4">Profil Admin</h2>
              
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-[#E2F0EF] text-[#2C5C59] flex items-center justify-center text-3xl font-bold">
                  {user?.email?.[0].toUpperCase() || 'A'}
                </div>
                <div>
                  <button className="px-4 py-2 bg-white border border-gray-200 text-sm font-bold text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
                    Ubah Foto
                  </button>
                  <p className="text-xs text-gray-400 mt-2">Format JPG, PNG max 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Nama Lengkap</label>
                  <input
                    type="text"
                    defaultValue="Admin Kahf"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6DB9B2] transition-all bg-gray-50 focus:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Alamat Email</label>
                  <input
                    type="email"
                    defaultValue={user?.email || ''}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Peran</label>
                  <input
                    type="text"
                    defaultValue={user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex justify-end">
                <button className="px-6 py-3 bg-[#2C5C59] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#6DB9B2]/20 hover:bg-[#1f4240] transition-colors">
                  Simpan Perubahan
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-4">Keamanan Akun</h2>
              
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Kata Sandi Saat Ini</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6DB9B2] transition-all bg-gray-50 focus:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Kata Sandi Baru</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6DB9B2] transition-all bg-gray-50 focus:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Konfirmasi Kata Sandi Baru</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6DB9B2] transition-all bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex justify-start">
                <button className="px-6 py-3 bg-[#2C5C59] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#6DB9B2]/20 hover:bg-[#1f4240] transition-colors">
                  Perbarui Kata Sandi
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-4">Preferensi Notifikasi</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Email Laporan Harian</h4>
                    <p className="text-xs text-gray-500 mt-1">Terima ringkasan penjualan setiap pagi.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2C5C59]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Peringatan Stok Tipis</h4>
                    <p className="text-xs text-gray-500 mt-1">Notifikasi jika stok produk mendekati batas minimum.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2C5C59]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-4">Pengaturan Sistem</h2>
              
              <div className="space-y-4">
                <div className="space-y-2 max-w-sm">
                  <label className="text-sm font-bold text-gray-700">Batas Waktu Sesi (Menit)</label>
                  <input
                    type="number"
                    defaultValue="60"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6DB9B2] transition-all bg-gray-50 focus:bg-white"
                  />
                </div>
                <div className="space-y-2 max-w-sm">
                  <label className="text-sm font-bold text-gray-700">Zona Waktu Default</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6DB9B2] transition-all bg-gray-50 focus:bg-white">
                    <option>WIB (Asia/Jakarta)</option>
                    <option>WITA (Asia/Makassar)</option>
                    <option>WIT (Asia/Jayapura)</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex justify-start">
                <button className="px-6 py-3 bg-[#2C5C59] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#6DB9B2]/20 hover:bg-[#1f4240] transition-colors">
                  Simpan Sistem
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
