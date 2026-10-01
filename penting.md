# Konsep Sistem Wardah Beauty Passport

## 1. Administrator (Admin)
- **Dashboard**: Monitoring penjualan nasional, perkembangan produk, dan interaksi antara Beauty Advisor (BA) dan customer.
- **Customer Insight**: Melihat data lengkap profil pelanggan, riwayat transaksi, dan manajemen akun.
- **Product Insight**: Memantau katalog produk kecantikan Wardah, manajemen kategori, harga, dan SKU (CRUD).
- **Kelola Beauty Advisor & Akses**: Admin dapat mendaftarkan akun BA baru secara instan (nama, email, password acak, no WA, dan penugasan counter Wardah), mengedit data BA, mereset password, dan mengaktifkan/menonaktifkan akun langsung dari dashboard tanpa perlu membuka Firebase Console atau menyalin UID.
- **BA Performance**: Memantau performa dan kontribusi Beauty Advisor berdasarkan transaksi riil dan konsultasi.
- **Regional Report**: Analisis performa dan ekspor laporan penjualan berdasarkan wilayah counter/kota.
- **Pengaturan Akun**: Preferensi sistem, notifikasi, dan keamanan akun.

## 2. Beauty Advisor (BA)
- **Beranda (Dashboard)**: Sapaan "Halo, Beauty Advisor!", memantau statistik customer, omset penjualan, dan transaksi harian.
- **Customer Database**: Pencarian cepat pelanggan, profil lengkap, riwayat belanja, dan analisa jenis kulit.
- **Kasir & Barcode Riwayat (Scan Barcode)**:
  - BA mencari/memilih customer yang sedang dilayani.
  - BA meng-update produk Wardah apa saja yang dibeli customer, kuantitas, dan total belanja.
  - BA menampilkan **Barcode QR Riwayat Customer** di layar untuk dipindai oleh customer.
  - Menyediakan juga kamera pemindai kartu customer jika diperlukan.
- **Konsultasi Kulit**: Analisis tipe kulit, concern (masalah kulit), dan rekomendasi produk resmi dari BA.
- **Rekomendasi Produk**: Katalog produk Wardah live-sync dengan filter tipe kulit dan direct WhatsApp share.
- **Follow Up**: Pengingat otomatis untuk pelanggan > 25 hari untuk repeat order via pesan aplikasi atau WhatsApp.
- **Riwayat Penjualan**: Laporan transaksi pribadi masing-masing BA.

## 3. Customer (Wardah Beauty Passport)
- **Desain Beauty Passport** (Sesuai Referensi Wardah):
  - Header: Identitas Wardah, avatar berhijab, sapaan "Halo, {Nama}! ✨ Ini adalah beauty passport kamu."
  - Kartu Tier Member: Member Gold & Poin Loyalitas Wardah.
  - 5 Quick Menu Pastel:
    1. **Riwayat Pembelian**: Riwayat belanja lengkap, invoice, dan status transaksi.
    2. **Riwayat Konsultasi**: Catatan konsultasi dan saran dari Beauty Advisor.
    3. **Rekomendasi Personal**: Produk perawatan harian yang dipersonalisasi sesuai jenis kulit.
    4. **Loyalty & Reward**: Kumpulkan poin dan tukarkan dengan produk Wardah gratis.
    5. **Favorite Products**: Produk favorit yang disimpan pelanggan.
  - **Beauty Journey Card**: "Kulit lebih sehat, percaya diri setiap hari bersama Wardah 💙"
  - **Scan Barcode BA**: Kamera scanner cepat untuk memindai barcode yang ditampilkan oleh BA di counter, langsung menampilkan riwayat pembelian terbaru pelanggan.
  - Slogan: *"Your Beauty Journey Our Priority 💙"*
