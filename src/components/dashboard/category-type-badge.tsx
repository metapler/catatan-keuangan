import { StatusBadge } from "@/components/dashboard/status-badge";
import { getCategoryTypeMeta, type CategoryType } from "@/lib/utils/finance";

export function CategoryTypeBadge({ type }: { type: CategoryType }) {
  const item = getCategoryTypeMeta(type);

  return (
    <StatusBadge label={item.label} icon={item.icon} className={item.className} />
  );
}
