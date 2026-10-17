"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import type { AuthActionState } from "@/types/auth";

function buildErrorState(message: string): AuthActionState {
  return {
    status: "error",
    message,
  };
}

export async function loginAction(
  values: LoginInput,
): Promise<AuthActionState | never> {
  const parsedValues = loginSchema.safeParse(values);

  if (!parsedValues.success) {
    return buildErrorState(
      parsedValues.error.issues[0]?.message ?? "Data login tidak valid.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsedValues.data);

  if (error) {
    return buildErrorState(error.message);
  }

  redirect("/dashboard");
}

