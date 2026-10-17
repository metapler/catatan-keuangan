import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import {
  getExpenseBudgetCategories,
  type BudgetExpenseCategory,
} from "@/lib/queries/budgets";

export type DailyAllowanceRow = {
  id: string;
  user_id: string;
  category_id: string;
  daily_amount: number;
  start_date: string;
  rollover_enabled: boolean;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyAllowanceTransaction = {
  id: string;
  amount: number;
  description: string | null;
  transactionDate: string;
};

export type DailyAllowanceSummary = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  dailyAmount: number;
  startDate: string;
  rolloverEnabled: boolean;
  isActive: boolean;
  note: string | null;
  // Perhitungan Hari Ini
  todayAllowance: number;
  todaySpent: number;
  todayRemaining: number;
  todayPercentageUsed: number;
  // Akumulasi / Rollover
  pastDays: number;
  pastAllowance: number;
  pastSpent: number;
  accumulatedSurplus: number;
  // Total Tersedia
  totalAvailableToday: number;
  daysActive: number;
  // Status
  status: "aman" | "hampir habis" | "jatah habis" | "defisit akumulasi";
  // Transaksi hari ini
  todayTransactions: DailyAllowanceTransaction[];
};

export type DailyAllowancesQueryResult = {
  allowances: DailyAllowanceSummary[];
  expenseCategories: BudgetExpenseCategory[];
  totalDailyAmount: number;
  totalTodaySpent: number;
  totalTodayRemaining: number;
  totalAccumulatedSurplus: number;
  totalAvailableToday: number;
  activeCount: number;
};

export function getDailyAllowanceStatus(
  todaySpent: number,
  todayAllowance: number,
  accumulatedSurplus: number,
): DailyAllowanceSummary["status"] {
  if (todaySpent >= todayAllowance && todayAllowance > 0) {
    return "jatah habis";
  }
  if (todayAllowance > 0 && todaySpent / todayAllowance >= 0.8) {
    return "hampir habis";
  }
  if (accumulatedSurplus < 0) {
    return "defisit akumulasi";
  }
  return "aman";
}

