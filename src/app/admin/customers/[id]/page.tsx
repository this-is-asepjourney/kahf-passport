'use client';

import { useEffect, useState, use } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Customer } from '@/types';
import { formatIDR } from '@/lib/utils';
import Link from 'next/link';

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});

  // Password Reset State
  const [isResetting, setIsResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
      return;
    }
    if (user) {
      loadCustomer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, id, router]);

  const loadCustomer = async () => {
    try {
      const snap = await getDoc(doc(db, 'customers', id));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Customer;
        setCustomer(data);
        setEditForm({ fullName: data.fullName, phone: data.phone, status: data.status, memberNo: data.memberNo });
      } else {
        setCustomer(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!customer) return;
    try {
      await updateDoc(doc(db, 'customers', customer.id), editForm);
      setCustomer({ ...customer, ...editForm } as Customer);
      setIsEditing(false);
    } catch (err) {
      console.error('Update failed:', err);
      alert('Gagal mengupdate data customer');
    }
  };

  const handleDelete = async () => {
    if (!customer || !confirm('Yakin ingin menghapus customer ini?')) return;
    try {
      // For full deletion, you'd also want to delete the Firebase Auth user via API
      await deleteDoc(doc(db, 'customers', customer.id));
      router.push('/admin/customers');
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Gagal menghapus customer');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer?.uid) {
      setResetMessage({ type: 'error', text: 'Customer ini belum tertaut dengan akun Auth (uid kosong).' });
      return;
    }
    if (newPassword.length < 6) {
      setResetMessage({ type: 'error', text: 'Password minimal 6 karakter' });
      return;
    }

    setIsResetting(true);
    setResetMessage({ type: '', text: '' });

    try {
      // Get the current user's token
            // Wait, we can get token using auth.currentUser.getIdToken()
      const { auth } = await import('@/lib/firebase/client');
      const idToken = await auth.currentUser?.getIdToken();

      const res = await fetch('/api/admin/customers/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          uid: customer.uid,
          newPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        setResetMessage({ type: 'success', text: 'Password berhasil diubah!' });
        setNewPassword('');
      } else {
        setResetMessage({ type: 'error', text: data.error || 'Gagal mengubah password' });
      }
    } catch (err: unknown) {
      setResetMessage({ type: 'error', text: (err as Error).message || 'Terjadi kesalahan' });
    } finally {
      setIsResetting(false);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 mb-4">Customer tidak ditemukan.</p>
        <Link href="/admin/customers" className="text-purple-600 font-medium">← Kembali ke daftar</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Link href="/admin/customers" className="text-gray-500 hover:text-gray-800">← Kembali</Link>
        <h1 className="text-2xl font-bold text-gray-900">Detail Customer</h1>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Left Column: Info & Edit */}
          <div className="flex-1 space-y-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <h2 className="text-xl font-bold">Informasi Profil</h2>
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="text-sm font-bold text-purple-600 hover:text-purple-800">
                  Edit Profil
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setIsEditing(false)} className="text-sm font-medium text-gray-500">Batal</button>
                  <button onClick={handleUpdate} className="text-sm font-bold text-white bg-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-700">Simpan</button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Nama Lengkap</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editForm.fullName || ''} 
                    onChange={e => setEditForm({...editForm, fullName: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none"
                  />
                ) : (
                  <p className="font-medium text-gray-900">{customer.fullName}</p>
                )}
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Nomor HP</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editForm.phone || ''} 
                    onChange={e => setEditForm({...editForm, phone: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none"
                  />
                ) : (
                  <p className="font-medium text-gray-900">{customer.phone}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Nomor Member</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editForm.memberNo || ''} 
                    onChange={e => setEditForm({...editForm, memberNo: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none"
                  />
                ) : (
                  <p className="font-medium text-gray-900">{customer.memberNo}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
                {isEditing ? (
                  <select 
                    value={editForm.status || 'unclaimed'} 
                    onChange={e => setEditForm({...editForm, status: e.target.value as "active" | "unclaimed" | "blocked"})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none"
                  >
                    <option value="active">Aktif</option>
                    <option value="unclaimed">Belum Klaim</option>
                    <option value="blocked">Diblokir</option>
                  </select>
                ) : (
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                    customer.status === 'active' ? 'bg-green-100 text-green-700' :
                    customer.status === 'unclaimed' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {customer.status === 'active' ? 'Aktif' : customer.status === 'unclaimed' ? 'Belum Klaim' : 'Diblokir'}
                  </span>
                )}
              </div>
            </div>

            {/* Metrics */}
            <div className="pt-4 grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Total Belanja</p>
                <p className="text-xl font-bold text-gray-900">{formatIDR(customer.totalSpent)}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Jumlah Transaksi</p>
                <p className="text-xl font-bold text-gray-900">{customer.purchaseCount}x</p>
              </div>
            </div>

            <div className="pt-4 flex justify-end border-t border-gray-100">
              <button 
                onClick={handleDelete}
                className="text-sm font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition-colors"
              >
                Hapus Customer
              </button>
            </div>
          </div>

          {/* Right Column: Password Reset */}
          <div className="w-full md:w-80 space-y-6">
            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 h-full">
              <h3 className="font-bold text-gray-900 mb-2">Bantuan Sandi</h3>
              <p className="text-sm text-gray-500 mb-6">Jika customer lupa password, Anda dapat membuatkan password baru untuk mereka di sini.</p>
              
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Password Baru</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-200 outline-none bg-white"
                    required
                    minLength={6}
                  />
                </div>
                
                {resetMessage.text && (
                  <div className={`p-3 rounded-xl text-xs font-medium ${resetMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {resetMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isResetting}
                  className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {isResetting ? 'Menyimpan...' : 'Ubah Password'}
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
