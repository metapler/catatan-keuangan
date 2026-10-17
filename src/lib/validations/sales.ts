import { z } from "zod";

export const saleSchema = z.object({
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
  incomeAccountId: z.string().min(1, "Pilih akun penerima penjualan."),
  incomeCategoryId: z.string().min(1, "Pilih kategori penjualan."),
  expenseCategoryId: z.string().min(1, "Pilih kategori modal/HPP."),
  saleDate: z
    .string()
    .min(1, "Tanggal penjualan wajib diisi.")
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Tanggal penjualan tidak valid.",
    }),
  customerRef: z
    .string()
    .trim()
    .max(100, "Referensi terlalu panjang.")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .trim()
    .max(255, "Deskripsi terlalu panjang.")
    .optional()
    .or(z.literal("")),
});

export type SaleInput = z.infer<typeof saleSchema>;

// Skema wizard tambah penjualan: satu form untuk dua mode pembayaran.
// "lunas" butuh akun penerima; "hutang" butuh pelanggan (dicatat sebagai hutang).
export const saleWizardSchema = z
  .object({
    paymentType: z.enum(["lunas", "hutang"], {
      message: "Cara pembayaran tidak valid.",
    }),
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
    incomeAccountId: z.string().optional().or(z.literal("")),
    customerId: z.string().optional().or(z.literal("")),
    incomeCategoryId: z.string().min(1, "Pilih kategori penjualan."),
    expenseCategoryId: z.string().min(1, "Pilih kategori modal/HPP."),
    saleDate: z
      .string()
      .min(1, "Tanggal penjualan wajib diisi.")
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "Tanggal penjualan tidak valid.",
      }),
    customerRef: z
      .string()
      .trim()
      .max(100, "Referensi terlalu panjang.")
      .optional()
      .or(z.literal("")),
    description: z
      .string()
      .trim()
      .max(255, "Deskripsi terlalu panjang.")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((values, ctx) => {
    if (values.paymentType === "lunas" && !values.incomeAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["incomeAccountId"],
        message: "Pilih akun penerima penjualan.",
      });
    }

    if (values.paymentType === "hutang" && !values.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customerId"],
        message: "Pilih pelanggan.",
      });
    }
  });

export type SaleWizardInput = z.infer<typeof saleWizardSchema>;
