"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Coins,
  PiggyBank,
  Power,
  PowerOff,
  ReceiptText,
  RotateCcw,
  SquarePen,
  Wallet,
} from "lucide-react";

import {
  deleteDailyAllowanceAction,
  toggleDailyAllowanceAction,
} from "@/app/(dashboard)/budgets/daily-actions";
import { CategoryColorDot } from "@/components/dashboard/category-color-dot";
import { DailyAllowanceStatusBadge } from "@/components/dashboard/daily-allowance-status-badge";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { DeleteButton } from "@/components/dashboard/delete-button";
import { ProgressBar } from "@/components/dashboard/progress-bar";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { DailyAllowanceFormDialog } from "@/components/forms/daily-allowance-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { BudgetExpenseCategory } from "@/lib/queries/budgets";
import type { DailyAllowancesQueryResult } from "@/lib/queries/daily-allowances";
import { formatCurrencyIDR, formatDateID } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type DailyAllowanceTabProps = {
  data: DailyAllowancesQueryResult;
  expenseCategories: BudgetExpenseCategory[];
};

export function DailyAllowanceTab({ data, expenseCategories }: DailyAllowanceTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    allowances,
    totalDailyAmount,
    totalTodaySpent,
    totalTodayRemaining,
    totalAccumulatedSurplus,
  } = data;

  const handleToggle = (id: string, currentActive: boolean) => {
    startTransition(async () => {
      await toggleDailyAllowanceAction(id, !currentActive);
      router.refresh();
    });
  };

  const existingCategoryIds = allowances.map((a) => a.categoryId);

  return (
    <div className="space-y-5">
      {/* Kartu Ringkasan Total (Harmonisasi 4 SummaryCard Standar) */}
      <div className="enter-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Jatah Hari Ini"
          value={formatCurrencyIDR(totalDailyAmount)}
          helper="Total alokasi pos harian"
          icon={Coins}
          variant="income"
        />
        <SummaryCard
          label="Terpakai Hari Ini"
          value={formatCurrencyIDR(totalTodaySpent)}
          helper="Total pengeluaran tercatat hari ini"
          icon={ReceiptText}
          variant="expense"
        />
        <SummaryCard
          label="Siap Pakai Hari Ini"
          value={formatCurrencyIDR(totalTodayRemaining)}
          helper="Sisa alokasi kuota anggaran hari ini"
          icon={Wallet}
          variant={totalTodayRemaining < 0 ? "expense" : "balance"}
        />
        <SummaryCard
          label="Sisa Akumulasi"
          value={formatCurrencyIDR(totalAccumulatedSurplus)}
          helper="Tabungan sisa dari hari-hari kemarin"
          icon={PiggyBank}
          variant={totalAccumulatedSurplus >= 0 ? "savings" : "expense"}
        />
      </div>

      {/* Kontainer Daftar Pos Anggaran Harian (Bungkus dengan DataTableCard) */}
      <DataTableCard
        title="Daftar Pos Anggaran Harian"
        description="Kelola pos belanja harian dan pantau realisasi serta akumulasi tabungannya."
        action={
          <div className="hidden sm:block">
            <DailyAllowanceFormDialog
              expenseCategories={expenseCategories}
              existingCategoryIds={existingCategoryIds}
            />
          </div>
        }
      >
        {allowances.length === 0 ? (
          <div className="py-8">
            <EmptyState
              title="Belum ada Anggaran Harian"
              description="Buat jatah belanja harian (seperti Makan harian atau Jajan) yang berulang setiap hari dengan akumulasi sisa otomatis."
            />
          </div>
        ) : (
          <div className="grid gap-4 pt-1 md:grid-cols-2">
            {allowances.map((allowance) => {
              const tone =
                allowance.status === "aman"
                  ? "income"
                  : allowance.status === "hampir habis"
                    ? "warning"
                    : "expense";

              return (
                <Card
                  key={allowance.id}
                  className={cn(
                    "border-border/60 bg-card transition-all duration-150",
                    !allowance.isActive && "opacity-60",
                  )}
                >
                  <CardHeader className="p-4 pb-3 sm:p-5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryColorDot color={allowance.categoryColor} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="truncate text-sm font-bold text-foreground">
                              {allowance.categoryName}
                            </h4>
                            {!allowance.isActive && (
                              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Nonaktif
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              {formatCurrencyIDR(allowance.dailyAmount)}
                            </span>{" "}
                            / hari
                            <span className="mx-1.5 opacity-40">·</span>
                            <span>Mulai {formatDateID(allowance.startDate)}</span>
                          </p>
                        </div>
                      </div>

                      {/* Status Badge di mobile & desktop */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        <DailyAllowanceStatusBadge status={allowance.status} />
                        {/* Desktop action toolbar */}
                        <div className="hidden sm:flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "size-7 p-0",
                              allowance.isActive ? "text-emerald-600 hover:text-emerald-700" : "text-muted-foreground",
                            )}
                            title={allowance.isActive ? "Nonaktifkan" : "Aktifkan"}
                            disabled={isPending}
                            onClick={() => handleToggle(allowance.id, allowance.isActive)}
                          >
                            {allowance.isActive ? (
                              <Power className="size-3.5" />
                            ) : (
                              <PowerOff className="size-3.5" />
                            )}
                          </Button>
                          <DailyAllowanceFormDialog
                            allowance={allowance}
                            expenseCategories={expenseCategories}
                            trigger={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Edit"
                              >
                                <SquarePen className="size-3.5" />
                              </Button>
                            }
                          />
                          <DeleteButton
                            action={deleteDailyAllowanceAction.bind(null, allowance.id)}
                            title="Hapus Anggaran Harian?"
                            description={`Anggaran Harian untuk ${allowance.categoryName} akan dihapus.`}
                            confirmLabel="Hapus"
                            successMessage="Anggaran Harian dihapus."
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 p-4 pt-0 sm:p-5">
                    {allowance.note && (
                      <p className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                        {allowance.note}
                      </p>
                    )}

                    {/* Kuota Hari Ini */}
                    <div className="space-y-2 rounded-xl border border-border/40 bg-muted/20 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Clock className="size-3.5 text-muted-foreground" />
                          Hari Ini
                        </span>
                        <span className="tabular-nums font-medium text-foreground">
                          {allowance.todayPercentageUsed.toFixed(0)}% terpakai
                        </span>
                      </div>
                      <ProgressBar value={allowance.todayPercentageUsed} tone={tone} />
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
                        <span>
                          Terpakai <span className="font-medium text-foreground">{formatCurrencyIDR(allowance.todaySpent)}</span> dari{" "}
                          {formatCurrencyIDR(allowance.todayAllowance)}
                        </span>
                        <span
                          className={cn(
                            "font-semibold",
                            allowance.todayRemaining < 0
                              ? "text-status-expense"
                              : "text-foreground",
                          )}
                        >
                          Sisa: {formatCurrencyIDR(allowance.todayRemaining)}
                        </span>
                      </div>
                    </div>

                    {/* Akumulasi Sisa & Siap Pakai Hari Ini (Harmonisasi seragam) */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5 sm:p-3">
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <RotateCcw className="size-3 shrink-0" />
                          <span className="truncate">Sisa Akumulasi</span>
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-sm sm:text-base font-bold tabular-nums truncate",
                            allowance.accumulatedSurplus >= 0
                              ? "text-status-income"
                              : "text-status-expense",
                          )}
                        >
                          {allowance.rolloverEnabled
                            ? formatCurrencyIDR(allowance.accumulatedSurplus)
                            : "Nonaktif"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                          {allowance.pastDays} hari kemarin
                        </p>
                      </div>

                      <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5 sm:p-3">
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Wallet className="size-3 shrink-0" />
                          <span className="truncate">Siap Pakai Hari Ini</span>
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-sm sm:text-base font-bold tabular-nums truncate",
                            allowance.todayRemaining < 0
                              ? "text-status-expense"
                              : "text-foreground",
                          )}
                        >
                          {formatCurrencyIDR(allowance.todayRemaining)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                          Sisa hari ini
                        </p>
                      </div>
                    </div>

                    {/* Transaksi Hari Ini */}
                    {allowance.todayTransactions.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                          <ReceiptText className="size-3" />
                          Transaksi hari ini ({allowance.todayTransactions.length}):
                        </p>
                        <div className="max-h-28 divide-y divide-border/40 overflow-y-auto rounded-lg border border-border/40 bg-card px-2.5">
                          {allowance.todayTransactions.map((tx) => (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between py-1.5 text-xs"
                            >
                              <span className="truncate pr-2 text-muted-foreground">
                                {tx.description || "Pengeluaran"}
                              </span>
                              <span className="shrink-0 font-medium tabular-nums text-status-expense">
                                -{formatCurrencyIDR(tx.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mobile Action Bar: Tombol Aktifkan/Nonaktifkan + Edit + Hapus */}
                    <div className="flex items-center justify-between border-t border-border/40 pt-3 sm:hidden">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-7 gap-1.5 px-2.5 text-xs font-medium rounded-lg",
                          allowance.isActive
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                            : "border-border bg-muted/40 text-muted-foreground",
                        )}
                        disabled={isPending}
                        onClick={() => handleToggle(allowance.id, allowance.isActive)}
                      >
                        {allowance.isActive ? (
                          <>
                            <Power className="size-3 text-emerald-600" />
                            <span>Aktif</span>
                          </>
                        ) : (
                          <>
                            <PowerOff className="size-3 text-muted-foreground" />
                            <span>Nonaktif</span>
                          </>
                        )}
                      </Button>

                      <div className="flex items-center gap-1">
                        <DailyAllowanceFormDialog
                          allowance={allowance}
                          expenseCategories={expenseCategories}
                        />
                        <DeleteButton
                          action={deleteDailyAllowanceAction.bind(null, allowance.id)}
                          title="Hapus Anggaran Harian?"
                          description={`Anggaran Harian untuk ${allowance.categoryName} akan dihapus.`}
                          confirmLabel="Hapus"
                          successMessage="Anggaran Harian dihapus."
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DataTableCard>
    </div>
  );
}
