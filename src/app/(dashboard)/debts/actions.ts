"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  creditSaleSchema,
  loanSchema,
  paymentSchema,
  type CreditSaleInput,
  type LoanInput,
  type PaymentInput,
} from "@/lib/validations/debts";
import {
  customerSchema,
  type CustomerInput,
} from "@/lib/validations/customers";
import type { MutationState } from "@/types/finance";

export type CustomerMutationState = MutationState & { id?: string };

function errorState(message: string): MutationState {
  return { status: "error", message };
}

function successState(message: string): MutationState {
  return { status: "success", message };
}

function revalidateDebtPages() {
  revalidatePath("/debts");
  revalidatePath("/sales");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

async function getCurrentUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error(error?.message ?? "Session user tidak ditemukan.");
  }

  return { supabase, userId: user.id };
}

function isMissingRpcError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("could not find the function") ||
    (lower.includes("function") && lower.includes("does not exist")) ||
    lower.includes("pgrst202") ||
    (lower.includes("404") && lower.includes("function"))
  );
}

function nullIfEmpty(value?: string | null) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function mapDebtError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("harga jual harus lebih dari 0")) {
    return "Harga jual harus lebih dari 0.";
  }
  if (lower.includes("modal tidak boleh negatif")) {
    return "Modal tidak boleh negatif.";
  }
  if (lower.includes("nominal pembayaran harus lebih dari 0")) {
    return "Nominal pembayaran harus lebih dari 0.";
  }
  if (lower.includes("data hutang tidak ditemukan")) {
    return "Data hutang tidak ditemukan.";
  }
  if (lower.includes("data cicilan tidak ditemukan")) {
    return "Data cicilan tidak ditemukan.";
  }
  if (lower.includes("data penjualan hutang tidak ditemukan")) {
    return "Data penjualan hutang tidak ditemukan.";
  }
  if (lower.includes("data pinjaman tidak ditemukan")) {
    return "Data pinjaman tidak ditemukan.";
  }
  if (lower.includes("jumlah pinjaman harus lebih dari 0")) {
    return "Jumlah pinjaman harus lebih dari 0.";
  }
  if (lower.includes("jumlah pinjaman tidak boleh lebih kecil")) {
    return "Jumlah pinjaman tidak boleh lebih kecil dari total cicilan.";
  }
  if (lower.includes("pilih akun sumber pinjaman")) {
    return "Pilih akun sumber pinjaman.";
  }
  if (lower.includes("akun sumber pinjaman tidak valid")) {
    return "Akun sumber pinjaman tidak valid.";
  }
  if (lower.includes("kategori cicilan tidak valid")) {
    return "Kategori cicilan tidak valid.";
  }
  if (lower.includes("kategori pinjaman tidak valid")) {
    return "Kategori pinjaman tidak valid.";
  }
  if (lower.includes("data penjualan tidak ditemukan")) {
    return "Data penjualan tidak ditemukan.";
  }
  if (lower.includes("hutang sudah lunas")) {
    return "Hutang ini sudah lunas.";
  }
  if (lower.includes("melebihi sisa hutang")) {
    return "Nominal melebihi sisa hutang.";
  }
  if (lower.includes("not authenticated")) {
    return "Sesi berakhir. Silakan login ulang.";
  }
  if (lower.includes("pilih pelanggan")) {
    return "Pilih pelanggan.";
  }
  if (lower.includes("pelanggan tidak valid")) {
    return "Pelanggan tidak valid.";
  }
  if (lower.includes("Akun Sumber wajib diisi")) {
    return "Pilih akun untuk modal.";
  }
  if (lower.includes("Akun Sumber tidak valid")) {
    return "Akun Sumber tidak valid.";
  }
  if (lower.includes("pilih akun penerima pembayaran")) {
    return "Pilih akun penerima pembayaran.";
  }
  if (lower.includes("akun penerima tidak valid")) {
    return "Akun penerima tidak valid.";
  }
  if (lower.includes("kategori penjualan tidak valid")) {
    return "Kategori penjualan tidak valid.";
  }
  if (lower.includes("kategori modal tidak valid")) {
    return "Kategori modal tidak valid.";
  }
  if (lower.includes("pilih tipe produk")) {
    return "Pilih tipe produk.";
  }
  if (lower.includes("tipe produk tidak valid")) {
    return "Tipe produk tidak valid.";
  }
  if (lower.includes("produk tidak valid")) {
    return "Tipe produk tidak valid.";
  }

  return message;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function resolveNames(
  supabase: SupabaseClient,
  customerId: string | undefined,
  productTypeId: string,
) {
  const [customerResult, typeResult] = await Promise.all([
    customerId
      ? supabase.from("customers").select("name").eq("id", customerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("product_types").select("name").eq("id", productTypeId).maybeSingle(),
  ]);

  if (customerResult.error) throw new Error(customerResult.error.message);
  if (typeResult.error) throw new Error(typeResult.error.message);

  return {
    customerName: (customerResult.data as { name: string } | null)?.name ?? null,
    productTypeName: (typeResult.data as { name: string } | null)?.name ?? null,
  };
}

type ResolvedCreditSale = CreditSaleInput & {
  customerName: string | null;
  productTypeName: string | null;
};

async function resolveCreditSaleInput(
  supabase: SupabaseClient,
  values: CreditSaleInput,
): Promise<ResolvedCreditSale> {
  const names = await resolveNames(supabase, values.customerId, values.productTypeId);
  return { ...values, ...names };
}

function creditExpenseDescription(input: ResolvedCreditSale) {
  const base =
    input.description?.trim() || `HPP ${input.productTypeName ?? "Penjualan"}`.trim();
  return base || "HPP Penjualan";
}

// ---------- Fallback manual (bila RPC belum dijalankan di Supabase) ----------

async function assertCreditOwnership(supabase: SupabaseClient, input: ResolvedCreditSale) {
  const [costAccount, incomeCategory, expenseCategory, productType, customer] =
    await Promise.all([
      supabase.from("accounts").select("id").eq("id", input.costAccountId).maybeSingle(),
      supabase
        .from("categories")
        .select("id")
        .eq("id", input.incomeCategoryId)
        .eq("type", "income")
        .maybeSingle(),
      supabase
        .from("categories")
        .select("id")
        .eq("id", input.expenseCategoryId)
        .eq("type", "expense")
        .maybeSingle(),
      supabase
        .from("product_types")
        .select("id")
        .eq("id", input.productTypeId)
        .maybeSingle(),
      supabase.from("customers").select("id").eq("id", input.customerId).maybeSingle(),
    ]);

  if (costAccount.error) throw new Error(costAccount.error.message);
  if (incomeCategory.error) throw new Error(incomeCategory.error.message);
  if (expenseCategory.error) throw new Error(expenseCategory.error.message);
  if (productType.error) throw new Error(productType.error.message);
  if (customer.error) throw new Error(customer.error.message);

  if (!costAccount.data) throw new Error("Akun Sumber tidak valid");
  if (!incomeCategory.data) throw new Error("Kategori penjualan tidak valid");
  if (!expenseCategory.data) throw new Error("Kategori modal tidak valid");
  if (!productType.data) throw new Error("Tipe produk tidak valid");
  if (!customer.data) throw new Error("Pelanggan tidak valid");
}

async function manualCreateDebt(
  supabase: SupabaseClient,
  userId: string,
  input: ResolvedCreditSale,
) {
  await assertCreditOwnership(supabase, input);

  let expenseTxId: string | null = null;

  if (input.costAmount > 0) {
    const { data: expenseTx, error: expenseError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        type: "expense",
        amount: input.costAmount,
        account_id: input.costAccountId,
        category_id: input.expenseCategoryId,
        description: creditExpenseDescription(input),
        transaction_date: input.saleDate,
      })
      .select("id")
      .single();

    if (expenseError || !expenseTx) {
      throw new Error(expenseError?.message ?? "Gagal mencatat modal penjualan.");
    }

    expenseTxId = (expenseTx as { id: string }).id;
  }

  const { data: saleRow, error: saleError } = await supabase
    .from("sales")
    .insert({
      user_id: userId,
      product_type_id: input.productTypeId,
      product_type_name_snapshot: input.productTypeName,
      sale_date: input.saleDate,
      cost_amount: input.costAmount,
      sell_amount: input.sellAmount,
      cost_account_id: input.costAccountId,
      income_account_id: null,
      income_category_id: input.incomeCategoryId,
      expense_category_id: input.expenseCategoryId,
      expense_transaction_id: expenseTxId,
      income_transaction_id: null,
      customer_ref: input.customerName,
      description: nullIfEmpty(input.description),
    })
    .select("id")
    .single();

  if (saleError || !saleRow) {
    if (expenseTxId) {
      await supabase.from("transactions").delete().eq("id", expenseTxId);
    }
    throw new Error(saleError?.message ?? "Gagal mencatat penjualan hutang.");
  }

  const saleId = (saleRow as { id: string }).id;

  const { error: debtError } = await supabase.from("debts").insert({
    user_id: userId,
    customer_id: input.customerId,
    customer_name_snapshot: input.customerName,
    sale_id: saleId,
  });

  if (debtError) {
    await supabase.from("sales").delete().eq("id", saleId);
    if (expenseTxId) {
      await supabase.from("transactions").delete().eq("id", expenseTxId);
    }
    throw new Error(debtError.message);
  }
}

