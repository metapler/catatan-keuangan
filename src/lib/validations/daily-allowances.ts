import { z } from "zod";

export const dailyAllowanceSchema = z.object({
  categoryId: z.string().min(1, "Pilih kategori pengeluaran."),
  dailyAmount: z.coerce
    .number()
    .finite("Nominal Anggaran Harian harus berupa angka.")
    .gt(0, "Nominal Anggaran Harian harus lebih dari 0."),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD).")
    .default(() => new Date().toISOString().slice(0, 10)),
  rolloverEnabled: z.boolean().default(true),
  isActive: z.boolean().default(true),
  note: z.string().max(255, "Catatan maksimal 255 karakter.").optional().nullable(),
});

export type DailyAllowanceInput = z.infer<typeof dailyAllowanceSchema>;
