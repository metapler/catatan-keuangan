import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  ChartPie,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react";

import {
  DashboardCashflowTrendChart,
} from "@/components/charts/dashboard-cashflow-trend-chart";
import {
  DashboardExpensePieChart,
} from "@/components/charts/dashboard-expense-pie-chart";
import {
  DashboardMonthlyComparisonChart,
} from "@/components/charts/dashboard-monthly-comparison-chart";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { DailyAllowanceDashboardWidget } from "@/components/dashboard/daily-allowance-dashboard-widget";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { TransactionTypeBadge } from "@/components/dashboard/transaction-type-badge";
import {
  DashboardChartSection,
  type DashboardChartPeriodValues,
} from "@/components/forms/dashboard-chart-section";
import { TransactionFormDialog } from "@/components/forms/transaction-form-dialog";
import { Fab } from "@/components/layout/fab";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ArrowSeparator } from "@/components/ui/arrow-separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDashboardData,
  type ChartPeriod,
} from "@/lib/queries/dashboard";
import { getDailyAllowances } from "@/lib/queries/daily-allowances";
import { formatCurrencyIDR, formatDateID } from "@/lib/utils/format";
import {
  formatMonthOverMonthPct,
  type MonthOverMonthTrend,
} from "@/lib/utils/finance";
import { cn } from "@/lib/utils";

const amountColors = {
  income: "text-status-income",
  expense: "text-status-expense",
  transfer: "text-status-transfer",
} as const;

function renderRecentAccountLabel(
  transaction: Awaited<
    ReturnType<typeof getDashboardData>
  >["recentTransactions"][number],
): ReactNode {
  if (transaction.type === "transfer") {
    return (
      <>
        {transaction.transferFrom}
        <ArrowSeparator />
        {transaction.transferTo}
      </>
    );
  }

  return transaction.accountLabel;
}

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

const monthKeyPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthDurations = [3, 6, 12, 24];
const yearDurations = [2, 3, 5];

function parseChartPeriod(
  params: Record<string, string | string[] | undefined>,
): ChartPeriod {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthKey = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mode = getSingleSearchParam(params, "period");

  if (mode === "last-years") {
    const years = Number(getSingleSearchParam(params, "years"));
    return {
      mode: "last-years",
      years: yearDurations.includes(years) ? years : 3,
    };
  }

  if (mode === "year") {
    const year = Number(getSingleSearchParam(params, "year"));
    return {
      mode: "year",
      year:
        Number.isInteger(year) && year >= 2000 && year <= currentYear
          ? year
          : currentYear,
    };
  }

  if (mode === "month-range") {
    const fromRaw = getSingleSearchParam(params, "from") ?? "";
    const toRaw = getSingleSearchParam(params, "to") ?? "";

    return {
      mode: "month-range",
      from: monthKeyPattern.test(fromRaw) ? fromRaw : `${currentYear}-01`,
      to: monthKeyPattern.test(toRaw) ? toRaw : currentMonthKey,
    };
  }

  const months = Number(getSingleSearchParam(params, "months"));
  return {
    mode: "last-months",
    months: monthDurations.includes(months) ? months : 6,
  };
}

