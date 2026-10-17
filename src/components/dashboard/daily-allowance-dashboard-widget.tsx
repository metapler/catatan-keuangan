import Link from "next/link";
import { ArrowRight, PiggyBank } from "lucide-react";

import { CategoryColorDot } from "@/components/dashboard/category-color-dot";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { ProgressBar } from "@/components/dashboard/progress-bar";
import { buttonVariants } from "@/components/ui/button";
import type { DailyAllowancesQueryResult } from "@/lib/queries/daily-allowances";
import { formatCurrencyIDR } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export function DailyAllowanceDashboardWidget({
  data,
}: {
  data: DailyAllowancesQueryResult;
}) {
  const activeAllowances = data.allowances.filter((a) => a.isActive);

  if (activeAllowances.length === 0) {
    return null;
  }

  return (
    <DataTableCard
      title="Anggaran Harian & Sisa Akumulasi"
      action={
        <Link
          href="/budgets?tab=daily"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-8 gap-1.5 rounded-xl text-xs",
          )}
        >
          Kelola Anggaran
          <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activeAllowances.map((allowance) => {
          const tone =
            allowance.status === "aman"
              ? "income"
              : allowance.status === "hampir habis"
                ? "warning"
                : "expense";

          return (
            <div
              key={allowance.id}
              className="space-y-2.5 rounded-xl border border-border/40 bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryColorDot color={allowance.categoryColor} />
                  <p className="truncate text-xs font-bold text-foreground">
                    {allowance.categoryName}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                  {formatCurrencyIDR(allowance.dailyAmount)}/hr
                </span>
              </div>

              <ProgressBar value={allowance.todayPercentageUsed} tone={tone} />

              <div className="flex items-center justify-between text-[11px] tabular-nums">
                <span className="text-muted-foreground">
                  Terpakai: {formatCurrencyIDR(allowance.todaySpent)}
                </span>
                <span
                  className={cn(
                    "font-bold",
                    allowance.todayRemaining < 0
                      ? "text-status-expense"
                      : "text-foreground",
                  )}
                >
                  Siap Pakai: {formatCurrencyIDR(allowance.todayRemaining)}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <PiggyBank className="size-3" />
                  Sisa Akumulasi:
                </span>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    allowance.accumulatedSurplus >= 0
                      ? "text-status-income"
                      : "text-status-expense",
                  )}
                >
                  {allowance.rolloverEnabled
                    ? formatCurrencyIDR(allowance.accumulatedSurplus)
                    : "Nonaktif"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </DataTableCard>
  );
}
