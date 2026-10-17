import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/5 text-primary/60 ring-1 ring-primary/10">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-5 text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