function buildFilterValues(
  period: ChartPeriod,
): DashboardChartPeriodValues {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthKey = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return {
    mode: period.mode,
    months: period.mode === "last-months" ? period.months : 6,
    years: period.mode === "last-years" ? period.years : 3,
    year: period.mode === "year" ? period.year : currentYear,
    from: period.mode === "month-range" ? period.from : `${currentYear}-01`,
    to: period.mode === "month-range" ? period.to : currentMonthKey,
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const chartPeriod = parseChartPeriod(params);
  const hasPeriodParam = Boolean(getSingleSearchParam(params, "period"));

  const [result, dailyAllowances] = await Promise.all([
    getDashboardData(chartPeriod)
      .then((data) => ({ data, error: null as string | null }))
      .catch((error) => ({
        data: null,
        error: error instanceof Error ? error.message : "Gagal memuat dashboard.",
      })),
    getDailyAllowances().catch(() => ({
      allowances: [],
      expenseCategories: [],
      totalDailyAmount: 0,
      totalTodaySpent: 0,
      totalTodayRemaining: 0,
      totalAccumulatedSurplus: 0,
      totalAvailableToday: 0,
      activeCount: 0,
    })),
  ]);

  const header = (
    <PageHeader
      title="Dashboard"
      description="Ringkasan keuanganmu."
    />
  );

  if (result.error || !result.data) {
    return (
      <div className="space-y-5">
        {header}
        <ErrorState description={result.error ?? "Gagal memuat dashboard."} />
      </div>
    );
  }

  const {
    summary,
    charts,
    recentTransactions,
    accounts,
    incomeCategories,
    expenseCategories,
    usage,
  } = result.data;

  const toMomDisplay = (pct: number | null) => {
    if (pct === null) {
      return {
        trend: "neutral" as MonthOverMonthTrend,
        trendValue: undefined as string | undefined,
        helper: "Bulan lalu belum ada data",
      };
    }
    return {
      trend: (pct > 0 ? "up" : pct < 0 ? "down" : "neutral") as MonthOverMonthTrend,
      trendValue: formatMonthOverMonthPct(pct),
      helper: "vs bulan lalu",
    };
  };

  const momCards = [
    toMomDisplay(summary.balanceChangePct),
    toMomDisplay(summary.incomeChangePct),
    toMomDisplay(summary.expenseChangePct),
    toMomDisplay(summary.remainingChangePct),
  ];

  const summaryCards = [
    {
      label: "Pemasukan Bulan Ini",
      value: formatCurrencyIDR(summary.incomeThisMonth),
      helper: momCards[1]!.helper,
      icon: TrendingUp,
      variant: "income" as const,
      trend: momCards[1]!.trend,
      trendValue: momCards[1]!.trendValue,
      invertTrendColor: false,
    },
    {
      label: "Pengeluaran Bulan Ini",
      value: formatCurrencyIDR(summary.expenseThisMonth),
      helper: momCards[2]!.helper,
      icon: ChartPie,
      variant: "expense" as const,
      trend: momCards[2]!.trend,
      trendValue: momCards[2]!.trendValue,
      invertTrendColor: true,
    },
    {
      label: "Sisa Arus Kas",
      value: formatCurrencyIDR(summary.remainingThisMonth),
      helper: momCards[3]!.helper,
      icon: Landmark,
      variant: "default" as const,
      trend: momCards[3]!.trend,
      trendValue: momCards[3]!.trendValue,
      invertTrendColor: false,
    },
    {
      label: "Target Tabungan",
      value: `${summary.activeSavingsGoals}`,
      helper: "Goal aktif",
      icon: PiggyBank,
      variant: "savings" as const,
      trend: "neutral" as const,
      trendValue: undefined,
      invertTrendColor: false,
    },
  ];

  const cashflowSlot = charts.cashflowTrend.some((point) => point.net !== 0) ? (
    <DashboardCashflowTrendChart data={charts.cashflowTrend} />
  ) : (
    <div className="py-4">
      <EmptyState
        title="Belum ada arus kas"
        description="Catat transaksi untuk melihat tren arus kas."
      />
    </div>
  );

  const comparisonSlot = charts.monthlyComparison.some(
    (point) => point.income !== 0 || point.expense !== 0
  ) ? (
    <DashboardMonthlyComparisonChart data={charts.monthlyComparison} />
  ) : (
    <div className="py-4">
      <EmptyState
        title="Belum ada perbandingan"
        description="Catat transaksi untuk melihat perbandingan bulanan."
      />
    </div>
  );

  return (
    <div className="space-y-5">
      {header}

      {/* Total saldo */}
      <SummaryCard
        label="Total Saldo"
        value={formatCurrencyIDR(summary.totalBalance)}
        helper={momCards[0]!.helper}
        icon={Wallet}
        variant="balance"
        trend={momCards[0]!.trend}
        trendValue={momCards[0]!.trendValue}
      />

      <div className="enter-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            icon={card.icon}
            variant={card.variant}
            trend={card.trend}
            trendValue={card.trendValue}
            invertTrendColor={card.invertTrendColor}
          />
        ))}
      </div>

      <DashboardChartSection
        values={buildFilterValues(chartPeriod)}
        periodLabel={charts.periodLabel}
        isActive={hasPeriodParam}
        granularity={charts.granularity}
        cashflowSlot={cashflowSlot}
        comparisonSlot={comparisonSlot}
      />

      <DailyAllowanceDashboardWidget data={dailyAllowances} />

      <div className="enter-stagger grid gap-4 lg:grid-cols-[1fr_320px]">
        <DataTableCard
          title="Transaksi Terbaru"
          action={
            <Link href="/transactions" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Lihat Semua
              <ArrowRightLeft className="size-3.5" />
            </Link>
          }
        >
          {recentTransactions.length === 0 ? (
            <div className="py-6">
              <EmptyState
                title="Belum ada transaksi"
                description="Mulai catat transaksi pertamamu."
              />
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="divide-y divide-border/40 sm:hidden">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0 space-y-1">
                      <TransactionTypeBadge type={transaction.type} />
                      <p className="truncate text-xs font-medium text-foreground">
                        {renderRecentAccountLabel(transaction)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateID(transaction.transactionDate)}
                        {transaction.categoryLabel
                          ? ` · ${transaction.categoryLabel}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-0.5 text-sm font-semibold tabular-nums",
                        amountColors[transaction.type]
                      )}
                    >
                      {transaction.type === "income" && (
                        <ArrowUpRight className="size-3 opacity-60" />
                      )}
                      {transaction.type === "expense" && (
                        <ArrowDownRight className="size-3 opacity-60" />
                      )}
                      {formatCurrencyIDR(transaction.amount)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent">
                      <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                        Tanggal
                      </TableHead>
                      <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                        Tipe
                      </TableHead>
                      <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                        Akun
                      </TableHead>
                      <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                        Kategori
                      </TableHead>
                      <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                        Nominal
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTransactions.map((transaction) => (
                      <TableRow
                        key={transaction.id}
                        className="border-border/40 transition-colors duration-150 hover:bg-muted/30"
                      >
                        <TableCell className="py-2.5 text-xs whitespace-nowrap text-muted-foreground">
                          {formatDateID(transaction.transactionDate)}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <TransactionTypeBadge type={transaction.type} />
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate py-2.5 text-xs font-medium text-foreground">
                          {renderRecentAccountLabel(transaction)}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate py-2.5 text-xs text-muted-foreground">
                          {transaction.categoryLabel ?? "-"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "py-2.5 text-right text-xs font-semibold whitespace-nowrap tabular-nums",
                            amountColors[transaction.type]
                          )}
                        >
                          <span className="flex items-center justify-end gap-1">
                            {transaction.type === "income" && (
                              <ArrowUpRight className="size-3 opacity-60" />
                            )}
                            {transaction.type === "expense" && (
                              <ArrowDownRight className="size-3 opacity-60" />
                            )}
                            {formatCurrencyIDR(transaction.amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DataTableCard>

        <Card className="h-full border-border/60 bg-card">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold tracking-tight">
              Distribusi Pengeluaran
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            {charts.expenseByCategory.length > 0 ? (
              <DashboardExpensePieChart data={charts.expenseByCategory} />
            ) : (
              <div className="py-5">
                <EmptyState
                  title="Tidak ada pengeluaran"
                  description="Catat pengeluaran untuk melihat distribusi."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Fab>
        <TransactionFormDialog
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          accountUsage={usage.accountUsage}
          categoryUsage={usage.categoryUsage}
        />
      </Fab>
    </div>
  );
}
