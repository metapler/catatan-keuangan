export function CategoryColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3 rounded-full shadow-sm ring-1 ring-black/10 dark:ring-white/10"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}