async function manualUpdateDebt(
  supabase: SupabaseClient,
  userId: string,
  debtId: string,
  input: ResolvedCreditSale,
) {
  await assertCreditOwnership(supabase, input);

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("id, sale_id")
    .eq("id", debtId)
    .maybeSingle();

  if (debtError) {
    throw new Error(debtError.message);
  }
  if (!debt) {
    throw new Error("Data hutang tidak ditemukan");
  }

  const saleId = (debt as { sale_id: string }).sale_id;

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("id, expense_transaction_id")
    .eq("id", saleId)
    .maybeSingle();

  if (saleError) {
    throw new Error(saleError.message);
  }
  if (!sale) {
    throw new Error("Data penjualan tidak ditemukan");
  }

  let expenseTxId = (sale as { expense_transaction_id: string | null })
    .expense_transaction_id;

  if (expenseTxId) {
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", expenseTxId)
      .maybeSingle();
    if (!existing) expenseTxId = null;
  }

  if (input.costAmount > 0) {
    if (expenseTxId) {
      const { error } = await supabase
        .from("transactions")
        .update({
          amount: input.costAmount,
          account_id: input.costAccountId,
          category_id: input.expenseCategoryId,
          description: creditExpenseDescription(input),
          transaction_date: input.saleDate,
        })
        .eq("id", expenseTxId);

      if (error) throw new Error(error.message);
    } else {
      const { data: newExpense, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          type: "expense",
          amount: input.costAmount,
          account_id: input.costAccountId,
          category_id: input.expenseCategoryId,
          description: creditExpenseDescription(input),
          transaction_date: input.saleDate,
        })
        .select("id")
        .single();

      if (error || !newExpense) {
        throw new Error(error?.message ?? "Gagal mencatat modal penjualan.");
      }

      expenseTxId = (newExpense as { id: string }).id;
    }
  } else if (expenseTxId) {
    await supabase.from("transactions").delete().eq("id", expenseTxId);
    expenseTxId = null;
  }

  const { error: updateSaleError } = await supabase
    .from("sales")
    .update({
      product_type_id: input.productTypeId,
      product_type_name_snapshot: input.productTypeName,
      sale_date: input.saleDate,
      cost_amount: input.costAmount,
      sell_amount: input.sellAmount,
      cost_account_id: input.costAccountId,
      income_account_id: null,
      income_category_id: input.incomeCategoryId,
      expense_category_id: input.expenseCategoryId,
      expense_transaction_id: expenseTxId,
      income_transaction_id: null,
      customer_ref: input.customerName,
      description: nullIfEmpty(input.description),
    })
    .eq("id", saleId);

  if (updateSaleError) {
    throw new Error(updateSaleError.message);
  }

  const { error: updateDebtError } = await supabase
    .from("debts")
    .update({
      customer_id: input.customerId,
      customer_name_snapshot: input.customerName,
    })
    .eq("id", debtId);

  if (updateDebtError) {
    throw new Error(updateDebtError.message);
  }
}

