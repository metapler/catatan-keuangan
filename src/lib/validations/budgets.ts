import { z } from "zod";

export const budgetSchema = z.object({
  categoryId: z.string().min(1, "Pilih kategori expense."),
  periodMonth: z.coerce
    .number()
    .int("Bulan tidak valid.")
    .min(1, "Bulan minimal 1.")
    .max(12, "Bulan maksimal 12."),
  periodYear: z.coerce
    .number()
    .int("Tahun tidak valid.")
    .min(2000, "Tahun minimal 2000.")
    .max(2100, "Tahun maksimal 2100."),
  amount: z.coerce
    .number()
    .finite("Nominal budget harus berupa angka.")
    .gt(0, "Nominal budget harus lebih dari 0."),
});

export type BudgetInput = z.infer<typeof budgetSchema>;
