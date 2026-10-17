"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createSavingsProgressSchema,
  savingsGoalSchema,
  type SavingsGoalInput,
} from "@/lib/validations/savings-goals";
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

function mapSavingsGoalPayload(values: SavingsGoalInput) {
  return {
    name: values.name,
    target_amount: values.targetAmount,
    current_amount: values.currentAmount,
    target_date: values.targetDate || null,
    status: values.status,
  };
}

export async function createSavingsGoalAction(
  values: SavingsGoalInput,
): Promise<MutationState> {
  const parsed = savingsGoalSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data target tabungan tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const { error } = await supabase.from("savings_goals").insert({
      user_id: userId,
      ...mapSavingsGoalPayload(parsed.data),
    });

    if (error) {
      return errorState(error.message);
    }

    revalidatePath("/savings-goals");
    revalidatePath("/dashboard");

    return successState("Target tabungan berhasil ditambahkan.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal membuat target tabungan.",
    );
  }
}

export async function updateSavingsGoalAction(
  goalId: string,
  values: SavingsGoalInput,
): Promise<MutationState> {
  const parsed = savingsGoalSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data target tabungan tidak valid.",
    );
  }

  try {
    const { supabase } = await getCurrentUserContext();
    const { error } = await supabase
      .from("savings_goals")
      .update(mapSavingsGoalPayload(parsed.data))
      .eq("id", goalId);

    if (error) {
      return errorState(error.message);
    }

    revalidatePath("/savings-goals");
    revalidatePath("/dashboard");

    return successState("Target tabungan berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal memperbarui target tabungan.",
    );
  }
}

export async function updateSavingsGoalProgressAction(
  goalId: string,
  currentAmount: number,
): Promise<MutationState> {
  try {
    const { supabase } = await getCurrentUserContext();
    const { data: goal, error: goalError } = await supabase
      .from("savings_goals")
      .select("target_amount")
      .eq("id", goalId)
      .maybeSingle();

    if (goalError) {
      return errorState(goalError.message);
    }

    if (!goal) {
      return errorState("Target tabungan tidak ditemukan.");
    }

    const parsed = createSavingsProgressSchema(Number(goal.target_amount)).safeParse({
      currentAmount,
    });

    if (!parsed.success) {
      return errorState(
        parsed.error.issues[0]?.message ?? "Nominal progress tidak valid.",
      );
    }

    const { error } = await supabase
      .from("savings_goals")
      .update({
        current_amount: parsed.data.currentAmount,
      })
      .eq("id", goalId);

    if (error) {
      return errorState(error.message);
    }

    revalidatePath("/savings-goals");
    revalidatePath("/dashboard");

    return successState("Progress tabungan berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal memperbarui progress tabungan.",
    );
  }
}

export async function deleteSavingsGoalAction(goalId: string) {
  const { supabase } = await getCurrentUserContext();
  const { error } = await supabase
    .from("savings_goals")
    .delete()
    .eq("id", goalId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/savings-goals");
  revalidatePath("/dashboard");
}
