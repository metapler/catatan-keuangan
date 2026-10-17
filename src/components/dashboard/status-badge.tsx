import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  label: string;
  icon?: LucideIcon;
  /** Token color classes, e.g. from getTransactionTypeMeta(). */
  className?: string;
};

export function StatusBadge({ label, icon: Icon, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 shrink-0 gap-1 rounded-full px-2 font-medium whitespace-nowrap",
        className
      )}
      render={
        <span className="inline-flex items-center gap-1">
          {Icon ? <Icon className="size-3" /> : null}
          {label}
        </span>
      }
    />
  );
}
