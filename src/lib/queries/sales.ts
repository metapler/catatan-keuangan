import { createClient } from "@/lib/supabase/server";
import { deriveDebtStatus, type DebtStatus } from "@/lib/validations/debts";
import {
  buildUsageCount,
  type UsageCount,
} from "@/lib/utils/sort-by-usage";
import { getTransactionFormOptions } from "@/lib/queries/transactions";
import {
  ensureBuiltinProductTypes,
  getProductTypes,
} from "@/lib/queries/product-types";

export type SaleRow = {
  id: string;
  product_type_id: string | null;
  product_type_name_snapshot: string | null;
  sale_date: string;
  cost_amount: number;
  sell_amount: number;
  cost_account_id: string | null;
  income_account_id: string | null;
  income_category_id: string | null;
  expense_category_id: string | null;
  expense_transaction_id: string | null;
  income_transaction_id: string | null;
  customer_ref: string | null;
  description: string | null;
  created_at: string;
};

export type SaleSummary = SaleRow & {
  /** Omzet yang diakui: sell penuh untuk tunai, total cicilan untuk kredit. */
  turnover: number;
  profit: number;
  productTypeId: string | null;
  productTypeName: string | null;
  costAccountName: string | null;
  incomeAccountName: string | null;
  incomeCategoryName: string | null;
  expenseCategoryName: string | null;
  isCredit: boolean;
  debtId: string | null;
  paidAmount: number;
  remainingAmount: number;
  debtStatus: DebtStatus | null;
  customerName: string | null;
  /** Akun penerima cicilan terakhir (khusus sale kredit; null jika belum ada cicilan berakun). */
  lastPaymentAccountName: string | null;
  isOrphan: boolean;
};

export type SaleFilters = {
  dateFrom?: string;
  dateTo?: string;
  productTypeId?: string;
  accountId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type SalesSummaryTotals = {
  turnover: number;
  totalCost: number;
  profit: number;
  count: number;
  orphanCount: number;
};

export type ProfitByProductType = {
  productTypeId: string | null;
  productTypeName: string;
  turnover: number;
  totalCost: number;
  profit: number;
  count: number;
};

export type SalesUsage = {
  productTypeUsage: UsageCount;
  accountUsage: UsageCount;
  incomeCategoryUsage: UsageCount;
  expenseCategoryUsage: UsageCount;
};

type SalesUsageRow = {
  id: string;
  product_type_id: string | null;
  cost_account_id: string | null;
  income_account_id: string | null;
  income_category_id: string | null;
  expense_category_id: string | null;
};

const emptySalesUsage = (): SalesUsage => ({
  productTypeUsage: {},
  accountUsage: {},
  incomeCategoryUsage: {},
  expenseCategoryUsage: {},
});

function aggregateSalesUsage(rows: SalesUsageRow[]): SalesUsage {
  const productTypeIds: Array<string | null> = [];
  const accountIds: Array<string | null> = [];
  const incomeCategoryIds: Array<string | null> = [];
  const expenseCategoryIds: Array<string | null> = [];

  for (const row of rows) {
    productTypeIds.push(row.product_type_id);
    accountIds.push(row.cost_account_id, row.income_account_id);
    incomeCategoryIds.push(row.income_category_id);
    expenseCategoryIds.push(row.expense_category_id);
  }

  return {
    productTypeUsage: buildUsageCount(productTypeIds),
    accountUsage: buildUsageCount(accountIds),
    incomeCategoryUsage: buildUsageCount(incomeCategoryIds),
    expenseCategoryUsage: buildUsageCount(expenseCategoryIds),
  };
}

/**
 * Frekuensi pemakaian opsi penjualan dari seluruh riwayat sales user.
 * Bila `creditOnlySaleIds` diisi, hanya sales kredit (punya hutang) yang dihitung.
 */
export async function getSalesUsage(
  creditOnlySaleIds?: Set<string>,
): Promise<SalesUsage> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, product_type_id, cost_account_id, income_account_id, income_category_id, expense_category_id",
    );

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as SalesUsageRow[]);
  const scoped = creditOnlySaleIds
    ? rows.filter((row) => creditOnlySaleIds.has(row.id))
    : rows;

  return aggregateSalesUsage(scoped);
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isMissingTableError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("could not find the table") ||
    lower.includes("pgrst205") ||
    lower.includes("schema cache")
  );
}