async function getRemainingAmount(supabase: SupabaseClient, debtId: string) {
  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("id, sale_id")
    .eq("id", debtId)
    .maybeSingle();

  if (debtError) throw new Error(debtError.message);
  if (!debt) throw new Error("Data hutang tidak ditemukan");

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("sell_amount, income_category_id")
    .eq("id", (debt as { sale_id: string }).sale_id)
    .maybeSingle();

  if (saleError) throw new Error(saleError.message);
  if (!sale) throw new Error("Data penjualan hutang tidak ditemukan");

  const { data: payments, error: paymentsError } = await supabase
    .from("debt_payments")
    .select("amount")
    .eq("debt_id", debtId);

  if (paymentsError) throw new Error(paymentsError.message);

  const sell = Number((sale as { sell_amount: number }).sell_amount);
  const paid = ((payments ?? []) as Array<{ amount: number }>).reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  return {
    sell,
    paid,
    remaining: sell - paid,
    incomeCategoryId: (sale as { income_category_id: string | null }).income_category_id,
  };
}

async function manualCreatePayment(
  supabase: SupabaseClient,
  userId: string,
  debtId: string,
  input: PaymentInput,
) {
  const { remaining, incomeCategoryId } = await getRemainingAmount(supabase, debtId);

  if (remaining <= 0) {
    throw new Error("Hutang sudah lunas");
  }
  if (input.amount > remaining) {
    throw new Error("Melebihi sisa hutang");
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", input.accountId)
    .maybeSingle();

  if (!account) {
    throw new Error("Akun penerima tidak valid");
  }

  const { data: debt } = await supabase
    .from("debts")
    .select("customer_name_snapshot")
    .eq("id", debtId)
    .maybeSingle();

  const desc =
    input.note?.trim() ||
    `Cicilan hutang ${((debt as { customer_name_snapshot: string | null } | null)?.customer_name_snapshot ?? "pelanggan").trim() || "pelanggan"}`;

  const { data: incomeTx, error: incomeError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: "income",
      amount: input.amount,
      account_id: input.accountId,
      category_id: incomeCategoryId,
      description: desc,
      transaction_date: input.paymentDate,
    })
    .select("id")
    .single();

  if (incomeError || !incomeTx) {
    throw new Error(incomeError?.message ?? "Gagal mencatat pembayaran.");
  }

  const { error: paymentError } = await supabase.from("debt_payments").insert({
    user_id: userId,
    debt_id: debtId,
    amount: input.amount,
    account_id: input.accountId,
    category_id: incomeCategoryId,
    income_transaction_id: (incomeTx as { id: string }).id,
    payment_date: input.paymentDate,
    note: nullIfEmpty(input.note),
  });

  if (paymentError) {
    await supabase
      .from("transactions")
      .delete()
      .eq("id", (incomeTx as { id: string }).id);
    throw new Error(paymentError.message);
  }
}

