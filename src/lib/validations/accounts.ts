import { z } from "zod";

export const accountTypes = [
  "cash",
  "bank",
  "ewallet",
  "savings",
  "crypto",
  "hutang",
] as const;

export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama akun wajib diisi.")
    .max(100, "Nama akun terlalu panjang."),
  type: z
    .string()
    .trim()
    .min(1, "Tipe akun wajib diisi.")
    .max(50, "Tipe akun terlalu panjang."),
  initialBalance: z.coerce
    .number()
    .finite("Saldo awal harus berupa angka.")
    .min(0, "Saldo awal tidak boleh negatif."),
});

export type AccountInput = z.infer<typeof accountSchema>;

