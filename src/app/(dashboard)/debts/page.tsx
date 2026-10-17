import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  HandCoins,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";

import {
  cleanupOrphanPaymentAction,
  deleteCustomerAction,
  deleteDebtAction,
  deletePaymentAction,
} from "@/app/(dashboard)/debts/actions";
import {
  DeleteButton,
  OrphanCleanupButton,
} from "@/components/dashboard/delete-button";
import { DebtStatusBadge } from "@/components/dashboard/debt-status-badge";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { ProgressBar } from "@/components/dashboard/progress-bar";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { CustomerFormDialog } from "@/components/forms/customer-form-dialog";
import { DebtFilters } from "@/components/forms/debt-filters";
import { DebtFormDialog } from "@/components/forms/debt-form-dialog";
import { PaymentFormDialog } from "@/components/forms/payment-form-dialog";
import { Fab } from "@/components/layout/fab";
import { PageHeader } from "@/components/layout/page-header";
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
import { getDebts } from "@/lib/queries/debts";
import { financeDeleteMessages } from "@/lib/utils/delete-messages";
import { formatCurrencyIDR, formatDateID } from "@/lib/utils/format";
import { paginate } from "@/lib/utils/paginate";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type DebtsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

const needsMigrationHint = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("customers") ||
    lower.includes("debts") ||
    lower.includes("debt_payments") ||
    lower.includes("relation") ||
    lower.includes("does not exist") ||
    lower.includes("pgrst205") ||
    lower.includes("schema cache")
  );
};