async function manualUpdatePayment(
  supabase: SupabaseClient,
  userId: string,
  paymentId: string,
  input: PaymentInput,
) {
  const { data: payment, error: paymentError } = await supabase
    .from("debt_payments")
    .select("id, debt_id, income_transaction_id")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) throw new Error(paymentError.message);
  if (!payment) throw new Error("Data cicilan tidak ditemukan");

  const row = payment as { debt_id: string; income_transaction_id: string | null };

  const { data: others } = await supabase
    .from("debt_payments")
    .select("amount")
    .eq("debt_id", row.debt_id)
    .neq("id", paymentId);

  const { data: sale } = await supabase
    .from("sales")
    .select("sell_amount")
    .eq(
      "id",
      (
        (await supabase
          .from("debts")
          .select("sale_id")
          .eq("id", row.debt_id)
          .maybeSingle()).data as { sale_id: string } | null
      )?.sale_id ?? "",
    )
    .maybeSingle();

  const sell = Number((sale as { sell_amount: number } | null)?.sell_amount ?? 0);
  const paidOthers = ((others ?? []) as Array<{ amount: number }>).reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  if (input.amount > sell - paidOthers) {
    throw new Error("Melebihi sisa hutang");
  }

  const { data: debt } = await supabase
    .from("debts")
    .select("customer_name_snapshot")
    .eq("id", row.debt_id)
    .maybeSingle();

  const desc =
    input.note?.trim() ||
    `Cicilan hutang ${((debt as { customer_name_snapshot: string | null } | null)?.customer_name_snapshot ?? "pelanggan").trim() || "pelanggan"}`;

  let incomeTxId = row.income_transaction_id;

  if (incomeTxId) {
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", incomeTxId)
      .maybeSingle();

    if (!existing) incomeTxId = null;
  }

  if (incomeTxId) {
    const { error } = await supabase
      .from("transactions")
      .update({
        amount: input.amount,
        account_id: input.accountId,
        description: desc,
        transaction_date: input.paymentDate,
      })
      .eq("id", incomeTxId);

    if (error) throw new Error(error.message);
  } else {
    const { data: debtSale } = await supabase
      .from("debts")
      .select("sale_id")
      .eq("id", row.debt_id)
      .maybeSingle();

    const { data: saleRow } = await supabase
      .from("sales")
      .select("income_category_id")
      .eq("id", (debtSale as { sale_id: string } | null)?.sale_id ?? "")
      .maybeSingle();

    const { data: newTx, error } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        type: "income",
        amount: input.amount,
        account_id: input.accountId,
        category_id: (saleRow as { income_category_id: string | null } | null)
          ?.income_category_id,
        description: desc,
        transaction_date: input.paymentDate,
      })
      .select("id")
      .single();

    if (error || !newTx) {
      throw new Error(error?.message ?? "Gagal mencatat pembayaran.");
    }

    incomeTxId = (newTx as { id: string }).id;
  }

  const { error: updateError } = await supabase
    .from("debt_payments")
    .update({
      amount: input.amount,
      account_id: input.accountId,
      income_transaction_id: incomeTxId,
      payment_date: input.paymentDate,
      note: nullIfEmpty(input.note),
    })
    .eq("id", paymentId);

  if (updateError) throw new Error(updateError.message);
}

async function manualDeletePayment(supabase: SupabaseClient, paymentId: string) {
  const { data: payment, error: paymentError } = await supabase
    .from("debt_payments")
    .select("id, income_transaction_id")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) throw new Error(paymentError.message);
  if (!payment) throw new Error("Data cicilan tidak ditemukan");

  const { error: deleteError } = await supabase
    .from("debt_payments")
    .delete()
    .eq("id", paymentId);

  if (deleteError) throw new Error(deleteError.message);

  const txId = (payment as { income_transaction_id: string | null }).income_transaction_id;
  if (txId) {
    await supabase.from("transactions").delete().eq("id", txId);
  }
}

