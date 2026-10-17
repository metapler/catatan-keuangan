"use client";

import { Menu } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type MobileNavProps = {
    navContent: React.ReactNode;
};

export function MobileNav({ navContent }: MobileNavProps) {
    return (
        <Sheet>
            <SheetTrigger
                className={cn(
                    "inline-flex items-center justify-center rounded-lg border border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0 h-8 w-8 cursor-pointer"
                )}
            >
                <Menu className="size-4" />
                <span className="sr-only">Toggle navigation menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] p-0">
                <SheetHeader className="sr-only">
                    <SheetTitle>Menu Navigasi</SheetTitle>
                </SheetHeader>
                {navContent}
            </SheetContent>
        </Sheet>
    );
}
