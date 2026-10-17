"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { saleSchema, type SaleInput } from "@/lib/validations/sales";
import {
  productTypeSchema,
  type ProductTypeInput,
} from "@/lib/validations/product-types";
import type { MutationState } from "@/types/finance";

export type ProductTypeMutationState = MutationState & { id?: string };

function errorState(message: string): MutationState {
  return { status: "error", message };
}

function successState(message: string): MutationState {
  return { status: "success", message };
}

function revalidateSalesPages() {
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
    lower.includes("function") && lower.includes("does not exist") ||
    lower.includes("pgrst202") ||
    lower.includes("404") && lower.includes("function")
  );
}

function nullIfEmpty(value?: string | null) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function mapSaleError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("harga jual harus lebih dari 0")) {
    return "Harga jual harus lebih dari 0.";
  }
  if (lower.includes("modal tidak boleh negatif")) {
    return "Modal tidak boleh negatif.";
  }
  if (lower.includes("data penjualan tidak ditemukan")) {
    return "Data penjualan tidak ditemukan.";
  }
  if (lower.includes("not authenticated")) {
    return "Sesi berakhir. Silakan login ulang.";
  }
  if (lower.includes("Akun Sumber wajib diisi")) {
    return "Pilih akun untuk modal.";
  }
  if (lower.includes("akun penerima wajib diisi")) {
    return "Pilih akun penerima penjualan.";
  }
  if (lower.includes("Akun Sumber tidak valid")) {
    return "Akun Sumber tidak valid.";
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
  if (lower.includes("account") && lower.includes("does not belong")) {
    return "Akun yang dipilih tidak sesuai dengan user aktif.";
  }
  if (lower.includes("category") && lower.includes("does not belong")) {
    return "Kategori yang dipilih tidak sesuai dengan user aktif.";
  }
  if (lower.includes("violates check constraint") && lower.includes("transactions")) {
    return "Nominal transaksi tidak valid untuk constraint database.";
  }

  return message;
}

async function resolveProductTypeName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productTypeId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("product_types")
    .select("name")
    .eq("id", productTypeId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { name: string } | null)?.name ?? null;
}

type ResolvedSale = SaleInput & { productTypeName: string | null };

async function resolveSaleInput(
  supabase: Awaited<ReturnType<typeof createClient>>,
  values: SaleInput,
): Promise<ResolvedSale> {
  const productTypeName = await resolveProductTypeName(
    supabase,
    values.productTypeId,
  );

  return { ...values, productTypeName };
}

function expenseDescription(input: ResolvedSale) {
  const base =
    input.description?.trim() ||
    `HPP ${input.productTypeName ?? "Penjualan"}`.trim();
  return base || "HPP Penjualan";
}

function incomeDescription(input: ResolvedSale) {
  const base =
    input.description?.trim() ||
    `Penjualan ${input.productTypeName ?? ""}`.trim();
  return base || "Penjualan";
}

// ---------- Fallback manual (bila RPC belum dijalankan di Supabase) ----------

async function assertManualOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: ResolvedSale,
) {
  const [costAccount, incomeAccount, incomeCategory, expenseCategory, productType] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id")
        .eq("id", input.costAccountId)
        .maybeSingle(),
      supabase
        .from("accounts")
        .select("id")
        .eq("id", input.incomeAccountId)
        .maybeSingle(),
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
    ]);

  if (costAccount.error) throw new Error(costAccount.error.message);
  if (incomeAccount.error) throw new Error(incomeAccount.error.message);
  if (incomeCategory.error) throw new Error(incomeCategory.error.message);
  if (expenseCategory.error) throw new Error(expenseCategory.error.message);
  if (productType.error) throw new Error(productType.error.message);

  if (!costAccount.data) throw new Error("Akun Sumber tidak valid");
  if (!incomeAccount.data) throw new Error("Akun penerima tidak valid");
  if (!incomeCategory.data) throw new Error("Kategori penjualan tidak valid");
  if (!expenseCategory.data) throw new Error("Kategori modal tidak valid");
  if (!productType.data) throw new Error("Tipe produk tidak valid");
}

