import { StatusBadge } from "@/components/dashboard/status-badge";
import { getBudgetStatusMeta, type BudgetStatus } from "@/lib/utils/finance";

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  const item = getBudgetStatusMeta(status);

  return (
    <StatusBadge label={item.label} icon={item.icon} className={item.className} />
  );
}
