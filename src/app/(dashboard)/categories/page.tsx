import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, FolderPlus } from "lucide-react";

import { deleteCategoryAction } from "@/app/(dashboard)/categories/actions";
import { CategoryColorDot } from "@/components/dashboard/category-color-dot";
import { CategoryTypeBadge } from "@/components/dashboard/category-type-badge";
import { DeleteButton } from "@/components/dashboard/delete-button";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { CategoryFormDialog } from "@/components/forms/category-form-dialog";
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
import { getCategoriesGrouped } from "@/lib/queries/categories";
import { paginate } from "@/lib/utils/paginate";
import { cn } from "@/lib/utils";

type Category = Awaited<
  ReturnType<typeof getCategoriesGrouped>
>["incomeCategories"][number];

const PAGE_SIZE = 10;

type CategoriesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function CategoryActions({ category }: { category: Category }) {
  return (
    <div className="flex justify-end gap-1">
      <CategoryFormDialog category={category} />
      <DeleteButton
        action={deleteCategoryAction.bind(null, category.id)}
        title="Hapus kategori?"
        description="Kategori yang dihapus tidak bisa dikembalikan. Pastikan kategori ini belum dipakai transaksi."
        confirmLabel="Hapus kategori"
        successMessage="Kategori dihapus."
        disabled={category.usageCount > 0}
        disabledLabel="Dipakai transaksi"
      />
    </div>
  );
}

function CategoryTable({ categories }: { categories: Category[] }) {
  return (
    <>
      {/* Mobile: card list */}
      <div className="divide-y divide-border/40 sm:hidden">
        {categories.map((category) => (
          <div key={category.id} className="space-y-2 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <CategoryColorDot color={category.color} />
                <p className="truncate text-sm font-semibold text-foreground">
                  {category.name}
                </p>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {category.usageCount} transaksi
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <CategoryTypeBadge type={category.type} />
              {category.icon ? (
                <span className="text-xs text-muted-foreground">
                  Icon: {category.icon}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1 pt-0.5">
              <CategoryActions category={category} />
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
                Tipe
              </TableHead>
              <TableHead className="h-9 py-2 text-xs font-semibold text-muted-foreground">
                Visual
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
            {categories.map((category) => (
              <TableRow
                key={category.id}
                className="border-border/40 transition-colors duration-150 hover:bg-muted/30"
              >
                <TableCell className="py-2.5">
                  <p className="text-xs font-semibold text-foreground">
                    {category.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {category.icon || "Tanpa icon"}
                  </p>
                </TableCell>
                <TableCell className="py-2.5">
                  <CategoryTypeBadge type={category.type} />
                </TableCell>
                <TableCell className="py-2.5">
                  <CategoryColorDot color={category.color} />
                </TableCell>
                <TableCell className="py-2.5 text-xs text-muted-foreground tabular-nums">
                  {category.usageCount} transaksi
                </TableCell>
                <TableCell className="py-2.5 text-right">
                  <CategoryActions category={category} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export default async function CategoriesPage({
  searchParams,
}: CategoriesPageProps) {
  const params = (await searchParams) ?? {};
  const result = await getCategoriesGrouped()
    .then((data) => ({ data, error: null as string | null }))
    .catch((error) => ({
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Gagal memuat data kategori dari Supabase.",
    }));

  const header = (
    <PageHeader
      title="Kategori"
      description="Kategorikan pemasukan dan pengeluaranmu."
    />
  );

  if (result.error || !result.data) {
    return (
      <section className="space-y-5">
        {header}
        <ErrorState description={result.error ?? "Gagal memuat data kategori."} />
      </section>
    );
  }

  const { incomeCategories: allIncomeCategories, expenseCategories: allExpenseCategories } =
    result.data;
  const totalCategories = allIncomeCategories.length + allExpenseCategories.length;
  const incomePage = paginate(
    allIncomeCategories,
    Number(getSingleSearchParam(params, "pageIncome") ?? "1"),
    PAGE_SIZE,
  );
  const expensePage = paginate(
    allExpenseCategories,
    Number(getSingleSearchParam(params, "pageExpense") ?? "1"),
    PAGE_SIZE,
  );

  const currentTab = getSingleSearchParam(params, "tab") ?? "pemasukan";

  const createTabHref = (tabValue: string) => {
    const nextParams = new URLSearchParams();
    if (tabValue !== "pemasukan") nextParams.set("tab", tabValue);
    const qs = nextParams.toString();
    return `/categories${qs ? `?${qs}` : ""}`;
  };

  const tabs = [
    {
      value: "pemasukan",
      label: "Pemasukan",
      icon: ArrowUpCircle,
      count: allIncomeCategories.length,
      title: "Kategori Pemasukan",
      page: incomePage,
      emptyDescription:
        "Tambahkan kategori pemasukan seperti Gaji, Bonus, atau Freelance.",
    },
    {
      value: "pengeluaran",
      label: "Pengeluaran",
      icon: ArrowDownCircle,
      count: allExpenseCategories.length,
      title: "Kategori Pengeluaran",
      page: expensePage,
      emptyDescription:
        "Tambahkan kategori pengeluaran seperti Makan, Transport, atau Tagihan.",
    },
  ] as const;

  const activeTab = tabs.find((t) => t.value === currentTab) ?? tabs[0];

  return (
    <section className="space-y-5">
      {header}

      <div className="enter-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Total Kategori"
          value={`${totalCategories}`}
          helper="Jumlah semua kategori"
          icon={FolderPlus}
          variant="transfer"
        />
        <SummaryCard
          label="Kategori Pemasukan"
          value={`${allIncomeCategories.length}`}
          helper="Dipakai transaksi pemasukan"
          icon={ArrowUpCircle}
          variant="income"
        />
        <SummaryCard
          label="Kategori Pengeluaran"
          value={`${allExpenseCategories.length}`}
          helper="Dipakai transaksi dan budget"
          icon={ArrowDownCircle}
          variant="expense"
        />
      </div>

      {/* Segmented Pill Switcher untuk Kategori */}
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

      <DataTableCard title={activeTab.title}>
        {activeTab.page.items.length === 0 ? (
          <EmptyState
            title="Belum ada kategori"
            description={activeTab.emptyDescription}
          />
        ) : (
          <>
            <CategoryTable categories={activeTab.page.items} />
            <PaginationControls
              page={activeTab.page.page}
              totalPages={activeTab.page.totalPages}
              totalCount={activeTab.page.totalCount}
              basePath="/categories"
              searchParams={
                currentTab !== "pemasukan" ? { tab: currentTab } : {}
              }
              pageParam={
                activeTab.value === "pemasukan" ? "pageIncome" : "pageExpense"
              }
              entityLabel="kategori"
            />
          </>
        )}
      </DataTableCard>

      <Fab>
        <CategoryFormDialog />
      </Fab>
    </section>
  );
}
