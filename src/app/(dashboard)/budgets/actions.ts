"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  budgetSchema,
  type BudgetInput,
} from "@/lib/validations/budgets";
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

function mapBudgetError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("budgets_unique_period")) {
    return "Budget untuk kategori dan periode ini sudah ada.";
  }

  if (lower.includes("duplicate")) {
    return "Budget untuk kategori dan periode ini sudah ada.";
  }

  if (lower.includes("budget only allowed for expense category")) {
    return "Budget hanya boleh memakai kategori expense.";
  }

  if (lower.includes("budget category does not belong")) {
    return "Kategori budget tidak sesuai dengan user aktif.";
  }

  return message;
}

export async function createBudgetAction(values: BudgetInput): Promise<MutationState> {
  const parsed = budgetSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data budget tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const { error } = await supabase.from("budgets").insert({
      user_id: userId,
      category_id: parsed.data.categoryId,
      period_month: parsed.data.periodMonth,
      period_year: parsed.data.periodYear,
      amount: parsed.data.amount,
    });

    if (error) {
      return errorState(mapBudgetError(error.message));
    }

    revalidatePath("/budgets");
    revalidatePath("/dashboard");

    return successState("Budget berhasil ditambahkan.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal membuat budget.",
    );
  }
}

export async function updateBudgetAction(
  budgetId: string,
  values: BudgetInput,
): Promise<MutationState> {
  const parsed = budgetSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data budget tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const { data, error } = await supabase
      .from("budgets")
      .update({
        category_id: parsed.data.categoryId,
        period_month: parsed.data.periodMonth,
        period_year: parsed.data.periodYear,
        amount: parsed.data.amount,
      })
      .eq("id", budgetId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      return errorState(mapBudgetError(error.message));
    }

    if (!data) {
      return errorState("Budget tidak ditemukan atau sudah dihapus.");
    }

    revalidatePath("/budgets");
    revalidatePath("/dashboard");

    return successState("Budget berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal memperbarui budget.",
    );
  }
}

export async function deleteBudgetAction(budgetId: string) {
  const { supabase, userId } = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("budgets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", budgetId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error("Budget tidak ditemukan atau tidak memiliki izin menghapus.");
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}
