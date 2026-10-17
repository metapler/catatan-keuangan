import { z } from "zod";

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama pelanggan wajib diisi.")
    .max(100, "Nama pelanggan terlalu panjang."),
  phone: z
    .string()
    .trim()
    .max(30, "Nomor telepon terlalu panjang.")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(255, "Catatan terlalu panjang.")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional().default(true),
});

export type CustomerInput = z.infer<typeof customerSchema>;
