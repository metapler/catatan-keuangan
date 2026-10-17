import { z } from "zod";

export const transactionTypes = ["income", "expense", "transfer"] as const;

const baseSchema = z.object({
  type: z.enum(transactionTypes, {
    message: "Tipe transaksi tidak valid.",
  }),
  amount: z.coerce
    .number()
    .finite("Nominal harus berupa angka.")
    .gt(0, "Nominal harus lebih dari 0."),
  transactionDate: z
    .string()
    .min(1, "Tanggal transaksi wajib diisi.")
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Tanggal transaksi tidak valid.",
    }),
  description: z
    .string()
    .trim()
    .max(255, "Deskripsi terlalu panjang.")
    .optional()
    .or(z.literal("")),
  accountId: z.string().optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  fromAccountId: z.string().optional().or(z.literal("")),
  toAccountId: z.string().optional().or(z.literal("")),
});

export const transactionSchema = baseSchema.superRefine((values, ctx) => {
  if ((values.type === "income" || values.type === "expense") && !values.accountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["accountId"],
      message: "Pilih akun untuk transaksi ini.",
    });
  }

  if (values.type === "income" && !values.categoryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categoryId"],
      message: "Pilih kategori income.",
    });
  }

  if (values.type === "expense" && !values.categoryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categoryId"],
      message: "Pilih kategori expense.",
    });
  }

  if (values.type === "transfer") {
    if (!values.fromAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fromAccountId"],
        message: "Pilih akun asal transfer.",
      });
    }

    if (!values.toAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toAccountId"],
        message: "Pilih akun tujuan transfer.",
      });
    }

    if (
      values.fromAccountId &&
      values.toAccountId &&
      values.fromAccountId === values.toAccountId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toAccountId"],
        message: "Akun asal dan tujuan transfer tidak boleh sama.",
      });
    }
  }
});

export type TransactionInput = z.infer<typeof transactionSchema>;
