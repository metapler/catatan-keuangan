"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "system", label: "Sistem", icon: Monitor },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Tema tampilan"
      className={cn("grid grid-cols-3 gap-1 rounded-lg bg-muted p-1", className)}
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const isActive = mounted && theme === option.value;

        return (
          <Button
            key={option.value}
            variant="ghost"
            size="sm"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(option.value)}
            className={cn(
              "h-7 gap-1 rounded-md px-2 text-xs transition-[background-color,box-shadow,color] duration-150",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
