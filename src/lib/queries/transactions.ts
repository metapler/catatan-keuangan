import { createClient } from "@/lib/supabase/server";
import { buildUsageCount, type UsageCount } from "@/lib/utils/sort-by-usage";

type TransactionRow = {
  id: string;
  type: "income" | "expense" | "transfer";
  account_id: string | null;
  category_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  amount: number;
  description: string | null;
  transaction_date: string;
  created_at: string;
};

type AccountOptionRow = {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
};

type CategoryOptionRow = {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string | null;
  icon: string | null;
  is_active: boolean;
};

export type TransactionOptionAccount = {
  id: string;
  name: string;
  type: AccountOptionRow["type"];
};

export type TransactionOptionCategory = {
  id: string;
  name: string;
  type: CategoryOptionRow["type"];
  color: string;
  icon: string | null;
};

export type TransactionSourceKind =
  | "sale-cost"
  | "sale-income"
  | "debt-payment"
  | "loan-disbursement";

/** Atribusi sumber transaksi yang lahir dari skema Penjualan/Hutang. */
export type TransactionSource = {
  kind: TransactionSourceKind;
  /** Label chip, mis. "Penjualan · Kuota" / "Cicilan Hutang · Jokowi". */
  label: string;
  /** Halaman sumber untuk tautan chip. */
  href: "/sales" | "/debts";
  customerName: string | null;
  productName: string | null;
};

export type TransactionSummary = {
  id: string;
  type: TransactionRow["type"];
  amount: number;
  description: string | null;
  transactionDate: string;
  createdAt: string;
  accountId: string | null;
  categoryId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  accountName: string | null;
  categoryName: string | null;
  fromAccountName: string | null;
  toAccountName: string | null;
  source: TransactionSource | null;
  /** Memo tampilan: description tanpa teks bawaan sistem yang duplikat chip Sumber. */
  memo: string | null;
};

export type TransactionFilters = {
  dateFrom?: string;
  dateTo?: string;
  type?: "income" | "expense" | "transfer";
  categoryId?: string;
  accountId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export async function getTransactionFormOptions({
  activeOnly = true,
}: {
  activeOnly?: boolean;
} = {}) {
  const supabase = await createClient();

  const accountsQuery = supabase
    .from("accounts")
    .select("id, name, type, is_active")
    .order("name", { ascending: true });

  const categoriesQuery = supabase
    .from("categories")
    .select("id, name, type, color, icon, is_active")
    .order("name", { ascending: true });

  const [accountsResult, categoriesResult] = await Promise.all([
    activeOnly ? accountsQuery.eq("is_active", true) : accountsQuery,
    activeOnly ? categoriesQuery.eq("is_active", true) : categoriesQuery,
  ]);

  if (accountsResult.error) {
    throw new Error(accountsResult.error.message);
  }

  if (categoriesResult.error) {
    throw new Error(categoriesResult.error.message);
  }

  const accounts = ((accountsResult.data ?? []) as AccountOptionRow[]).map(
    (account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
    }),
  );

  const categories = ((categoriesResult.data ?? []) as CategoryOptionRow[]).map(
    (category) => ({
      id: category.id,
      name: category.name,
      type: category.type,
      color: category.color ?? "#94A3B8",
      icon: category.icon,
    }),
  );

  return {
    accounts,
    incomeCategories: categories.filter((category) => category.type === "income"),
    expenseCategories: categories.filter((category) => category.type === "expense"),
  };
}

type TransactionUsageRow = {
  account_id: string | null;
  category_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
};

/** Frekuensi pemakaian akun & kategori dari seluruh riwayat transaksi user. */
export async function getTransactionUsage(): Promise<{
  accountUsage: UsageCount;
  categoryUsage: UsageCount;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("account_id, category_id, from_account_id, to_account_id");

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as TransactionUsageRow[]);
  const accountIds: Array<string | null> = [];
  const categoryIds: Array<string | null> = [];

  for (const row of rows) {
    accountIds.push(row.account_id, row.from_account_id, row.to_account_id);
    categoryIds.push(row.category_id);
  }

  return {
    accountUsage: buildUsageCount(accountIds),
    categoryUsage: buildUsageCount(categoryIds),
  };
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type SaleSourceRow = {
  id: string;
  product_type_name_snapshot: string | null;
  description: string | null;
  expense_transaction_id: string | null;
  income_transaction_id: string | null;
  /** Nama pelanggan hanya tersedia untuk penjualan kredit (ada baris debts). */
  debts: {
    customer_name_snapshot: string | null;
    customers: { name: string } | null;
  } | null;
};

/**
 * Peta txId -> sumber transaksi, dibaca dari pointer balik skema
 * Penjualan/Hutang (sales, debt_payments, debts). Query error diabaikan:
 * halaman tetap tampil tanpa chip (mis. tabel belum dimigrasi).
 */