// ---------- Pinjaman uang (debts kind='loan') ----------

type ResolvedLoan = LoanInput & { customerName: string | null };

async function resolveLoanInput(
  supabase: SupabaseClient,
  values: LoanInput,
): Promise<ResolvedLoan> {
  const { data, error } = await supabase
    .from("customers")
    .select("name")
    .eq("id", values.customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const customerName = (data as { name: string } | null)?.name ?? null;
  return { ...values, customerName };
}

function loanExpenseDescription(input: ResolvedLoan) {
  const base =
    input.description?.trim() || `Pinjaman ${input.customerName ?? "pelanggan"}`.trim();
  return base || "Pinjaman pelanggan";
}

async function assertLoanOwnership(supabase: SupabaseClient, input: ResolvedLoan) {
  const [sourceAccount, incomeCategory, expenseCategory, customer] = await Promise.all([
    supabase.from("accounts").select("id").eq("id", input.sourceAccountId).maybeSingle(),
    supabase
      .from("categories")
      .select("id")
      .eq("id", input.incomeCategoryId)
      .eq("type", "income")
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id")
      .eq("id", input.expenseCategoryId)
      .eq("type", "expense")
      .maybeSingle(),
    supabase.from("customers").select("id").eq("id", input.customerId).maybeSingle(),
  ]);

  if (sourceAccount.error) throw new Error(sourceAccount.error.message);
  if (incomeCategory.error) throw new Error(incomeCategory.error.message);
  if (expenseCategory.error) throw new Error(expenseCategory.error.message);
  if (customer.error) throw new Error(customer.error.message);

  if (!sourceAccount.data) throw new Error("Akun sumber pinjaman tidak valid");
  if (!incomeCategory.data) throw new Error("Kategori cicilan tidak valid");
  if (!expenseCategory.data) throw new Error("Kategori pinjaman tidak valid");
  if (!customer.data) throw new Error("Pelanggan tidak valid");
}

async function manualCreateLoan(
  supabase: SupabaseClient,
  userId: string,
  input: ResolvedLoan,
) {
  await assertLoanOwnership(supabase, input);

  // Uang keluar dari akun sumber saat pinjaman diserahkan.
  const { data: expenseTx, error: expenseError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: "expense",
      amount: input.loanAmount,
      account_id: input.sourceAccountId,
      category_id: input.expenseCategoryId,
      description: loanExpenseDescription(input),
      transaction_date: input.loanDate,
    })
    .select("id")
    .single();

  if (expenseError || !expenseTx) {
    throw new Error(expenseError?.message ?? "Gagal mencatat penyerahan pinjaman.");
  }

  const expenseTxId = (expenseTx as { id: string }).id;

  const { error: debtError } = await supabase.from("debts").insert({
    user_id: userId,
    customer_id: input.customerId,
    customer_name_snapshot: input.customerName,
    sale_id: null,
    kind: "loan",
    loan_amount: input.loanAmount,
    loan_date: input.loanDate,
    loan_source_account_id: input.sourceAccountId,
    loan_expense_category_id: input.expenseCategoryId,
    loan_income_category_id: input.incomeCategoryId,
    loan_description: nullIfEmpty(input.description),
    loan_expense_transaction_id: expenseTxId,
  });

  if (debtError) {
    await supabase.from("transactions").delete().eq("id", expenseTxId);
    throw new Error(debtError.message);
  }
}

