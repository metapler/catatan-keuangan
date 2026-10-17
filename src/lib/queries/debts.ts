import { createClient } from "@/lib/supabase/server";
import { deriveDebtStatus, type DebtStatus } from "@/lib/validations/debts";
import { getCustomers } from "@/lib/queries/customers";
import {
  ensureBuiltinProductTypes,
  getProductTypes,
} from "@/lib/queries/product-types";
import { getTransactionFormOptions } from "@/lib/queries/transactions";
import {
  buildUsageCount,
  type UsageCount,
} from "@/lib/utils/sort-by-usage";

export type DebtRow = {
  id: string;
  customer_id: string | null;
  customer_name_snapshot: string | null;
  /** 'sale' = hutang produk (1:1 ke sales), 'loan' = pinjaman uang (tanpa sales). */
  kind: string | null;
  sale_id: string | null;
  loan_amount: number | string | null;
  loan_date: string | null;
  loan_source_account_id: string | null;
  loan_expense_category_id: string | null;
  loan_income_category_id: string | null;
  loan_description: string | null;
  loan_expense_transaction_id: string | null;
  created_at: string;
};

export type SaleForDebt = {
  id: string;
  product_type_id: string | null;
  product_type_name_snapshot: string | null;
  sale_date: string;
  cost_amount: number;
  sell_amount: number;
  cost_account_id: string | null;
  income_category_id: string | null;
  expense_category_id: string | null;
  expense_transaction_id: string | null;
  income_transaction_id: string | null;
  description: string | null;
};

export type PaymentRow = {
  id: string;
  debt_id: string;
  amount: number;
  account_id: string | null;
  category_id: string | null;
  income_transaction_id: string | null;
  payment_date: string;
  note: string | null;
  created_at: string;
};

export type PaymentSummary = {
  id: string;
  amount: number;
  accountId: string | null;
  accountName: string | null;
  paymentDate: string;
  note: string | null;
  createdAt: string;
  isOrphan: boolean;
};

export type DebtSummary = {
  id: string;
  /** 'sale' = hutang produk (terhubung sales), 'loan' = pinjaman uang. */
  kind: "sale" | "loan";
  saleId: string | null;
  customerId: string | null;
  customerName: string;
  productTypeId: string | null;
  productTypeName: string | null;
  saleDate: string;
  costAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: DebtStatus;
  costAccountId: string | null;
  costAccountName: string | null;
  incomeCategoryId: string | null;
  incomeCategoryName: string | null;
  expenseCategoryId: string | null;
  expenseCategoryName: string | null;
  description: string | null;
  createdAt: string;
  payments: PaymentSummary[];
  isOrphan: boolean;
};

export type DebtFilters = {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  status?: DebtStatus | "";
  q?: string;
  page?: number;
  pageSize?: number;
};