async function manualCreateSale(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: ResolvedSale,
) {
  await assertManualOwnership(supabase, input);

  // Modal Rp0 -> tidak ada arus keluar, expense tx dilewati (transactions.amount > 0).
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
        description: expenseDescription(input),
        transaction_date: input.saleDate,
      })
      .select("id")
      .single();

    if (expenseError || !expenseTx) {
      throw new Error(expenseError?.message ?? "Gagal mencatat modal penjualan.");
    }

    expenseTxId = (expenseTx as { id: string }).id;
  }

  const { data: incomeTx, error: incomeError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: "income",
      amount: input.sellAmount,
      account_id: input.incomeAccountId,
      category_id: input.incomeCategoryId,
      description: incomeDescription(input),
      transaction_date: input.saleDate,
    })
    .select("id")
    .single();

  if (incomeError || !incomeTx) {
    if (expenseTxId) {
      await supabase.from("transactions").delete().eq("id", expenseTxId);
    }
    throw new Error(incomeError?.message ?? "Gagal mencatat pemasukan penjualan.");
  }

  const incomeTxId = (incomeTx as { id: string }).id;

  const { error: saleError } = await supabase.from("sales").insert({
    user_id: userId,
    product_type_id: input.productTypeId,
    product_type_name_snapshot: input.productTypeName,
    sale_date: input.saleDate,
    cost_amount: input.costAmount,
    sell_amount: input.sellAmount,
    cost_account_id: input.costAccountId,
    income_account_id: input.incomeAccountId,
    income_category_id: input.incomeCategoryId,
    expense_category_id: input.expenseCategoryId,
    expense_transaction_id: expenseTxId,
    income_transaction_id: incomeTxId,
    customer_ref: nullIfEmpty(input.customerRef),
    description: nullIfEmpty(input.description),
  });

  if (saleError) {
    const createdIds = [expenseTxId, incomeTxId].filter(
      (id): id is string => Boolean(id),
    );
    if (createdIds.length > 0) {
      await supabase.from("transactions").delete().in("id", createdIds);
    }
    throw new Error(saleError.message);
  }
}

async function manualUpdateSale(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  saleId: string,
  input: ResolvedSale,
) {
  const { data: sale, error: fetchError } = await supabase
    .from("sales")
    .select("id, expense_transaction_id, income_transaction_id")
    .eq("id", saleId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!sale) {
    throw new Error("Data penjualan tidak ditemukan");
  }

  await assertManualOwnership(supabase, input);

  const row = sale as {
    expense_transaction_id: string | null;
    income_transaction_id: string | null;
  };

  let expenseTxId = row.expense_transaction_id;

  if (expenseTxId) {
    const { data: existingExpense } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", expenseTxId)
      .maybeSingle();

    if (!existingExpense) {
      expenseTxId = null;
    }
  }

  if (input.costAmount > 0) {
    if (expenseTxId) {
      const { error } = await supabase
        .from("transactions")
        .update({
          amount: input.costAmount,
          account_id: input.costAccountId,
          category_id: input.expenseCategoryId,
          description: expenseDescription(input),
          transaction_date: input.saleDate,
        })
        .eq("id", expenseTxId);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { data: newExpense, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          type: "expense",
          amount: input.costAmount,
          account_id: input.costAccountId,
          category_id: input.expenseCategoryId,
          description: expenseDescription(input),
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
    // Modal turun ke Rp0: hapus expense tx bila masih ada.
    await supabase.from("transactions").delete().eq("id", expenseTxId);
    expenseTxId = null;
  }

  let incomeTxId = row.income_transaction_id;

  if (incomeTxId) {
    const { data: existingIncome } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", incomeTxId)
      .maybeSingle();

    if (!existingIncome) {
      incomeTxId = null;
    }
  }

  if (incomeTxId) {
    const { error } = await supabase
      .from("transactions")
      .update({
        amount: input.sellAmount,
        account_id: input.incomeAccountId,
        category_id: input.incomeCategoryId,
        description: incomeDescription(input),
        transaction_date: input.saleDate,
      })
      .eq("id", incomeTxId);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { data: newIncome, error } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        type: "income",
        amount: input.sellAmount,
        account_id: input.incomeAccountId,
        category_id: input.incomeCategoryId,
        description: incomeDescription(input),
        transaction_date: input.saleDate,
      })
      .select("id")
      .single();

    if (error || !newIncome) {
      throw new Error(error?.message ?? "Gagal mencatat pemasukan penjualan.");
    }

    incomeTxId = (newIncome as { id: string }).id;
  }

  const { error: saleError } = await supabase
    .from("sales")
    .update({
      product_type_id: input.productTypeId,
      product_type_name_snapshot: input.productTypeName,
      sale_date: input.saleDate,
      cost_amount: input.costAmount,
      sell_amount: input.sellAmount,
      cost_account_id: input.costAccountId,
      income_account_id: input.incomeAccountId,
      income_category_id: input.incomeCategoryId,
      expense_category_id: input.expenseCategoryId,
      expense_transaction_id: expenseTxId,
      income_transaction_id: incomeTxId,
      customer_ref: nullIfEmpty(input.customerRef),
      description: nullIfEmpty(input.description),
    })
    .eq("id", saleId);

  if (saleError) {
    throw new Error(saleError.message);
  }
}