export async function getDailyAllowances(): Promise<DailyAllowancesQueryResult> {
  const supabase = await createClient();
  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");

  const [allowancesResult, categories] = await Promise.all([
    supabase
      .from("daily_allowances")
      .select(
        "id, user_id, category_id, daily_amount, start_date, rollover_enabled, is_active, note, created_at, updated_at",
      )
      .order("created_at", { ascending: false }),
    getExpenseBudgetCategories(),
  ]);

  if (allowancesResult.error) {
    // Jika tabel belum dibuat (misal di Supabase pengguna), kembalikan array kosong gracefully
    if (allowancesResult.error.message.includes("does not exist")) {
      return {
        allowances: [],
        expenseCategories: categories,
        totalDailyAmount: 0,
        totalTodaySpent: 0,
        totalTodayRemaining: 0,
        totalAccumulatedSurplus: 0,
        totalAvailableToday: 0,
        activeCount: 0,
      };
    }
    throw new Error(allowancesResult.error.message);
  }

  const allowanceRows = (allowancesResult.data ?? []) as DailyAllowanceRow[];
  if (allowanceRows.length === 0) {
    return {
      allowances: [],
      expenseCategories: categories,
      totalDailyAmount: 0,
      totalTodaySpent: 0,
      totalTodayRemaining: 0,
      totalAccumulatedSurplus: 0,
      totalAvailableToday: 0,
      activeCount: 0,
    };
  }

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Ambil tanggal mulai paling awal dari semua allowance untuk batas query transaksi
  const earliestStartDate = allowanceRows.reduce((earliest, row) => {
    return row.start_date < earliest ? row.start_date : earliest;
  }, todayStr);

  const categoryIds = allowanceRows.map((r) => r.category_id);

  // Ambil seluruh transaksi expense dari earliestStartDate sampai todayStr untuk kategori-kategori ini
  const { data: transactionsData, error: transactionsError } = await supabase
    .from("transactions")
    .select("id, amount, category_id, description, transaction_date")
    .eq("type", "expense")
    .in("category_id", categoryIds)
    .gte("transaction_date", earliestStartDate)
    .lte("transaction_date", todayStr)
    .order("transaction_date", { ascending: false });

  if (transactionsError) {
    throw new Error(transactionsError.message);
  }

  const transactions = (transactionsData ?? []) as Array<{
    id: string;
    amount: number;
    category_id: string;
    description: string | null;
    transaction_date: string;
  }>;

  const allowances: DailyAllowanceSummary[] = allowanceRows.map((row) => {
    const category = categoryMap.get(row.category_id);
    const dailyAmount = Number(row.daily_amount);
    const startDateObj = startOfDay(parseISO(row.start_date));
    const rawDiff = differenceInCalendarDays(today, startDateObj);

    const isFuture = rawDiff < 0;
    const daysActive = isFuture ? 0 : rawDiff + 1;
    const pastDays = isFuture ? 0 : Math.max(0, rawDiff);

    // Filter transaksi kategori ini
    const catTransactions = transactions.filter(
      (tx) => tx.category_id === row.category_id && tx.transaction_date >= row.start_date,
    );

    // Transaksi hari ini
    const todayTransactions = catTransactions
      .filter((tx) => tx.transaction_date === todayStr)
      .map((tx) => ({
        id: tx.id,
        amount: Number(tx.amount),
        description: tx.description,
        transactionDate: tx.transaction_date,
      }));

    const todaySpent = todayTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const todayAllowance = isFuture ? 0 : dailyAmount;
    const todayRemaining = todayAllowance - todaySpent;
    const todayPercentageUsed =
      todayAllowance > 0 ? Math.min(100, (todaySpent / todayAllowance) * 100) : 0;

    // Transaksi hari-hari kemarin (sejak startDate s/d kemarin)
    const pastTransactions = catTransactions.filter(
      (tx) => tx.transaction_date < todayStr,
    );
    const pastSpent = pastTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const pastAllowance = pastDays * dailyAmount;

    // Sisa akumulasi / celengan sisa dari hari-hari sebelumnya
    const accumulatedSurplus = row.rollover_enabled ? pastAllowance - pastSpent : 0;

    // Siap pakai hari ini: murni dari sisa anggaran hari ini saja (tidak menjumlahkan sisa kemarin)
    const totalAvailableToday = todayRemaining;

    return {
      id: row.id,
      categoryId: row.category_id,
      categoryName: category?.name ?? "Kategori tidak ditemukan",
      categoryColor: category?.color ?? "#F43F5E",
      categoryIcon: category?.icon ?? null,
      dailyAmount,
      startDate: row.start_date,
      rolloverEnabled: row.rollover_enabled,
      isActive: row.is_active,
      note: row.note,
      todayAllowance,
      todaySpent,
      todayRemaining,
      todayPercentageUsed,
      pastDays,
      pastAllowance,
      pastSpent,
      accumulatedSurplus,
      totalAvailableToday,
      daysActive,
      status: getDailyAllowanceStatus(todaySpent, todayAllowance, accumulatedSurplus),
      todayTransactions,
    };
  });

  const activeAllowances = allowances.filter((a) => a.isActive);

  const totalDailyAmount = activeAllowances.reduce((sum, a) => sum + a.dailyAmount, 0);
  const totalTodaySpent = activeAllowances.reduce((sum, a) => sum + a.todaySpent, 0);
  const totalTodayRemaining = activeAllowances.reduce((sum, a) => sum + a.todayRemaining, 0);
  const totalAccumulatedSurplus = activeAllowances.reduce(
    (sum, a) => sum + a.accumulatedSurplus,
    0,
  );
  // Total siap pakai hari ini = total sisa jatah anggaran hari ini
  const totalAvailableToday = totalTodayRemaining;

  return {
    allowances,
    expenseCategories: categories,
    totalDailyAmount,
    totalTodaySpent,
    totalTodayRemaining,
    totalAccumulatedSurplus,
    totalAvailableToday,
    activeCount: activeAllowances.length,
  };
}
