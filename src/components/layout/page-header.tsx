import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-5",
        className
      )}
    >
      <div className="max-w-2xl">
        <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground max-w-lg">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
