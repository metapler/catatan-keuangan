"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useChartTheme } from "@/components/charts/chart-theme";
import { formatCurrencyIDR } from "@/lib/utils/format";
import { formatCompactCurrencyIDR } from "@/lib/utils/format";

type ChartPoint = {
  label: string;
  income: number;
  expense: number;
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload) return null;

  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-md">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5 text-xs">
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground tabular-nums">
            {formatCurrencyIDR(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export function DashboardMonthlyComparisonChart({
  data,
}: {
  data: ChartPoint[];
}) {
  const colors = useChartTheme();

  return (
    <div className="h-[200px] w-full focus:outline-none [&_svg]:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={3} barCategoryGap="20%">
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={colors.border}
            opacity={0.5}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: colors.mutedForeground }}
            dy={6}
          />
          <YAxis
            tickFormatter={(value) =>
              formatCompactCurrencyIDR(Number(value ?? 0))
            }
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fontSize: 10, fill: colors.mutedForeground }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: colors.border, fillOpacity: 0.3 }} />
          <Legend
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          <Bar
            dataKey="income"
            name="Pemasukan"
            fill={colors.income}
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
          <Bar
            dataKey="expense"
            name="Pengeluaran"
            fill={colors.expense}
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