async function manualDeleteSale(
  supabase: Awaited<ReturnType<typeof createClient>>,
  saleId: string,
) {
  const { data: sale, error: fetchError } = await supabase
    .from("sales")
    .select("id, expense_transaction_id, income_transaction_id")
    .eq("id", saleId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!sale) {
    throw new Error("Data penjualan tidak ditemukan");
  }

  const row = sale as {
    expense_transaction_id: string | null;
    income_transaction_id: string | null;
  };

  // Kumpulkan income tx milik cicilan hutang (bila sale ini kredit) sebelum
  // FK CASCADE menghapus debts + payments. Abaikan bila tabel belum ada.
  let paymentTxIds: string[] = [];
  const { data: linkedDebt } = await supabase
    .from("debts")
    .select("id")
    .eq("sale_id", saleId)
    .maybeSingle();

  if (linkedDebt) {
    const { data: payments } = await supabase
      .from("debt_payments")
      .select("income_transaction_id")
      .eq("debt_id", (linkedDebt as { id: string }).id);

    paymentTxIds = ((payments ?? []) as Array<{ income_transaction_id: string | null }>)
      .map((p) => p.income_transaction_id)
      .filter((id): id is string => Boolean(id));
  }

  const { error: deleteSaleError } = await supabase
    .from("sales")
    .delete()
    .eq("id", saleId);

  if (deleteSaleError) {
    throw new Error(deleteSaleError.message);
  }

  const linkedIds = [row.expense_transaction_id, row.income_transaction_id, ...paymentTxIds].filter(
    (id): id is string => Boolean(id),
  );

  if (linkedIds.length > 0) {
    const { error: deleteTxError } = await supabase
      .from("transactions")
      .delete()
      .in("id", linkedIds);

    if (deleteTxError) {
      throw new Error(deleteTxError.message);
    }
  }
}

// ---------- Public actions: penjualan ----------

export async function createSaleAction(
  values: SaleInput,
): Promise<MutationState> {
  const parsed = saleSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data penjualan tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const input = await resolveSaleInput(supabase, parsed.data);

    const { error } = await supabase.rpc("create_sale", {
      p_product_type_id: input.productTypeId,
      p_product_type_name_snapshot: input.productTypeName,
      p_sale_date: input.saleDate,
      p_cost_amount: input.costAmount,
      p_sell_amount: input.sellAmount,
      p_cost_account_id: input.costAccountId,
      p_income_account_id: input.incomeAccountId,
      p_income_category_id: input.incomeCategoryId,
      p_expense_category_id: input.expenseCategoryId,
      p_customer_ref: nullIfEmpty(input.customerRef),
      p_description: nullIfEmpty(input.description),
    });

    if (error) {
      if (isMissingRpcError(error.message)) {
        await manualCreateSale(supabase, userId, input);
      } else {
        return errorState(mapSaleError(error.message));
      }
    }

    revalidateSalesPages();

    return successState("Penjualan berhasil dicatat.");
  } catch (error) {
    return errorState(
      error instanceof Error ? mapSaleError(error.message) : "Gagal mencatat penjualan.",
    );
  }
}

export async function updateSaleAction(
  saleId: string,
  values: SaleInput,
): Promise<MutationState> {
  const parsed = saleSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data penjualan tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const input = await resolveSaleInput(supabase, parsed.data);

    const { error } = await supabase.rpc("update_sale", {
      p_sale_id: saleId,
      p_product_type_id: input.productTypeId,
      p_product_type_name_snapshot: input.productTypeName,
      p_sale_date: input.saleDate,
      p_cost_amount: input.costAmount,
      p_sell_amount: input.sellAmount,
      p_cost_account_id: input.costAccountId,
      p_income_account_id: input.incomeAccountId,
      p_income_category_id: input.incomeCategoryId,
      p_expense_category_id: input.expenseCategoryId,
      p_customer_ref: nullIfEmpty(input.customerRef),
      p_description: nullIfEmpty(input.description),
    });

    if (error) {
      if (isMissingRpcError(error.message)) {
        await manualUpdateSale(supabase, userId, saleId, input);
      } else {
        return errorState(mapSaleError(error.message));
      }
    }

    revalidateSalesPages();

    return successState("Penjualan berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error
        ? mapSaleError(error.message)
        : "Gagal memperbarui penjualan.",
    );
  }
}

