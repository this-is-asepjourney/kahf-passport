'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import Link from 'next/link';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [targetEmail, setTargetEmail] = useState('');
  const [targetUid, setTargetUid] = useState('');
  const [role, setRole] = useState<string>('ba');
  const [storeId, setStoreId] = useState('');
  const [regionId, setRegionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSetRole = async () => {
    if (!targetUid) { setError('UID wajib diisi'); return; }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth().currentUser?.getIdToken();

      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ targetUid, role, storeId: storeId || undefined, regionId: regionId || undefined }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setMessage(result.message);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah role');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">🔒</p>
          <p className="text-gray-600">Hanya super admin yang dapat mengakses halaman ini.</p>
          <Link href="/admin" className="mt-4 block text-purple-600 text-sm">← Kembali</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="gradient-hero px-6 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-white/80 hover:text-white">←</Link>
          <h1 className="text-xl font-bold text-white">Pengguna & Role</h1>
        </div>
        <p className="text-white/60 text-sm mt-1 ml-8">Kelola hak akses pengguna</p>
      </div>

      <div className="px-6 -mt-4 pb-8 space-y-4">
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Set Role Pengguna</h2>

          {message && (
            <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm animate-in">
              ✓ {message}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-in">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UID Pengguna <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={targetUid}
                onChange={e => setTargetUid(e.target.value)}
                placeholder="Firebase UID"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
              >
                <option value="customer">customer</option>
                <option value="ba">ba (Brand Ambassador)</option>
                <option value="admin_region">admin_region</option>
                <option value="super_admin">super_admin</option>
              </select>
            </div>

            {(role === 'ba') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store ID</label>
                <input
                  type="text"
                  value={storeId}
                  onChange={e => setStoreId(e.target.value)}
                  placeholder="ID counter"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
                />
              </div>
            )}

            {(role === 'admin_region') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region ID</label>
                <input
                  type="text"
                  value={regionId}
                  onChange={e => setRegionId(e.target.value)}
                  placeholder="ID wilayah"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
                />
              </div>
            )}

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-xs text-amber-700">
                ⚠️ Perubahan role akan berlaku pada login berikutnya. Minta pengguna untuk logout dan login ulang.
              </p>
            </div>

            <button
              onClick={handleSetRole}
              disabled={loading}
              className="w-full py-4 rounded-2xl gradient-hero text-white font-semibold disabled:opacity-50 hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-lg"
            >
              {loading ? 'Menyimpan...' : '✓ Set Role'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
