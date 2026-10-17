import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  getSavingsGoalStatusMeta,
  type SavingsGoalStatus,
} from "@/lib/utils/finance";

export function SavingsGoalStatusBadge({
  status,
}: {
  status: SavingsGoalStatus;
}) {
  const item = getSavingsGoalStatusMeta(status);

  return (
    <StatusBadge label={item.label} icon={item.icon} className={item.className} />
  );
}
