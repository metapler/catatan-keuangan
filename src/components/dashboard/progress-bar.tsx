import { cn } from "@/lib/utils";

type ProgressBarTone = "income" | "warning" | "expense" | "transfer";

const toneClasses: Record<ProgressBarTone, string> = {
  income: "bg-status-income",
  warning: "bg-status-warning",
  expense: "bg-status-expense",
  transfer: "bg-status-transfer",
};

type ProgressBarProps = {
  /** Percentage 0–100; clamped for display. */
  value: number;
  tone?: ProgressBarTone;
  className?: string;
};

export function ProgressBar({ value, tone = "income", className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <div
        className={cn("h-full rounded-full", toneClasses[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
