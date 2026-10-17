import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  getTransactionTypeMeta,
  type TransactionType,
} from "@/lib/utils/finance";

export function TransactionTypeBadge({ type }: { type: TransactionType }) {
  const item = getTransactionTypeMeta(type);

  return (
    <StatusBadge label={item.label} icon={item.icon} className={item.className} />
  );
}
