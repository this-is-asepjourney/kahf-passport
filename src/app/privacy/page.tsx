import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi',
  description: 'Kebijakan privasi Khaf Passport mengenai pemrosesan data pribadi pelanggan.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="gradient-hero px-6 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/80 hover:text-white">←</Link>
          <h1 className="text-xl font-bold text-white">Kebijakan Privasi</h1>
        </div>
        <p className="text-white/60 text-sm mt-1 ml-8">Terakhir diperbarui: September 2026</p>
      </div>

      <div className="px-6 -mt-4 pb-8">
        <div className="bg-white rounded-3xl shadow-sm p-6 prose prose-sm max-w-none">
          <h2 className="text-lg font-bold text-gray-900 mb-4">1. Pendahuluan</h2>
          <p className="text-gray-600 mb-4">
            Khaf (&quot;kami&quot;) menghormati privasi Anda dan berkomitmen untuk melindungi data pribadi yang Anda berikan melalui platform Khaf Passport. Kebijakan privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan melindungi informasi Anda.
          </p>

          <h2 className="text-lg font-bold text-gray-900 mb-4">2. Data yang Kami Kumpulkan</h2>
          <ul className="text-gray-600 mb-4 space-y-2 list-disc list-inside">
            <li>Nama lengkap dan nomor telepon (WhatsApp)</li>
            <li>Tanggal lahir, jenis kelamin, kota (opsional)</li>
            <li>Riwayat pembelian produk Khaf di counter</li>
            <li>Data perangkat dan interaksi dengan aplikasi</li>
          </ul>

          <h2 className="text-lg font-bold text-gray-900 mb-4">3. Tujuan Pemrosesan Data</h2>
          <ul className="text-gray-600 mb-4 space-y-2 list-disc list-inside">
            <li>Menyediakan layanan Khaf Passport (riwayat pembelian digital)</li>
            <li>Memfasilitasi layanan Brand Ambassador kami</li>
            <li>Analisis data penjualan internal (anonim/agregat)</li>
            <li>Komunikasi layanan (dengan persetujuan Anda)</li>
          </ul>

          <h2 className="text-lg font-bold text-gray-900 mb-4">4. Dasar Hukum Pemrosesan</h2>
          <p className="text-gray-600 mb-4">
            Pemrosesan data dilakukan berdasarkan persetujuan eksplisit Anda saat pendaftaran, sesuai ketentuan Undang-Undang Perlindungan Data Pribadi (UU PDP) Indonesia.
          </p>

          <h2 className="text-lg font-bold text-gray-900 mb-4">5. Keamanan Data</h2>
          <p className="text-gray-600 mb-4">
            Data Anda disimpan di Google Cloud Firestore dengan enkripsi at-rest dan in-transit. Akses data dibatasi oleh role-based access control yang ketat.
          </p>

          <h2 className="text-lg font-bold text-gray-900 mb-4">6. Hak Anda</h2>
          <p className="text-gray-600 mb-2">Sesuai UU PDP, Anda berhak untuk:</p>
          <ul className="text-gray-600 mb-4 space-y-1 list-disc list-inside">
            <li>Mengakses data pribadi Anda</li>
            <li>Memperbaiki data yang tidak akurat</li>
            <li>Meminta penghapusan data (&quot;hak untuk dilupakan&quot;)</li>
            <li>Menarik persetujuan Anda kapan saja</li>
          </ul>

          <h2 className="text-lg font-bold text-gray-900 mb-4">7. Kontak</h2>
          <p className="text-gray-600 mb-4">
            Untuk pertanyaan atau permintaan terkait data pribadi, hubungi kami di:{' '}
            <strong>privacy@khaf.id</strong>
          </p>

          <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-700">
              ⚠️ Dokumen ini adalah draf dan belum merupakan nasihat hukum. Konsultasikan dengan tim legal Khaf sebelum publikasi resmi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