async function manualUpdateLoan(
  supabase: SupabaseClient,
  userId: string,
  debtId: string,
  input: ResolvedLoan,
) {
  await assertLoanOwnership(supabase, input);

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("kind, loan_expense_transaction_id")
    .eq("id", debtId)
    .maybeSingle();

  if (debtError) throw new Error(debtError.message);
  if (!debt) throw new Error("Data pinjaman tidak ditemukan");

  const row = debt as { kind: string | null; loan_expense_transaction_id: string | null };
  if (row.kind && row.kind !== "loan") {
    throw new Error("Data pinjaman tidak ditemukan");
  }

  // Tagihan tidak boleh lebih kecil dari cicilan yang sudah masuk.
  const { data: paidRows, error: paidError } = await supabase
    .from("debt_payments")
    .select("amount")
    .eq("debt_id", debtId);

  if (paidError) throw new Error(paidError.message);

  const paid = ((paidRows ?? []) as Array<{ amount: number | string }>).reduce(
    (sum, p) => sum + Number(p.amount ?? 0),
    0,
  );
  if (input.loanAmount < paid) {
    throw new Error("Jumlah pinjaman tidak boleh lebih kecil dari total cicilan");
  }

  const { error: updateError } = await supabase
    .from("debts")
    .update({
      customer_id: input.customerId,
      customer_name_snapshot: input.customerName,
      loan_amount: input.loanAmount,
      loan_date: input.loanDate,
      loan_source_account_id: input.sourceAccountId,
      loan_expense_category_id: input.expenseCategoryId,
      loan_income_category_id: input.incomeCategoryId,
      loan_description: nullIfEmpty(input.description),
    })
    .eq("id", debtId);

  if (updateError) throw new Error(updateError.message);

  // Sinkronkan transaksi penyerahan pinjaman (bila masih ada).
  if (row.loan_expense_transaction_id) {
    const { error: txError } = await supabase
      .from("transactions")
      .update({
        amount: input.loanAmount,
        account_id: input.sourceAccountId,
        category_id: input.expenseCategoryId,
        description: loanExpenseDescription(input),
        transaction_date: input.loanDate,
      })
      .eq("id", row.loan_expense_transaction_id);

    if (txError) throw new Error(txError.message);
  }
}

async function manualDeleteLoan(supabase: SupabaseClient, debtId: string) {
  const { data: payments } = await supabase
    .from("debt_payments")
    .select("income_transaction_id")
    .eq("debt_id", debtId);

  const paymentTxIds = ((payments ?? []) as Array<{ income_transaction_id: string | null }>)
    .map((p) => p.income_transaction_id)
    .filter((id): id is string => Boolean(id));

  let expenseTxId: string | null = null;
  const { data: debtRow, error: debtError } = await supabase
    .from("debts")
    .select("loan_expense_transaction_id")
    .eq("id", debtId)
    .maybeSingle();

  if (!debtError && debtRow) {
    expenseTxId = (debtRow as { loan_expense_transaction_id: string | null })
      .loan_expense_transaction_id;
  }

  const { error: deleteError } = await supabase.from("debts").delete().eq("id", debtId);

  if (deleteError) throw new Error(deleteError.message);

  const txIds = [...paymentTxIds, ...(expenseTxId ? [expenseTxId] : [])];
  if (txIds.length > 0) {
    await supabase.from("transactions").delete().in("id", txIds);
  }
}

// ---------- Public actions: hutang ----------

export async function createDebtAction(values: CreditSaleInput): Promise<MutationState> {
  const parsed = creditSaleSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data hutang tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const input = await resolveCreditSaleInput(supabase, parsed.data);

    const { error } = await supabase.rpc("create_credit_sale", {
      p_customer_id: input.customerId,
      p_customer_name_snapshot: input.customerName,
      p_product_type_id: input.productTypeId,
      p_product_type_name_snapshot: input.productTypeName,
      p_sale_date: input.saleDate,
      p_cost_amount: input.costAmount,
      p_sell_amount: input.sellAmount,
      p_cost_account_id: input.costAccountId,
      p_expense_category_id: input.expenseCategoryId,
      p_income_category_id: input.incomeCategoryId,
      p_description: nullIfEmpty(input.description),
    });

    if (error) {
      if (isMissingRpcError(error.message)) {
        await manualCreateDebt(supabase, userId, input);
      } else {
        return errorState(mapDebtError(error.message));
      }
    }

    revalidateDebtPages();

    return successState("Hutang berhasil dicatat.");
  } catch (error) {
    return errorState(
      error instanceof Error ? mapDebtError(error.message) : "Gagal mencatat hutang.",
    );
  }
}

export async function updateDebtAction(
  debtId: string,
  values: CreditSaleInput,
): Promise<MutationState> {
  const parsed = creditSaleSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data hutang tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const input = await resolveCreditSaleInput(supabase, parsed.data);

    const { error } = await supabase.rpc("update_credit_sale", {
      p_debt_id: debtId,
      p_customer_id: input.customerId,
      p_customer_name_snapshot: input.customerName,
      p_product_type_id: input.productTypeId,
      p_product_type_name_snapshot: input.productTypeName,
      p_sale_date: input.saleDate,
      p_cost_amount: input.costAmount,
      p_sell_amount: input.sellAmount,
      p_cost_account_id: input.costAccountId,
      p_expense_category_id: input.expenseCategoryId,
      p_income_category_id: input.incomeCategoryId,
      p_description: nullIfEmpty(input.description),
    });

    if (error) {
      if (isMissingRpcError(error.message)) {
        await manualUpdateDebt(supabase, userId, debtId, input);
      } else {
        return errorState(mapDebtError(error.message));
      }
    }

    revalidateDebtPages();

    return successState("Hutang berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error ? mapDebtError(error.message) : "Gagal memperbarui hutang.",
    );
  }
}

