"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Filter, RotateCcw, SlidersHorizontal, X } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FilterChip,
  FilterField,
  FilterResetChip,
} from "@/components/forms/filter-panel";

export type DashboardChartPeriodMode =
  | "last-months"
  | "last-years"
  | "year"
  | "month-range";

export type DashboardChartPeriodValues = {
  mode: DashboardChartPeriodMode;
  months: number;
  years: number;
  year: number;
  from: string;
  to: string;
};

const modeOptions: Array<{ value: DashboardChartPeriodMode; label: string }> = [
  { value: "last-months", label: "Beberapa bulan terakhir" },
  { value: "last-years", label: "Beberapa tahun terakhir" },
  { value: "year", label: "Tahun tertentu" },
  { value: "month-range", label: "Rentang bulan" },
];

const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const monthShortNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const monthDurationOptions = [3, 6, 12];
const yearDurationOptions = [2, 3, 5];

function buildMonthKeyOptions(currentYear: number) {
  const options: Array<{ value: string; label: string }> = [];
  const startYear = currentYear - 5;

  for (let year = startYear; year <= currentYear; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const value = `${year}-${String(month).padStart(2, "0")}`;

      options.push({
        value,
        label: `${monthShortNames[month - 1]} ${year}`,
      });
    }
  }

  return options;
}

function formatMonthKeyLabel(value: string) {
  const [yearStr, monthStr] = value.split("-");
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (!month || !year) {
    return value;
  }

  return `${monthNames[month - 1]} ${year}`;
}

type DashboardChartSectionProps = {
  values: DashboardChartPeriodValues;
  /** Human-readable label of the active period, e.g. "Jan 2026 – Jun 2026". */
  periodLabel: string;
  /** Whether a period param is present in the URL. */
  isActive: boolean;
  granularity: "month" | "year";
  /** Server-rendered chart content for the "Tren Arus Kas" card. */
  cashflowSlot: ReactNode;
  /** Server-rendered chart content for the "Pemasukan vs Pengeluaran" card. */
  comparisonSlot: ReactNode;
};

export function DashboardChartSection({
  values,
  periodLabel,
  isActive,
  granularity,
  cashflowSlot,
  comparisonSlot,
}: DashboardChartSectionProps) {
  const currentYear = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DashboardChartPeriodMode>(values.mode);
  const [months, setMonths] = useState(String(values.months));
  const [years, setYears] = useState(String(values.years));
  const [from, setFrom] = useState(values.from);
  const [to, setTo] = useState(values.to);

  useEffect(() => setMode(values.mode), [values.mode]);
  useEffect(() => setMonths(String(values.months)), [values.months]);
  useEffect(() => setYears(String(values.years)), [values.years]);
  useEffect(() => setFrom(values.from), [values.from]);
  useEffect(() => setTo(values.to), [values.to]);

  const modeLabel =
    modeOptions.find((option) => option.value === mode)?.label ??
    "Beberapa bulan terakhir";
  const monthKeyOptions = buildMonthKeyOptions(currentYear);

  return (
    <div className="enter-stagger space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold tracking-tight">
              Tren Arus Kas
            </CardTitle>
            <CardDescription className="text-xs">
              {periodLabel}
            </CardDescription>
            <CardAction className="flex items-center gap-1.5">
              {isActive && !open && (
                <>
                  <FilterChip>{periodLabel}</FilterChip>
                  <FilterResetChip href="/dashboard" />
                </>
              )}
              <Button
                type="button"
                variant={open ? "default" : "outline"}
                size="sm"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? (
                  <>
                    <X className="size-3.5" />
                    Tutup
                  </>
                ) : (
                  <>
                    <SlidersHorizontal className="size-3.5" />
                    Filter
                  </>
                )}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-5">{cashflowSlot}</CardContent>
        </Card>

        <Card className="border-border/60 bg-card">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold tracking-tight">
              Pemasukan vs Pengeluaran
            </CardTitle>
            <CardDescription className="text-xs">
              {periodLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">{comparisonSlot}</CardContent>
        </Card>
      </div>

      {open && (
        <form
          key={JSON.stringify(values)}
          action="/dashboard"
          className="rounded-xl border border-border/60 bg-card p-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Periode">
              <Select
                value={mode}
                onValueChange={(v) => {
                  if (v) setMode(v as DashboardChartPeriodMode);
                }}
              >
                <SelectTrigger className="h-8 w-full bg-background text-xs">
                  <SelectValue placeholder="Pilih periode">{modeLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {modeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="period" value={mode} />
            </FilterField>

            {mode === "last-months" && (
              <FilterField label="Jumlah bulan">
                <Select
                  value={months}
                  onValueChange={(v) => {
                    if (v) setMonths(v);
                  }}
                >
                  <SelectTrigger className="h-8 w-full bg-background text-xs">
                    <SelectValue placeholder="Pilih jumlah">{`${months} bulan terakhir`}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {monthDurationOptions.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option} bulan terakhir
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="months" value={months} />
              </FilterField>
            )}

            {mode === "last-years" && (
              <FilterField label="Jumlah tahun">
                <Select
                  value={years}
                  onValueChange={(v) => {
                    if (v) setYears(v);
                  }}
                >
                  <SelectTrigger className="h-8 w-full bg-background text-xs">
                    <SelectValue placeholder="Pilih jumlah">{`${years} tahun terakhir`}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {yearDurationOptions.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option} tahun terakhir
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="years" value={years} />
              </FilterField>
            )}

            {mode === "year" && (
              <FilterField label="Tahun">
                <Input
                  type="number"
                  name="year"
                  min="2000"
                  max={currentYear}
                  defaultValue={values.year}
                  className="h-8 bg-background text-xs"
                />
              </FilterField>
            )}

            {mode === "month-range" && (
              <>
                <FilterField label="Dari bulan">
                  <Select
                    value={from}
                    onValueChange={(v) => {
                      if (v) setFrom(v);
                    }}
                  >
                    <SelectTrigger className="h-8 w-full bg-background text-xs">
                      <SelectValue placeholder="Pilih bulan">
                        {formatMonthKeyLabel(from)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {monthKeyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="from" value={from} />
                </FilterField>

                <FilterField label="Sampai bulan">
                  <Select
                    value={to}
                    onValueChange={(v) => {
                      if (v) setTo(v);
                    }}
                  >
                    <SelectTrigger className="h-8 w-full bg-background text-xs">
                      <SelectValue placeholder="Pilih bulan">
                        {formatMonthKeyLabel(to)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {monthKeyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="to" value={to} />
                </FilterField>
              </>
            )}
          </div>

          <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/60 pt-3">
            <Link
              href="/dashboard"
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