async function fetchTransactionSources(
  supabase: SupabaseClient,
  txIds: string[],
): Promise<Map<string, TransactionSource>> {
  const sources = new Map<string, TransactionSource>();
  if (txIds.length === 0) return sources;

  const [saleExpenseResult, saleIncomeResult, paymentsResult, loanDebtsResult] =
    await Promise.all([
      supabase
        .from("sales")
        .select(
          "id, product_type_name_snapshot, description, expense_transaction_id, income_transaction_id, debts(customer_name_snapshot, customers(name))",
        )
        .in("expense_transaction_id", txIds),
      supabase
        .from("sales")
        .select(
          "id, product_type_name_snapshot, description, expense_transaction_id, income_transaction_id, debts(customer_name_snapshot, customers(name))",
        )
        .in("income_transaction_id", txIds),
      supabase
        .from("debt_payments")
        .select(
          "income_transaction_id, debts(id, customer_name_snapshot, kind, customers(name), sales(product_type_name_snapshot, description))",
        )
        .in("income_transaction_id", txIds),
      supabase
        .from("debts")
        .select("id, customer_name_snapshot, loan_expense_transaction_id, customers(name)")
        .in("loan_expense_transaction_id", txIds),
    ]);

  const productName = (row: SaleSourceRow) =>
    row.product_type_name_snapshot ?? row.description ?? null;

  // Nama pelanggan penjualan: hanya ada lewat hutang (penjualan kredit).
  const saleCustomerName = (
    row: Pick<SaleSourceRow, "debts">,
  ): string | null =>
    row.debts?.customer_name_snapshot ?? row.debts?.customers?.name ?? null;

  for (const row of ((saleExpenseResult.data ?? []) as unknown as SaleSourceRow[]) ?? []) {
    if (!row.expense_transaction_id) continue;
    const customerName = saleCustomerName(row);
    sources.set(row.expense_transaction_id, {
      kind: "sale-cost",
      label: `Penjualan · ${productName(row) || "-"}${
        customerName ? ` · ${customerName}` : ""
      }`,
      href: "/sales",
      customerName,
      productName: productName(row),
    });
  }

  for (const row of ((saleIncomeResult.data ?? []) as unknown as SaleSourceRow[]) ?? []) {
    if (!row.income_transaction_id) continue;
    const customerName = saleCustomerName(row);
    sources.set(row.income_transaction_id, {
      kind: "sale-income",
      label: `Penjualan · ${productName(row) || "-"}${
        customerName ? ` · ${customerName}` : ""
      }`,
      href: "/sales",
      customerName,
      productName: productName(row),
    });
  }

  for (const row of ((paymentsResult.data ?? []) as unknown as Array<{
    income_transaction_id: string | null;
    debts: {
      id: string;
      customer_name_snapshot: string | null;
      kind: string | null;
      customers: { name: string } | null;
      sales: {
        product_type_name_snapshot: string | null;
        description: string | null;
      } | null;
    } | null;
  }> | null) ?? []) {
    if (!row.income_transaction_id || !row.debts) continue;
    const isLoan = row.debts.kind === "loan";
    const customerName =
      row.debts.customer_name_snapshot ?? row.debts.customers?.name ?? null;
    // Cicilan diperjelas dengan produk yang dihutang: "Cicilan Kuota · Jokowi".
    // Pinjaman uang tidak punya produk -> tetap "Cicilan Pinjaman · Jokowi".
    const subject = isLoan
      ? "Pinjaman"
      : (row.debts.sales?.product_type_name_snapshot ??
        row.debts.sales?.description ??
        "Hutang");
    sources.set(row.income_transaction_id, {
      kind: "debt-payment",
      label: `Cicilan ${subject} · ${customerName || "pelanggan"}`,
      href: "/debts",
      customerName,
      productName: isLoan ? null : (subject === "Hutang" ? null : subject),
    });
  }

  for (const row of ((loanDebtsResult.data ?? []) as unknown as Array<{
    id: string;
    customer_name_snapshot: string | null;
    loan_expense_transaction_id: string | null;
    customers: { name: string } | null;
  }> | null) ?? []) {
    if (!row.loan_expense_transaction_id) continue;
    const customerName = row.customer_name_snapshot ?? row.customers?.name ?? null;
    sources.set(row.loan_expense_transaction_id, {
      kind: "loan-disbursement",
      label: `Pinjaman · ${customerName || "pelanggan"}`,
      href: "/debts",
      customerName,
      productName: null,
    });
  }

  return sources;
}

/** Deskripsi bawaan sistem untuk sumber terkait (isinya duplikat chip Sumber). */
function defaultDescriptionFor(source: TransactionSource): string | null {
  switch (source.kind) {
    case "sale-cost":
      return source.productName ? `HPP ${source.productName}` : null;
    case "sale-income":
      return source.productName ? `Penjualan ${source.productName}` : null;
    case "debt-payment":
      return `Cicilan hutang ${source.customerName ?? "pelanggan"}`;
    case "loan-disbursement":
      return `Pinjaman ${source.customerName ?? "pelanggan"}`;
  }
}

/**
 * Memo tampilan: description mentah, dikembalikan null bila isinya persis
 * teks bawaan sistem untuk sumber terkait (sudah diwakili chip Sumber).
 * Transaksi tanpa sumber tidak tersentuh. Field `description` tetap utuh
 * untuk form edit.
 */
