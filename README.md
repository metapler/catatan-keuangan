# 💰 Catatan Keuangan (Personal Finance Tracker)

Aplikasi web pencatatan dan pengelolaan keuangan pribadi modern yang dibangun menggunakan **Next.js 15 (App Router)** dan **Supabase**.

---

## ✨ Fitur Utama

- 📊 **Dashboard Keuangan**: Ringkasan total saldo seluruh akun, pemasukan & pengeluaran bulanan, analisis grafik distribusi pengeluaran, serta transaksi terbaru.
- 💸 **Pencatatan Transaksi**: Catat arus kas pemasukan (*income*), pengeluaran (*expense*), dan transfer antar dompet/akun secara konsisten.
- 💳 **Manajemen Akun & Dompet**: Kelola dompet tunai, rekening bank, e-wallet, hingga akun tabungan lengkap dengan akumulasi saldo real-time.
- 🏷️ **Kategori Transaksi**: Kelola kategori pemasukan dan pengeluaran secara terpisah dengan warna visual kustom.
- 🎯 **Perencanaan Anggaran (Budgeting)**: Atur batas anggaran bulanan per kategori dan pantau persentase penggunaan agar tidak boros.
- 🐖 **Target Tabungan (Savings Goals)**: Buat target tabungan impian, lacak progress terkumpul, serta atur deadline pencapaian.
- 🔒 **Sistem Keamanan Data (Multi-User & RLS)**: Terintegrasi dengan Supabase Auth & Row Level Security (RLS) sehingga setiap pengguna hanya dapat membaca dan mengelola data miliknya sendiri.

---

## 🛠️ Teknologi yang Digunakan

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router & React 19)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL & Row Level Security)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Visualisasi Data**: [Recharts](https://recharts.org/)
- **Form & Validasi**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)

---

## 🚀 Cara Menjalankan Project

### 1. Prasyarat
- Node.js versi 18.x atau yang lebih baru
- NPM / Yarn / PNPM
- Akun Supabase

### 2. Clone Repository
```bash
git clone https://github.com/username/catatan-keuangan.git
cd catatan-keuangan
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Konfigurasi Environment Variable
Buat file `.env.local` di root folder proyek dan salin dari `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Jalankan Development Server
```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) pada browser Anda.

---

## 📜 Lisensi

Project ini dibuat untuk penggunaan pribadi dan edukasi.
