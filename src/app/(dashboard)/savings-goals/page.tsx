import { CalendarClock, Flag, PiggyBank, TrendingUp } from "lucide-react";

import { deleteSavingsGoalAction } from "@/app/(dashboard)/savings-goals/actions";
import { DeleteButton } from "@/components/dashboard/delete-button";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { ProgressBar } from "@/components/dashboard/progress-bar";
import { SavingsGoalStatusBadge } from "@/components/dashboard/savings-goal-status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { SavingsGoalFormDialog } from "@/components/forms/savings-goal-form-dialog";
import { SavingsProgressDialog } from "@/components/forms/savings-progress-dialog";
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
import { getSavingsGoals } from "@/lib/queries/savings-goals";
import type { SavingsGoalStatus } from "@/lib/utils/finance";
import { formatCurrencyIDR, formatDateID } from "@/lib/utils/format";
import { paginate } from "@/lib/utils/paginate";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type SavingsGoalsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

const progressTone: Record<SavingsGoalStatus, "income" | "warning" | "expense" | "transfer"> = {
  active: "income",
  completed: "transfer",
  cancelled: "warning",
};

export default async function SavingsGoalsPage({
  searchParams,
}: SavingsGoalsPageProps) {
  const params = (await searchParams) ?? {};
  const result = await getSavingsGoals()
    .then((data) => ({ data, error: null as string | null }))
    .catch((error) => ({
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Gagal memuat target tabungan.",
    }));

  const header = (
    <PageHeader
      title="Target Tabungan"
      description="Semoga tercapai ya."
    />
  );

  if (result.error || !result.data) {
    return (
      <section className="space-y-5">
        {header}
        <ErrorState description={result.error ?? "Gagal memuat target tabungan."} />
      </section>
    );
  }

  const {
    goals: allGoals,
    activeCount,
    completedCount,
    cancelledCount,
    totalTargetAmount,
    totalCurrentAmount,
  } = result.data;
  const goalsPage = paginate(
    allGoals,
    Number(getSingleSearchParam(params, "page") ?? "1"),
    PAGE_SIZE,
  );
  const goals = goalsPage.items;

  const overallProgress =
    totalTargetAmount > 0
      ? Math.min((totalCurrentAmount / totalTargetAmount) * 100, 100)
      : 0;

  return (
    <section className="space-y-5">
      {header}

      <div className="enter-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Target Aktif"
          value={`${activeCount}`}
          helper="Target tabungan yang masih berjalan"
          icon={Flag}
          variant="expense"
        />
        <SummaryCard
          label="Nominal Target"
          value={formatCurrencyIDR(totalTargetAmount)}
          helper="Total seluruh target nominal"
          icon={PiggyBank}
          variant="savings"
        />
        <SummaryCard
          label="Terkumpul"
          value={formatCurrencyIDR(totalCurrentAmount)}
          helper="Akumulasi progress yang tercatat"
          icon={TrendingUp}
          variant="income"
        />
        <SummaryCard
          label="Selesai / Dibatalkan"
          value={`${completedCount + cancelledCount}`}
          helper="Gabungan target selesai dan dibatalkan"
          icon={CalendarClock}
          variant="transfer"
        />
      </div>

      {totalTargetAmount > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Progress Keseluruhan
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Akumulasi semua target tabungan
              </p>
            </div>
            <span className="text-sm font-bold text-primary tabular-nums">
              {overallProgress.toFixed(1)}%
            </span>
          </div>
          <ProgressBar value={overallProgress} tone="income" className="h-2" />
          <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>{formatCurrencyIDR(totalCurrentAmount)} terkumpul</span>
            <span>dari {formatCurrencyIDR(totalTargetAmount)}</span>
          </div>
        </div>
      )}

      <DataTableCard
        title="Daftar Target Tabungan"
      >
        {goals.length === 0 ? (
          <EmptyState
            title="Belum ada target tabungan"
            description="Tambahkan target pertamamu untuk mulai memantau progress menabung."
          />
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="divide-y divide-border/40 sm:hidden">
              {goals.map((goal) => (
                <div key={goal.id} className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {goal.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        Sisa {formatCurrencyIDR(goal.remainingAmount)}
                      </p>
                    </div>
                    <SavingsGoalStatusBadge status={goal.status} />
                  </div>
                  <ProgressBar
                    value={goal.progressPercentage}
                    tone={progressTone[goal.status]}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                    <span>
                      {formatCurrencyIDR(goal.currentAmount)} dari{" "}
                      {formatCurrencyIDR(goal.targetAmount)}
                    </span>
                    <span>{goal.progressPercentage.toFixed(1)}%</span>
                  </div>
                  {goal.targetDate ? (
                    <p
                      className={cn(
                        "text-xs",
                        goal.isOverdue
                          ? "font-medium text-status-expense"
                          : "text-muted-foreground"
                      )}
                    >
                      Deadline {formatDateID(goal.targetDate)}
                      {goal.isOverdue ? " · Terlambat" : ""}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-1 pt-0.5">
                    <SavingsProgressDialog goal={goal} />
                    <SavingsGoalFormDialog goal={goal} />
                    <DeleteButton
                      action={deleteSavingsGoalAction.bind(null, goal.id)}
                      title="Hapus target tabungan?"
                      description="Target yang dihapus tidak bisa dikembalikan."
                      confirmLabel="Hapus target"
                      successMessage="Target tabungan dihapus."
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
                      Target
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Target Nominal
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Terkumpul
                    </TableHead>
                    <TableHead className="h-9 min-w-[180px] py-2 text-xs font-semibold text-muted-foreground">
                      Progress
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Deadline
                    </TableHead>
                    <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goals.map((goal) => (
                    <TableRow
                      key={goal.id}
                      className="border-border/40 transition-colors duration-150 hover:bg-muted/30"
                    >
                      <TableCell className="py-2.5">
                        <p className="text-xs font-semibold text-foreground">
                          {goal.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                          Sisa {formatCurrencyIDR(goal.remainingAmount)}
                        </p>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <SavingsGoalStatusBadge status={goal.status} />
                      </TableCell>
                      <TableCell className="py-2.5 text-xs font-medium text-foreground tabular-nums">
                        {formatCurrencyIDR(goal.targetAmount)}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground tabular-nums">
                        {formatCurrencyIDR(goal.currentAmount)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="space-y-1">
                          <ProgressBar
                            value={goal.progressPercentage}
                            tone={progressTone[goal.status]}
                          />
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {goal.progressPercentage.toFixed(1)}% tercapai
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {goal.targetDate ? (
                          <div>
                            <p
                              className={cn(
                                "text-xs",
                                goal.isOverdue
                                  ? "font-medium text-status-expense"
                                  : "text-foreground"
                              )}
                            >
                              {formatDateID(goal.targetDate)}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {goal.isOverdue ? "Terlambat" : "Sesuai rencana"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <SavingsProgressDialog goal={goal} />
                          <SavingsGoalFormDialog goal={goal} />
                          <DeleteButton
                            action={deleteSavingsGoalAction.bind(null, goal.id)}
                            title="Hapus target tabungan?"
                            description="Target yang dihapus tidak bisa dikembalikan."
                            confirmLabel="Hapus target"
                            successMessage="Target tabungan dihapus."
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <PaginationControls
              page={goalsPage.page}
              totalPages={goalsPage.totalPages}
              totalCount={goalsPage.totalCount}
              basePath="/savings-goals"
              searchParams={{}}
              entityLabel="target"
            />
          </>
        )}
      </DataTableCard>

      <Fab>
        <SavingsGoalFormDialog />
      </Fab>
    </section>
  );
}
