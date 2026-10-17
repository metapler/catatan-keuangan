import { StatusBadge } from "@/components/dashboard/status-badge";
import type { DebtStatus } from "@/lib/validations/debts";

const config: Record<DebtStatus, { label: string; className: string }> = {
  belum_lunas: {
    label: "Belum lunas",
    className:
      "border-status-expense-border bg-status-expense-bg text-status-expense",
  },
  mencicil: {
    label: "Mencicil",
    className:
      "border-status-warning-border bg-status-warning-bg text-status-warning",
  },
  lunas: {
    label: "Lunas",
    className:
      "border-status-income-border bg-status-income-bg text-status-income",
  },
};

export function DebtStatusBadge({ status }: { status: DebtStatus }) {
  const item = config[status];

  return <StatusBadge label={item.label} className={item.className} />;
}