const SALES_SELECT =
  "id, product_type_id, product_type_name_snapshot, sale_date, cost_amount, sell_amount, cost_account_id, income_account_id, income_category_id, expense_category_id, expense_transaction_id, income_transaction_id, customer_ref, description, created_at";

function resolveTypeName(
  row: { product_type_id: string | null; product_type_name_snapshot: string | null; description: string | null },
  typesMap: Map<string, { id: string; name: string }>,
): { id: string | null; name: string | null } {
  if (row.product_type_id) {
    const live = typesMap.get(row.product_type_id);
    if (live) return { id: live.id, name: live.name };
  }
  if (row.product_type_name_snapshot) {
    return { id: row.product_type_id, name: row.product_type_name_snapshot };
  }
  if (row.description) {
    return { id: row.product_type_id, name: row.description };
  }
  return { id: row.product_type_id, name: null };
}

export async function getSales(filters: SaleFilters = {}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 10, 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  await ensureBuiltinProductTypes().catch(() => {
    // Tabel belum dimigrasi: lanjutkan tanpa tipe.
  });

  let salesQuery = supabase
    .from("sales")
    .select(SALES_SELECT, { count: "exact" })
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.dateFrom) {
    salesQuery = salesQuery.gte("sale_date", filters.dateFrom);
  }

  if (filters.dateTo) {
    salesQuery = salesQuery.lte("sale_date", filters.dateTo);
  }

  if (filters.productTypeId) {
    salesQuery = salesQuery.eq("product_type_id", filters.productTypeId);
  }

  if (filters.accountId) {
    salesQuery = salesQuery.or(
      `cost_account_id.eq.${filters.accountId},income_account_id.eq.${filters.accountId}`,
    );
  }

  if (filters.q) {
    const q = filters.q.replace(/[%_]/g, "");
    salesQuery = salesQuery.or(
      `description.ilike.%${q}%,customer_ref.ilike.%${q}%,product_type_name_snapshot.ilike.%${q}%`,
    );
  }

  const [salesResult, debtsResult, paymentsResult, formOptions, allOptions, productTypes, salesUsage] =
    await Promise.all([
      salesQuery.range(from, to),
      supabase.from("debts").select("id, customer_name_snapshot, sale_id"),
      supabase.from("debt_payments").select("debt_id, amount, account_id, payment_date, created_at"),
      getTransactionFormOptions({ activeOnly: true }),
      getTransactionFormOptions({ activeOnly: false }),
      getProductTypes({ activeOnly: false }).catch(() => []),
      getSalesUsage().catch(() => emptySalesUsage()),
    ]);

  if (salesResult.error) {
    // Kolom baru belum ada (schema lama): fallback ke kolom produk lama.
    if (isMissingTableError(salesResult.error.message)) {
      return getSalesLegacy(filters);
    }
    throw new Error(salesResult.error.message);
  }
  if (debtsResult.error) {
    // Tabel debts belum dimigrasi: anggap tidak ada credit sale.
    if (!isMissingTableError(debtsResult.error.message)) {
      throw new Error(debtsResult.error.message);
    }
  }
  if (paymentsResult.error) {
    if (!isMissingTableError(paymentsResult.error.message)) {
      throw new Error(paymentsResult.error.message);
    }
  }

  const rows = ((salesResult.data ?? []) as SaleRow[]).map((row) => ({
    ...row,
    cost_amount: toNumber(row.cost_amount),
    sell_amount: toNumber(row.sell_amount),
  }));

  type DebtLink = { id: string; customer_name_snapshot: string | null; sale_id: string };
  const debtBySaleId = new Map<string, DebtLink>();
  for (const debt of ((debtsResult.data ?? []) as DebtLink[] | null) ?? []) {
    debtBySaleId.set(debt.sale_id, debt);
  }

  const paidByDebtId = new Map<string, number>();
  for (const payment of ((paymentsResult.data ?? []) as Array<{
    debt_id: string;
    amount: number | string;
    account_id: string | null;
    payment_date: string;
    created_at: string;
  }> | null) ?? []) {
    paidByDebtId.set(
      payment.debt_id,
      (paidByDebtId.get(payment.debt_id) ?? 0) + toNumber(payment.amount),
    );
  }

  // Akun penerima cicilan terakhir per hutang — ditampilkan sebagai "Akun
  // Penerima" sale kredit. Cicilan berakun NULL (akun terhapus) dilewati.
  const lastPaymentAccountByDebtId = new Map<
    string,
    { account_id: string; payment_date: string; created_at: string }
  >();
  for (const payment of ((paymentsResult.data ?? []) as Array<{
    debt_id: string;
    account_id: string | null;
    payment_date: string;
    created_at: string;
  }> | null) ?? []) {
    if (!payment.account_id) continue;
    const prev = lastPaymentAccountByDebtId.get(payment.debt_id);
    const isNewer =
      !prev ||
      payment.payment_date > prev.payment_date ||
      (payment.payment_date === prev.payment_date &&
        payment.created_at > prev.created_at);
    if (isNewer) {
      lastPaymentAccountByDebtId.set(payment.debt_id, {
        account_id: payment.account_id,
        payment_date: payment.payment_date,
        created_at: payment.created_at,
      });
    }
  }

  // Cek transaksi ter-link yang masih ada (guard orphan).
  const linkedIds = rows.flatMap((row) =>
    [row.expense_transaction_id, row.income_transaction_id].filter(
      (id): id is string => Boolean(id),
    ),
  );

  let existingTxIds = new Set<string>();
  if (linkedIds.length > 0) {
    const { data: txRows, error: txError } = await supabase
      .from("transactions")
      .select("id")
      .in("id", linkedIds);

    if (txError) {
      throw new Error(txError.message);
    }

    existingTxIds = new Set(
      ((txRows ?? []) as Array<{ id: string }>).map((r) => r.id),
    );
  }

  const accountsMap = new Map(
    allOptions.accounts.map((account) => [account.id, account]),
  );
  const categoriesMap = new Map(
    [...allOptions.incomeCategories, ...allOptions.expenseCategories].map(
      (category) => [category.id, category],
    ),
  );
  const typesMap = new Map(productTypes.map((type) => [type.id, type]));

  const sales: SaleSummary[] = rows.map((row) => {
    const resolved = resolveTypeName(row, typesMap);
    const debt = debtBySaleId.get(row.id);
    const isCredit = Boolean(debt);
    const paid = debt ? (paidByDebtId.get(debt.id) ?? 0) : 0;
    const lastPaymentAccountId =
      debt ? (lastPaymentAccountByDebtId.get(debt.id)?.account_id ?? null) : null;
    // Cash-basis: baris kredit menyumbang omzet sebesar cicilan masuk.
    const turnover = isCredit ? paid : row.sell_amount;
    const expenseGone =
      row.expense_transaction_id !== null &&
      !existingTxIds.has(row.expense_transaction_id);
    // income NULL pada credit sale adalah normal, bukan yatim.
    const incomeGone =
      !isCredit &&
      row.income_transaction_id !== null &&
      !existingTxIds.has(row.income_transaction_id);

    return {
      ...row,
      turnover,
      profit: turnover - row.cost_amount,
      productTypeId: resolved.id,
      productTypeName: resolved.name,
      costAccountName: row.cost_account_id
        ? (accountsMap.get(row.cost_account_id)?.name ?? "Unknown")
        : null,
      incomeAccountName: row.income_account_id
        ? (accountsMap.get(row.income_account_id)?.name ?? "Unknown")
        : null,
      incomeCategoryName: row.income_category_id
        ? (categoriesMap.get(row.income_category_id)?.name ?? "Unknown")
        : null,
      expenseCategoryName: row.expense_category_id
        ? (categoriesMap.get(row.expense_category_id)?.name ?? "Unknown")
        : null,
      isCredit,
      debtId: debt?.id ?? null,
      paidAmount: paid,
      remainingAmount: isCredit ? Math.max(0, row.sell_amount - paid) : 0,
      debtStatus: isCredit ? deriveDebtStatus(paid, row.sell_amount) : null,
      customerName: debt?.customer_name_snapshot ?? null,
      lastPaymentAccountName: lastPaymentAccountId
        ? (accountsMap.get(lastPaymentAccountId)?.name ?? "Unknown")
        : null,
      isOrphan: expenseGone || incomeGone,
    };
  });

  // Ringkasan dihitung dari SELURUH hasil filter (tanpa pagination) agar konsisten.
  let totalsQuery = supabase
    .from("sales")
    .select("id, product_type_id, cost_amount, sell_amount, expense_transaction_id, income_transaction_id");
  if (filters.dateFrom) totalsQuery = totalsQuery.gte("sale_date", filters.dateFrom);
  if (filters.dateTo) totalsQuery = totalsQuery.lte("sale_date", filters.dateTo);
  if (filters.productTypeId) totalsQuery = totalsQuery.eq("product_type_id", filters.productTypeId);
  if (filters.accountId) {
    totalsQuery = totalsQuery.or(
      `cost_account_id.eq.${filters.accountId},income_account_id.eq.${filters.accountId}`,
    );
  }
  if (filters.q) {
    const q = filters.q.replace(/[%_]/g, "");
    totalsQuery = totalsQuery.or(
      `description.ilike.%${q}%,customer_ref.ilike.%${q}%,product_type_name_snapshot.ilike.%${q}%`,
    );
  }

  const { data: totalsData, error: totalsError } = await totalsQuery;

  if (totalsError) {
    throw new Error(totalsError.message);
  }

  type TotalsRow = {
    id: string;
    cost_amount: number | string;
    sell_amount: number | string;
    expense_transaction_id: string | null;
    income_transaction_id: string | null;
  };

  const totalsRows = ((totalsData ?? []) as TotalsRow[]).map((row) => ({
    ...row,
    cost_amount: toNumber(row.cost_amount),
    sell_amount: toNumber(row.sell_amount),
  }));

  // Cek yatim untuk SELURUH hasil filter (tidak hanya halaman aktif).
  const allLinkedIds = totalsRows.flatMap((row) =>
    [row.expense_transaction_id, row.income_transaction_id].filter(
      (id): id is string => Boolean(id),
    ),
  );

  let allExistingTxIds = existingTxIds;
  if (allLinkedIds.length > 0) {
    const missingIds = allLinkedIds.filter((id) => !existingTxIds.has(id));
    if (missingIds.length > 0) {
      const { data: extraTxRows, error: extraTxError } = await supabase
        .from("transactions")
        .select("id")
        .in("id", missingIds);

      if (extraTxError) {
        throw new Error(extraTxError.message);
      }

      allExistingTxIds = new Set(existingTxIds);
      for (const r of (extraTxRows ?? []) as Array<{ id: string }>) {
        allExistingTxIds.add(r.id);
      }
    }
  }

  const totals: SalesSummaryTotals = totalsRows.reduce(
    (acc, row) => {
      const cost = row.cost_amount;
      const debtLink = debtBySaleId.get(row.id);
      const isCredit = Boolean(debtLink);
      const turnover = isCredit
        ? (paidByDebtId.get(debtLink!.id) ?? 0)
        : row.sell_amount;
      acc.turnover += turnover;
      acc.totalCost += cost;
      acc.profit += turnover - cost;
      acc.count += 1;

      const expenseGone =
        row.expense_transaction_id !== null &&
        !allExistingTxIds.has(row.expense_transaction_id);
      const incomeGone =
        !isCredit &&
        row.income_transaction_id !== null &&
        !allExistingTxIds.has(row.income_transaction_id);

      if (expenseGone || incomeGone) {
        acc.orphanCount += 1;
      }

      return acc;
    },
    { turnover: 0, totalCost: 0, profit: 0, count: 0, orphanCount: 0 },
  );

  // Breakdown per tipe dari seluruh hasil filter.
  // (Omzet kredit = cicilan masuk, mengikuti aturan cash-basis.)
  const breakdownQuery = supabase
    .from("sales")
    .select("id, product_type_id, product_type_name_snapshot, cost_amount, sell_amount");
  let bq = breakdownQuery;
  if (filters.dateFrom) bq = bq.gte("sale_date", filters.dateFrom);
  if (filters.dateTo) bq = bq.lte("sale_date", filters.dateTo);
  if (filters.productTypeId) bq = bq.eq("product_type_id", filters.productTypeId);
  if (filters.accountId) {
    bq = bq.or(
      `cost_account_id.eq.${filters.accountId},income_account_id.eq.${filters.accountId}`,
    );
  }
  if (filters.q) {
    const q = filters.q.replace(/[%_]/g, "");
    bq = bq.or(
      `description.ilike.%${q}%,customer_ref.ilike.%${q}%,product_type_name_snapshot.ilike.%${q}%`,
    );
  }

  const { data: breakdownData, error: breakdownError } = await bq;

  if (breakdownError) {
    throw new Error(breakdownError.message);
  }

  const breakdownMap = new Map<string, ProfitByProductType>();
  for (const row of (breakdownData ?? []) as Array<{
    id: string;
    product_type_id: string | null;
    product_type_name_snapshot: string | null;
    cost_amount: number | string;
    sell_amount: number | string;
  }>) {
    const resolved = resolveTypeName(
      { ...row, description: null },
      typesMap,
    );
    const key = resolved.id ?? `__notype__${resolved.name ?? "manual"}`;
    const existing = breakdownMap.get(key) ?? {
      productTypeId: resolved.id,
      productTypeName: resolved.name ?? "Tanpa tipe",
      turnover: 0,
      totalCost: 0,
      profit: 0,
      count: 0,
    };
    const cost = toNumber(row.cost_amount);
    const debtLink = debtBySaleId.get(row.id);
    const turnover = debtLink
      ? (paidByDebtId.get(debtLink.id) ?? 0)
      : toNumber(row.sell_amount);
    existing.turnover += turnover;
    existing.totalCost += cost;
    existing.profit += turnover - cost;
    existing.count += 1;
    breakdownMap.set(key, existing);
  }

  const profitByProductType = Array.from(breakdownMap.values()).sort(
    (a, b) => b.profit - a.profit,
  );

  return {
    sales,
    totals,
    profitByProduct: profitByProductType,
    totalCount: salesResult.count ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((salesResult.count ?? 0) / pageSize)),
    accounts: formOptions.accounts,
    incomeCategories: formOptions.incomeCategories,
    expenseCategories: formOptions.expenseCategories,
    allAccounts: allOptions.accounts,
    productTypes,
    ...salesUsage,
    filters: {
      dateFrom: filters.dateFrom ?? "",
      dateTo: filters.dateTo ?? "",
      productTypeId: filters.productTypeId ?? "",
      accountId: filters.accountId ?? "",
      q: filters.q ?? "",
    },
  };
}

