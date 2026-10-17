"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Calendar, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTodayHref,
  FilterChip,
  FilterField,
  FilterPanel,
  FilterResetChip,
  isTodayRange,
} from "@/components/forms/filter-panel";
import type { TransactionOptionAccount } from "@/lib/queries/transactions";
import type { ProductTypeSummary } from "@/lib/queries/product-types";

type SaleFiltersProps = {
  filters: {
    dateFrom: string;
    dateTo: string;
    productTypeId: string;
    accountId: string;
    q: string;
  };
  accounts: TransactionOptionAccount[];
  productTypes: ProductTypeSummary[];
};

export function SaleFilters({ filters, accounts, productTypes }: SaleFiltersProps) {
  const [productTypeId, setProductTypeId] = useState(filters.productTypeId ?? "");
  const [accountId, setAccountId] = useState(filters.accountId ?? "");

  useEffect(() => {
    setProductTypeId(filters.productTypeId ?? "");
  }, [filters.productTypeId]);

  useEffect(() => {
    setAccountId(filters.accountId ?? "");
  }, [filters.accountId]);

  const safeTypes = productTypes ?? [];
  const safeAccounts = accounts ?? [];

  const activeCount = [
    filters.q,
    filters.dateFrom,
    filters.dateTo,
    filters.productTypeId,
    filters.accountId,
  ].filter(Boolean).length;

  const todayActive = isTodayRange(filters.dateFrom, filters.dateTo);
  const todayHref = createTodayHref(
    "/sales",
    {
      q: filters.q,
      productTypeId: filters.productTypeId,
      accountId: filters.accountId,
    },
    todayActive,
  );

  return (
    <FilterPanel
      action="/sales"
      resetHref="/sales"
      activeCount={activeCount}
      formKey={JSON.stringify(filters)}
      toolbar={
        <Link
          href={todayHref}
          className={buttonVariants({
            variant: todayActive ? "default" : "outline",
            size: "sm",
          })}
        >
          <Calendar className="size-3.5" />
          Hari Ini
        </Link>
      }
      chips={
        <>
          {filters.q && <FilterChip>{filters.q}</FilterChip>}
          {filters.dateFrom && <FilterChip>{filters.dateFrom}</FilterChip>}
          {filters.dateTo && <FilterChip>{filters.dateTo}</FilterChip>}
          {filters.productTypeId && (
            <FilterChip>
              {safeTypes.find((p) => p.id === filters.productTypeId)?.name ??
                "Tipe"}
            </FilterChip>
          )}
          {filters.accountId && (
            <FilterChip>
              {safeAccounts.find((a) => a.id === filters.accountId)?.name ??
                "Akun"}
            </FilterChip>
          )}
          <FilterResetChip href="/sales" />
        </>
      }
    >
      <FilterField label="Kata kunci" className="sm:col-span-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="Cari deskripsi / referensi..."
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

      <FilterField label="Tipe produk">
        <Select
          value={productTypeId}
          onValueChange={(v) => setProductTypeId(v ?? "")}
        >
          <SelectTrigger className="h-8 w-full bg-background text-xs">
            <SelectValue placeholder="Semua tipe">
              {productTypeId
                ? safeTypes.find((p) => p.id === productTypeId)?.name ||
                  "Semua tipe"
                : "Semua tipe"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Semua tipe</SelectItem>
            {safeTypes.map((productType) => (
              <SelectItem key={productType.id} value={productType.id}>
                {productType.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="productTypeId" value={productTypeId} />
      </FilterField>

      <FilterField label="Akun">
        <Select value={accountId} onValueChange={(v) => setAccountId(v ?? "")}>
          <SelectTrigger className="h-8 w-full bg-background text-xs">
            <SelectValue placeholder="Semua akun">
              {accountId
                ? safeAccounts.find((a) => a.id === accountId)?.name ||
                  "Semua akun"
                : "Semua akun"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Semua akun</SelectItem>
            {safeAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="accountId" value={accountId} />
      </FilterField>
    </FilterPanel>
  );
}
