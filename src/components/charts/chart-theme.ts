"use client";

import { useTheme } from "next-themes";

/**
 * Literal mirrors of the globals.css tokens. Recharts passes colors as SVG
 * presentation attributes, where CSS var() does not resolve — so charts read
 * the resolved values for the active theme instead.
 */
export const chartPalettes = {
  light: {
    primary: "#4f46e5",
    background: "#fafafa",
    card: "#ffffff",
    border: "#e4e4e7",
    mutedForeground: "#71717a",
    income: "#059669",
    expense: "#e11d48",
    transfer: "#2563eb",
    chart1: "#4f46e5",
    chart2: "#f59e0b",
    chart3: "#10b981",
    chart4: "#ec4899",
    chart5: "#8b5cf6",
  },
  dark: {
    primary: "#6366f1",
    background: "#0a0a0a",
    card: "#131316",
    border: "#27272a",
    mutedForeground: "#a1a1aa",
    income: "#34d399",
    expense: "#fb7185",
    transfer: "#60a5fa",
    chart1: "#818cf8",
    chart2: "#fbbf24",
    chart3: "#34d399",
    chart4: "#f472b6",
    chart5: "#a78bfa",
  },
} as const;

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? chartPalettes.dark : chartPalettes.light;
}