export type DebtTotals = {
  totalTagihan: number;
  totalTerbayar: number;
  totalSisa: number;
  count: number;
  belumLunas: number;
  mencicil: number;
  lunas: number;
  orphanCount: number;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getDebts(filters: DebtFilters = {}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 10, 50));

  // Satu hutang = satu baris debt; agregasi dilakukan in-memory agar filter,
  // totals, dan pagination selalu konsisten satu sama lain.
  await ensureBuiltinProductTypes().catch(() => {
    // Tabel belum dimigrasi: lanjutkan tanpa tipe.
  });

  const [debtsResult, allSalesResult, allPaymentsResult, formOptions, allOptions, customers, productTypes] =
    await Promise.all([
      supabase
        .from("debts")
        .select(
          "id, customer_id, customer_name_snapshot, sale_id, kind, loan_amount, loan_date, loan_source_account_id, loan_expense_category_id, loan_income_category_id, loan_description, loan_expense_transaction_id, created_at",
        ),
      supabase.from("sales").select(
        "id, product_type_id, product_type_name_snapshot, sale_date, cost_amount, sell_amount, cost_account_id, income_category_id, expense_category_id, expense_transaction_id, income_transaction_id, description",
      ),
      supabase
        .from("debt_payments")
        .select(
          "id, debt_id, amount, account_id, category_id, income_transaction_id, payment_date, note, created_at",
        )
        .order("payment_date", { ascending: true })
        .order("created_at", { ascending: true }),
      getTransactionFormOptions({ activeOnly: true }),
      getTransactionFormOptions({ activeOnly: false }),
      getCustomers({ activeOnly: false }),
      getProductTypes({ activeOnly: false }).catch(() => []),
    ]);

  if (debtsResult.error) {
    throw new Error(debtsResult.error.message);
  }
  if (allSalesResult.error) {
    throw new Error(allSalesResult.error.message);
  }
  if (allPaymentsResult.error) {
    throw new Error(allPaymentsResult.error.message);
  }

  const salesMap = new Map<string, SaleForDebt>(
    (
      (allSalesResult.data ?? []) as Array<
        Omit<SaleForDebt, "cost_amount" | "sell_amount"> & {
          cost_amount: number | string;
          sell_amount: number | string;
        }
      >
    ).map((row) => [
      row.id,
      {
        ...row,
        cost_amount: toNumber(row.cost_amount),
        sell_amount: toNumber(row.sell_amount),
      },
    ]),
  );

  const paymentsByDebt = new Map<string, PaymentRow[]>();
  for (const raw of (allPaymentsResult.data ?? []) as Array<
    Omit<PaymentRow, "amount"> & { amount: number | string }
  >) {
    const row: PaymentRow = { ...raw, amount: toNumber(raw.amount) };
    const list = paymentsByDebt.get(row.debt_id) ?? [];
    list.push(row);
    paymentsByDebt.set(row.debt_id, list);
  }

  // Cek transaksi ter-link yang masih ada (guard orphan).
  const linkedTxIds = new Set<string>();
  for (const sale of salesMap.values()) {
    if (sale.expense_transaction_id) linkedTxIds.add(sale.expense_transaction_id);
    if (sale.income_transaction_id) linkedTxIds.add(sale.income_transaction_id);
  }
  for (const debt of ((debtsResult.data ?? []) as DebtRow[])) {
    // Tx penyerahan pinjaman uang (kind='loan').
    if (debt.loan_expense_transaction_id) {
      linkedTxIds.add(debt.loan_expense_transaction_id);
    }
  }
  for (const list of paymentsByDebt.values()) {
    for (const payment of list) {
      if (payment.income_transaction_id) linkedTxIds.add(payment.income_transaction_id);
    }
  }

  let existingTxIds = new Set<string>();
  if (linkedTxIds.size > 0) {
    const { data: txRows, error: txError } = await supabase
      .from("transactions")
      .select("id")
      .in("id", Array.from(linkedTxIds));

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
  const customersMap = new Map(customers.map((customer) => [customer.id, customer]));
  const typesMap = new Map(productTypes.map((type) => [type.id, type]));

  const buildSummary = (debt: DebtRow): DebtSummary | null => {
    const kind: "sale" | "loan" = debt.kind === "loan" ? "loan" : "sale";
    const sale = debt.sale_id ? salesMap.get(debt.sale_id) : undefined;

    const payments = (paymentsByDebt.get(debt.id) ?? []).map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      accountId: payment.account_id,
      accountName: payment.account_id
        ? (accountsMap.get(payment.account_id)?.name ?? "Unknown")
        : null,
      paymentDate: payment.payment_date,
      note: payment.note,
      createdAt: payment.created_at,
      isOrphan:
        payment.income_transaction_id !== null &&
        !existingTxIds.has(payment.income_transaction_id),
    }));

    const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const customer = debt.customer_id ? customersMap.get(debt.customer_id) : undefined;
    const customerName =
      debt.customer_name_snapshot ?? customer?.name ?? "Tanpa pelanggan";

    // Pinjaman uang: tagihan berdiri sendiri di baris debts (tanpa sales).
    if (kind === "loan") {
      const total = toNumber(debt.loan_amount);
      const expenseGone =
        debt.loan_expense_transaction_id !== null &&
        !existingTxIds.has(debt.loan_expense_transaction_id);

      return {
        id: debt.id,
        kind,
        saleId: null,
        customerId: debt.customer_id,
        customerName,
        productTypeId: null,
        productTypeName: null,
        saleDate: debt.loan_date ?? debt.created_at.slice(0, 10),
        costAmount: total,
        totalAmount: total,
        paidAmount: paid,
        remainingAmount: Math.max(0, total - paid),
        status: deriveDebtStatus(paid, total),
        costAccountId: debt.loan_source_account_id,
        costAccountName: debt.loan_source_account_id
          ? (accountsMap.get(debt.loan_source_account_id)?.name ?? "Unknown")
          : null,
        incomeCategoryId: debt.loan_income_category_id,
        incomeCategoryName: debt.loan_income_category_id
          ? (categoriesMap.get(debt.loan_income_category_id)?.name ?? "Unknown")
          : null,
        expenseCategoryId: debt.loan_expense_category_id,
        expenseCategoryName: debt.loan_expense_category_id
          ? (categoriesMap.get(debt.loan_expense_category_id)?.name ?? "Unknown")
          : null,
        description: debt.loan_description,
        createdAt: debt.created_at,
        payments,
        isOrphan: expenseGone || payments.some((payment) => payment.isOrphan),
      };
    }

    if (!sale) return null;

    const total = sale.sell_amount;

    const liveType = sale.product_type_id ? typesMap.get(sale.product_type_id) : undefined;

    const expenseGone =
      sale.expense_transaction_id !== null &&
      !existingTxIds.has(sale.expense_transaction_id);

    return {
      id: debt.id,
      kind,
      saleId: debt.sale_id,
      customerId: debt.customer_id,
      customerName,
      productTypeId: liveType?.id ?? sale.product_type_id,
      productTypeName:
        liveType?.name ?? sale.product_type_name_snapshot ?? sale.description ?? null,
      saleDate: sale.sale_date,
      costAmount: sale.cost_amount,
      totalAmount: total,
      paidAmount: paid,
      remainingAmount: Math.max(0, total - paid),
      status: deriveDebtStatus(paid, total),
      costAccountId: sale.cost_account_id,
      costAccountName: sale.cost_account_id
        ? (accountsMap.get(sale.cost_account_id)?.name ?? "Unknown")
        : null,
      incomeCategoryId: sale.income_category_id,
      incomeCategoryName: sale.income_category_id
        ? (categoriesMap.get(sale.income_category_id)?.name ?? "Unknown")
        : null,
      expenseCategoryId: sale.expense_category_id,
      expenseCategoryName: sale.expense_category_id
        ? (categoriesMap.get(sale.expense_category_id)?.name ?? "Unknown")
        : null,
      description: sale.description,
      createdAt: debt.created_at,
      payments,
      isOrphan: expenseGone || payments.some((payment) => payment.isOrphan),
    };
  };

  let scoped = ((debtsResult.data ?? []) as DebtRow[])
    .map(buildSummary)
    .filter((summary): summary is DebtSummary => summary !== null)
    // Urutkan berdasarkan tanggal penjualan terbaru agar konsisten dengan Sales.
    .sort((a, b) => (a.saleDate < b.saleDate ? 1 : a.saleDate > b.saleDate ? -1 : 0));

  if (filters.dateFrom) {
    scoped = scoped.filter((s) => s.saleDate >= filters.dateFrom!);
  }
  if (filters.dateTo) {
    scoped = scoped.filter((s) => s.saleDate <= filters.dateTo!);
  }
  if (filters.customerId) {
    scoped = scoped.filter((s) => s.customerId === filters.customerId);
  }
  if (filters.status) {
    scoped = scoped.filter((s) => s.status === filters.status);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    scoped = scoped.filter((s) =>
      [s.customerName, s.productTypeName ?? "", s.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }

  const totals: DebtTotals = {
    totalTagihan: 0,
    totalTerbayar: 0,
    totalSisa: 0,
    count: 0,
    belumLunas: 0,
    mencicil: 0,
    lunas: 0,
    orphanCount: 0,
  };

  for (const s of scoped) {
    totals.totalTagihan += s.totalAmount;
    totals.totalTerbayar += s.paidAmount;
    totals.totalSisa += s.remainingAmount;
    totals.count += 1;
    totals[
      s.status === "belum_lunas"
        ? "belumLunas"
        : s.status === "mencicil"
          ? "mencicil"
          : "lunas"
    ] += 1;
    if (s.isOrphan) totals.orphanCount += 1;
  }

  const totalCount = scoped.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = scoped.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Frekuensi pemakaian opsi form hutang (all-time, per user via RLS):
  // pelanggan dari seluruh debts, tipe/akun/kategori dari sales kredit
  // (sales yang terhubung ke debts).
  const debtRows = ((debtsResult.data ?? []) as DebtRow[]);
  const customerUsage: UsageCount = buildUsageCount(
    debtRows.map((debt) => debt.customer_id),
  );
  const creditSaleIds = new Set(debtRows.map((debt) => debt.sale_id));
  const creditProductTypeIds: Array<string | null> = [];
  const creditAccountIds: Array<string | null> = [];
  const creditIncomeCategoryIds: Array<string | null> = [];
  const creditExpenseCategoryIds: Array<string | null> = [];

  for (const sale of salesMap.values()) {
    if (!creditSaleIds.has(sale.id)) continue;
    creditProductTypeIds.push(sale.product_type_id);
    creditAccountIds.push(sale.cost_account_id);
    creditIncomeCategoryIds.push(sale.income_category_id);
    creditExpenseCategoryIds.push(sale.expense_category_id);
  }

  // Pinjaman uang ikut menyumbang frekuensi akun sumber & kategori.
  for (const debt of debtRows) {
    if (debt.kind !== "loan") continue;
    creditAccountIds.push(debt.loan_source_account_id);
    creditIncomeCategoryIds.push(debt.loan_income_category_id);
    creditExpenseCategoryIds.push(debt.loan_expense_category_id);
  }

  return {
    debts: paged,
    totals,
    totalCount,
    page: safePage,
    pageSize,
    totalPages,
    accounts: formOptions.accounts,
    incomeCategories: formOptions.incomeCategories,
    expenseCategories: formOptions.expenseCategories,
    customers,
    productTypes,
    customerUsage,
    productTypeUsage: buildUsageCount(creditProductTypeIds),
    accountUsage: buildUsageCount(creditAccountIds),
    incomeCategoryUsage: buildUsageCount(creditIncomeCategoryIds),
    expenseCategoryUsage: buildUsageCount(creditExpenseCategoryIds),
    filters: {
      dateFrom: filters.dateFrom ?? "",
      dateTo: filters.dateTo ?? "",
      customerId: filters.customerId ?? "",
      status: filters.status ?? "",
      q: filters.q ?? "",
    },
  };
}

export async function getDebtById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debts")
    .select(
      "id, customer_id, customer_name_snapshot, sale_id, kind, loan_amount, loan_date, loan_source_account_id, loan_expense_category_id, loan_income_category_id, loan_description, loan_expense_transaction_id, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  return data as DebtRow;
}