export async function deleteSaleAction(saleId: string) {
  const { supabase } = await getCurrentUserContext();

  const { error } = await supabase.rpc("delete_sale", { p_sale_id: saleId });

  if (error) {
    if (isMissingRpcError(error.message)) {
      await manualDeleteSale(supabase, saleId);
    } else {
      throw new Error(mapSaleError(error.message));
    }
  }

  revalidateSalesPages();
}

/** Hapus baris sales yatim (salah satu transaksi ter-link sudah dihapus manual). */
export async function cleanupOrphanSaleAction(saleId: string) {
  const { supabase } = await getCurrentUserContext();

  // Bersihkan dulu income tx cicilan yang masih ada (bila sale ini kredit).
  const { data: linkedDebt } = await supabase
    .from("debts")
    .select("id")
    .eq("sale_id", saleId)
    .maybeSingle();

  if (linkedDebt) {
    const { data: payments } = await supabase
      .from("debt_payments")
      .select("income_transaction_id")
      .eq("debt_id", (linkedDebt as { id: string }).id);

    const paymentTxIds = ((payments ?? []) as Array<{ income_transaction_id: string | null }>)
      .map((p) => p.income_transaction_id)
      .filter((id): id is string => Boolean(id));

    if (paymentTxIds.length > 0) {
      await supabase.from("transactions").delete().in("id", paymentTxIds);
    }
  }

  const { error } = await supabase.from("sales").delete().eq("id", saleId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateSalesPages();
}

// ---------- Public actions: tipe produk ----------

function mapProductTypeError(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("duplicate") ||
    lower.includes("product_types_user_id_name_unique_idx")
  ) {
    return "Tipe produk sudah ada.";
  }

  return message;
}

export async function createProductTypeAction(
  values: ProductTypeInput,
): Promise<ProductTypeMutationState> {
  const parsed = productTypeSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data tipe produk tidak valid.",
    );
  }

  try {
    const { supabase, userId } = await getCurrentUserContext();
    const { data, error } = await supabase
      .from("product_types")
      .insert({
        user_id: userId,
        name: parsed.data.name,
        is_builtin: false,
        is_active: parsed.data.isActive ?? true,
      })
      .select("id")
      .single();

    if (error || !data) {
      return errorState(mapProductTypeError(error?.message ?? "Gagal membuat tipe produk."));
    }

    revalidatePath("/sales");
    revalidatePath("/debts");

    return { status: "success", message: "Tipe produk berhasil ditambahkan.", id: (data as { id: string }).id };
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal membuat tipe produk.",
    );
  }
}

export async function updateProductTypeAction(
  productTypeId: string,
  values: ProductTypeInput,
): Promise<MutationState> {
  const parsed = productTypeSchema.safeParse(values);

  if (!parsed.success) {
    return errorState(
      parsed.error.issues[0]?.message ?? "Data tipe produk tidak valid.",
    );
  }

  try {
    const { supabase } = await getCurrentUserContext();
    const { error } = await supabase
      .from("product_types")
      .update({
        name: parsed.data.name,
        is_active: parsed.data.isActive ?? true,
      })
      .eq("id", productTypeId);

    if (error) {
      return errorState(mapProductTypeError(error.message));
    }

    revalidatePath("/sales");
    revalidatePath("/debts");

    return successState("Tipe produk berhasil diperbarui.");
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Gagal memperbarui tipe produk.",
    );
  }
}

export async function deleteProductTypeAction(productTypeId: string) {
  const { supabase } = await getCurrentUserContext();

  const { data: row, error: fetchError } = await supabase
    .from("product_types")
    .select("is_builtin")
    .eq("id", productTypeId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (!row) {
    throw new Error("Tipe produk tidak ditemukan.");
  }
  if ((row as { is_builtin: boolean }).is_builtin) {
    throw new Error("Tipe bawaan tidak bisa dihapus, hanya bisa dinonaktifkan.");
  }

  // Riwayat penjualan dipertahankan (product_type_id SET NULL + snapshot nama).
  const { error } = await supabase.from("product_types").delete().eq("id", productTypeId);

  if (error) {
    throw new Error(mapProductTypeError(error.message));
  }

  revalidatePath("/sales");
  revalidatePath("/debts");
}