// ---------- Public actions: pinjaman uang ----------

export async function createLoanAction(values: LoanInput): Promise<MutationState> {
  const parsed = loanSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data pinjaman tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const input = await resolveLoanInput(supabase, parsed.data);

    const { error } = await supabase.rpc("create_money_loan", {
      p_customer_id: input.customerId,
      p_customer_name_snapshot: input.customerName,
      p_loan_amount: input.loanAmount,
      p_source_account_id: input.sourceAccountId,
      p_expense_category_id: input.expenseCategoryId,
      p_income_category_id: input.incomeCategoryId,
      p_loan_date: input.loanDate,
      p_description: nullIfEmpty(input.description),
    });

    if (error) {
      if (isMissingRpcError(error.message)) {
        await manualCreateLoan(supabase, userId, input);
      } else {
        return errorState(mapDebtError(error.message));
      }
    }

    revalidateDebtPages();

    return successState("Pinjaman berhasil dicatat.");
  } catch (error) {
    return errorState(
      error instanceof Error ? mapDebtError(error.message) : "Gagal mencatat pinjaman.",
    );
  }
}

export async function updateLoanAction(
  debtId: string,
  values: LoanInput,
): Promise<MutationState> {
  const parsed = loanSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data pinjaman tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const input = await resolveLoanInput(supabase, parsed.data);

    const { error } = await supabase.rpc("update_money_loan", {
      p_debt_id: debtId,
      p_customer_id: input.customerId,
      p_customer_name_snapshot: input.customerName,
      p_loan_amount: input.loanAmount,
      p_source_account_id: input.sourceAccountId,
      p_expense_category_id: input.expenseCategoryId,
      p_income_category_id: input.incomeCategoryId,
      p_loan_date: input.loanDate,
      p_description: nullIfEmpty(input.description),
    });

    if (error) {
      if (isMissingRpcError(error.message)) {
        await manualUpdateLoan(supabase, userId, debtId, input);
      } else {
        return errorState(mapDebtError(error.message));
      }
    }

    revalidateDebtPages();

    return successState("Pinjaman berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error ? mapDebtError(error.message) : "Gagal memperbarui pinjaman.",
    );
  }
}

export async function deleteDebtAction(debtId: string) {
  const { supabase } = await getCurrentUserContext();

  // Hapus via sale agar cascade membersihkan debts + payments.
  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("sale_id")
    .eq("id", debtId)
    .maybeSingle();

  if (debtError) {
    throw new Error(debtError.message);
  }
  if (!debt) {
    throw new Error("Data hutang tidak ditemukan");
  }

  const saleId = (debt as { sale_id: string | null }).sale_id;

  // Pinjaman uang (kind='loan') tidak punya baris sales — hapus via jalur pinjaman.
  if (!saleId) {
    const { error: loanDeleteError } = await supabase.rpc("delete_money_loan", {
      p_debt_id: debtId,
    });

    if (loanDeleteError) {
      if (isMissingRpcError(loanDeleteError.message)) {
        await manualDeleteLoan(supabase, debtId);
      } else {
        throw new Error(mapDebtError(loanDeleteError.message));
      }
    }

    revalidateDebtPages();
    return;
  }

  // Kumpulkan income tx cicilan sebelum hapus (fallback bila RPC belum ada).
  const { data: payments } = await supabase
    .from("debt_payments")
    .select("income_transaction_id")
    .eq("debt_id", debtId);

  const paymentTxIds = ((payments ?? []) as Array<{ income_transaction_id: string | null }>)
    .map((p) => p.income_transaction_id)
    .filter((id): id is string => Boolean(id));

  const { data: sale } = await supabase
    .from("sales")
    .select("expense_transaction_id, income_transaction_id")
    .eq("id", saleId)
    .maybeSingle();

  const { error } = await supabase.rpc("delete_sale", { p_sale_id: saleId });

  if (error) {
    if (isMissingRpcError(error.message)) {
      await supabase.from("sales").delete().eq("id", saleId);

      const saleRow = sale as {
        expense_transaction_id: string | null;
        income_transaction_id: string | null;
      } | null;

      const linkedIds = [
        saleRow?.expense_transaction_id,
        saleRow?.income_transaction_id,
        ...paymentTxIds,
      ].filter((id): id is string => Boolean(id));

      if (linkedIds.length > 0) {
        await supabase.from("transactions").delete().in("id", linkedIds);
      }
    } else {
      throw new Error(mapDebtError(error.message));
    }
  }

  revalidateDebtPages();
}

