import { createClient } from "@/lib/supabase/server";

export type CategoryRow = {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
};

type TransactionUsage = {
  category_id: string | null;
};

export type CategorySummary = {
  id: string;
  name: string;
  type: CategoryRow["type"];
  color: string;
  icon: string | null;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
};

export async function getCategoriesGrouped() {
  const supabase = await createClient();

  const [categoriesResult, usageResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, type, color, icon, is_active, created_at")
      .order("name", { ascending: true }),
    supabase.from("transactions").select("category_id"),
  ]);

  if (categoriesResult.error) {
    throw new Error(categoriesResult.error.message);
  }

  if (usageResult.error) {
    throw new Error(usageResult.error.message);
  }

  const usageMap = new Map<string, number>();

  for (const row of (usageResult.data ?? []) as TransactionUsage[]) {
    if (!row.category_id) continue;

    usageMap.set(row.category_id, (usageMap.get(row.category_id) ?? 0) + 1);
  }

  const categories = ((categoriesResult.data ?? []) as CategoryRow[]).map(
    (category) => ({
      id: category.id,
      name: category.name,
      type: category.type,
      color: category.color ?? "#94A3B8",
      icon: category.icon,
      isActive: category.is_active,
      usageCount: usageMap.get(category.id) ?? 0,
      createdAt: category.created_at,
    }),
  );

  return {
    incomeCategories: categories.filter((category) => category.type === "income"),
    expenseCategories: categories.filter(
      (category) => category.type === "expense",
    ),
  };
}

export async function getCategoryById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, type, color, icon, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as CategoryRow | null;
}
