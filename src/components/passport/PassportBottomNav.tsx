'use client';

import Link from 'next/link';
import { useNotifications } from '@/hooks/useNotifications';
import { Bell, Home, QrCode, User } from 'lucide-react';

interface PassportBottomNavProps {
  activeTab?: 'home' | 'qr' | 'notifications' | 'profile';
}

export function PassportBottomNav({ activeTab = 'home' }: PassportBottomNavProps) {
  const { unreadCount } = useNotifications();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-lg bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center safe-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.03)] pointer-events-auto">
        {/* Home */}
        <Link
          href="/passport"
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'home' ? 'text-[#6DB9B2]' : 'text-gray-400 hover:text-[#6DB9B2]'
          }`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        {/* Passport QR */}
        <Link
          href="/passport/qr"
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'qr' ? 'text-[#6DB9B2]' : 'text-gray-400 hover:text-[#6DB9B2]'
          }`}
        >
          <QrCode className="w-6 h-6" />
          <span className="text-[10px] font-medium">Passport</span>
        </Link>

        {/* Notifications with Live Badge */}
        <Link
          href="/passport/notifications"
          className={`flex flex-col items-center gap-1 relative transition-colors ${
            activeTab === 'notifications' ? 'text-[#6DB9B2]' : 'text-gray-400 hover:text-[#6DB9B2]'
          }`}
        >
          <div className="relative">
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Notifikasi</span>
        </Link>

        {/* Akun */}
        <Link
          href="/passport/profile"
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'profile' ? 'text-[#6DB9B2]' : 'text-gray-400 hover:text-[#6DB9B2]'
          }`}
        >
          <User className="w-6 h-6" />
          <span className="text-[10px] font-medium">Akun</span>
        </Link>
      </div>
    </div>
  );
}
