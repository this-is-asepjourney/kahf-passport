'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDateTime } from '@/lib/utils';
import type { NotificationType, CustomerNotification } from '@/types';
import { PassportBottomNav } from '@/components/passport/PassportBottomNav';
import {
  Bell,
  CheckCheck,
  Sparkles,
  MessageSquare,
  Clock,
  ShieldCheck,
  Gift,
  Tag,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export default function CustomerNotificationsPage() {
  const { user, customer, loading: authLoading } = useAuth();
  const router = useRouter();
  const { notifications, unreadCount, loading: notifLoading, markAsRead, markAllAsRead } = useNotifications();

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'ba' | 'admin'>('all');
  const [selectedNotif, setSelectedNotif] = useState<CustomerNotification | null>(null);

  if (!authLoading && !user) {
    router.replace('/login');
    return null;
  }

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'unread') return !item.isRead;
    if (activeTab === 'ba') return item.senderRole === 'ba';
    if (activeTab === 'admin') return item.senderRole === 'admin';
    return true;
  });

  const handleCardClick = (notif: CustomerNotification) => {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
    setSelectedNotif(notif);
  };

  const getNotificationIcon = (type: NotificationType, role: string) => {
    switch (type) {
      case 'follow_up':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'consultation':
        return <Sparkles className="w-5 h-5 text-[#2C5C59]" />;
      case 'reward':
        return <Gift className="w-5 h-5 text-amber-500" />;
      case 'promo':
        return <Tag className="w-5 h-5 text-rose-500" />;
      case 'admin_broadcast':
        return <ShieldCheck className="w-5 h-5 text-blue-600" />;
      case 'ba_message':
      default:
        return <MessageSquare className="w-5 h-5 text-[#2C5C59]" />;
    }
  };

  const getTypeLabel = (type: NotificationType) => {
    switch (type) {
      case 'follow_up':
        return 'Follow Up Perawatan';
      case 'consultation':
        return 'Hasil Konsultasi';
      case 'reward':
        return 'Poin & Loyalty';
      case 'promo':
        return 'Promo Spesial';
      case 'admin_broadcast':
        return 'Pengumuman Resmi';
      case 'ba_message':
      default:
        return 'Pesan Personal';
    }
  };

  const getTypeBg = (type: NotificationType) => {
    switch (type) {
      case 'follow_up':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'consultation':
        return 'bg-[#E2F0EF] text-[#2C5C59] border-[#6DB9B2]/30';
      case 'reward':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'promo':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'admin_broadcast':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ba_message':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex justify-center">
      <div className="w-full max-w-lg min-h-screen pb-24 relative overflow-hidden bg-[#F8F9FA] sm:shadow-lg sm:border-x sm:border-gray-100 flex flex-col">
        {/* Background Ambient Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#E8C5C8] rounded-full mix-blend-multiply filter blur-[80px] opacity-35 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-40 left-0 w-64 h-64 bg-[#6DB9B2] rounded-full mix-blend-multiply filter blur-[80px] opacity-20 pointer-events-none" />

        {/* Top Header */}
        <header className="px-6 pt-12 pb-4 relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/passport"
              className="p-2.5 rounded-2xl bg-white shadow-xs border border-gray-100 text-[#2C5C59] hover:bg-gray-50 active:scale-95 transition-all"
              aria-label="Kembali ke Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-extrabold text-[#2C5C59] tracking-tight">Kotak Masuk</h1>
              <p className="text-xs text-gray-500">Pesan dari BA & Admin Kahf</p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 shadow-xs text-xs font-bold text-[#2C5C59] hover:bg-[#E2F0EF]/50 active:scale-95 transition-all"
              title="Tandai semua pesan sudah dibaca"
            >
              <CheckCheck className="w-4 h-4 text-[#6DB9B2]" />
              <span>Semua Dibaca</span>
            </button>
          )}
        </header>

        {/* Filter Tabs */}
        <div className="px-6 relative z-10 mb-4">
          <div className="bg-white p-1.5 rounded-2xl border border-gray-100 shadow-xs flex gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-center ${
                activeTab === 'all'
                  ? 'bg-[#2C5C59] text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-center flex items-center justify-center gap-1.5 ${
                activeTab === 'unread'
                  ? 'bg-[#2C5C59] text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span>Belum Dibaca</span>
              {unreadCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    activeTab === 'unread' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-600'
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('ba')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-center ${
                activeTab === 'ba'
                  ? 'bg-[#2C5C59] text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Beauty Advisor
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-center ${
                activeTab === 'admin'
                  ? 'bg-[#2C5C59] text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Admin Resmi
            </button>
          </div>
        </div>

        {/* Notification List Area */}
        <div className="px-6 flex-1 relative z-10 space-y-3">
          {notifLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
              <p className="text-xs text-gray-400 font-medium">Memuat pesan masuk...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm mt-4">
              <div className="w-16 h-16 rounded-full bg-[#E2F0EF]/60 text-[#2C5C59] flex items-center justify-center mx-auto text-2xl mb-4">
                <Bell className="w-8 h-8 text-[#6DB9B2]" />
              </div>
              <h3 className="font-extrabold text-gray-900 text-base">Kotak Masuk Bersih</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">
                {activeTab === 'unread'
                  ? 'Tidak ada pesan yang belum dibaca. Semua pesan telah Anda lihat!'
                  : 'Belum ada notifikasi atau pesan baru dari Beauty Advisor maupun Admin.'}
              </p>
              {activeTab !== 'all' && (
                <button
                  onClick={() => setActiveTab('all')}
                  className="mt-5 text-xs text-[#2C5C59] font-bold underline"
                >
                  Tampilkan Semua Pesan
                </button>
              )}
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleCardClick(notif)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer relative ${
                  notif.isRead
                    ? 'bg-white/80 border-gray-100 shadow-xs hover:shadow-sm'
                    : 'bg-white border-[#6DB9B2]/40 shadow-md ring-2 ring-[#6DB9B2]/10'
                }`}
              >
                {/* Unread indicator dot */}
                {!notif.isRead && (
                  <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100 animate-pulse" />
                )}

                <div className="flex items-start gap-3.5">
                  {/* Icon Avatar */}
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                      notif.senderRole === 'ba'
                        ? 'bg-[#E2F0EF] border-[#6DB9B2]/30'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    {getNotificationIcon(notif.type, notif.senderRole)}
                  </div>

                  <div className="flex-1 min-w-0 pr-4">
                    {/* Header info */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTypeBg(
                          notif.type
                        )}`}
                      >
                        {getTypeLabel(notif.type)}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {formatDateTime(notif.createdAt)}
                      </span>
                    </div>

                    <h4
                      className={`text-sm tracking-tight mb-1 truncate ${
                        notif.isRead ? 'font-bold text-gray-800' : 'font-black text-gray-900'
                      }`}
                    >
                      {notif.title}
                    </h4>

                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>

                    {/* Sender footer */}
                    <div className="mt-2.5 pt-2 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-400">
                      <span className="font-semibold text-gray-600 flex items-center gap-1 truncate">
                        <span>👤</span>
                        <span className="truncate">{notif.senderName}</span>
                        {notif.storeName && (
                          <span className="text-gray-400 font-normal">({notif.storeName})</span>
                        )}
                      </span>

                      {notif.actionUrl && (
                        <span className="text-[#2C5C59] font-bold flex items-center gap-0.5 text-[10px] shrink-0">
                          Buka <ChevronRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ============================================================== */}
        {/* DETAIL POPUP MODAL                                             */}
        {/* ============================================================== */}
        {selectedNotif && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 animate-in zoom-in-95 border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                      selectedNotif.senderRole === 'ba'
                        ? 'bg-[#E2F0EF] border-[#6DB9B2]/30'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    {getNotificationIcon(selectedNotif.type, selectedNotif.senderRole)}
                  </div>
                  <div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTypeBg(
                        selectedNotif.type
                      )}`}
                    >
                      {getTypeLabel(selectedNotif.type)}
                    </span>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {formatDateTime(selectedNotif.createdAt)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedNotif(null)}
                  className="p-1.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div>
                <h3 className="font-extrabold text-base text-gray-900 tracking-tight">
                  {selectedNotif.title}
                </h3>
                <div className="mt-2 text-xs font-medium text-gray-700 bg-gray-50 p-4 rounded-2xl border border-gray-100 leading-relaxed whitespace-pre-line">
                  {selectedNotif.message}
                </div>
              </div>

              <div className="p-3 bg-[#E2F0EF]/40 rounded-2xl border border-[#6DB9B2]/20 flex items-center justify-between text-xs">
                <div>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                    Pengirim:
                  </p>
                  <p className="font-bold text-[#2C5C59]">{selectedNotif.senderName}</p>
                </div>
                {selectedNotif.storeName && (
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                      Lokasi:
                    </p>
                    <p className="font-bold text-gray-700">{selectedNotif.storeName}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {selectedNotif.actionUrl ? (
                  <Link
                    href={selectedNotif.actionUrl}
                    onClick={() => setSelectedNotif(null)}
                    className="flex-1 py-3 bg-[#2C5C59] hover:bg-[#204441] text-white font-bold text-xs rounded-xl text-center shadow-md shadow-[#2C5C59]/20 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span>Buka Tautan</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <button
                    onClick={() => setSelectedNotif(null)}
                    className="flex-1 py-3 bg-[#2C5C59] text-white font-bold text-xs rounded-xl transition-all"
                  >
                    Tutup
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <PassportBottomNav activeTab="notifications" />
      </div>
    </div>
  );
}
