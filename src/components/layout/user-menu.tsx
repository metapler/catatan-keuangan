"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";

import { logoutAction } from "@/app/(dashboard)/actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuProps = {
  userEmail?: string | null;
};

export function UserMenu({ userEmail }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          <UserRound className="size-3.5" />
          Akun
        </span>
        <ChevronDown className="size-3 transition-transform duration-150" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium break-all text-foreground">
            {userEmail ?? "Pengguna"}
          </p>
        </div>
        <DropdownMenuSeparator />
        <div className="p-1.5">
          <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">
            Tema
          </p>
          <ThemeToggle className="w-full" />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings className="size-3.5" />
          Pengaturan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction} className="w-full">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-destructive outline-none transition-colors duration-150 hover:bg-destructive/5 focus:bg-destructive/5"
          >
            <LogOut className="size-3.5" />
            Keluar
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
