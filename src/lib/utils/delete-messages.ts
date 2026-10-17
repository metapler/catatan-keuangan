// Pesan mengikuti cakupan delete_sale, delete_money_loan, dan delete_debt_payment.
// Penjualan kredit memakai pesan yang sama dari halaman Penjualan maupun Hutang.
export const financeDeleteMessages = {
  cashSale:
    "Penjualan beserta transaksi modal dan pemasukan yang terhubung akan dihapus permanen. Saldo akun akan dihitung ulang. Tindakan ini tidak bisa dibatalkan.",
  creditSale:
    "Penjualan, hutang pelanggan, seluruh cicilan, serta transaksi modal dan pemasukan cicilan yang terhubung akan dihapus permanen. Saldo akun akan dihitung ulang. Tindakan ini tidak bisa dibatalkan.",
  loan:
    "Pinjaman, seluruh cicilan, serta transaksi pencairan pinjaman dan pemasukan cicilan yang terhubung akan dihapus permanen. Saldo akun akan dihitung ulang. Tindakan ini tidak bisa dibatalkan.",
  payment:
    "Cicilan beserta transaksi pemasukan yang terhubung akan dihapus permanen. Sisa hutang akan bertambah kembali dan saldo akun akan dihitung ulang. Tindakan ini tidak bisa dibatalkan.",
} as const;