/** Hapus baris payment yatim (income tx-nya dihapus manual dari Transaksi). */
export async function cleanupOrphanPaymentAction(paymentId: string) {
  const { supabase } = await getCurrentUserContext();

  const { error } = await supabase.from("debt_payments").delete().eq("id", paymentId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateDebtPages();
}

// ---------- Public actions: cicilan ----------

export async function createPaymentAction(
  debtId: string,
  values: PaymentInput,
): Promise<MutationState> {
  const parsed = paymentSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data pembayaran tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();

    const { error } = await supabase.rpc("record_debt_payment", {
      p_debt_id: debtId,
      p_amount: parsed.data.amount,
      p_account_id: parsed.data.accountId,
      p_payment_date: parsed.data.paymentDate,
      p_note: nullIfEmpty(parsed.data.note),
    });

    if (error) {
      if (isMissingRpcError(error.message)) {
        await manualCreatePayment(supabase, userId, debtId, parsed.data);
      } else {
        return errorState(mapDebtError(error.message));
      }
    }

    revalidateDebtPages();

    return successState("Pembayaran berhasil dicatat.");
  } catch (error) {
    return errorState(
      error instanceof Error
        ? mapDebtError(error.message)
        : "Gagal mencatat pembayaran.",
    );
  }
}

export async function updatePaymentAction(
  paymentId: string,
  values: PaymentInput,
): Promise<MutationState> {
  const parsed = paymentSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data pembayaran tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();

    const { error } = await supabase.rpc("update_debt_payment", {
      p_payment_id: paymentId,
      p_amount: parsed.data.amount,
      p_account_id: parsed.data.accountId,
      p_payment_date: parsed.data.paymentDate,
      p_note: nullIfEmpty(parsed.data.note),
    });

    if (error) {
      if (isMissingRpcError(error.message)) {
        await manualUpdatePayment(supabase, userId, paymentId, parsed.data);
      } else {
        return errorState(mapDebtError(error.message));
      }
    }

    revalidateDebtPages();

    return successState("Pembayaran berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error
        ? mapDebtError(error.message)
        : "Gagal memperbarui pembayaran.",
    );
  }
}

export async function deletePaymentAction(paymentId: string) {
  const { supabase } = await getCurrentUserContext();

  const { error } = await supabase.rpc("delete_debt_payment", {
    p_payment_id: paymentId,
  });

  if (error) {
    if (isMissingRpcError(error.message)) {
      await manualDeletePayment(supabase, paymentId);
    } else {
      throw new Error(mapDebtError(error.message));
    }
  }

  revalidateDebtPages();
}

// ---------- Public actions: pelanggan ----------

function mapCustomerError(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("duplicate") ||
    lower.includes("customers_user_id_name_unique_idx")
  ) {
    return "Nama pelanggan sudah ada.";
  }

  return message;
}

export async function createCustomerAction(
  values: CustomerInput,
): Promise<CustomerMutationState> {
  const parsed = customerSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data pelanggan tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const { data, error } = await supabase
      .from("customers")
      .insert({
        user_id: userId,
        name: parsed.data.name,
        phone: nullIfEmpty(parsed.data.phone),
        notes: nullIfEmpty(parsed.data.notes),
        is_active: parsed.data.isActive ?? true,
      })
      .select("id")
      .single();

    if (error || !data) {
      return errorState(mapCustomerError(error?.message ?? "Gagal membuat pelanggan."));
    }

    revalidateDebtPages();

    return {
      status: "success",
      message: "Pelanggan berhasil ditambahkan.",
      id: (data as { id: string }).id,
    };
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal membuat pelanggan.",
    );
  }
}

export async function updateCustomerAction(
  customerId: string,
  values: CustomerInput,
): Promise<MutationState> {
  const parsed = customerSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data pelanggan tidak valid.",
    );
  }

  try {
    const { supabase } = await getCurrentUserContext();
    const { error } = await supabase
      .from("customers")
      .update({
        name: parsed.data.name,
        phone: nullIfEmpty(parsed.data.phone),
        notes: nullIfEmpty(parsed.data.notes),
        is_active: parsed.data.isActive ?? true,
      })
      .eq("id", customerId);

    if (error) {
      return errorState(mapCustomerError(error.message));
    }

    revalidateDebtPages();

    return successState("Pelanggan berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal memperbarui pelanggan.",
    );
  }
}

export async function deleteCustomerAction(customerId: string) {
  const { supabase } = await getCurrentUserContext();

  // Riwayat hutang dipertahankan (customer_id SET NULL + snapshot nama).
  const { error } = await supabase.from("customers").delete().eq("id", customerId);

  if (error) {
    throw new Error(mapCustomerError(error.message));
  }

  revalidateDebtPages();
}

// Inline-add tipe dari form hutang memakai action di sales/actions.ts
// (createProductTypeAction) agar satu sumber kebenaran.