/**
 * Fallback bila kolom product_type_* belum ada (schema lama):
 * tampilkan data apa adanya memakai kolom produk lama.
 */
async function getSalesLegacy(filters: SaleFilters = {}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 10, 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let salesQuery = supabase
    .from("sales")
    .select(
      "id, sale_date, cost_amount, sell_amount, cost_account_id, income_account_id, income_category_id, expense_category_id, expense_transaction_id, income_transaction_id, customer_ref, description, created_at",
      { count: "exact" },
    )
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.dateFrom) salesQuery = salesQuery.gte("sale_date", filters.dateFrom);
  if (filters.dateTo) salesQuery = salesQuery.lte("sale_date", filters.dateTo);
  if (filters.accountId) {
    salesQuery = salesQuery.or(
      `cost_account_id.eq.${filters.accountId},income_account_id.eq.${filters.accountId}`,
    );
  }
  if (filters.q) {
    const q = filters.q.replace(/[%_]/g, "");
    salesQuery = salesQuery.or(
      `description.ilike.%${q}%,customer_ref.ilike.%${q}%`,
    );
  }

  const [salesResult, formOptions, allOptions] = await Promise.all([
    salesQuery.range(from, to),
    getTransactionFormOptions({ activeOnly: true }),
    getTransactionFormOptions({ activeOnly: false }),
  ]);

  if (salesResult.error) {
    throw new Error(salesResult.error.message);
  }

  const accountsMap = new Map(
    allOptions.accounts.map((account) => [account.id, account]),
  );
  const categoriesMap = new Map(
    [...allOptions.incomeCategories, ...allOptions.expenseCategories].map(
      (category) => [category.id, category],
    ),
  );

  type LegacyRow = Omit<SaleRow, "product_type_id" | "product_type_name_snapshot">;
  const sales: SaleSummary[] = ((salesResult.data ?? []) as Array<
    LegacyRow & { cost_amount: number | string; sell_amount: number | string }
  >).map((raw) => {
    const cost = toNumber(raw.cost_amount);
    const sell = toNumber(raw.sell_amount);
    return {
      ...raw,
      product_type_id: null,
      product_type_name_snapshot: null,
      cost_amount: cost,
      sell_amount: sell,
      turnover: sell,
      profit: sell - cost,
      productTypeId: null,
      productTypeName: raw.description ?? null,
      costAccountName: raw.cost_account_id
        ? (accountsMap.get(raw.cost_account_id)?.name ?? "Unknown")
        : null,
      incomeAccountName: raw.income_account_id
        ? (accountsMap.get(raw.income_account_id)?.name ?? "Unknown")
        : null,
      incomeCategoryName: raw.income_category_id
        ? (categoriesMap.get(raw.income_category_id)?.name ?? "Unknown")
        : null,
      expenseCategoryName: raw.expense_category_id
        ? (categoriesMap.get(raw.expense_category_id)?.name ?? "Unknown")
        : null,
      isCredit: false,
      debtId: null,
      paidAmount: 0,
      remainingAmount: 0,
      debtStatus: null,
      customerName: null,
      lastPaymentAccountName: null,
      isOrphan: false,
    };
  });

  const count = salesResult.count ?? 0;

  return {
    sales,
    totals: sales.reduce(
      (acc, s) => ({
        turnover: acc.turnover + s.turnover,
        totalCost: acc.totalCost + s.cost_amount,
        profit: acc.profit + s.profit,
        count: acc.count + 1,
        orphanCount: 0,
      }),
      { turnover: 0, totalCost: 0, profit: 0, count: 0, orphanCount: 0 },
    ),
    profitByProduct: [] as ProfitByProductType[],
    totalCount: count,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(count / pageSize)),
    accounts: formOptions.accounts,
    incomeCategories: formOptions.incomeCategories,
    expenseCategories: formOptions.expenseCategories,
    allAccounts: allOptions.accounts,
    productTypes: [],
    ...emptySalesUsage(),
    filters: {
      dateFrom: filters.dateFrom ?? "",
      dateTo: filters.dateTo ?? "",
      productTypeId: filters.productTypeId ?? "",
      accountId: filters.accountId ?? "",
      q: filters.q ?? "",
    },
  };
}

export async function getSaleById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales")
    .select(SALES_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  const row = data as SaleRow;

  return {
    ...row,
    cost_amount: toNumber(row.cost_amount),
    sell_amount: toNumber(row.sell_amount),
  };
}
