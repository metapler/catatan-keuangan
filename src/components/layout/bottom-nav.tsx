"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  navItems,
  primaryNavItems,
  secondaryNavItems,
  type NavItem,
} from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

function BottomNavItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-medium transition-colors duration-150"
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full transition-colors duration-150",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground"
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <span className={cn(active ? "text-primary" : "text-muted-foreground")}>
        {item.label}
      </span>
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = secondaryNavItems.some((item) =>
    isActiveRoute(pathname, item.href)
  );

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch">
        {primaryNavItems.map((item) => (
          <BottomNavItem
            key={item.href}
            item={item}
            active={isActiveRoute(pathname, item.href)}
          />
        ))}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-medium"
            aria-expanded={moreOpen}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full transition-colors duration-150",
                moreActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
              )}
            >
              <Ellipsis className="size-[18px]" />
            </span>
            <span className={moreActive ? "text-primary" : "text-muted-foreground"}>
              Lainnya
            </span>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl px-3 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Menu lainnya</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-4 gap-1">
              {navItems.slice(4).map((item) => {
                const Icon = item.icon;
                const active = isActiveRoute(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-colors duration-150",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
