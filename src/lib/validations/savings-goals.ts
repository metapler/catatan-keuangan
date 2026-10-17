import { z } from "zod";

export const savingsGoalStatuses = [
  "active",
  "completed",
  "cancelled",
] as const;

export const savingsGoalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama target tabungan wajib diisi.")
    .max(120, "Nama target terlalu panjang."),
  targetAmount: z.coerce
    .number()
    .finite("Target nominal harus berupa angka.")
    .gt(0, "Target nominal harus lebih dari 0."),
  currentAmount: z.coerce
    .number()
    .finite("Progress nominal harus berupa angka.")
    .min(0, "Progress nominal tidak boleh negatif."),
  targetDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "Tanggal target tidak valid.",
    }),
  status: z.enum(savingsGoalStatuses, {
    message: "Status target tidak valid.",
  }),
}).superRefine((values, ctx) => {
  if (values.currentAmount > values.targetAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["currentAmount"],
      message: "Nominal terkumpul tidak boleh melebihi target nominal.",
    });
  }
});

export function createSavingsProgressSchema(targetAmount: number) {
  return z.object({
    currentAmount: z.coerce
      .number()
      .finite("Progress nominal harus berupa angka.")
      .min(0, "Progress nominal tidak boleh negatif.")
      .max(
        targetAmount,
        "Nominal terkumpul tidak boleh melebihi target nominal.",
      ),
  });
}

export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>;
