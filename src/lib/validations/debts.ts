import { z } from "zod";

const dateField = (emptyMessage: string, invalidMessage: string) =>
  z
    .string()
    .min(1, emptyMessage)
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: invalidMessage,
    });

export const creditSaleSchema = z.object({
  customerId: z.string().min(1, "Pilih pelanggan."),
  productTypeId: z.string().min(1, "Pilih tipe produk."),
  costAmount: z.coerce
    .number()
    .finite("Modal harus berupa angka.")
    .min(0, "Modal tidak boleh negatif."),
  sellAmount: z.coerce
    .number()
    .finite("Harga jual harus berupa angka.")
    .gt(0, "Harga jual harus lebih dari 0."),
  costAccountId: z.string().min(1, "Pilih akun untuk modal."),
  expenseCategoryId: z.string().min(1, "Pilih kategori modal/HPP."),
  incomeCategoryId: z
    .string()
    .min(1, "Pilih kategori penjualan (dipakai tiap cicilan)."),
  saleDate: dateField(
    "Tanggal penjualan wajib diisi.",
    "Tanggal penjualan tidak valid.",
  ),
  description: z
    .string()
    .trim()
    .max(255, "Deskripsi terlalu panjang.")
    .optional()
    .or(z.literal("")),
});

export type CreditSaleInput = z.infer<typeof creditSaleSchema>;

// Pinjaman uang ke pelanggan (debts kind='loan', tanpa baris sales).
// Total tagihan = loanAmount (uang yang diserahkan, tanpa bunga).
export const loanSchema = z.object({
  customerId: z.string().min(1, "Pilih pelanggan."),
  loanAmount: z.coerce
    .number()
    .finite("Jumlah pinjaman harus berupa angka.")
    .gt(0, "Jumlah pinjaman harus lebih dari 0."),
  sourceAccountId: z.string().min(1, "Pilih akun sumber pinjaman."),
  expenseCategoryId: z.string().min(1, "Pilih kategori pinjaman."),
  incomeCategoryId: z.string().min(1, "Pilih kategori cicilan."),
  loanDate: dateField(
    "Tanggal pinjaman wajib diisi.",
    "Tanggal pinjaman tidak valid.",
  ),
  description: z
    .string()
    .trim()
    .max(255, "Deskripsi terlalu panjang.")
    .optional()
    .or(z.literal("")),
});

export type LoanInput = z.infer<typeof loanSchema>;

// Skema wizard tambah hutang: satu form untuk dua jenis hutang.
// "sale" = hutang produk dari penjualan kredit (alur lama);
// "loan" = pinjaman uang langsung ke pelanggan.
export const debtWizardSchema = z
  .object({
    kind: z.enum(["sale", "loan"], {
      message: "Jenis hutang tidak valid.",
    }),
    customerId: z.string().min(1, "Pilih pelanggan."),
    productTypeId: z.string().optional().or(z.literal("")),
    costAmount: z.coerce.number().finite("Modal harus berupa angka."),
    sellAmount: z.coerce.number().finite("Harga jual harus berupa angka."),
    loanAmount: z.coerce.number().finite("Jumlah pinjaman harus berupa angka."),
    // "Akun" per jenis: modal (sale) / akun sumber pinjaman (loan).
    costAccountId: z.string().optional().or(z.literal("")),
    expenseCategoryId: z.string().optional().or(z.literal("")),
    // Kategori income = kategori yang dipakai tiap cicilan.
    incomeCategoryId: z.string().optional().or(z.literal("")),
    saleDate: dateField(
      "Tanggal hutang wajib diisi.",
      "Tanggal hutang tidak valid.",
    ),
    description: z
      .string()
      .trim()
      .max(255, "Deskripsi terlalu panjang.")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((values, ctx) => {
    const addIssue = (path: string, message: string) =>
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message,
      });

    if (values.kind === "sale") {
      if (!values.productTypeId) {
        addIssue("productTypeId", "Pilih tipe produk.");
      }
      if (values.costAmount < 0) {
        addIssue("costAmount", "Modal tidak boleh negatif.");
      }
      if (!(values.sellAmount > 0)) {
        addIssue("sellAmount", "Harga jual harus lebih dari 0.");
      }
      if (!values.costAccountId) {
        addIssue("costAccountId", "Pilih akun untuk modal.");
      }
      if (!values.expenseCategoryId) {
        addIssue("expenseCategoryId", "Pilih kategori modal/HPP.");
      }
      if (!values.incomeCategoryId) {
        addIssue("incomeCategoryId", "Pilih kategori penjualan (dipakai tiap cicilan).");
      }
    } else {
      if (!(values.loanAmount > 0)) {
        addIssue("loanAmount", "Jumlah pinjaman harus lebih dari 0.");
      }
      if (!values.costAccountId) {
        addIssue("costAccountId", "Pilih akun sumber pinjaman.");
      }
      if (!values.expenseCategoryId) {
        addIssue("expenseCategoryId", "Pilih kategori pinjaman.");
      }
      if (!values.incomeCategoryId) {
        addIssue("incomeCategoryId", "Pilih kategori cicilan.");
      }
    }
  });

export type DebtWizardInput = z.infer<typeof debtWizardSchema>;

export const paymentSchema = z.object({
  amount: z.coerce
    .number()
    .finite("Nominal harus berupa angka.")
    .gt(0, "Nominal pembayaran harus lebih dari 0."),
  accountId: z.string().min(1, "Pilih akun penerima pembayaran."),
  paymentDate: dateField(
    "Tanggal pembayaran wajib diisi.",
    "Tanggal pembayaran tidak valid.",
  ),
  note: z
    .string()
    .trim()
    .max(255, "Catatan terlalu panjang.")
    .optional()
    .or(z.literal("")),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export type DebtStatus = "belum_lunas" | "mencicil" | "lunas";

export function deriveDebtStatus(paid: number, total: number): DebtStatus {
  if (paid >= total) return "lunas";
  if (paid > 0) return "mencicil";
  return "belum_lunas";
}
