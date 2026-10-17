import { accountTypes } from "@/lib/validations/accounts";

export type AccountTypeOption = {
  value: string;
  label: string;
  isBuiltin: boolean;
};

const BUILTIN_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank",
  ewallet: "E-Wallet",
  savings: "Savings",
  crypto: "Crypto",
  hutang: "Hutang",
};

export const BUILTIN_ACCOUNT_TYPE_OPTIONS: AccountTypeOption[] = accountTypes.map(
  (value) => ({
    value,
    label: BUILTIN_LABELS[value] ?? value,
    isBuiltin: true,
  }),
);

export function isBuiltinAccountType(value: string): boolean {
  return (accountTypes as readonly string[]).includes(value);
}

export function accountTypeLabel(value: string): string {
  const builtin = BUILTIN_ACCOUNT_TYPE_OPTIONS.find(
    (option) => option.value === value,
  );
  if (builtin) return builtin.label;
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Katalog opsi tipe akun = 6 tipe bawaan + tipe custom distinct yang sudah
 * dipakai akun. Dedupe case-insensitive agar "Bank" tidak dobel dengan "bank".
 */
export function buildAccountTypeCatalog(
  usedTypes: readonly string[],
): AccountTypeOption[] {
  const catalog = [...BUILTIN_ACCOUNT_TYPE_OPTIONS];
  const seen = new Set(catalog.map((option) => option.value.toLowerCase()));

  for (const raw of usedTypes) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    catalog.push({ value, label: accountTypeLabel(value), isBuiltin: false });
  }

  return catalog;
}
