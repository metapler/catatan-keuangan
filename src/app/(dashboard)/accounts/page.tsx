import { Landmark, PiggyBank, Smartphone, Wallet } from "lucide-react";

import { deleteAccountAction } from "@/app/(dashboard)/accounts/actions";
import { AccountTypeBadge } from "@/components/dashboard/account-type-badge";
import { DeleteButton } from "@/components/dashboard/delete-button";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { AccountFormDialog } from "@/components/forms/account-form-dialog";
import { Fab } from "@/components/layout/fab";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAccountsWithBalances } from "@/lib/queries/accounts";
import { getAccountStatusMeta } from "@/lib/utils/finance";
import { formatCurrencyIDR } from "@/lib/utils/format";
import { buildAccountTypeCatalog } from "@/lib/utils/account-types";
import { paginate } from "@/lib/utils/paginate";

const PAGE_SIZE = 10;

type AccountsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

const totalByTypeIcons = {
  cash: Wallet,
  bank: Landmark,
  ewallet: Smartphone,
  savings: PiggyBank,
} as const;

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = (await searchParams) ?? {};
  const result = await getAccountsWithBalances()
    .then((data) => ({ data, error: null as string | null }))
    .catch((error) => ({
      data: null,
      error:
        error instanceof Error ? error.message : "Gagal memuat data akun dari Supabase.",
    }));

  const header = (
    <PageHeader
      title="Akun"
      description="Semua sumber uangmu."
    />
  );

  if (result.error || !result.data) {
    return (
      <section className="space-y-5">
        {header}
        <ErrorState description={result.error ?? "Gagal memuat data akun."} />
      </section>
    );
  }

  const { accounts: allAccounts, totalBalance } = result.data;
  const accountsPage = paginate(
    allAccounts,
    Number(getSingleSearchParam(params, "page") ?? "1"),
    PAGE_SIZE,
  );
  const accounts = accountsPage.items;
  // Frekuensi tipe akun = jumlah akun per tipe dari seluruh akun (tipe custom ikut dihitung).
  const typeUsage: Record<string, number> = {};
  for (const account of allAccounts) {
    typeUsage[account.type] = (typeUsage[account.type] ?? 0) + 1;
  }
  // Katalog tipe = bawaan + tipe custom yang sudah dipakai akun (tanpa tabel baru).
  const accountTypeCatalog = buildAccountTypeCatalog(
    allAccounts.map((account) => account.type),
  );
  const accountCounts = {
    cash: accounts.filter((account) => account.type === "cash").length,
    bank: accounts.filter((account) => account.type === "bank").length,
    ewallet: accounts.filter((account) => account.type === "ewallet").length,
    hutang: accounts.filter((account) => account.type === "hutang").length,
    others: accounts.filter(
      (account) =>
        account.type !== "cash" &&
        account.type !== "bank" &&
        account.type !== "ewallet" &&
        account.type !== "hutang",
    ).length,
  };

  const summaryCards = [
    {
      label: "Total Saldo Neto",
      value: formatCurrencyIDR(totalBalance),
      helper: "Total Saldo di semua akun",
      icon: Wallet,
      variant: "income" as const,
    },
    {
      label: "Bank",
      value: `${accountCounts.bank} Akun`,
      helper: "Rekening utama dan tabungan",
      icon: totalByTypeIcons.bank,
      variant: "expense" as const,
    },
    {
      label: "E-Wallet",
      value: `${accountCounts.ewallet} Akun`,
      helper: "Dompet digital",
      icon: totalByTypeIcons.ewallet,
      variant: "savings" as const,
    },
    {
      label: "Tunai",
      value: `${accountCounts.cash + accountCounts.others} Akun`,
      helper: "Uang tunai dan tipe lainnya",
      icon: totalByTypeIcons.cash,
      variant: "transfer" as const,
    },
  ];

  const deleteButton = (account: (typeof accounts)[number]) => (
    <DeleteButton
      action={deleteAccountAction.bind(null, account.id)}
      title="Hapus akun?"
      description="Akun yang dihapus tidak bisa dikembalikan. Pastikan akun ini belum dipakai transaksi."
      confirmLabel="Hapus akun"
      successMessage="Akun dihapus."
      disabled={account.transactionCount > 0}
      disabledLabel="Dipakai transaksi"
    />
  );

  return (
    <section className="space-y-5">
      {header}

      <div className="enter-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            icon={card.icon}
            variant={card.variant}
          />
        ))}
      </div>

      <DataTableCard
        title="Daftar Akun"
      >
        {accounts.length === 0 ? (
          <EmptyState
            title="Belum ada akun keuangan"
            description="Tambahkan akun pertamamu untuk mulai mencatat saldo dan transaksi."
          />
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="divide-y divide-border/40 sm:hidden">
              {accounts.map((account) => {
                const status = getAccountStatusMeta(account.isActive);

                return (
                  <div key={account.id} className="space-y-2 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {account.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {account.transactionCount} transaksi
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-foreground tabular-nums">
                        {formatCurrencyIDR(account.currentBalance)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AccountTypeBadge type={account.type} />
                      <StatusBadge label={status.label} className={status.className} />
                    </div>
                    <div className="flex items-center gap-1 pt-0.5">
                      <AccountFormDialog
                        account={account}
                        typeUsage={typeUsage}
                        accountTypes={accountTypeCatalog}
                      />
                      {deleteButton(account)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Akun
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Tipe
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Saldo Awal
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Saldo Aktual
                    </TableHead>
                    <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                      Transaksi
                    </TableHead>
                    <TableHead className="h-9 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => {
                    const status = getAccountStatusMeta(account.isActive);

                    return (
                      <TableRow
                        key={account.id}
                        className="border-border/40 transition-colors duration-150 hover:bg-muted/30"
                      >
                        <TableCell className="py-2.5">
                          <p className="text-xs font-semibold text-foreground">
                            {account.name}
                          </p>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <AccountTypeBadge type={account.type} />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <StatusBadge label={status.label} className={status.className} />
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground tabular-nums">
                          {formatCurrencyIDR(account.initialBalance)}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs font-bold text-foreground tabular-nums">
                          {formatCurrencyIDR(account.currentBalance)}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground tabular-nums">
                          {account.transactionCount} transaksi
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <AccountFormDialog
                              account={account}
                              typeUsage={typeUsage}
                              accountTypes={accountTypeCatalog}
                            />
                            {deleteButton(account)}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <PaginationControls
              page={accountsPage.page}
              totalPages={accountsPage.totalPages}
              totalCount={accountsPage.totalCount}
              basePath="/accounts"
              searchParams={{}}
              entityLabel="akun"
            />
          </>
        )}
      </DataTableCard>

      <Fab>
        <AccountFormDialog typeUsage={typeUsage} accountTypes={accountTypeCatalog} />
      </Fab>
    </section>
  );
}
