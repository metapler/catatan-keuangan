"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Filter, RotateCcw, SlidersHorizontal, X } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

type FilterPanelProps = {
  /** GET form target, e.g. "/transactions". */
  action: string;
  /** Link target for the reset button. */
  resetHref: string;
  /** Number of currently active filters; shows a badge and the chip row. */
  activeCount: number;
  /** Remount key so defaultValue fields re-sync with the URL. */
  formKey?: string;
  /** Extra actions next to the toggle, e.g. a "Hari Ini" shortcut. */
  toolbar?: ReactNode;
  /** Active-filter chips, rendered while the panel is closed. */
  chips?: ReactNode;
  children: ReactNode;
};

export function FilterPanel({
  action,
  resetHref,
  activeCount,
  formKey,
  toolbar,
  chips,
  children,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <>
              <X className="size-3.5" />
              Tutup Filter
            </>
          ) : (
            <>
              <SlidersHorizontal className="size-3.5" />
              Filter
              {activeCount > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </>
          )}
        </Button>

        {toolbar}

        {activeCount > 0 && !open && (
          <div className="flex flex-wrap items-center gap-1">{chips}</div>
        )}
      </div>

      {open && (
        <form
          key={formKey}
          action={action}
          className="rounded-xl border border-border/60 bg-card p-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {children}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/60 pt-3">
            <Link
              href={resetHref}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <RotateCcw className="size-3.5" />
              Reset
            </Link>
            <Button type="submit" size="sm">
              <Filter className="size-3.5" />
              Terapkan
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function FilterField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export function FilterChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

export function FilterResetChip({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted"
    >
      <RotateCcw className="size-3" />
      Reset
    </Link>
  );
}

export function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isTodayRange(dateFrom: string, dateTo: string): boolean {
  const today = getTodayStr();
  return dateFrom === today && dateTo === today;
}

/** Build an href that toggles today's date range while keeping other params. */
export function createTodayHref(
  basePath: string,
  keepParams: Record<string, string>,
  todayActive: boolean,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(keepParams)) {
    if (value) params.set(key, value);
  }

  if (!todayActive) {
    params.set("dateFrom", getTodayStr());
    params.set("dateTo", getTodayStr());
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
