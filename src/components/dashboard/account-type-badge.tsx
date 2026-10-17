import { StatusBadge } from "@/components/dashboard/status-badge";
import { getAccountTypeMeta, type AccountType } from "@/lib/utils/finance";

export function AccountTypeBadge({ type }: { type: AccountType }) {
  const item = getAccountTypeMeta(type);

  return (
    <StatusBadge label={item.label} icon={item.icon} className={item.className} />
  );
}
