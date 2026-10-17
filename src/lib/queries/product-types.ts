import { createClient } from "@/lib/supabase/server";
import { BUILTIN_PRODUCT_TYPES } from "@/lib/validations/product-types";

export type ProductTypeRow = {
  id: string;
  name: string;
  is_builtin: boolean;
  is_active: boolean;
  created_at: string;
};

export type ProductTypeSummary = {
  id: string;
  name: string;
  isBuiltin: boolean;
  isActive: boolean;
  createdAt: string;
};

function mapProductType(row: ProductTypeRow): ProductTypeSummary {
  return {
    id: row.id,
    name: row.name,
    isBuiltin: row.is_builtin,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

/**
 * Seed 4 tipe bawaan bila user belum punya satu pun baris.
 * Setelah itu tidak pernah auto-seed lagi (rename bawaan aman).
 */
export async function ensureBuiltinProductTypes(): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_types")
    .select("id")
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  if ((data ?? []).length > 0) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error: insertError } = await supabase.from("product_types").insert(
    BUILTIN_PRODUCT_TYPES.map((name) => ({
      user_id: user.id,
      name,
      is_builtin: true,
      is_active: true,
    })),
  );

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function getProductTypes({
  activeOnly = true,
}: {
  activeOnly?: boolean;
} = {}): Promise<ProductTypeSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("product_types")
    .select("id, name, is_builtin, is_active, created_at")
    .order("is_builtin", { ascending: false })
    .order("name", { ascending: true });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ProductTypeRow[]).map(mapProductType);
}

export async function getProductTypeById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_types")
    .select("id, name, is_builtin, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  return mapProductType(data as ProductTypeRow);
}
