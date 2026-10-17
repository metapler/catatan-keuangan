export function formatThousand(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return "";
  }

  return Math.trunc(Math.abs(value)).toLocaleString("id-ID");
}

export function parseDisplayToNumber(display: string): number {
  const digits = display.replace(/\D/g, "").slice(0, 15);
  return digits ? Number(digits) : 0;
}

export function displayFromNumber(value: number): string {
  return formatThousand(value);
}

export function multiplyDisplayByThousand(display: string): {
  numeric: number;
  display: string;
} {
  const numeric = parseDisplayToNumber(display) * 1000;
  return { numeric, display: numeric > 0 ? formatThousand(numeric) : "" };
}
