# Database Catatan Keuangan

Untuk instalasi baru, jalankan `schema.sql` melalui SQL Editor Supabase.

## Pembaruan budget (audit 01)

Untuk database yang sudah ada, jalankan hanya
`migrations/202610170001_align_budget_soft_delete.sql` sebelum memakai kode budget
yang diperbarui. Migrasi ini berjalan dalam satu transaksi dan boleh dijalankan
ulang. Tidak perlu menjalankan seluruh `schema.sql` untuk pembaruan ini.

Migrasi menambahkan `is_auto_generated` (default `false`) dan `deleted_at`
(default `NULL`). Budget lama tetap aktif dan nominalnya tetap sama. Constraint
unik lama diganti index unik untuk baris dengan `deleted_at IS NULL`.

Aturan yang berlaku:

- Hanya satu budget aktif per pengguna, kategori, bulan, dan tahun.
- Menghapus budget menyimpan riwayat dengan `deleted_at`, tanpa mengubah transaksi
  pemasukan/pengeluaran.
- Setelah dihapus, budget untuk kategori/periode yang sama bisa dibuat sebagai
  baris baru. Riwayat lama tidak masuk ringkasan maupun frekuensi kategori aktif.
- Form lama tidak bisa memperbarui budget yang sudah dihapus.

Jalankan `tests/budget_soft_delete.sql` melalui SQL Editor setelah migrasi untuk
memeriksa default kolom, penolakan duplikasi, hapus/buat ulang, dan keutuhan riwayat.
Pengujian memakai tabel temporer dengan struktur/index yang disalin dari `budgets`
dan diakhiri dengan rollback; tidak mengubah data pengguna. Sukses tanpa error
berarti seluruh pemeriksaan lulus.
