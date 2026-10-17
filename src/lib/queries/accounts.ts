import { createClient } from "@/lib/supabase/server";
import {
  calculateAccountBalances,
  type AccountBalanceSummary,
  type BalanceAccountRow as AccountRow,
  type BalanceTransactionRow as TransactionForBalance,
} from "@/lib/queries/aggregates";

export type AccountSummary = AccountBalanceSummary;

export async function getAccountsWithBalances() {
  const supabase = await createClient();

  const [
    {
      data: { user },
      error: authError,
    },
    accountsResult,
    transactionsResult,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("accounts")
      .select("id, name, type, initial_balance, is_active, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("id, type, account_id, from_account_id, to_account_id, amount")
      .order("transaction_date", { ascending: false }),
  ]);

  if (authError) {
    throw new Error(authError.message);
  }

  if (!user) {
    return {
      accounts: [] as AccountSummary[],
      totalBalance: 0,
    };
  }

  if (accountsResult.error) {
    throw new Error(accountsResult.error.message);
  }

  if (transactionsResult.error) {
    throw new Error(transactionsResult.error.message);
  }

  const accounts = (accountsResult.data ?? []) as AccountRow[];
  const transactions = (transactionsResult.data ?? []) as TransactionForBalance[];

  return calculateAccountBalances(accounts, transactions);
}

export async function getAccountById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, type, initial_balance, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AccountRow | null;
}
