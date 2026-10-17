import {
  ArrowRightLeft,
  ChartColumnBig,
  FolderKanban,
  HandCoins,
  LayoutDashboard,
  PiggyBank,
  ShoppingCart,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transaksi", icon: ArrowRightLeft },
  { href: "/sales", label: "Penjualan", icon: ShoppingCart },
  { href: "/debts", label: "Hutang", icon: HandCoins },
  { href: "/accounts", label: "Akun", icon: WalletCards },
  { href: "/categories", label: "Kategori", icon: FolderKanban },
  { href: "/budgets", label: "Anggaran", icon: ChartColumnBig },
  { href: "/savings-goals", label: "Tabungan", icon: PiggyBank },
];

/** First four items shown directly in the mobile bottom bar. */
export const primaryNavItems = navItems.slice(0, 4);

/** Remaining items, reachable via "Lainnya" on mobile. */
export const secondaryNavItems = navItems.slice(4);
