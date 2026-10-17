import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Masukkan email yang valid."),
  password: z
    .string()
    .min(1, "Password minimal 1 karakter.")
    .max(72, "Password terlalu panjang."),
});

export type LoginInput = z.infer<typeof loginSchema>;
