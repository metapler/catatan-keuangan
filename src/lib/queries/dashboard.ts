import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";
import {
  buildPeriodAggregation,
  calculateAccountBalances,
  sumTransactionAmountsByType,
  type BalanceAccountRow,
  type BalanceTransactionRow,
  type PeriodAggregationGranularity,
} from "@/lib/queries/aggregates";
import { calculateMonthOverMonth } from "@/lib/utils/finance";
import { getAccountsWithBalances } from "@/lib/queries/accounts";
import { getSavingsGoals } from "@/lib/queries/savings-goals";
import {
  getTransactionFormOptions,
  getTransactionUsage,
  type TransactionOptionAccount,
  type TransactionOptionCategory,
} from "@/lib/queries/transactions";

type DashboardTransactionRow = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  description: string | null;
  transaction_date: string;
  created_at: string;
  account_id: string | null;
  category_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
};

type MonthlyChartPoint = ReturnType<typeof buildPeriodAggregation>[number];

type PieChartPoint = {
  name: string;
  value: number;
  color: string;
};

type RecentTransaction = {
  id: string;
  type: DashboardTransactionRow["type"];
  amount: number;
  description: string | null;
  transactionDate: string;
  accountLabel: string;
  transferFrom: string | null;
  transferTo: string | null;
  categoryLabel: string | null;
};

export type ChartPeriodMode = "last-months" | "last-years" | "year" | "month-range";

export type ChartPeriod =
  | { mode: "last-months"; months: number }
  | { mode: "last-years"; years: number }
  | { mode: "year"; year: number }
  | { mode: "month-range"; from: string; to: string };

export const chartPeriodModes: Array<{
  value: ChartPeriodMode;
  label: string;
}> = [
    { value: "last-months", label: "Beberapa bulan terakhir" },
    { value: "last-years", label: "Beberapa tahun terakhir" },
    { value: "year", label: "Tahun tertentu" },
    { value: "month-range", label: "Rentang bulan" },
  ];

const defaultChartPeriod: ChartPeriod = { mode: "last-months", months: 6 };

const monthKeyPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseMonthKey(value: string | undefined, fallback: string) {
  return value && monthKeyPattern.test(value) ? value : fallback;
}

export type DashboardData = {
  summary: {
    totalBalance: number;
    incomeThisMonth: number;
    expenseThisMonth: number;
    remainingThisMonth: number;
    activeSavingsGoals: number;
    incomePrevMonth: number;
    expensePrevMonth: number;
    remainingPrevMonth: number;
    previousBalance: number;
    incomeChangePct: number | null;
    expenseChangePct: number | null;
    remainingChangePct: number | null;
    balanceChangePct: number | null;
  };
  charts: {
    monthlyComparison: MonthlyChartPoint[];
    expenseByCategory: PieChartPoint[];
    cashflowTrend: MonthlyChartPoint[];
    periodLabel: string;
    granularity: PeriodAggregationGranularity;
  };
  usage: {
    accountUsage: Record<string, number>;
    categoryUsage: Record<string, number>;
  };
  recentTransactions: RecentTransaction[];
  accounts: TransactionOptionAccount[];
  incomeCategories: TransactionOptionCategory[];
  expenseCategories: TransactionOptionCategory[];
};

