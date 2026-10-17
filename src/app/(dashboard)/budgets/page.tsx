import Link from "next/link";
import {
  CalendarRange,
  CircleDollarSign,
  Coins,
  ListChecks,
  PiggyBank,
  TriangleAlert,
} from "lucide-react";

import { deleteBudgetAction } from "@/app/(dashboard)/budgets/actions";
import { BudgetStatusBadge } from "@/components/dashboard/budget-status-badge";
import { CategoryColorDot } from "@/components/dashboard/category-color-dot";
import { DailyAllowanceTab } from "@/components/dashboard/daily-allowance-tab";
import { DeleteButton } from "@/components/dashboard/delete-button";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { ProgressBar } from "@/components/dashboard/progress-bar";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { BudgetFormDialog } from "@/components/forms/budget-form-dialog";
import { BudgetPeriodFilter } from "@/components/forms/budget-period-filter";
import { DailyAllowanceFormDialog } from "@/components/forms/daily-allowance-form-dialog";
import { Fab } from "@/components/layout/fab";
import { PageHeader } from "@/components/layout/page-header";
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
import { getBudgetsByPeriod } from "@/lib/queries/budgets";
import { getDailyAllowances } from "@/lib/queries/daily-allowances";
import type { BudgetStatus } from "@/lib/utils/finance";
import { formatCurrencyIDR } from "@/lib/utils/format";
import { paginate } from "@/lib/utils/paginate";
import { cn } from "@/lib/utils";

type BudgetsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

const PAGE_SIZE = 10;

const progressTone: Record<BudgetStatus, "income" | "warning" | "expense"> = {
  aman: "income",
  "hampir habis": "warning",
  "melewati budget": "expense",
};