export default async function DebtsPage({ searchParams }: DebtsPageProps) {
  const params = (await searchParams) ?? {};
  const rawStatus = getSingleSearchParam(params, "status") ?? "";
  const filters = {
    dateFrom: getSingleSearchParam(params, "dateFrom") ?? "",
    dateTo: getSingleSearchParam(params, "dateTo") ?? "",
    customerId: getSingleSearchParam(params, "customerId") ?? "",
    status: (["belum_lunas", "mencicil", "lunas", ""].includes(rawStatus)
      ? rawStatus
      : "") as "" | "belum_lunas" | "mencicil" | "lunas",
    q: getSingleSearchParam(params, "q") ?? "",
    page: Number(getSingleSearchParam(params, "page") ?? "1"),
    pageSize: 10,
  };

  const result = await getDebts(filters)
    .then((data) => ({ data, error: null as string | null }))
    .catch((error) => ({
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Gagal memuat data hutang dari Supabase.",
    }));

  const header = (
    <PageHeader
      title="Hutang"
      description="Catatan hutang pelangganmu."
    />
  );

  if (result.error || !result.data) {
    const hint = result.error && needsMigrationHint(result.error);

    return (
      <section className="space-y-5">
        {header}
        <ErrorState description={result.error ?? "Gagal memuat data hutang."} />
        {hint ? (
          <div className="rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3 text-xs leading-relaxed text-status-warning">
            Tabel <code className="font-mono">customers</code> /{" "}
            <code className="font-mono">debts</code> /{" "}
            <code className="font-mono">debt_payments</code> belum ada di
            Supabase. Jalankan{" "}
            <code className="font-mono">supabase/schema.sql</code> terbaru via
            SQL Editor Supabase, lalu refresh halaman ini.
          </div>
        ) : null}
      </section>
    );
  }

  const {
    debts,
    totals,
    accounts,
    customers: allCustomers,
    productTypes,
    incomeCategories,
    expenseCategories,
    customerUsage,
    productTypeUsage,
    accountUsage,
    incomeCategoryUsage,
    expenseCategoryUsage,
    totalCount,
    page,
    totalPages,
  } = result.data;

  const currentTab = getSingleSearchParam(params, "tab") ?? "hutang";

  const createTabHref = (tabValue: string) => {
    const nextParams = new URLSearchParams();
    if (filters.dateFrom) nextParams.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) nextParams.set("dateTo", filters.dateTo);
    if (filters.customerId) nextParams.set("customerId", filters.customerId);
    if (filters.status) nextParams.set("status", filters.status);
    if (filters.q) nextParams.set("q", filters.q);
    if (tabValue !== "hutang") nextParams.set("tab", tabValue);
    const qs = nextParams.toString();
    return `/debts${qs ? `?${qs}` : ""}`;
  };

  const tabs = [
    {
      value: "hutang",
      label: "Hutang",
      icon: HandCoins,
      count: totals.count,
    },
    {
      value: "pelanggan",
      label: "Pelanggan",
      icon: Users,
      count: allCustomers.length,
    },
  ] as const;

  const paginationQuery = {
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { q: filters.q } : {}),
    ...(currentTab !== "hutang" ? { tab: currentTab } : {}),
  };

  const dialogProps = {
    customers: allCustomers,
    productTypes,
    accounts,
    incomeCategories,
    expenseCategories,
    customerUsage,
    productTypeUsage,
    accountUsage,
    incomeCategoryUsage,
    expenseCategoryUsage,
  };

  const customerPage = paginate(
    allCustomers,
    Number(getSingleSearchParam(params, "pageCustomer") ?? "1"),
    PAGE_SIZE,
  );
  const customers = customerPage.items;

  const missingCategories =
    incomeCategories.length === 0 || expenseCategories.length === 0;

  return (
    <section className="space-y-5">
      {header}

      <div className="enter-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Tagihan"
          value={formatCurrencyIDR(totals.totalTagihan)}
          helper={`${totals.count} hutang`}
          icon={HandCoins}
          variant="expense"
        />
        <SummaryCard
          label="Sudah Dibayar"
          value={formatCurrencyIDR(totals.totalTerbayar)}
          helper="Total cicilan masuk"
          icon={ArrowUpRight}
          variant="income"
        />
        <SummaryCard
          label="Sisa Hutang"
          value={formatCurrencyIDR(totals.totalSisa)}
          helper="Belum dibayar pelanggan"
          icon={ArrowDownRight}
          variant="balance"
        />
        <SummaryCard
          label="Status"
          value={`${totals.belumLunas + totals.mencicil} aktif`}
          helper={`${totals.belumLunas} belum lunas · ${totals.mencicil} mencicil · ${totals.lunas} lunas`}
          icon={Wallet}
          variant="default"
        />
      </div>

      {missingCategories ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3 text-xs leading-relaxed text-status-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            Butuh kategori <b>Penjualan</b> (pemasukan) dan <b>HPP / Modal</b>{" "}
            (pengeluaran) di halaman Kategori sebelum mencatat hutang.
          </p>
        </div>
      ) : null}

      {/* Segmented Pill Switcher untuk Hutang & Pelanggan */}
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

      {currentTab === "hutang" ? (
        <DataTableCard
          title="Daftar Hutang"
        >
          <DebtFilters filters={result.data.filters} customers={customers} />

            {debts.length === 0 ? (
              <EmptyState
                title="Belum ada hutang"
                description="Catat hutang pelanggan pertama — produk kredit atau pinjaman uang. Tagihan dibayar bertahap via cicilan."
                icon={HandCoins}
              />
            ) : (
              <div className="space-y-3">
                {debts.map((debt) => {
                  const paidPct =
                    debt.totalAmount > 0
                      ? Math.min(
                        (debt.paidAmount / debt.totalAmount) * 100,
                        100
                      )
                      : 0;

                  return (
                    <article
                      key={debt.id}
                      className="rounded-xl border border-border/60 bg-card p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {debt.customerName}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDateID(debt.saleDate)}
                            {debt.kind === "loan"
                              ? " · Pinjaman Uang"
                              : debt.productTypeName
                                ? ` · ${debt.productTypeName}`
                                : ""}
                            {debt.costAccountName
                              ? ` · dari ${debt.costAccountName}`
                              : ""}
                          </p>
                          {debt.description ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {debt.description}
                            </p>
                          ) : null}
                        </div>
                        <DebtStatusBadge status={debt.status} />
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-xs font-semibold tabular-nums">
                            {formatCurrencyIDR(debt.totalAmount)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                          <p className="text-xs text-muted-foreground">
                            Terbayar
                          </p>
                          <p className="text-xs font-semibold text-status-income tabular-nums">
                            {formatCurrencyIDR(debt.paidAmount)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                          <p className="text-xs text-muted-foreground">Sisa</p>
                          <p
                            className={cn(
                              "text-xs font-semibold tabular-nums",
                              debt.remainingAmount > 0
                                ? "text-status-expense"
                                : "text-status-income"
                            )}
                          >
                            {formatCurrencyIDR(debt.remainingAmount)}
                          </p>
                        </div>
                      </div>

                      <ProgressBar
                        value={paidPct}
                        tone="income"
                        className="mt-2"
                      />

                      {debt.isOrphan ? (
                        <p className="mt-2 inline-flex items-center gap-1 rounded-md border border-status-warning-border bg-status-warning-bg px-1.5 py-0.5 text-xs font-medium text-status-warning">
                          <TriangleAlert className="size-3" />
                          Salah satu transaksi terhubung terhapus manual
                        </p>
                      ) : null}

                      {debt.payments.length > 0 ? (
                        <div className="mt-2 overflow-x-auto rounded-lg border border-border/40">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-border/40 hover:bg-transparent">
                                <TableHead className="h-8 py-1 text-xs font-semibold text-muted-foreground">
                                  Cicilan
                                </TableHead>
                                <TableHead className="h-8 py-1 text-right text-xs font-semibold text-muted-foreground">
                                  Nominal
                                </TableHead>
                                <TableHead className="h-8 py-1 text-xs font-semibold text-muted-foreground">
                                  Akun
                                </TableHead>
                                <TableHead className="h-8 py-1 text-right text-xs font-semibold text-muted-foreground">
                                  Aksi
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {debt.payments.map((payment) => (
                                <TableRow
                                  key={payment.id}
                                  className="border-border/40 transition-colors duration-150 hover:bg-muted/30"
                                >
                                  <TableCell className="py-1.5 text-xs whitespace-nowrap text-muted-foreground">
                                    {formatDateID(payment.paymentDate)}
                                    {payment.note ? (
                                      <span className="block max-w-[180px] truncate">
                                        {payment.note}
                                      </span>
                                    ) : null}
                                    {payment.isOrphan ? (
                                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-status-warning-border bg-status-warning-bg px-1.5 py-0.5 text-xs font-medium text-status-warning">
                                        <TriangleAlert className="size-3" />
                                        Pemasukan terhapus
                                      </span>
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right text-xs font-medium text-status-income tabular-nums">
                                    {formatCurrencyIDR(payment.amount)}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-xs text-muted-foreground">
                                    {payment.accountName ?? "-"}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right">
                                    <div className="flex justify-end gap-1">
                                      {payment.isOrphan ? (
                                        <OrphanCleanupButton
                                          action={cleanupOrphanPaymentAction.bind(
                                            null,
                                            payment.id
                                          )}
                                        />
                                      ) : null}
                                      <PaymentFormDialog
                                        debt={debt}
                                        payment={payment}
                                        accounts={accounts}
                                      />
                                      <DeleteButton
                                        action={deletePaymentAction.bind(
                                          null,
                                          payment.id
                                        )}
                                        title="Hapus cicilan?"
                                        description={financeDeleteMessages.payment}
                                        confirmLabel="Hapus cicilan"
                                        successMessage="Cicilan dihapus."
                                      />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Belum ada cicilan.
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap justify-end gap-1">
                        <PaymentFormDialog debt={debt} accounts={accounts} />
                        <DebtFormDialog debt={debt} {...dialogProps} />
                        <DeleteButton
                          action={deleteDebtAction.bind(null, debt.id)}
                          title="Hapus hutang?"
                          description={
                            debt.kind === "loan"
                              ? financeDeleteMessages.loan
                              : financeDeleteMessages.creditSale
                          }
                          confirmLabel="Hapus hutang"
                          successMessage="Hutang dihapus."
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              basePath="/debts"
              searchParams={paginationQuery}
              entityLabel="hutang"
            />
          </DataTableCard>
        ) : (
          <DataTableCard
            title="Pelanggan"
            description="Hutang wajib memilih pelanggan yang sudah ada. Riwayat tetap tersimpan bila pelanggan dihapus."
          >
            {customers.length === 0 ? (
              <EmptyState
                title="Belum ada pelanggan"
                description="Tambahkan pelanggan agar hutang bisa dicatat atas nama mereka."
                icon={Users}
              />
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="divide-y divide-border/40 sm:hidden">
                  {customers.map((customer) => (
                    <div key={customer.id} className="space-y-2 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {customer.name}
                          </p>
                          {customer.notes ? (
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {customer.notes}
                            </p>
                          ) : null}
                        </div>
                        <StatusBadge
                          label={customer.isActive ? "Aktif" : "Nonaktif"}
                          className={
                            customer.isActive
                              ? "border-status-income-border bg-status-income-bg text-status-income"
                              : "border-border bg-muted text-muted-foreground"
                          }
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {customer.phone || "-"}
                      </p>
                      <div className="flex items-center gap-1 pt-0.5">
                        <CustomerFormDialog customer={customer} />
                        <DeleteButton
                          action={deleteCustomerAction.bind(null, customer.id)}
                          title="Hapus pelanggan?"
                          description="Riwayat hutang tetap tersimpan, tapi pelanggan tidak bisa dipakai untuk hutang baru."
                          confirmLabel="Hapus pelanggan"
                          successMessage="Pelanggan dihapus."
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
                          Nama
                        </TableHead>
                        <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                          Kontak
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
                      {customers.map((customer) => (
                        <TableRow
                          key={customer.id}
                          className="border-border/40 transition-colors duration-150 hover:bg-muted/30"
                        >
                          <TableCell className="py-2.5">
                            <p className="text-xs font-semibold text-foreground">
                              {customer.name}
                            </p>
                            {customer.notes ? (
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                {customer.notes}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-muted-foreground">
                            {customer.phone || "-"}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <StatusBadge
                              label={customer.isActive ? "Aktif" : "Nonaktif"}
                              className={
                                customer.isActive
                                  ? "border-status-income-border bg-status-income-bg text-status-income"
                                  : "border-border bg-muted text-muted-foreground"
                              }
                            />
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <CustomerFormDialog customer={customer} />
                              <DeleteButton
                                action={deleteCustomerAction.bind(
                                  null,
                                  customer.id
                                )}
                                title="Hapus pelanggan?"
                                description="Riwayat hutang tetap tersimpan, tapi pelanggan tidak bisa dipakai untuk hutang baru."
                                confirmLabel="Hapus pelanggan"
                                successMessage="Pelanggan dihapus."
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <PaginationControls
                  page={customerPage.page}
                  totalPages={customerPage.totalPages}
                  totalCount={customerPage.totalCount}
                  basePath="/debts"
                  searchParams={
                    currentTab !== "hutang" ? { tab: currentTab } : {}
                  }
                  pageParam="pageCustomer"
                  entityLabel="pelanggan"
                />
              </>
            )}
          </DataTableCard>
        )}

      <Fab>
        {currentTab === "pelanggan" ? (
          <CustomerFormDialog />
        ) : (
          <DebtFormDialog {...dialogProps} />
        )}
      </Fab>
    </section>
  );
}
