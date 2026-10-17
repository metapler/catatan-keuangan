"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  transactionSchema,
  type TransactionInput,
} from "@/lib/validations/transactions";
import type { MutationState } from "@/types/finance";

function errorState(message: string): MutationState {
  return {
    status: "error",
    message,
  };
}

function successState(message: string): MutationState {
  return {
    status: "success",
    message,
  };
}

function mapTransactionPayload(values: TransactionInput) {
  if (values.type === "transfer") {
    return {
      type: values.type,
      amount: values.amount,
      description: values.description || null,
      transaction_date: values.transactionDate,
      account_id: null,
      category_id: null,
      from_account_id: values.fromAccountId || null,
      to_account_id: values.toAccountId || null,
    };
  }

  return {
    type: values.type,
    amount: values.amount,
    description: values.description || null,
    transaction_date: values.transactionDate,
    account_id: values.accountId || null,
    category_id: values.categoryId || null,
    from_account_id: null,
    to_account_id: null,
  };
}

function mapTransactionError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("account_id does not belong")) {
    return "Akun yang dipilih tidak sesuai dengan user aktif.";
  }

  if (lower.includes("category_id does not belong")) {
    return "Kategori yang dipilih tidak sesuai dengan user aktif.";
  }

  if (lower.includes("from_account_id does not belong")) {
    return "Akun asal transfer tidak valid.";
  }

  if (lower.includes("to_account_id does not belong")) {
    return "Akun tujuan transfer tidak valid.";
  }

  return message;
}

async function getCurrentUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error(error?.message ?? "Session user tidak ditemukan.");
  }

  return { supabase, userId: user.id };
}

export async function createTransactionAction(
  values: TransactionInput,
): Promise<MutationState> {
  const parsed = transactionSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data transaksi tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      ...mapTransactionPayload(parsed.data),
    });

    if (error) {
      return errorState(mapTransactionError(error.message));
    }

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return successState("Transaksi berhasil ditambahkan.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal membuat transaksi.",
    );
  }
}

export async function updateTransactionAction(
  transactionId: string,
  values: TransactionInput,
): Promise<MutationState> {
  const parsed = transactionSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data transaksi tidak valid.",
    );
  }

  try {
    const { supabase } = await getCurrentUserContext();
    const { error } = await supabase
      .from("transactions")
      .update(mapTransactionPayload(parsed.data))
      .eq("id", transactionId);

    if (error) {
      return errorState(mapTransactionError(error.message));
    }

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return successState("Transaksi berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal memperbarui transaksi.",
    );
  }
}

export async function deleteTransactionAction(transactionId: string) {
  const { supabase } = await getCurrentUserContext();

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}
