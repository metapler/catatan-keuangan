import { createClient } from "@/lib/supabase/server";
import {
  buildUsageCount,
  type UsageCount,
} from "@/lib/utils/sort-by-usage";

type BudgetRow = {
  id: string;
  category_id: string;
  period_month: number;
  period_year: number;
  amount: number;
  is_auto_generated: boolean;
  deleted_at: string | null;
  created_at: string;
};

type BudgetCategoryRow = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  type: "expense";
  is_active: boolean;
};

type ExpenseTransactionRow = {
  category_id: string | null;
  amount: number;
};

export type BudgetExpenseCategory = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isActive: boolean;
};

export type BudgetSummary = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  amount: number;
  realized: number;
  remaining: number;
  percentageUsed: number;
  status: "aman" | "hampir habis" | "melewati budget";
  periodMonth: number;
  periodYear: number;
  createdAt: string;
};

export type BudgetsQueryResult = {
  budgets: BudgetSummary[];
  expenseCategories: BudgetExpenseCategory[];
  totalBudget: number;
  totalRealized: number;
  totalRemaining: number;
  atRiskCount: number;
  selectedMonth: number;
  selectedYear: number;
  categoryUsage: UsageCount;
};

export function getBudgetStatus(percentageUsed: number): BudgetSummary["status"] {
  if (percentageUsed > 100) {
    return "melewati budget";
  }

  if (percentageUsed >= 80) {
    return "hampir habis";
  }

  return "aman";
}

export async function getExpenseBudgetCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color, icon, type, is_active")
    .eq("type", "expense")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as BudgetCategoryRow[]).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color ?? "#F43F5E",
    icon: category.icon,
    isActive: category.is_active,
  }));
}

export async function getBudgetsByPeriod({
  month,
  year,
}: {
  month: number;
  year: number;
}): Promise<BudgetsQueryResult> {
  const supabase = await createClient();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

  const [budgetsResult, categories, expenseTransactionsResult, categoryUsage] =
    await Promise.all([
      supabase
        .from("budgets")
        .select("id, category_id, period_month, period_year, amount, is_auto_generated, deleted_at, created_at")
        .eq("period_month", month)
        .eq("period_year", year)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      getExpenseBudgetCategories(),
      supabase
        .from("transactions")
        .select("category_id, amount")
        .eq("type", "expense")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate),
      (async (): Promise<UsageCount> => {
        try {
          const { data, error } = await supabase
            .from("budgets")
            .select("category_id")
            .is("deleted_at", null);

          if (error) throw new Error(error.message);

          return buildUsageCount(
            ((data ?? []) as Array<{ category_id: string | null }>).map(
              (row) => row.category_id,
            ),
          );
        } catch {
          return {};
        }
      })(),
    ]);

  if (budgetsResult.error) {
    throw new Error(budgetsResult.error.message);
  }

  if (expenseTransactionsResult.error) {
    throw new Error(expenseTransactionsResult.error.message);
  }

  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const realizedMap = new Map<string, number>();

  for (const transaction of (expenseTransactionsResult.data ?? []) as ExpenseTransactionRow[]) {
    if (!transaction.category_id) continue;

    realizedMap.set(
      transaction.category_id,
      (realizedMap.get(transaction.category_id) ?? 0) + Number(transaction.amount),
    );
  }

  const budgets = ((budgetsResult.data ?? []) as BudgetRow[]).map((budget) => {
    const category = categoryMap.get(budget.category_id);
    const realized = realizedMap.get(budget.category_id) ?? 0;
    const amount = Number(budget.amount);
    const remaining = amount - realized;
    const percentageUsed = amount > 0 ? (realized / amount) * 100 : 0;

    return {
      id: budget.id,
      categoryId: budget.category_id,
      categoryName: category?.name ?? "Kategori tidak ditemukan",
      categoryColor: category?.color ?? "#F43F5E",
      categoryIcon: category?.icon ?? null,
      amount,
      realized,
      remaining,
      percentageUsed,
      status: getBudgetStatus(percentageUsed),
      periodMonth: budget.period_month,
      periodYear: budget.period_year,
      createdAt: budget.created_at,
    } satisfies BudgetSummary;
  });

  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalRealized = budgets.reduce((sum, budget) => sum + budget.realized, 0);
  const totalRemaining = budgets.reduce((sum, budget) => sum + budget.remaining, 0);
  const atRiskCount = budgets.filter(
    (budget) => budget.status !== "aman",
  ).length;

  return {
    budgets,
    expenseCategories: categories,
    totalBudget,
    totalRealized,
    totalRemaining,
    atRiskCount,
    selectedMonth: month,
    selectedYear: year,
    categoryUsage,
  };
}
