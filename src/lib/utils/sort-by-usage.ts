/**
 * Helper pengurutan opsi dropdown berdasarkan frekuensi pemakaian.
 *
 * Aturan: urutkan murni by usage count DESC. Seri (count sama, termasuk 0)
 * mempertahankan urutan asal (stable sort, tanpa tie-breaker nama).
 */

export type UsageCount = Record<string, number>;

/** Hitung jumlah pemakaian per id dari daftar id (null/undefined diabaikan). */
export function buildUsageCount(
  ids: Array<string | null | undefined>,
): UsageCount {
  const usage: UsageCount = {};

  for (const id of ids) {
    if (!id) continue;
    usage[id] = (usage[id] ?? 0) + 1;
  }

  return usage;
}

/**
 * Urutkan items by usage DESC (stable).
 * Tanpa `usage`, kembalikan salinan dengan urutan asal.
 */
export function sortByUsageDesc<T>(
  items: readonly T[],
  getId: (item: T) => string,
  usage?: UsageCount | null,
): T[] {
  if (!usage) return [...items];

  return [...items].sort(
    (a, b) => (usage[getId(b)] ?? 0) - (usage[getId(a)] ?? 0),
  );
}
