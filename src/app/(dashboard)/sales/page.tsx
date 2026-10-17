import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Package,
  ShoppingCart,
  SquarePen,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";

import {
  cleanupOrphanSaleAction,
  deleteProductTypeAction,
  deleteSaleAction,
} from "@/app/(dashboard)/sales/actions";
import { DeleteButton, OrphanCleanupButton } from "@/components/dashboard/delete-button";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { ProductTypeFormDialog } from "@/components/forms/product-type-form-dialog";
import { SaleFilters } from "@/components/forms/sale-filters";
import { SaleFormDialog } from "@/components/forms/sale-form-dialog";
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
import { getCustomers } from "@/lib/queries/customers";
import { getSales } from "@/lib/queries/sales";
import { financeDeleteMessages } from "@/lib/utils/delete-messages";
import { formatCurrencyIDR, formatDateID } from "@/lib/utils/format";
import { paginate } from "@/lib/utils/paginate";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type SaleListItem = Awaited<ReturnType<typeof getSales>>["sales"][number];

type SalesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function renderSaleAccountLabel(sale: SaleListItem): ReactNode {
  if (sale.isCredit) {
    return (
      <>
        {sale.costAccountName ?? "-"}
        <ArrowSeparator />
        {/* Akun penerima = akun cicilan terakhir; "-" bila belum ada cicilan. */}
        {sale.lastPaymentAccountName ?? "-"}
        {sale.customerName ? ` · ${sale.customerName}` : ""}
      </>
    );
  }

  if (sale.costAccountName) {
    return (
      <>
        {sale.costAccountName}
        <ArrowSeparator />
        {sale.incomeAccountName ?? "-"}
      </>
    );
  }

  return sale.incomeAccountName ?? "";
}

/** Badge status hutang untuk sale kredit: "Kurang RpX" selama bersisa, "Lunas" saat lunas. */
function SaleDebtBadge({ sale }: { sale: SaleListItem }) {
  if (!sale.isCredit) return null;

  const lunas = sale.debtStatus === "lunas";
  return (
    <StatusBadge
      label={
        lunas
          ? "Hutang · Lunas"
          : `Hutang · Kurang ${formatCurrencyIDR(sale.remainingAmount)}`
      }
      className={
        lunas
          ? "border-status-income-border bg-status-income-bg text-status-income"
          : "border-status-transfer-border bg-status-transfer-bg text-status-transfer"
      }
    />
  );
}

