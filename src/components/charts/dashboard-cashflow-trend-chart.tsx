"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useChartTheme } from "@/components/charts/chart-theme";
import {
  formatCompactCurrencyIDR,
  formatCurrencyIDR,
} from "@/lib/utils/format";

type TrendPoint = {
  label: string;
  net: number;
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-md">
      <p className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Arus kas net:</span>
        <span className="font-semibold text-foreground tabular-nums">
          {formatCurrencyIDR(payload[0].value)}
        </span>
      </div>
    </div>
  );
};

export function DashboardCashflowTrendChart({
  data,
}: {
  data: TrendPoint[];
}) {
  const colors = useChartTheme();

  return (
    <div className="h-[200px] w-full focus:outline-none [&_svg]:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="cashflowGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.primary} stopOpacity={0.25} />
              <stop offset="95%" stopColor={colors.primary} stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="net"
            stroke={colors.primary}
            fill="url(#cashflowGradient)"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: colors.primary,
              stroke: colors.background,
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