function resolveTransactionMemo(
  description: string | null,
  source: TransactionSource | null,
): string | null {
  const memo = description?.trim();
  if (!memo) return null;
  if (!source) return memo;

  const systemDefault = defaultDescriptionFor(source);
  if (systemDefault && memo.toLowerCase() === systemDefault.toLowerCase()) {
    return null;
  }

  return memo;
}

export async function getTransactions(filters: TransactionFilters = {}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 10, 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const buildFilteredQuery = (
    select: string,
    options?: { count?: "exact" },
  ) => {
    let query = supabase.from("transactions").select(select, options);

    if (filters.dateFrom) {
      query = query.gte("transaction_date", filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte("transaction_date", filters.dateTo);
    }

    if (filters.type) {
      query = query.eq("type", filters.type);
    }

    if (filters.categoryId) {
      query = query.eq("category_id", filters.categoryId);
    }

    if (filters.accountId) {
      query = query.or(
        `account_id.eq.${filters.accountId},from_account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`,
      );
    }

    if (filters.q) {
      query = query.ilike("description", `%${filters.q}%`);
    }

    return query;
  };

  // Summary covers every row matching the filters, not just the current page.
  const transactionsQuery = buildFilteredQuery(
    "id, type, account_id, category_id, from_account_id, to_account_id, amount, description, transaction_date, created_at",
    { count: "exact" },
  )
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  const summaryQuery = buildFilteredQuery("type, amount");

  const [transactionsResult, summaryResult, formOptions, allOptions, usage] =
    await Promise.all([
      transactionsQuery.range(from, to),
      summaryQuery,
      getTransactionFormOptions(),
      getTransactionFormOptions({ activeOnly: false }),
      getTransactionUsage().catch(() => ({
        accountUsage: {},
        categoryUsage: {},
      })),
    ]);

  if (transactionsResult.error) {
    throw new Error(transactionsResult.error.message);
  }

  if (summaryResult.error) {
    throw new Error(summaryResult.error.message);
  }

  const summaryRows = (summaryResult.data ?? []) as unknown as Array<{
    type: string;
    amount: number;
  }>;

  const summarize = (type: TransactionRow["type"]) => {
    const rows = summaryRows.filter((row) => row.type === type);
    return {
      count: rows.length,
      total: rows.reduce((sum, row) => sum + Number(row.amount), 0),
    };
  };

  const incomeSummary = summarize("income");
  const expenseSummary = summarize("expense");
  const transferSummary = summarize("transfer");

  const accountsMap = new Map(allOptions.accounts.map((account) => [account.id, account]));
  const categoriesMap = new Map(
    [...allOptions.incomeCategories, ...allOptions.expenseCategories].map(
      (category) => [category.id, category],
    ),
  );

  const transactions = ((transactionsResult.data ?? []) as unknown as TransactionRow[]).map(
    (transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount),
      description: transaction.description,
      transactionDate: transaction.transaction_date,
      createdAt: transaction.created_at,
      accountId: transaction.account_id,
      categoryId: transaction.category_id,
      fromAccountId: transaction.from_account_id,
      toAccountId: transaction.to_account_id,
      accountName: transaction.account_id
        ? accountsMap.get(transaction.account_id)?.name ?? null
        : null,
      categoryName: transaction.category_id
        ? categoriesMap.get(transaction.category_id)?.name ?? null
        : null,
      fromAccountName: transaction.from_account_id
        ? accountsMap.get(transaction.from_account_id)?.name ?? null
        : null,
      toAccountName: transaction.to_account_id
        ? accountsMap.get(transaction.to_account_id)?.name ?? null
        : null,
      source: null,
      memo: transaction.description,
    }),
  );

  // Chip atribusi sumber (Penjualan/Hutang) untuk transaksi halaman ini saja.
  let sources = new Map<string, TransactionSource>();
  const txIds = transactions.map((transaction) => transaction.id);
  if (txIds.length > 0) {
    try {
      sources = await fetchTransactionSources(supabase, txIds);
    } catch {
      // Tabel belum ada / error tak terduga -> halaman tetap tampil tanpa chip.
    }
  }

  const withSources = transactions.map((transaction) => {
    const source = sources.get(transaction.id) ?? null;
    return {
      ...transaction,
      source,
      memo: resolveTransactionMemo(transaction.description, source),
    };
  });

  return {
    transactions: withSources,
    ...formOptions,
    ...usage,
    summary: {
      totalCount: summaryRows.length,
      incomeCount: incomeSummary.count,
      incomeTotal: incomeSummary.total,
      expenseCount: expenseSummary.count,
      expenseTotal: expenseSummary.total,
      transferCount: transferSummary.count,
      transferTotal: transferSummary.total,
    },
    totalCount: transactionsResult.count ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((transactionsResult.count ?? 0) / pageSize)),
    filters: {
      dateFrom: filters.dateFrom ?? "",
      dateTo: filters.dateTo ?? "",
      type: filters.type ?? "",
      categoryId: filters.categoryId ?? "",
      accountId: filters.accountId ?? "",
      q: filters.q ?? "",
    },
  };
}
