"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  categorySchema,
  type CategoryInput,
} from "@/lib/validations/categories";
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

function mapCategoryError(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("duplicate") ||
    lower.includes("categories_user_id_type_name_unique_idx")
  ) {
    return "Nama kategori sudah ada untuk tipe ini.";
  }

  return message;
}

export async function createCategoryAction(
  values: CategoryInput,
): Promise<MutationState> {
  const parsed = categorySchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data kategori tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserId();
    const { error } = await supabase.from("categories").insert({
      user_id: userId,
      name: parsed.data.name,
      type: parsed.data.type,
      color: parsed.data.color,
      icon: parsed.data.icon || null,
    });

    if (error) {
      return errorState(mapCategoryError(error.message));
    }

    revalidatePath("/categories");

    return successState("Kategori berhasil ditambahkan.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal membuat kategori.",
    );
  }
}

export async function updateCategoryAction(
  categoryId: string,
  values: CategoryInput,
): Promise<MutationState> {
  const parsed = categorySchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data kategori tidak valid.",
    );
  }

  try {
    const { supabase } = await getCurrentUserId();
    const { error } = await supabase
      .from("categories")
      .update({
        name: parsed.data.name,
        type: parsed.data.type,
        color: parsed.data.color,
        icon: parsed.data.icon || null,
      })
      .eq("id", categoryId);

    if (error) {
      return errorState(mapCategoryError(error.message));
    }

    revalidatePath("/categories");

    return successState("Kategori berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal memperbarui kategori.",
    );
  }
}

export async function deleteCategoryAction(categoryId: string) {
  const { supabase } = await getCurrentUserId();

  const { count, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count ?? 0) > 0) {
    throw new Error("Kategori masih dipakai transaksi dan tidak bisa dihapus.");
  }

  const { error } = await supabase.from("categories").delete().eq("id", categoryId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/categories");
}
