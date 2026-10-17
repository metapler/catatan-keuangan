"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type OptionItem = {
  id: string;
  label: string;
  hint?: string;
  color?: string | null;
  icon?: ReactNode;
  disabled?: boolean;
};

type OptionListProps = {
  value: string;
  onChange: (id: string) => void;
  options: OptionItem[];
  emptyTitle?: string;
  emptyDescription?: string;
};

export function OptionList({
  value,
  onChange,
  options,
  emptyTitle = "Belum ada pilihan",
  emptyDescription = "Tambahkan data terlebih dahulu.",
}: OptionListProps) {
  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-8 text-center">
        <p className="text-sm font-semibold">{emptyTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" role="radiogroup">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            {option.color ? (
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: option.color }}
              />
            ) : null}
            {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{option.label}</span>
              {option.hint ? (
                <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
