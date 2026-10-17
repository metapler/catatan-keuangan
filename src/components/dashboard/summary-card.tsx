import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Trend = "up" | "down" | "neutral";

type SummaryCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  trend?: Trend;
  trendValue?: string;
  variant?: "default" | "income" | "expense" | "balance" | "savings" | "transfer";
  /** Swap up/down colors (e.g. expense up = red). Arrow direction is unchanged. */
  invertTrendColor?: boolean;
};

const variantStyles = {
  default: {
    iconBg: "bg-secondary",
    iconColor: "text-secondary-foreground",
    gradient: "",
  },
  income: {
    iconBg: "bg-status-income-bg",
    iconColor: "text-status-income",
    gradient: "gradient-income",
  },
  expense: {
    iconBg: "bg-status-expense-bg",
    iconColor: "text-status-expense",
    gradient: "gradient-expense",
  },
  balance: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    gradient: "gradient-balance",
  },
  savings: {
    iconBg: "bg-status-warning-bg",
    iconColor: "text-status-warning",
    gradient: "gradient-savings",
  },
  transfer: {
    iconBg: "bg-status-transfer-bg",
    iconColor: "text-status-transfer",
    gradient: "gradient-transfer",
  },
};

const trendConfig = {
  up: { icon: TrendingUp, color: "text-status-income" },
  down: { icon: TrendingDown, color: "text-status-expense" },
  neutral: { icon: Minus, color: "text-muted-foreground" },
};

export function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
  trend,
  trendValue,
  variant = "default",
  invertTrendColor = false,
}: SummaryCardProps) {
  const styles = variantStyles[variant];
  const TrendIcon = trend ? trendConfig[trend].icon : null;
  // Swap colors only, keep arrow direction: for expense, up = red, down = green.
  const colorTrend =
    invertTrendColor && trend === "up"
      ? "down"
      : invertTrendColor && trend === "down"
        ? "up"
        : (trend ?? "neutral");

  return (
    <Card
      className={cn(
        "group card-hover relative overflow-hidden bg-card",
        styles.gradient
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground leading-tight">
              {label}
            </p>
            <p className="mt-1 text-lg font-bold tracking-tight text-foreground tabular-nums">
              {value}
            </p>
            <div className="mt-1 flex items-center gap-1">
              {trend && TrendIcon && (
                <TrendIcon
                  className={cn("size-3", trendConfig[colorTrend].color)}
                />
              )}
              {trendValue && (
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    trendConfig[colorTrend].color
                  )}
                >
                  {trendValue}
                </span>
              )}
              <span className="truncate text-xs text-muted-foreground">
                {helper}
              </span>
            </div>
          </div>
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 ease-out group-hover:scale-105",
              styles.iconBg
            )}
          >
            <Icon className={cn("size-4", styles.iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
