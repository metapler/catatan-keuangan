import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FabProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Floating action container. Sits above the mobile bottom nav
 * and below dialogs/sheets (z-40 < z-50).
 */
export function Fab({ children, className }: FabProps) {
  return (
    <div
      className={cn(
        "fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-2 lg:right-6 lg:bottom-6",
        className
      )}
    >
      {children}
    </div>
  );
}
