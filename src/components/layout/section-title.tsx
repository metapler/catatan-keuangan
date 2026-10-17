import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionTitleProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function SectionTitle({
  title,
  description,
  action,
  className,
}: SectionTitleProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-5",
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
