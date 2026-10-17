import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Coins,
  Landmark,
  Layers,
  PiggyBank,
  Receipt,
  Slash,
  Smartphone,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type MonthOverMonthTrend = "up" | "down" | "neutral";

export type MonthOverMonth = {
  /** Percentage change vs previous period, or null when previous is 0 and current is not. */
  pct: number | null;
  trend: MonthOverMonthTrend;
};

export function calculateMonthOverMonth(
  current: number,
  previous: number,
): MonthOverMonth {
  if (previous === 0) {
    if (current === 0) {
      return { pct: 0, trend: "neutral" };
    }
    return { pct: null, trend: current > previous ? "up" : "down" };
  }

  if (current === previous) {
    return { pct: 0, trend: "neutral" };
  }

  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { pct, trend: pct > 0 ? "up" : "down" };
}

export function formatMonthOverMonthPct(pct: number): string {
  const sign = pct > 0 ? "+" : pct < 0 ? "-" : "";
  return `${sign}${Math.abs(pct).toFixed(1).replace(".", ",")}%`;
}

export type AccountType =
  | "cash"
  | "bank"
  | "ewallet"
  | "savings"
  | "crypto"
  | "hutang"
  | (string & {});
export type CategoryType = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer";
export type BudgetStatus = "aman" | "hampir habis" | "melewati budget";
export type SavingsGoalStatus = "active" | "completed" | "cancelled";

/** Color classes built on the --status-* tokens (globals.css) — single source of truth. */
const statusBadge = {
  income: "border-status-income-border bg-status-income-bg text-status-income",
  expense:
    "border-status-expense-border bg-status-expense-bg text-status-expense",
  transfer:
    "border-status-transfer-border bg-status-transfer-bg text-status-transfer",
  warning:
    "border-status-warning-border bg-status-warning-bg text-status-warning",
  violet:
    "border-status-violet-border bg-status-violet-bg text-status-violet",
  purple:
    "border-status-purple-border bg-status-purple-bg text-status-purple",
  neutral: "border-border bg-muted text-muted-foreground",
} as const;

export function getAccountTypeMeta(type: string) {
  const config: Record<
    string,
    { label: string; icon: LucideIcon; className: string }
  > = {
    cash: {
      label: "Tunai",
      icon: Wallet,
      className: statusBadge.warning,
    },
    bank: {
      label: "Bank",
      icon: Landmark,
      className: statusBadge.transfer,
    },
    ewallet: {
      label: "E-Wallet",
      icon: Smartphone,
      className: statusBadge.violet,
    },
    savings: {
      label: "Tabungan",
      icon: PiggyBank,
      className: statusBadge.income,
    },
    crypto: {
      label: "Crypto",
      icon: Coins,
      className: statusBadge.purple,
    },
    hutang: {
      label: "Hutang",
      icon: Receipt,
      className: statusBadge.expense,
    },
  };

  if (config[type]) {
    return config[type];
  }

  const formattedLabel = type
    ? type.charAt(0).toUpperCase() + type.slice(1)
    : "Lainnya";

  return {
    label: formattedLabel,
    icon: Layers,
    className: statusBadge.neutral,
  };
}

export function getAccountStatusMeta(isActive: boolean) {
  return isActive
    ? { label: "Aktif", className: statusBadge.income }
    : { label: "Nonaktif", className: statusBadge.neutral };
}

export function getCategoryTypeMeta(type: CategoryType) {
  return type === "income"
    ? {
      label: "Pemasukan",
      icon: ArrowUpCircle,
      className: statusBadge.income,
    }
    : {
      label: "Pengeluaran",
      icon: ArrowDownCircle,
      className: statusBadge.expense,
    };
}

export function getTransactionTypeMeta(type: TransactionType) {
  const config: Record<
    TransactionType,
    { label: string; icon: LucideIcon; className: string }
  > = {
    income: {
      label: "Pemasukan",
      icon: ArrowUpRight,
      className: statusBadge.income,
    },
    expense: {
      label: "Pengeluaran",
      icon: ArrowDownLeft,
      className: statusBadge.expense,
    },
    transfer: {
      label: "Transfer",
      icon: ArrowRightLeft,
      className: statusBadge.transfer,
    },
  };

  return config[type];
}

export function getBudgetStatusMeta(status: BudgetStatus) {
  const config: Record<
    BudgetStatus,
    { label: string; icon: LucideIcon; className: string }
  > = {
    aman: {
      label: "Aman",
      icon: CheckCircle2,
      className: statusBadge.income,
    },
    "hampir habis": {
      label: "Hampir habis",
      icon: TrendingUp,
      className: statusBadge.warning,
    },
    "melewati budget": {
      label: "Melewati budget",
      icon: AlertTriangle,
      className: statusBadge.expense,
    },
  };

  return config[status];
}

export function getSavingsGoalStatusMeta(status: SavingsGoalStatus) {
  const config: Record<
    SavingsGoalStatus,
    { label: string; icon: LucideIcon; className: string }
  > = {
    active: {
      label: "Aktif",
      icon: Clock3,
      className: statusBadge.income,
    },
    completed: {
      label: "Selesai",
      icon: CheckCircle2,
      className: statusBadge.transfer,
    },
    cancelled: {
      label: "Dibatalkan",
      icon: Slash,
      className: statusBadge.neutral,
    },
  };

  return config[status];
}