export async function getDashboardData(
  period: ChartPeriod = defaultChartPeriod,
): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const previousMonthStart = startOfMonth(subMonths(now, 1));
  const previousMonthEnd = endOfMonth(subMonths(now, 1));

  const currentYear = now.getFullYear();
  let chartRangeStart: Date;
  let chartRangeEnd: Date;
  let buckets: Array<{ key: string; label: string }>;
  let granularity: PeriodAggregationGranularity;
  let periodLabel: string;

  if (period.mode === "last-years") {
    const years = period.years;
    chartRangeStart = startOfMonth(subMonths(now, years * 12 - 1));
    chartRangeEnd = currentMonthEnd;
    buckets = Array.from({ length: years }, (_, index) => {
      const date = subMonths(now, (years - 1 - index) * 12);
      const yearLabel = format(date, "yyyy");

      return { key: yearLabel, label: yearLabel };
    });
    granularity = "year";
    periodLabel = `${years} tahun terakhir`;
  } else if (period.mode === "year") {
    const year = Math.min(Math.max(period.year, 2000), currentYear);
    chartRangeStart = new Date(year, 0, 1);
    chartRangeEnd = new Date(year, 11, 31);
    buckets = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(year, index, 1);

      return {
        key: format(date, "yyyy-MM"),
        label: format(date, "MMM", { locale: localeId }),
      };
    });
    granularity = "month";
    periodLabel = `Tahun ${year}`;
  } else if (period.mode === "month-range") {
    const fallbackFrom = format(subMonths(now, 5), "yyyy-MM");
    const fallbackTo = format(now, "yyyy-MM");
    let fromKey = parseMonthKey(period.from, fallbackFrom);
    let toKey = parseMonthKey(period.to, fallbackTo);

    if (fromKey > toKey) {
      [fromKey, toKey] = [toKey, fromKey];
    }

    const [fromYear = 0, fromMonth = 1] = fromKey.split("-").map(Number);
    const [toYear = 0, toMonth = 1] = toKey.split("-").map(Number);
    const fromDate = new Date(fromYear, fromMonth - 1, 1);
    const toDate = new Date(toYear, toMonth - 1, 1);
    const monthCount =
      (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
    const labelFormat = monthCount > 12 ? "MMM yy" : "MMM";

    chartRangeStart = startOfMonth(fromDate);
    chartRangeEnd = endOfMonth(toDate);
    buckets = Array.from({ length: monthCount }, (_, index) => {
      const date = new Date(fromYear, fromMonth - 1 + index, 1);

      return {
        key: format(date, "yyyy-MM"),
        label: format(date, labelFormat, { locale: localeId }),
      };
    });
    granularity = "month";
    periodLabel = `${format(fromDate, "MMM yyyy", { locale: localeId })} – ${format(
      toDate,
      "MMM yyyy",
      { locale: localeId },
    )}`;
  } else {
    const months = period.months;
    const labelFormat = months > 12 ? "MMM yy" : "MMM";
    chartRangeStart = startOfMonth(subMonths(now, months - 1));
    chartRangeEnd = currentMonthEnd;
    buckets = Array.from({ length: months }, (_, index) => {
      const date = subMonths(now, months - 1 - index);

      return {
        key: format(date, "yyyy-MM"),
        label: format(date, labelFormat, { locale: localeId }),
      };
    });
    granularity = "month";
    periodLabel = `${months} bulan terakhir`;
  }

  const [
    accountsData,
    savingsGoalsData,
    options,
    activeFormOptions,
    recentTransactionsResult,
    chartTransactionsResult,
    currentMonthTransactionsResult,
    previousMonthTransactionsResult,
    balanceHistoryResult,
    transactionUsage,
  ] = await Promise.all([
    getAccountsWithBalances(),
    getSavingsGoals(),
    getTransactionFormOptions({ activeOnly: false }),
    getTransactionFormOptions({ activeOnly: true }),
    supabase
      .from("transactions")
      .select(
        "id, type, amount, description, transaction_date, created_at, account_id, category_id, from_account_id, to_account_id",
      )
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("transactions")
      .select(
        "id, type, amount, description, transaction_date, created_at, account_id, category_id, from_account_id, to_account_id",
      )
      .gte("transaction_date", format(chartRangeStart, "yyyy-MM-dd"))
      .lte("transaction_date", format(chartRangeEnd, "yyyy-MM-dd"))
      .order("transaction_date", { ascending: false }),
    supabase
      .from("transactions")
      .select(
        "id, type, amount, description, transaction_date, created_at, account_id, category_id, from_account_id, to_account_id",
      )
      .gte("transaction_date", format(currentMonthStart, "yyyy-MM-dd"))
      .lte("transaction_date", format(currentMonthEnd, "yyyy-MM-dd"))
      .order("transaction_date", { ascending: false }),
    supabase
      .from("transactions")
      .select(
        "id, type, amount, description, transaction_date, created_at, account_id, category_id, from_account_id, to_account_id",
      )
      .gte("transaction_date", format(previousMonthStart, "yyyy-MM-dd"))
      .lte("transaction_date", format(previousMonthEnd, "yyyy-MM-dd")),
    Promise.all([
      supabase.from("accounts").select("id, name, type, initial_balance, is_active, created_at"),
      supabase
        .from("transactions")
        .select("id, type, account_id, from_account_id, to_account_id, amount")
        .lte("transaction_date", format(previousMonthEnd, "yyyy-MM-dd")),
    ]),
    getTransactionUsage().catch(() => ({ accountUsage: {}, categoryUsage: {} })),
  ]);

  if (recentTransactionsResult.error) {
    throw new Error(recentTransactionsResult.error.message);
  }

  if (chartTransactionsResult.error) {
    throw new Error(chartTransactionsResult.error.message);
  }

  if (currentMonthTransactionsResult.error) {
    throw new Error(currentMonthTransactionsResult.error.message);
  }

  if (previousMonthTransactionsResult.error) {
    throw new Error(previousMonthTransactionsResult.error.message);
  }

  const [balanceAccountsResult, balanceTransactionsResult] = balanceHistoryResult;

  if (balanceAccountsResult.error) {
    throw new Error(balanceAccountsResult.error.message);
  }

  if (balanceTransactionsResult.error) {
    throw new Error(balanceTransactionsResult.error.message);
  }

  const accountsMap = new Map(options.accounts.map((account) => [account.id, account]));
  const categoriesMap = new Map(
    [...options.incomeCategories, ...options.expenseCategories].map((category) => [
      category.id,
      category,
    ]),
  );

  const latestTransactions: RecentTransaction[] = (
    (recentTransactionsResult.data ?? []) as DashboardTransactionRow[]
  ).map((transaction) => {
    let accountLabel = "-";
    let transferFrom: string | null = null;
    let transferTo: string | null = null;
    if (transaction.type === "transfer") {
      transferFrom = transaction.from_account_id
        ? accountsMap.get(transaction.from_account_id)?.name ?? "Unknown"
        : "Unknown";
      transferTo = transaction.to_account_id
        ? accountsMap.get(transaction.to_account_id)?.name ?? "Unknown"
        : "Unknown";
    } else if (transaction.account_id) {
      accountLabel = accountsMap.get(transaction.account_id)?.name ?? "-";
    }

    return {
      id: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount),
      description: transaction.description,
      transactionDate: transaction.transaction_date,
      accountLabel,
      transferFrom,
      transferTo,
      categoryLabel: transaction.category_id
        ? categoriesMap.get(transaction.category_id)?.name ?? null
        : null,
    };
  });

  const chartTransactions = (
    (chartTransactionsResult.data ?? []) as DashboardTransactionRow[]
  ).map((transaction) => ({
    type: transaction.type,
    amount: Number(transaction.amount),
    transaction_date: transaction.transaction_date,
  }));

  const currentMonthTransactions = (
    (currentMonthTransactionsResult.data ?? []) as DashboardTransactionRow[]
  ).map((transaction) => ({
    type: transaction.type,
    amount: Number(transaction.amount),
    category_id: transaction.category_id,
  }));

  const periodAggregation = buildPeriodAggregation(
    chartTransactions,
    buckets,
    granularity,
  );

  const incomeThisMonth = sumTransactionAmountsByType(
    currentMonthTransactions,
    "income",
  );
  const expenseThisMonth = sumTransactionAmountsByType(
    currentMonthTransactions,
    "expense",
  );

  const previousMonthTransactions = (
    (previousMonthTransactionsResult.data ?? []) as DashboardTransactionRow[]
  ).map((transaction) => ({
    type: transaction.type,
    amount: Number(transaction.amount),
  }));

  const incomePrevMonth = sumTransactionAmountsByType(
    previousMonthTransactions,
    "income",
  );
  const expensePrevMonth = sumTransactionAmountsByType(
    previousMonthTransactions,
    "expense",
  );
  const remainingPrevMonth = incomePrevMonth - expensePrevMonth;

  const previousBalance = calculateAccountBalances(
    ((balanceAccountsResult.data ?? []) as BalanceAccountRow[]).map((account) => ({
      ...account,
      initial_balance: Number(account.initial_balance),
    })),
    ((balanceTransactionsResult.data ?? []) as BalanceTransactionRow[]).map(
      (transaction) => ({ ...transaction, amount: Number(transaction.amount) }),
    ),
  ).totalBalance;

  const remainingThisMonth = incomeThisMonth - expenseThisMonth;

  const incomeMoM = calculateMonthOverMonth(incomeThisMonth, incomePrevMonth);
  const expenseMoM = calculateMonthOverMonth(expenseThisMonth, expensePrevMonth);
  const remainingMoM = calculateMonthOverMonth(
    remainingThisMonth,
    remainingPrevMonth,
  );
  const balanceMoM = calculateMonthOverMonth(
    accountsData.totalBalance,
    previousBalance,
  );

  const expenseByCategoryMap = new Map<string, number>();

  currentMonthTransactions
    .filter((transaction) => transaction.type === "expense" && transaction.category_id)
    .forEach((transaction) => {
      const categoryId = transaction.category_id!;
      const categoryName = categoriesMap.get(categoryId)?.name ?? "Lainnya";
      expenseByCategoryMap.set(
        categoryName,
        (expenseByCategoryMap.get(categoryName) ?? 0) + transaction.amount,
      );
    });

  const colors = [
    "#F43F5E",
    "#FB923C",
    "#FACC15",
    "#4ADE80",
    "#38BDF8",
    "#818CF8",
    "#C084FC",
    "#F472B6",
  ];

  const expenseByCategory: PieChartPoint[] = Array.from(
    expenseByCategoryMap.entries(),
  ).map(([name, value], index) => ({
    name,
    value,
    color: colors[index % colors.length]!,
  }));

  return {
    summary: {
      totalBalance: accountsData.totalBalance,
      incomeThisMonth,
      expenseThisMonth,
      remainingThisMonth,
      activeSavingsGoals: savingsGoalsData.activeCount,
      incomePrevMonth,
      expensePrevMonth,
      remainingPrevMonth,
      previousBalance,
      incomeChangePct: incomeMoM.pct,
      expenseChangePct: expenseMoM.pct,
      remainingChangePct: remainingMoM.pct,
      balanceChangePct: balanceMoM.pct,
    },
    charts: {
      monthlyComparison: periodAggregation,
      expenseByCategory,
      cashflowTrend: periodAggregation,
      periodLabel,
      granularity,
    },
    recentTransactions: latestTransactions,
    accounts: activeFormOptions.accounts,
    incomeCategories: activeFormOptions.incomeCategories,
    expenseCategories: activeFormOptions.expenseCategories,
    usage: transactionUsage,
  };
}
