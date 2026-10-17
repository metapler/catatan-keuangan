"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { accountSchema, type AccountInput } from "@/lib/validations/accounts";
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

async function getCurrentUserId() {
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

function mapAccountError(message: string) {
  if (message.toLowerCase().includes("duplicate")) {
    return "Nama akun sudah dipakai. Gunakan nama lain.";
  }

  if (message.toLowerCase().includes("accounts_user_id_name_unique_idx")) {
    return "Nama akun sudah dipakai. Gunakan nama lain.";
  }

  return message;
}

export async function createAccountAction(
  values: AccountInput,
): Promise<MutationState> {
  const parsed = accountSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data akun tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserId();
    const { error } = await supabase.from("accounts").insert({
      user_id: userId,
      name: parsed.data.name,
      type: parsed.data.type,
      initial_balance: parsed.data.initialBalance,
    });

    if (error) {
      return errorState(mapAccountError(error.message));
    }

    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return successState("Akun berhasil ditambahkan.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal membuat akun.",
    );
  }
}

export async function updateAccountAction(
  accountId: string,
  values: AccountInput,
): Promise<MutationState> {
  const parsed = accountSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data akun tidak valid.",
    );
  }

  try {
    const { supabase } = await getCurrentUserId();
    const { error } = await supabase
      .from("accounts")
      .update({
        name: parsed.data.name,
        type: parsed.data.type,
        initial_balance: parsed.data.initialBalance,
      })
      .eq("id", accountId);

    if (error) {
      return errorState(mapAccountError(error.message));
    }

    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return successState("Akun berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal memperbarui akun.",
    );
  }
}

export async function deleteAccountAction(accountId: string) {
  const { supabase } = await getCurrentUserId();

  const { count, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .or(
      `account_id.eq.${accountId},from_account_id.eq.${accountId},to_account_id.eq.${accountId}`,
    );

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count ?? 0) > 0) {
    throw new Error("Akun masih dipakai transaksi dan tidak bisa dihapus.");
  }

  const { error } = await supabase.from("accounts").delete().eq("id", accountId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}