export default async function BudgetsPage({ searchParams }: BudgetsPageProps) {
  const params = (await searchParams) ?? {};
  const now = new Date();
  const month = Number(getSingleParam(params, "month") ?? now.getMonth() + 1);
  const year = Number(getSingleParam(params, "year") ?? now.getFullYear());
  const activeTab = getSingleParam(params, "tab") ?? "daily";

  const [monthlyResult, dailyAllowances] = await Promise.all([
    getBudgetsByPeriod({ month, year })
      .then((data) => ({ data, error: null as string | null }))
      .catch((error) => ({
        data: null,
        error: error instanceof Error ? error.message : "Gagal memuat data budget.",
      })),
    getDailyAllowances().catch((err) => {
      console.error("Failed to load daily allowances:", err);
      return {
        allowances: [],
        expenseCategories: [],
        totalDailyAmount: 0,
        totalTodaySpent: 0,
        totalTodayRemaining: 0,
        totalAccumulatedSurplus: 0,
        totalAvailableToday: 0,
        activeCount: 0,
      };
    }),
  ]);

  const header = (
    <PageHeader
      title="Anggaran"
      description="Kelola jatah belanja harian dengan rollover atau anggaran bulanan per kategori."
    />
  );

  if (monthlyResult.error || !monthlyResult.data) {
    return (
      <section className="space-y-5">
        {header}
        <ErrorState description={monthlyResult.error ?? "Gagal memuat data budget."} />
      </section>
    );
  }

  const {
    budgets: allBudgets,
    expenseCategories,
    totalBudget,
    totalRealized,
    totalRemaining,
    atRiskCount,
    selectedMonth,
    selectedYear,
    categoryUsage,
  } = monthlyResult.data;

  const budgetsPage = paginate(
    allBudgets,
    Number(getSingleParam(params, "page") ?? "1"),
    PAGE_SIZE,
  );
  const budgets = budgetsPage.items;
  const periodLabel = `${selectedMonth}/${selectedYear}`;

  const existingDailyCategoryIds = dailyAllowances.allowances.map((a) => a.categoryId);

  return (
    <section className="space-y-5">
      {header}

      {/* Tab Switcher */}
      <div className="flex items-center gap-1.5 rounded-2xl border border-border/60 bg-muted/40 p-1 text-xs font-semibold w-fit">
        <Link
          href={`/budgets?tab=daily${month ? `&month=${month}` : ""}${year ? `&year=${year}` : ""}`}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all duration-150",
            activeTab === "daily"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Coins className="size-4" />
          <span>Anggaran Harian & Akumulasi</span>
          {dailyAllowances.activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {dailyAllowances.activeCount}
            </span>
          )}
        </Link>
        <Link
          href={`/budgets?tab=monthly${month ? `&month=${month}` : ""}${year ? `&year=${year}` : ""}`}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all duration-150",
            activeTab === "monthly"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <CalendarRange className="size-4" />
          <span>Anggaran Bulanan</span>
          {allBudgets.length > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
              {allBudgets.length}
            </span>
          )}
        </Link>
      </div>

      {/* Konten Tab 1: Anggaran Harian & Akumulasi */}
      {activeTab === "daily" ? (
        <>
          <DailyAllowanceTab
            data={dailyAllowances}
            expenseCategories={expenseCategories}
          />
          <Fab>
            <DailyAllowanceFormDialog
              expenseCategories={expenseCategories}
              existingCategoryIds={existingDailyCategoryIds}
            />
          </Fab>
        </>
      ) : (
        /* Konten Tab 2: Anggaran Bulanan */
        <>
          <div className="enter-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total Budget"
              value={formatCurrencyIDR(totalBudget)}
              helper="Akumulasi semua budget periode aktif"
              icon={CircleDollarSign}
              variant="income"
            />
            <SummaryCard
              label="Realisasi"
              value={formatCurrencyIDR(totalRealized)}
              helper="Pengeluaran yang sudah tercatat periode ini"
              icon={ListChecks}
              variant="savings"
            />
            <SummaryCard
              label="Sisa Budget"
              value={formatCurrencyIDR(totalRemaining)}
              helper="Sisa gabungan setelah dikurangi realisasi"
              icon={PiggyBank}
              variant="transfer"
            />
            <SummaryCard
              label="Perlu Perhatian"
              value={`${atRiskCount}`}
              helper="Budget yang hampir habis atau terlewati"
              icon={TriangleAlert}
              variant="expense"
            />
          </div>

          <DataTableCard title="Budget Periode Berjalan">
            <BudgetPeriodFilter month={selectedMonth} year={selectedYear} />

            {budgets.length === 0 ? (
              <EmptyState
                title="Belum ada budget di periode ini"
                description="Tambahkan budget per kategori pengeluaran untuk mulai memantau pemakaian bulanan."
              />
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="divide-y divide-border/40 sm:hidden">
                  {budgets.map((budget) => (
                    <div key={budget.id} className="space-y-2 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <CategoryColorDot color={budget.categoryColor} />
                          <p className="truncate text-sm font-semibold text-foreground">
                            {budget.categoryName}
                          </p>
                        </div>
                        <BudgetStatusBadge status={budget.status} />
                      </div>
                      <ProgressBar
                        value={budget.percentageUsed}
                        tone={progressTone[budget.status]}
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                        <span>
                          Terpakai {formatCurrencyIDR(budget.realized)} dari{" "}
                          {formatCurrencyIDR(budget.amount)}
                        </span>
                        <span>{budget.percentageUsed.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-1 pt-0.5">
                        <BudgetFormDialog
                          budget={budget}
                          expenseCategories={expenseCategories}
                          selectedMonth={selectedMonth}
                          selectedYear={selectedYear}
                          categoryUsage={categoryUsage}
                        />
                        <DeleteButton
                          action={deleteBudgetAction.bind(null, budget.id)}
                          title="Hapus budget?"
                          description="Budget akan dihapus dari daftar aktif. Anda bisa membuat budget baru untuk kategori dan periode yang sama. Riwayat transaksi tidak berubah."
                          confirmLabel="Hapus budget"
                          successMessage="Budget dihapus."
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/60 hover:bg-transparent">
                        <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                          Kategori
                        </TableHead>
                        <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                          Budget
                        </TableHead>
                        <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                          Realisasi
                        </TableHead>
                        <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                          Sisa
                        </TableHead>
                        <TableHead className="h-9 min-w-[180px] py-2 text-xs font-semibold text-muted-foreground">
                          Progress
                        </TableHead>
                        <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                          Status
                        </TableHead>
                        <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Aksi
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgets.map((budget) => (
                        <TableRow
                          key={budget.id}
                          className="border-border/40 transition-colors duration-150 hover:bg-muted/30"
                        >
                          <TableCell className="py-2.5">
                            <div className="inline-flex items-center gap-2">
                              <CategoryColorDot color={budget.categoryColor} />
                              <div>
                                <p className="text-xs font-semibold text-foreground">
                                  {budget.categoryName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {periodLabel}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs font-medium text-foreground tabular-nums">
                            {formatCurrencyIDR(budget.amount)}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground tabular-nums">
                            {formatCurrencyIDR(budget.realized)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "py-2.5 text-xs font-medium tabular-nums",
                              budget.remaining < 0
                                ? "text-status-expense"
                                : "text-foreground",
                            )}
                          >
                            {formatCurrencyIDR(budget.remaining)}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="space-y-1">
                              <ProgressBar
                                value={budget.percentageUsed}
                                tone={progressTone[budget.status]}
                              />
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {budget.percentageUsed.toFixed(1)}% terpakai
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <BudgetStatusBadge status={budget.status} />
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <BudgetFormDialog
                                budget={budget}
                                expenseCategories={expenseCategories}
                                selectedMonth={selectedMonth}
                                selectedYear={selectedYear}
                                categoryUsage={categoryUsage}
                              />
                              <DeleteButton
                                action={deleteBudgetAction.bind(null, budget.id)}
                                title="Hapus budget?"
                                description="Budget akan dihapus dari daftar aktif. Anda bisa membuat budget baru untuk kategori dan periode yang sama. Riwayat transaksi tidak berubah."
                                confirmLabel="Hapus budget"
                                successMessage="Budget dihapus."
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <PaginationControls
                  page={budgetsPage.page}
                  totalPages={budgetsPage.totalPages}
                  totalCount={budgetsPage.totalCount}
                  basePath="/budgets"
                  searchParams={{
                    month: String(selectedMonth),
                    year: String(selectedYear),
                    tab: "monthly",
                  }}
                  entityLabel="budget"
                />
              </>
            )}
          </DataTableCard>

          <Fab>
            <BudgetFormDialog
              expenseCategories={expenseCategories}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              categoryUsage={categoryUsage}
            />
          </Fab>
        </>
      )}
    </section>
  );
}
