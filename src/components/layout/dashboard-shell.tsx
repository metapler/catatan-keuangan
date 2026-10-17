/* eslint-disable @next/next/no-img-element -- 28px favicon, Image optimizer not worth it */

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { PageBreadcrumb } from "@/components/layout/page-breadcrumb";
import { UserMenu } from "@/components/layout/user-menu";
import { navItems, type NavItem } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  userEmail?: string | null;
  children: ReactNode;
};

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

function SidebarNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = isActiveRoute(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export function DashboardShell({ userEmail, children }: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-svh w-full bg-background">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar lg:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-border/60 px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground transition-opacity duration-150 hover:opacity-80"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 p-1">
              <img src="/favicon.svg" alt="Catatan Keuangan" className="size-full" />
            </span>
            Catatan Keuangan
          </Link>
        </div>

        <nav aria-label="Navigasi utama" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {navItems.map((item) => (
            <SidebarNavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="border-t border-border/60 p-3">
          <UserMenu userEmail={userEmail} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-5 supports-[backdrop-filter]:bg-background/60 lg:px-6">
          <Link
            href="/dashboard"
            aria-label="Dashboard"
            className="flex items-center lg:hidden"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 p-1">
              <img src="/favicon.svg" alt="" className="size-full" />
            </span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center">
            <PageBreadcrumb pathname={pathname} />
          </div>
          <div className="lg:hidden">
            <UserMenu userEmail={userEmail} />
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-5 lg:px-6 lg:py-6 lg:pb-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
