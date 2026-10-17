const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const dateFormatters = {
  short: new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }),
  monthYear: new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
  }),
};

export function formatCurrencyIDR(value: number) {
  return currencyFormatter.format(value);
}

/** e.g. "Rp 1,2 jt" — for chart axes and tight spaces. */
export function formatCompactCurrencyIDR(value: number) {
  return `Rp ${compactCurrencyFormatter.format(value)}`;
}

export function formatDateID(
  value: string | number | Date,
  variant: keyof typeof dateFormatters = "short",
) {
  return dateFormatters[variant].format(new Date(value));
}
