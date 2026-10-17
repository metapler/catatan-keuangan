"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AmountInputProps = {
  id: string;
  value: string;
  onChange: (display: string, numeric: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  invalid?: boolean;
  onEnter?: () => void;
};

function toDisplay(numeric: number): string {
  return numeric > 0 ? numeric.toLocaleString("id-ID") : "";
}

export function AmountInput({
  id,
  value,
  onChange,
  placeholder = "0",
  autoFocus,
  invalid,
  onEnter,
}: AmountInputProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1",
        invalid && "border-b border-destructive pb-1",
      )}
    >
      <span className="shrink-0 text-2xl font-semibold text-muted-foreground">Rp</span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        aria-invalid={invalid}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "").slice(0, 15);
          const numeric = raw ? Number(raw) : 0;
          onChange(raw ? Number(raw).toLocaleString("id-ID") : "", numeric);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter?.();
          }
        }}
        className="h-14 flex-1 border-0 bg-transparent px-1 text-3xl font-bold tracking-tight shadow-none focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-transparent"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 rounded-lg px-2 text-xs text-muted-foreground"
        onClick={() => {
          const numeric = (value.replace(/\D/g, "") ? Number(value.replace(/\D/g, "")) : 0) * 1000;
          onChange(toDisplay(numeric), numeric);
        }}
      >
        +000
      </Button>
    </div>
  );
}
