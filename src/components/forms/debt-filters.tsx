"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

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
  FilterPanel,
  FilterResetChip,
} from "@/components/forms/filter-panel";
import type { CustomerSummary } from "@/lib/queries/customers";
import type { DebtStatus } from "@/lib/validations/debts";

type DebtFiltersProps = {
  filters: {
    dateFrom: string;
    dateTo: string;
    customerId: string;
    status: string;
    q: string;
  };
  customers: CustomerSummary[];
};

const statusOptions: Array<{ value: "" | DebtStatus; label: string }> = [
  { value: "", label: "Semua status" },
  { value: "belum_lunas", label: "Belum lunas" },
  { value: "mencicil", label: "Mencicil" },
  { value: "lunas", label: "Lunas" },
];

export function DebtFilters({ filters, customers }: DebtFiltersProps) {
  const [customerId, setCustomerId] = useState(filters.customerId ?? "");
  const [status, setStatus] = useState(filters.status ?? "");

  useEffect(() => {
    setCustomerId(filters.customerId ?? "");
  }, [filters.customerId]);

  useEffect(() => {
    setStatus(filters.status ?? "");
  }, [filters.status]);

  const activeCount = [
    filters.q,
    filters.dateFrom,
    filters.dateTo,
    filters.customerId,
    filters.status,
  ].filter(Boolean).length;

  return (
    <FilterPanel
      action="/debts"
      resetHref="/debts"
      activeCount={activeCount}
      formKey={JSON.stringify(filters)}
      chips={
        <>
          {filters.q && <FilterChip>{filters.q}</FilterChip>}
          {filters.dateFrom && <FilterChip>{filters.dateFrom}</FilterChip>}
          {filters.dateTo && <FilterChip>{filters.dateTo}</FilterChip>}
          {filters.status && (
            <FilterChip>
              {statusOptions.find((o) => o.value === filters.status)?.label ??
                filters.status}
            </FilterChip>
          )}
          {filters.customerId && (
            <FilterChip>
              {customers.find((c) => c.id === filters.customerId)?.name ??
                "Pelanggan"}
            </FilterChip>
          )}
          <FilterResetChip href="/debts" />
        </>
      }
    >
      <FilterField label="Kata kunci" className="sm:col-span-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="Cari pelanggan / produk..."
            className="h-8 bg-background pl-8 text-xs"
          />
        </div>
      </FilterField>

      <FilterField label="Tanggal awal">
        <Input
          type="date"
          name="dateFrom"
          defaultValue={filters.dateFrom}
          className="h-8 bg-background text-xs"
        />
      </FilterField>

      <FilterField label="Tanggal akhir">
        <Input
          type="date"
          name="dateTo"
          defaultValue={filters.dateTo}
          className="h-8 bg-background text-xs"
        />
      </FilterField>

      <FilterField label="Pelanggan">
        <Select
          value={customerId}
          onValueChange={(v) => setCustomerId(v ?? "")}
        >
          <SelectTrigger className="h-8 w-full bg-background text-xs">
            <SelectValue placeholder="Semua pelanggan">
              {customerId
                ? customers.find((c) => c.id === customerId)?.name ||
                  "Semua pelanggan"
                : "Semua pelanggan"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Semua pelanggan</SelectItem>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="customerId" value={customerId} />
      </FilterField>

      <FilterField label="Status">
        <Select value={status} onValueChange={(v) => setStatus(v ?? "")}>
          <SelectTrigger className="h-8 w-full bg-background text-xs">
            <SelectValue placeholder="Semua status">
              {statusOptions.find((o) => o.value === status)?.label ??
                "Semua status"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value || "all"} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="status" value={status} />
      </FilterField>
    </FilterPanel>
  );
}
