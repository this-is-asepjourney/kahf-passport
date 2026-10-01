'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import Link from 'next/link';
import type { Customer } from '@/types';
import { Bell, Send, CheckCircle2, X, Sparkles, MessageSquare } from 'lucide-react';

interface FollowUpItem extends Customer {
  daysSincePurchase: number;
}

const TEMPLATES = [
  {
    title: 'Pengingat Stok & Repurchase 🧴',
    message: 'Halo Bro! Stok produk perawatan Kahf-mu kemungkinan sudah menipis nih. Yuk mampir ke booth kami untuk refill produk favoritmu dan dapatkan poin loyalitas tambahan!',
    actionUrl: '/passport/recommendations',
  },
  {
    title: 'Konsultasi Perawatan Kulit Rutin ✨',
    message: 'Halo Bro! Bagaimana perkembangan perawatan kulitmu? Jangan ragu mampir ke booth Kahf untuk cek kondisi kulit terkini dan konsultasi gratis dengan Beauty Advisor kami.',
    actionUrl: '/passport',
  },
  {
    title: 'Penawaran Spesial Member Kahf 🎁',
    message: 'Halo Bro! Ada penawaran spesial dan bonus reward khusus untuk member Kahf Passport minggu ini. Tunjukkan barcode Passport-mu saat berbelanja ya!',
    actionUrl: '/passport',
  },
];

export default function BaFollowUpPage() {
  const { user, loading } = useAuth();
  const [customers, setCustomers] = useState<FollowUpItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // State untuk modal kirim notifikasi
  const [activeCustomer, setActiveCustomer] = useState<FollowUpItem | null>(null);
  const [notifTitle, setNotifTitle] = useState(TEMPLATES[0].title);
  const [notifMessage, setNotifMessage] = useState(TEMPLATES[0].message);
  const [notifActionUrl, setNotifActionUrl] = useState(TEMPLATES[0].actionUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const loadFollowUps = async () => {
      if (!user?.uid) return;
      try {
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
            
            if (diffDays >= 25) {
              followUpList.push({
                id: doc.id,
                ...data,
                daysSincePurchase: diffDays
              } as FollowUpItem);
            }
          }
        });
        
        followUpList.sort((a, b) => b.daysSincePurchase - a.daysSincePurchase);
        setCustomers(followUpList);
      } catch (err) {
        console.error(err);
      } finally {
        setDataLoading(false);
      }
    };

    if (!loading && user) {
      loadFollowUps();
    }
  }, [user, loading]);

  const handleOpenModal = (customer: FollowUpItem) => {
    setActiveCustomer(customer);
    setNotifTitle(TEMPLATES[0].title);
    setNotifMessage(TEMPLATES[0].message);
    setNotifActionUrl(TEMPLATES[0].actionUrl);
    setStatusMessage(null);
  };

  const handleSelectTemplate = (template: typeof TEMPLATES[0]) => {
    setNotifTitle(template.title);
    setNotifMessage(template.message);
    setNotifActionUrl(template.actionUrl);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer || !notifTitle.trim() || !notifMessage.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesi kedaluwarsa, silakan login ulang.');

      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerId: activeCustomer.id,
          title: notifTitle.trim(),
          message: notifMessage.trim(),
          type: 'follow_up',
          actionUrl: notifActionUrl.trim() || '/passport',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim notifikasi');
      }

      setStatusMessage({ type: 'success', text: `Pesan berhasil dikirim ke ${activeCustomer.fullName}!` });
      setTimeout(() => {
        setActiveCustomer(null);
        setStatusMessage(null);
      }, 1500);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Terjadi kesalahan saat mengirim pesan' });
    } finally {
      setIsSubmitting(false);
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
        <h1 className="text-2xl font-bold text-gray-900">Notifikasi & Follow Up</h1>
        <p className="text-sm text-gray-500 mt-1">
          Daftar pelanggan yang perlu dihubungi untuk repeat purchase (&gt; 25 hari). Kirim pesan langsung ke inbox Kahf Passport mereka atau via WhatsApp.
        </p>
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
              <div key={c.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/70 transition-colors">
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

                <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
                  <button
                    onClick={() => handleOpenModal(c)}
                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-[#2C5C59] text-white font-semibold text-xs rounded-xl hover:bg-[#234947] transition-colors shadow-sm cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Kirim Notif
                  </button>

                  <Link 
                    href={`https://wa.me/${c.phone.replace('+', '')}?text=Halo%20Kak%20${c.fullName},%20produk%20Kahf-nya%20masih%20ada?`}
                    target="_blank"
                    className="flex-1 md:flex-none text-center px-3.5 py-2.5 bg-green-50 text-green-700 font-semibold text-xs rounded-xl hover:bg-green-100 transition-colors"
                  >
                    Chat WA
                  </Link>

                  <Link 
                    href={`/ba/customers/${c.id}`}
                    className="flex-1 md:flex-none text-center px-3.5 py-2.5 bg-[#E2F0EF] text-[#2C5C59] font-semibold text-xs rounded-xl hover:bg-[#cbe6e3] transition-colors"
                  >
                    Profil
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Kirim Notifikasi ke Customer */}
      {activeCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#2C5C59] bg-[#E2F0EF] px-2.5 py-1 rounded-full">
                  Kirim Notifikasi Passport
                </span>
                <h2 className="text-xl font-bold text-gray-900 mt-2">{activeCustomer.fullName}</h2>
                <p className="text-xs text-gray-500">Pesan akan langsung muncul di kotak masuk aplikasi Kahf Passport pelanggan.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCustomer(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Cepat */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Pilih Template Cepat
              </label>
              <div className="flex flex-col gap-1.5">
                {TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                      notifTitle === tmpl.title
                        ? 'border-[#2C5C59] bg-[#E2F0EF]/40 font-semibold text-[#2C5C59]'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {tmpl.title}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Judul Notifikasi</label>
                <input
                  type="text"
                  required
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#2C5C59] focus:ring-1 focus:ring-[#2C5C59]"
                  placeholder="Contoh: Pengingat Khusus Untukmu"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Isi Pesan</label>
                <textarea
                  required
                  rows={4}
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#2C5C59] focus:ring-1 focus:ring-[#2C5C59]"
                  placeholder="Tulis pesan personal atau tips untuk pelanggan..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Tautan Aksi (Opsional)</label>
                <input
                  type="text"
                  value={notifActionUrl}
                  onChange={(e) => setNotifActionUrl(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#2C5C59] focus:ring-1 focus:ring-[#2C5C59]"
                  placeholder="/passport atau /passport/recommendations"
                />
              </div>

              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveCustomer(null)}
                  disabled={isSubmitting}
                  className="w-1/3 py-2.5 border border-gray-200 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 py-2.5 bg-[#2C5C59] text-white font-bold rounded-xl text-xs hover:bg-[#234947] transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Kirim ke Pelanggan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
