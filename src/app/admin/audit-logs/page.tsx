'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { AuditLog } from '@/types';
import { formatDateTime } from '@/lib/utils';
import Link from 'next/link';

export default function AdminAuditLogsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && user.role !== 'super_admin') { router.replace('/admin'); return; }
    if (!loading && user) {
      getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100)))
        .then(snap => setLogs(snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? d.data().createdAt,
        })) as AuditLog[]))
        .finally(() => setDataLoading(false));
    }
  }, [user, loading]);

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      record_purchase: '🛍️ Catat Pembelian',
      void_purchase: '🚫 Void Pembelian',
      set_user_role: '🔑 Ubah Role',
      claim_customer: '✅ Klaim Akun',
      regenerate_qr: '🔄 Regenerasi QR',
    };
    return labels[action] ?? action;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="gradient-hero px-6 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-white/80 hover:text-white">←</Link>
          <h1 className="text-xl font-bold text-white">Audit Log</h1>
        </div>
        <p className="text-white/60 text-sm mt-1 ml-8">100 aktivitas terbaru</p>
      </div>

      <div className="px-6 -mt-4 pb-8 space-y-3">
        {dataLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
            <p className="text-4xl mb-2">📋</p>
            <p className="text-gray-500">Belum ada log aktivitas</p>
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="bg-white rounded-3xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{getActionLabel(log.action)}</p>
                  <p className="text-xs text-gray-500">{log.userId}</p>
                  <p className="text-xs text-gray-400">
                    {log.subjectType}: {log.subjectId}
                  </p>
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(log.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
