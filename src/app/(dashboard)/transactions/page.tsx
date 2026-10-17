import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  HandCoins,
  Plus,
  ShoppingCart,
} from "lucide-react";

import { deleteTransactionAction } from "@/app/(dashboard)/transactions/actions";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { DeleteButton } from "@/components/dashboard/delete-button";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { TransactionTypeBadge } from "@/components/dashboard/transaction-type-badge";
import { TransactionFilters } from "@/components/forms/transaction-filters";
import { TransactionFormDialog } from "@/components/forms/transaction-form-dialog";
import { Fab } from "@/components/layout/fab";
import { PageHeader } from "@/components/layout/page-header";
import { ArrowSeparator } from "@/components/ui/arrow-separator";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getTransactions,
  type TransactionSource,
  type TransactionSummary,
} from "@/lib/queries/transactions";
import { formatCurrencyIDR, formatDateID } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/** Chip atribusi sumber: transaksi lahir dari Penjualan/Hutang, klik menuju halamannya. */
function TransactionSourceChip({ source }: { source: TransactionSource }) {
  const Icon =
    source.kind === "sale-cost" || source.kind === "sale-income"
      ? ShoppingCart
      : HandCoins;

  return (
    <Link
      href={source.href}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-foreground"
    >
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{source.label}</span>
    </Link>
  );
}

function renderDeleteWarning(transaction: TransactionSummary): string {
  if (transaction.source) {
    const target =
      transaction.source.href === "/sales" ? "Penjualan" : "Hutang";
    return `Transaksi ini terhubung ke catatan di halaman ${target}. Jika dihapus, catatan sumbernya akan ditandai yatim dan bisa dibersihkan dari halaman tersebut.`;
  }
  return "Transaksi yang dihapus tidak bisa dikembalikan.";
}

function renderAccountLabel(
  transaction: Awaited<ReturnType<typeof getTransactions>>["transactions"][number],
): ReactNode {
  if (transaction.type === "transfer") {
    return (
      <>
        {transaction.fromAccountName ?? "Unknown"}
        <ArrowSeparator />
        {transaction.toAccountName ?? "Unknown"}
      </>
    );
  }

  return transaction.accountName ?? "-";
}

const amountColors = {
  income: "text-status-income",
  expense: "text-status-expense",
  transfer: "text-status-transfer",
} as const;

type TransactionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const params = (await searchParams) ?? {};
  const filters = {
    dateFrom: getSingleSearchParam(params, "dateFrom") ?? "",
    dateTo: getSingleSearchParam(params, "dateTo") ?? "",
    type: getSingleSearchParam(params, "type") as
      | "income"
      | "expense"
      | "transfer"
      | undefined,
    categoryId: getSingleSearchParam(params, "categoryId") ?? "",
    accountId: getSingleSearchParam(params, "accountId") ?? "",
    q: getSingleSearchParam(params, "q") ?? "",
    page: Number(getSingleSearchParam(params, "page") ?? "1"),
    pageSize: 10,
  };

  const result = await getTransactions(filters)
    .then((data) => ({ data, error: null as string | null }))
    .catch((error) => ({
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Gagal memuat data transaksi dari Supabase.",
    }));

  const header = (
    <PageHeader
      title="Transaksi"
      description="Catatan transaksimu."
    />
  );

  if (result.error || !result.data) {
    return (
      <section className="space-y-5">
        {header}
        <ErrorState description={result.error ?? "Gagal memuat data transaksi."} />
      </section>
    );
  }

  const {
    transactions,
    accounts,
    incomeCategories,
    expenseCategories,
    accountUsage,
    categoryUsage,
    summary,
  } = result.data;
  const { totalCount, page, totalPages } = result.data;
  const paginationQuery = {
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };

  const createTypeHref = (newType: string) => {
    const nextParams = new URLSearchParams();
    if (filters.dateFrom) nextParams.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) nextParams.set("dateTo", filters.dateTo);
    if (filters.categoryId) nextParams.set("categoryId", filters.categoryId);
    if (filters.accountId) nextParams.set("accountId", filters.accountId);
    if (filters.q) nextParams.set("q", filters.q);
    if (newType) nextParams.set("type", newType);
    const qs = nextParams.toString();
    return `/transactions${qs ? `?${qs}` : ""}`;
  };

  const totalAllCount = summary.incomeCount + summary.expenseCount + summary.transferCount;
  const currentType = filters.type ?? "";

  const typeTabs = [
    {
      value: "",
      label: "Semua",
      count: totalAllCount,
      icon: null,
    },
    {
      value: "income",
      label: "Pemasukan",
      count: summary.incomeCount,
      icon: ArrowUpRight,
    },
    {
      value: "expense",
      label: "Pengeluaran",
      count: summary.expenseCount,
      icon: ArrowDownRight,
    },
    {
      value: "transfer",
      label: "Transfer",
      count: summary.transferCount,
      icon: ArrowUpDown,
    },
  ];

  return (
    <section className="space-y-5">
      {header}

      <div className="enter-stagger grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Pemasukan"
          value={formatCurrencyIDR(summary.incomeTotal)}
          helper={`${summary.incomeCount} transaksi`}
          icon={Plus}
          variant="income"
        />
        <SummaryCard
          label="Pengeluaran"
          value={formatCurrencyIDR(summary.expenseTotal)}
          helper={`${summary.expenseCount} transaksi`}
          icon={ArrowRight}
          variant="expense"
        />
        <SummaryCard
          label="Transfer"
          value={formatCurrencyIDR(summary.transferTotal)}
          helper={`${summary.transferCount} transaksi`}
          icon={ArrowUpDown}
          variant="default"
        />
      </div>

      {/* Segmented Pill Switcher untuk Tipe Transaksi */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-muted/40 p-1 text-xs font-semibold w-fit">
        {typeTabs.map((tab) => {
          const isActive = currentType === tab.value;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.value}
              href={createTypeHref(tab.value)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all duration-150",
                isActive
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon && <Icon className="size-4" />}
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <DataTableCard
        title="Daftar Transaksi"
      >
        <TransactionFilters
          filters={result.data.filters}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
        />

        {transactions.length === 0 ? (
          <EmptyState
            title="Belum ada transaksi"
            description="Tambahkan pemasukan, pengeluaran, atau transfer pertamamu untuk mulai membangun riwayat arus kas."
          />
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="divide-y divide-border/40 sm:hidden">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <TransactionTypeBadge type={transaction.type} />
                    <p className="truncate text-xs font-medium text-foreground">
                      {renderAccountLabel(transaction)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateID(transaction.transactionDate)}
                      {transaction.categoryName
                        ? ` · ${transaction.categoryName}`
                        : ""}
                    </p>
                    {transaction.source ? (
                      <TransactionSourceChip source={transaction.source} />
                    ) : null}
                    {transaction.memo ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {transaction.memo}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-1 pt-0.5">
                      <TransactionFormDialog
                        transaction={transaction}
                        accounts={accounts}
                        incomeCategories={incomeCategories}
                        expenseCategories={expenseCategories}
                        accountUsage={accountUsage}
                        categoryUsage={categoryUsage}
                      />
                      <DeleteButton
                        action={deleteTransactionAction.bind(null, transaction.id)}
                        title="Hapus transaksi?"
                        description={renderDeleteWarning(transaction)}
                        confirmLabel="Hapus transaksi"
                        successMessage="Transaksi dihapus."
                        className="h-7 text-xs text-muted-foreground"
                      />
                    </div>
                  </div>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-0.5 text-sm font-semibold tabular-nums",
                      amountColors[transaction.type]
                    )}
                  >
                    {transaction.type === "income" && (
                      <ArrowUpRight className="size-3 opacity-60" />
                    )}
                    {transaction.type === "expense" && (
                      <ArrowDownRight className="size-3 opacity-60" />
                    )}
                    {formatCurrencyIDR(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Tanggal
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Tipe
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Akun / Transfer
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Kategori
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Deskripsi
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Sumber
                    </TableHead>
                    <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Nominal
                    </TableHead>
                    <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      className="border-border/40 transition-colors duration-150 hover:bg-muted/30"
                    >
                      <TableCell className="py-2.5 text-xs whitespace-nowrap text-muted-foreground">
                        {formatDateID(transaction.transactionDate)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <TransactionTypeBadge type={transaction.type} />
                      </TableCell>
                      <TableCell className="max-w-[220px] py-2.5">
                        <span className="line-clamp-2 text-xs text-foreground">
                          {renderAccountLabel(transaction)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">
                        {transaction.categoryName ?? "-"}
                      </TableCell>
                      <TableCell className="max-w-[240px] py-2.5">
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {transaction.memo || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[180px] py-2.5">
                        {transaction.source ? (
                          <TransactionSourceChip source={transaction.source} />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "py-2.5 text-right text-xs font-semibold whitespace-nowrap tabular-nums",
                          amountColors[transaction.type]
                        )}
                      >
                        <span className="flex items-center justify-end gap-1">
                          {transaction.type === "income" && (
                            <ArrowUpRight className="size-3 opacity-60" />
                          )}
                          {transaction.type === "expense" && (
                            <ArrowDownRight className="size-3 opacity-60" />
                          )}
                          {formatCurrencyIDR(transaction.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <TransactionFormDialog
                            transaction={transaction}
                            accounts={accounts}
                            incomeCategories={incomeCategories}
                            expenseCategories={expenseCategories}
                            accountUsage={accountUsage}
                            categoryUsage={categoryUsage}
                          />
                          <DeleteButton
                            action={deleteTransactionAction.bind(
                              null,
                              transaction.id
                            )}
                            title="Hapus transaksi?"
                            description={renderDeleteWarning(transaction)}
                            confirmLabel="Hapus transaksi"
                            successMessage="Transaksi dihapus."
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          basePath="/transactions"
          searchParams={paginationQuery}
          entityLabel="transaksi"
        />
      </DataTableCard>

      <Fab>
        <TransactionFormDialog
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          accountUsage={accountUsage}
          categoryUsage={categoryUsage}
        />
      </Fab>
    </section>
  );
}
