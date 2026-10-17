import { z } from "zod";

/**
 * Nama kanonis 4 tipe bawaan. Satu-satunya sumber kebenaran di kode;
 * blok MIGRASI di supabase/schema.sql memakai literal yang sama.
 */
export const BUILTIN_PRODUCT_TYPES = [
  "Pulsa",
  "Kuota",
  "Token Listrik",
  "Wifi",
] as const;

export const productTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama tipe produk wajib diisi.")
    .max(50, "Nama tipe produk terlalu panjang."),
  isActive: z.boolean().optional().default(true),
});

export type ProductTypeInput = z.infer<typeof productTypeSchema>;
