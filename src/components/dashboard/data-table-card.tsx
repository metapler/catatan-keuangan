import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DataTableCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DataTableCard({
  title,
  description,
  action,
  children,
  className,
}: DataTableCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-border/60 bg-card",
        className
      )}
    >
      <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between px-4 pt-4">
        <div>
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </CardTitle>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className="p-0 px-4 pb-4">{children}</CardContent>
    </Card>
  );
}
