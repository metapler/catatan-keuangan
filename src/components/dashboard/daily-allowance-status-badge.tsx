import { AlertCircle, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { StatusBadge } from "@/components/dashboard/status-badge";
import type { DailyAllowanceSummary } from "@/lib/queries/daily-allowances";
import { cn } from "@/lib/utils";

export function DailyAllowanceStatusBadge({
  status,
  className,
}: {
  status: DailyAllowanceSummary["status"];
  className?: string;
}) {
  switch (status) {
    case "aman":
      return (
        <StatusBadge
          label="Aman"
          icon={CheckCircle2}
          className={cn(
            "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            className
          )}
        />
      );
    case "hampir habis":
      return (
        <StatusBadge
          label="Hampir Habis"
          icon={AlertTriangle}
          className={cn(
            "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
            className
          )}
        />
      );
    case "jatah habis":
      return (
        <StatusBadge
          label="Jatah Habis"
          icon={AlertCircle}
          className={cn(
            "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
            className
          )}
        />
      );
    case "defisit akumulasi":
      return (
        <StatusBadge
          label="Defisit"
          icon={XCircle}
          className={cn(
            "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
            className
          )}
        />
      );
  }
}