const needsMigrationHint = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("product_types") ||
    lower.includes("sales") ||
    lower.includes("relation") ||
    lower.includes("does not exist") ||
    lower.includes("pgrst205") ||
    lower.includes("schema cache")
  );
};

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const params = (await searchParams) ?? {};
  const filters = {
    dateFrom: getSingleSearchParam(params, "dateFrom") ?? "",
    dateTo: getSingleSearchParam(params, "dateTo") ?? "",
    productTypeId: getSingleSearchParam(params, "productTypeId") ?? "",
    accountId: getSingleSearchParam(params, "accountId") ?? "",
    q: getSingleSearchParam(params, "q") ?? "",
    page: Number(getSingleSearchParam(params, "page") ?? "1"),
    pageSize: 10,
  };

  const [result, customers] = await Promise.all([
    getSales(filters)
      .then((data) => ({ data, error: null as string | null }))
      .catch((error) => ({
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Gagal memuat data penjualan dari Supabase.",
      })),
    // Daftar pelanggan untuk opsi "Hutang" di form penjualan.
    // Gagal muat pelanggan tidak boleh membuat seluruh halaman gagal.
    getCustomers({ activeOnly: true }).catch(() => []),
  ]);

  const header = (
    <PageHeader
      title="Penjualan"
      description="Catatan penjualanmu."
    />
  );

  if (result.error || !result.data) {
    const hint = result.error && needsMigrationHint(result.error);

    return (
      <section className="space-y-5">
        {header}
        <ErrorState
          description={result.error ?? "Gagal memuat data penjualan."}
        />
        {hint ? (
          <div className="rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3 text-xs leading-relaxed text-status-warning">
            Tabel <code className="font-mono">product_types</code> /{" "}
            <code className="font-mono">sales</code> belum ada di Supabase.
            Jalankan <code className="font-mono">supabase/schema.sql</code>{" "}
            terbaru via SQL Editor Supabase, lalu refresh halaman ini.
          </div>
        ) : null}
      </section>
    );
  }

  const {
    sales,
    totals,
    profitByProduct,
    accounts,
    productTypes,
    incomeCategories,
    expenseCategories,
    productTypeUsage,
    accountUsage,
    incomeCategoryUsage,
    expenseCategoryUsage,
    totalCount,
    page,
    totalPages,
  } = result.data;

  const currentTab = getSingleSearchParam(params, "tab") ?? "penjualan";

  const createTabHref = (tabValue: string) => {
    const nextParams = new URLSearchParams();
    if (filters.dateFrom) nextParams.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) nextParams.set("dateTo", filters.dateTo);
    if (filters.productTypeId) nextParams.set("productTypeId", filters.productTypeId);
    if (filters.accountId) nextParams.set("accountId", filters.accountId);
    if (filters.q) nextParams.set("q", filters.q);
    if (tabValue !== "penjualan") nextParams.set("tab", tabValue);
    const qs = nextParams.toString();
    return `/sales${qs ? `?${qs}` : ""}`;
  };

  const tabs = [
    {
      value: "penjualan",
      label: "Penjualan",
      icon: ShoppingCart,
      count: totals.count,
    },
    {
      value: "laba",
      label: "Laba per Tipe",
      icon: TrendingUp,
      count: profitByProduct.length,
    },
    {
      value: "tipe",
      label: "Tipe Produk",
      icon: Package,
      count: productTypes.length,
    },
  ] as const;

  const paginationQuery = {
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
    ...(filters.productTypeId ? { productTypeId: filters.productTypeId } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.q ? { q: filters.q } : {}),
    ...(currentTab !== "penjualan" ? { tab: currentTab } : {}),
  };

  const missingCategories =
    incomeCategories.length === 0 || expenseCategories.length === 0;

  const profitPage = paginate(
    profitByProduct,
    Number(getSingleSearchParam(params, "pageProfit") ?? "1"),
    PAGE_SIZE,
  );
  const productTypePage = paginate(
    productTypes,
    Number(getSingleSearchParam(params, "pageType") ?? "1"),
    PAGE_SIZE,
  );
  const paginatedProfitByProduct = profitPage.items;
  const paginatedProductTypes = productTypePage.items;

  return (
    <section className="space-y-5">
      {header}

      <div className="enter-stagger grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Omzet"
          value={formatCurrencyIDR(totals.turnover)}
          helper={`${totals.count} penjualan`}
          icon={ArrowUpRight}
          variant="balance"
        />
        <SummaryCard
          label="Modal"
          value={formatCurrencyIDR(totals.totalCost)}
          helper="Total modal keluar"
          icon={ArrowDownRight}
          variant="expense"
        />
        <SummaryCard
          label="Laba"
          value={formatCurrencyIDR(totals.profit)}
          helper={
            totals.turnover > 0
              ? `Margin ${((totals.profit / totals.turnover) * 100).toFixed(1).replace(".", ",")}%`
              : "Belum ada omzet"
          }
          icon={Wallet}
          variant="income"
        />
      </div>

      {missingCategories ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3 text-xs leading-relaxed text-status-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            Butuh kategori <b>Penjualan</b> (pemasukan) dan <b>HPP / Modal</b>{" "}
            (pengeluaran) di halaman Kategori sebelum mencatat penjualan.
          </p>
        </div>
      ) : null}

      {/* Segmented Pill Switcher untuk Penjualan */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-muted/40 p-1 text-xs font-semibold w-fit">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.value;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.value}
              href={createTabHref(tab.value)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all duration-150",
                isActive
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
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

      {currentTab === "penjualan" && (
        <DataTableCard
          title="Daftar Penjualan"
        >
          <SaleFilters
            filters={result.data.filters}
            accounts={accounts}
            productTypes={productTypes}
          />

          {sales.length === 0 ? (
            <EmptyState
              title="Belum ada penjualan"
              description="Catat penjualan Pulsa, Kuota, Token Listrik, Wifi, atau tipe custom pertamamu. Modal dan pemasukan bisa beda akun."
            />
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="divide-y divide-border/40 sm:hidden">
                {sales.map((sale) => (
                  <div key={sale.id} className="space-y-2 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {sale.productTypeName ?? "-"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDateID(sale.sale_date)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            sale.profit >= 0
                              ? "text-status-income"
                              : "text-status-expense"
                          )}
                        >
                          {formatCurrencyIDR(sale.profit)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          laba
                        </p>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {renderSaleAccountLabel(sale)}
                      {!sale.isCredit && sale.customer_ref
                        ? ` · ${sale.customer_ref}`
                        : ""}
                      {sale.description ? ` · ${sale.description}` : ""}
                    </p>
                    <SaleDebtBadge sale={sale} />
                    <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                      <span className="text-status-expense">
                        Modal {formatCurrencyIDR(sale.cost_amount)}
                      </span>
                      <span className="text-status-income">
                        Jual{" "}
                        {formatCurrencyIDR(
                          sale.isCredit ? sale.paidAmount : sale.sell_amount
                        )}
                      </span>
                    </div>
                    {sale.isOrphan ? (
                      <p className="flex items-center gap-1 text-xs text-status-warning">
                        <TriangleAlert className="size-3" />
                        Transaksi terhubung terhapus
                      </p>
                    ) : null}
                    <div className="flex items-center gap-1 pt-0.5">
                      {sale.isOrphan ? (
                        <OrphanCleanupButton
                          action={cleanupOrphanSaleAction.bind(null, sale.id)}
                        />
                      ) : null}
                      {sale.isCredit ? (
                        <Link
                          href="/debts"
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                        >
                          <SquarePen className="size-3.5" />
                          Kelola di Hutang
                        </Link>
                      ) : (
                        <SaleFormDialog
                          sale={sale}
                          productTypes={productTypes}
                          accounts={accounts}
                          incomeCategories={incomeCategories}
                          expenseCategories={expenseCategories}
                          productTypeUsage={productTypeUsage}
                          accountUsage={accountUsage}
                          incomeCategoryUsage={incomeCategoryUsage}
                          expenseCategoryUsage={expenseCategoryUsage}
                        />
                      )}
                      <DeleteButton
                        action={deleteSaleAction.bind(null, sale.id)}
                        title="Hapus penjualan?"
                        description={
                          sale.isCredit
                            ? financeDeleteMessages.creditSale
                            : financeDeleteMessages.cashSale
                        }
                        confirmLabel="Hapus penjualan"
                        successMessage="Penjualan dihapus."
                      />
                    </div>
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
                      <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                        Modal
                      </TableHead>
                      <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                        Jual
                      </TableHead>
                      <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                        Laba
                      </TableHead>
                      <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow
                        key={sale.id}
                        className="border-border/40 transition-colors duration-150 hover:bg-muted/30"
                      >
                        <TableCell className="py-2.5 text-xs whitespace-nowrap text-muted-foreground">
                          {formatDateID(sale.sale_date)}
                        </TableCell>
                        <TableCell className="max-w-[240px] py-2.5">
                          <p className="line-clamp-1 text-xs font-semibold text-foreground">
                            {sale.productTypeName ?? "-"}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {renderSaleAccountLabel(sale)}
                            {!sale.isCredit && sale.customer_ref
                              ? ` · ${sale.customer_ref}`
                              : ""}
                            {sale.description ? ` · ${sale.description}` : ""}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <SaleDebtBadge sale={sale} />
                            {sale.isOrphan ? (
                              <StatusBadge
                                label="Transaksi terhubung terhapus"
                                className="border-status-warning-border bg-status-warning-bg text-status-warning"
                              />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-right text-xs whitespace-nowrap text-status-expense tabular-nums">
                          {formatCurrencyIDR(sale.cost_amount)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right text-xs font-medium whitespace-nowrap text-status-income tabular-nums">
                          {formatCurrencyIDR(
                            sale.isCredit ? sale.paidAmount : sale.sell_amount
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "py-2.5 text-right text-xs font-semibold whitespace-nowrap tabular-nums",
                            sale.profit >= 0
                              ? "text-status-income"
                              : "text-status-expense"
                          )}
                        >
                          {formatCurrencyIDR(sale.profit)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            {sale.isOrphan ? (
                              <OrphanCleanupButton
                                action={cleanupOrphanSaleAction.bind(null, sale.id)}
                              />
                            ) : null}
                            {sale.isCredit ? (
                              <Link
                                href="/debts"
                                className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                              >
                                <SquarePen className="size-3.5" />
                                Kelola di Hutang
                              </Link>
                            ) : (
                              <SaleFormDialog
                                sale={sale}
                                productTypes={productTypes}
                                accounts={accounts}
                                incomeCategories={incomeCategories}
                                expenseCategories={expenseCategories}
                                productTypeUsage={productTypeUsage}
                                accountUsage={accountUsage}
                                incomeCategoryUsage={incomeCategoryUsage}
                                expenseCategoryUsage={expenseCategoryUsage}
                              />
                            )}
                            <DeleteButton
                              action={deleteSaleAction.bind(null, sale.id)}
                              title="Hapus penjualan?"
                              description={
                                sale.isCredit
                                  ? financeDeleteMessages.creditSale
                                  : financeDeleteMessages.cashSale
                              }
                              confirmLabel="Hapus penjualan"
                              successMessage="Penjualan dihapus."
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
            basePath="/sales"
            searchParams={paginationQuery}
            entityLabel="penjualan"
          />
        </DataTableCard>
      )}

      {currentTab === "laba" && (
        <DataTableCard
          title="Laba per Tipe"
        >
          {profitByProduct.length === 0 ? (
            <EmptyState
              title="Belum ada breakdown"
              description="Breakdown laba per tipe muncul setelah ada penjualan pada filter aktif."
              icon={Package}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Tipe
                    </TableHead>
                    <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Transaksi
                    </TableHead>
                    <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Omzet
                    </TableHead>
                    <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Modal
                    </TableHead>
                    <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Laba
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProfitByProduct.map((row) => (
                    <TableRow
                      key={`${row.productTypeId ?? "notype"}-${row.productTypeName}`}
                      className="border-border/40 transition-colors duration-150 hover:bg-muted/30"
                    >
                      <TableCell className="py-2.5 text-xs font-semibold text-foreground">
                        {row.productTypeName}
                      </TableCell>
                      <TableCell className="py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                        {row.count}x
                      </TableCell>
                      <TableCell className="py-2.5 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatCurrencyIDR(row.turnover)}
                      </TableCell>
                      <TableCell className="py-2.5 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatCurrencyIDR(row.totalCost)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "py-2.5 text-right text-xs font-semibold whitespace-nowrap tabular-nums",
                          row.profit >= 0
                            ? "text-status-income"
                            : "text-status-expense"
                        )}
                      >
                        {formatCurrencyIDR(row.profit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <PaginationControls
            page={profitPage.page}
            totalPages={profitPage.totalPages}
            totalCount={profitPage.totalCount}
            basePath="/sales"
            searchParams={paginationQuery}
            pageParam="pageProfit"
            entityLabel="tipe"
          />
        </DataTableCard>
      )}

      {currentTab === "tipe" && (
        <DataTableCard
          title="Tipe Produk"
        >
          {productTypes.length === 0 ? (
            <EmptyState
              title="Belum ada tipe"
              description="Tambahkan tipe produk pertama, mis. Pulsa, Kuota, Token Listrik, atau Wifi."
              icon={Package}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Nama
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Asal
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProductTypes.map((productType) => (
                    <TableRow
                      key={productType.id}
                      className="border-border/40 transition-colors duration-150 hover:bg-muted/30"
                    >
                      <TableCell className="py-2.5 text-xs font-semibold text-foreground">
                        {productType.name}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">
                        {productType.isBuiltin ? "Bawaan" : "Custom"}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <StatusBadge
                          label={productType.isActive ? "Aktif" : "Nonaktif"}
                          className={
                            productType.isActive
                              ? "border-status-income-border bg-status-income-bg text-status-income"
                              : "border-border bg-muted text-muted-foreground"
                          }
                        />
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <ProductTypeFormDialog productType={productType} />
                          {productType.isBuiltin ? null : (
                            <DeleteButton
                              action={deleteProductTypeAction.bind(
                                null,
                                productType.id
                              )}
                              title="Hapus tipe produk?"
                              description="Tipe yang dihapus tidak bisa dikembalikan."
                              confirmLabel="Hapus tipe"
                              successMessage="Tipe produk dihapus."
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <PaginationControls
            page={productTypePage.page}
            totalPages={productTypePage.totalPages}
            totalCount={productTypePage.totalCount}
            basePath="/sales"
            searchParams={paginationQuery}
            pageParam="pageType"
            entityLabel="tipe produk"
          />
        </DataTableCard>
      )}

      <Fab>
        {currentTab === "tipe" ? (
          <ProductTypeFormDialog />
        ) : (
          <SaleFormDialog
            productTypes={productTypes}
            accounts={accounts}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            customers={customers}
            productTypeUsage={productTypeUsage}
            accountUsage={accountUsage}
            incomeCategoryUsage={incomeCategoryUsage}
            expenseCategoryUsage={expenseCategoryUsage}
          />
        )}
      </Fab>
    </section>
  );
}
