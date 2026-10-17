import { z } from "zod";

export const categoryTypes = ["income", "expense"] as const;

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama kategori wajib diisi.")
    .max(100, "Nama kategori terlalu panjang."),
  type: z.enum(categoryTypes, {
    message: "Tipe kategori tidak valid.",
  }),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{6})$/, "Gunakan format warna hex seperti #10B981."),
  icon: z
    .string()
    .trim()
    .max(50, "Icon terlalu panjang.")
    .optional()
    .or(z.literal("")),
});

export type CategoryInput = z.infer<typeof categorySchema>;
