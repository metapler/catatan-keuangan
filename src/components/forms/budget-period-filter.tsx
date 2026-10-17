"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterField, FilterPanel } from "@/components/forms/filter-panel";

type BudgetPeriodFilterProps = {
  month: number;
  year: number;
};

const monthOptions = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

export function BudgetPeriodFilter({
  month,
  year,
}: BudgetPeriodFilterProps) {
  const [monthValue, setMonthValue] = useState(String(month));
  const [yearValue, setYearValue] = useState(String(year));

  useEffect(() => {
    setMonthValue(String(month));
  }, [month]);

  useEffect(() => {
    setYearValue(String(year));
  }, [year]);

  const monthLabel =
    monthOptions.find((m) => m.value === Number(monthValue))?.label ?? monthValue;

  return (
    <FilterPanel
      action="/budgets"
      resetHref="/budgets"
      activeCount={0}
      formKey={`${month}-${year}`}
    >
      <FilterField label="Bulan">
        <Select
          name="month"
          value={monthValue}
          onValueChange={(v) => {
            if (v) setMonthValue(v);
          }}
        >
          <SelectTrigger className="h-8 w-full bg-background text-xs">
            <SelectValue placeholder="Pilih bulan">{monthLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((item) => (
              <SelectItem key={item.value} value={String(item.value)}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Tahun">
        <Input
          type="number"
          name="year"
          min="2000"
          max="2100"
          value={yearValue}
          onChange={(e) => setYearValue(e.target.value)}
          className="h-8 bg-background text-xs"
        />
      </FilterField>
    </FilterPanel>
  );
}
