import Link from "next/link";
import { ChevronRight, House } from "lucide-react";

type PageBreadcrumbProps = {
  pathname: string;
};

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  accounts: "Akun",
  categories: "Kategori",
  transactions: "Transaksi",
  sales: "Penjualan",
  debts: "Hutang",
  budgets: "Anggaran",
  "savings-goals": "Tabungan",
  settings: "Pengaturan",
};

export function PageBreadcrumb({ pathname }: PageBreadcrumbProps) {
  const segments = pathname.split("/").filter(Boolean);

  const routeItems = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;

    return {
      href,
      label: routeLabels[segment] ?? segment,
    };
  });
  const items = [
    { href: "/dashboard", label: routeLabels.dashboard },
    ...routeItems.filter((item) => item.href !== "/dashboard"),
  ];

  return (
    <nav
      aria-label="Jejak navigasi"
      className="min-w-0 overflow-x-auto text-xs text-muted-foreground"
    >
      <ol className="flex items-center gap-1">
        {items.map((item, index) => (
          <li key={item.href} className="inline-flex shrink-0 items-center gap-1">
            {index > 0 ? (
              <ChevronRight aria-hidden="true" className="size-3 text-muted-foreground" />
            ) : null}
            {index === items.length - 1 ? (
              <span
                aria-current="page"
                className="inline-flex items-center gap-1.5 px-1.5 py-0.5 font-medium text-foreground"
              >
                {index === 0 ? <House aria-hidden="true" className="size-3" /> : null}
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors duration-150 hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {index === 0 ? <House aria-hidden="true" className="size-3" /> : null}
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
