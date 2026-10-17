import type { AccountInput } from "@/lib/validations/accounts";
import type { CategoryInput } from "@/lib/validations/categories";
import type { BudgetInput } from "@/lib/validations/budgets";
import type { DailyAllowanceInput } from "@/lib/validations/daily-allowances";
import type { SavingsGoalInput } from "@/lib/validations/savings-goals";
import type { TransactionInput } from "@/lib/validations/transactions";
import type { ProductTypeInput } from "@/lib/validations/product-types";
import type { SaleInput } from "@/lib/validations/sales";
import type { CustomerInput } from "@/lib/validations/customers";
import type { CreditSaleInput, PaymentInput } from "@/lib/validations/debts";

export type MutationState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export type AccountFormValues = AccountInput;
export type CategoryFormValues = CategoryInput;
export type BudgetFormValues = BudgetInput;
export type DailyAllowanceFormValues = DailyAllowanceInput;
export type SavingsGoalFormValues = SavingsGoalInput;
export type TransactionFormValues = TransactionInput;
export type ProductTypeFormValues = ProductTypeInput;
export type SaleFormValues = SaleInput;
export type CustomerFormValues = CustomerInput;
export type CreditSaleFormValues = CreditSaleInput;
export type PaymentFormValues = PaymentInput;
