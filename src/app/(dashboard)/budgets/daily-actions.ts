"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  dailyAllowanceSchema,
  type DailyAllowanceInput,
} from "@/lib/validations/daily-allowances";
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

function mapAllowanceError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("daily_allowances_user_category_unique") || lower.includes("duplicate")) {
    return "Anggaran Harian untuk kategori ini sudah dibuat. Silakan edit jika ingin mengubah nominal.";
  }

  return message;
}

export async function createDailyAllowanceAction(
  values: DailyAllowanceInput,
): Promise<MutationState> {
  const parsed = dailyAllowanceSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data Anggaran Harian tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const { error } = await supabase.from("daily_allowances").insert({
      user_id: userId,
      category_id: parsed.data.categoryId,
      daily_amount: parsed.data.dailyAmount,
      start_date: parsed.data.startDate,
      rollover_enabled: parsed.data.rolloverEnabled,
      is_active: parsed.data.isActive,
      note: parsed.data.note || null,
    });

    if (error) {
      return errorState(mapAllowanceError(error.message));
    }

    revalidatePath("/budgets");
    revalidatePath("/dashboard");

    return successState("Anggaran Harian berhasil ditambahkan.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal menambahkan Anggaran Harian.",
    );
  }
}

export async function updateDailyAllowanceAction(
  allowanceId: string,
  values: DailyAllowanceInput,
): Promise<MutationState> {
  const parsed = dailyAllowanceSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data Anggaran Harian tidak valid.",
    );
  }

  try {
    const { supabase } = await getCurrentUserContext();
    const { error } = await supabase
      .from("daily_allowances")
      .update({
        category_id: parsed.data.categoryId,
        daily_amount: parsed.data.dailyAmount,
        start_date: parsed.data.startDate,
        rollover_enabled: parsed.data.rolloverEnabled,
        is_active: parsed.data.isActive,
        note: parsed.data.note || null,
      })
      .eq("id", allowanceId);

    if (error) {
      return errorState(mapAllowanceError(error.message));
    }

    revalidatePath("/budgets");
    revalidatePath("/dashboard");

    return successState("Anggaran Harian berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal memperbarui Anggaran Harian.",
    );
  }
}

export async function deleteDailyAllowanceAction(allowanceId: string) {
  const { supabase, userId } = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("daily_allowances")
    .delete()
    .eq("id", allowanceId)
    .eq("user_id", userId)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Anggaran Harian tidak ditemukan atau tidak memiliki izin menghapus.",
    );
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}

export async function toggleDailyAllowanceAction(
  allowanceId: string,
  isActive: boolean,
): Promise<MutationState> {
  try {
    const { supabase, userId } = await getCurrentUserContext();
    const { error } = await supabase
      .from("daily_allowances")
      .update({ is_active: isActive })
      .eq("id", allowanceId)
      .eq("user_id", userId);

    if (error) {
      return errorState(error.message);
    }

    revalidatePath("/budgets");
    revalidatePath("/dashboard");

    return successState(
      isActive
        ? "Anggaran Harian diaktifkan."
        : "Anggaran Harian dinonaktifkan.",
    );
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal mengubah status Anggaran Harian.",
    );
  }
}
