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
import type {
  TransactionOptionAccount,
  TransactionOptionCategory,
} from "@/lib/queries/transactions";

type TransactionFiltersProps = {
  filters: {
    dateFrom: string;
    dateTo: string;
    type: string;
    categoryId: string;
    accountId: string;
    q: string;
  };
  accounts: TransactionOptionAccount[];
  incomeCategories: TransactionOptionCategory[];
  expenseCategories: TransactionOptionCategory[];
};

const typeLabels: Record<string, string> = {
  "": "Semua tipe",
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
};

export function TransactionFilters({
  filters,
  accounts,
  incomeCategories,
  expenseCategories,
}: TransactionFiltersProps) {
  const categories = [...incomeCategories, ...expenseCategories];

  const [type, setType] = useState(filters.type ?? "");
  const [accountId, setAccountId] = useState(filters.accountId ?? "");
  const [categoryId, setCategoryId] = useState(filters.categoryId ?? "");

  useEffect(() => {
    setType(filters.type ?? "");
  }, [filters.type]);

  useEffect(() => {
    setAccountId(filters.accountId ?? "");
  }, [filters.accountId]);

  useEffect(() => {
    setCategoryId(filters.categoryId ?? "");
  }, [filters.categoryId]);

  const activeCount = [
    filters.q,
    filters.dateFrom,
    filters.dateTo,
    filters.type,
    filters.categoryId,
    filters.accountId,
  ].filter(Boolean).length;

  const todayActive = isTodayRange(filters.dateFrom, filters.dateTo);
  const todayHref = createTodayHref(
    "/transactions",
    {
      q: filters.q,
      type: filters.type,
      categoryId: filters.categoryId,
      accountId: filters.accountId,
    },
    todayActive,
  );

  return (
    <FilterPanel
      action="/transactions"
      resetHref="/transactions"
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
          {filters.type && <FilterChip>{typeLabels[filters.type]}</FilterChip>}
          {filters.dateFrom && <FilterChip>{filters.dateFrom}</FilterChip>}
          {filters.dateTo && <FilterChip>{filters.dateTo}</FilterChip>}
          {filters.accountId && (
            <FilterChip>
              {accounts.find((a) => a.id === filters.accountId)?.name ?? "Akun"}
            </FilterChip>
          )}
          {filters.categoryId && (
            <FilterChip>
              {categories.find((c) => c.id === filters.categoryId)?.name ??
                "Kategori"}
            </FilterChip>
          )}
          <FilterResetChip href="/transactions" />
        </>
      }
    >
      <FilterField label="Kata kunci" className="sm:col-span-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="Cari deskripsi..."
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

      <FilterField label="Tipe">
        <Select value={type} onValueChange={(v) => setType(v ?? "")}>
          <SelectTrigger className="h-8 w-full bg-background text-xs">
            <SelectValue placeholder="Semua tipe">
              {typeLabels[type] || "Semua tipe"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Semua tipe</SelectItem>
            <SelectItem value="income">Pemasukan</SelectItem>
            <SelectItem value="expense">Pengeluaran</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="type" value={type} />
      </FilterField>

      <FilterField label="Akun">
        <Select value={accountId} onValueChange={(v) => setAccountId(v ?? "")}>
          <SelectTrigger className="h-8 w-full bg-background text-xs">
            <SelectValue placeholder="Semua akun">
              {accountId
                ? accounts.find((a) => a.id === accountId)?.name || "Semua akun"
                : "Semua akun"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Semua akun</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="accountId" value={accountId} />
      </FilterField>

      <FilterField label="Kategori">
        <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
          <SelectTrigger className="h-8 w-full bg-background text-xs">
            <SelectValue placeholder="Semua kategori">
              {categoryId
                ? categories.find((c) => c.id === categoryId)?.name ||
                  "Semua kategori"
                : "Semua kategori"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Semua kategori</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="categoryId" value={categoryId} />
      </FilterField>
    </FilterPanel>
  );
}
