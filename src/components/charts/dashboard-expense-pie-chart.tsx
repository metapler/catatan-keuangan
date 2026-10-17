"use client";

import React, { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { useChartTheme } from "@/components/charts/chart-theme";
import { formatCurrencyIDR } from "@/lib/utils/format";

/** Palet warna yang jelas dan mudah dibedakan antar kategori */
const PALETTE = [
  "#f43f5e", // rose-500
  "#f97316", // orange-500
  "#eab308", // yellow-500
  "#84cc16", // lime-500
  "#10b981", // emerald-500
  "#06b6d4", // cyan-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#d946ef", // fuchsia-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
];

type PiePoint = {
  name: string;
  value: number;
  color?: string;
};

type SliceLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
};

const RADIAN = Math.PI / 180;

/** Label persentase di tengah setiap slice; diabaikan jika < 5% agar tidak berantakan */
function SliceLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: SliceLabelProps) {
  if (percent === undefined || percent < 0.05) return null;
  if (
    cx === undefined ||
    cy === undefined ||
    midAngle === undefined ||
    innerRadius === undefined ||
    outerRadius === undefined
  ) {
    return null;
  }

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-[10px] font-bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { color: string; percent: number };
  }>;
}) => {
  if (!active || !payload || !payload.length) return null;

  const entry = payload[0];
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-md">
      <div className="flex items-center gap-1.5 text-xs">
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: entry.payload.color }}
        />
        <span className="text-muted-foreground">{entry.name}:</span>
        <span className="font-semibold text-foreground tabular-nums">
          {formatCurrencyIDR(entry.value)}
        </span>
        <span className="text-muted-foreground tabular-nums">
          ({(entry.payload.percent * 100).toFixed(1)}%)
        </span>
      </div>
    </div>
  );
};

export function DashboardExpensePieChart({
  data,
}: {
  data: PiePoint[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const colors = useChartTheme();
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  const chartData = data.map((entry, index) => ({
    ...entry,
    pieIndex: index,
    color: PALETTE[index % PALETTE.length],
    percent: total > 0 ? entry.value / total : 0,
  }));

  return (
    <div className="relative h-[220px] w-full focus:outline-none [&_svg]:focus:outline-none [&_*]:focus-visible:ring-0 [&_*]:focus-visible:ring-offset-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={68}
            outerRadius={(entry: { pieIndex?: number }) =>
              entry?.pieIndex === activeIndex ? 98 : 92
            }
            paddingAngle={4}
            cornerRadius={8}
            stroke={colors.card}
            strokeWidth={2}
            isAnimationActive
            animationDuration={800}
            animationEasing="ease-out"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
            label={SliceLabel as never}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                opacity={activeIndex === undefined || activeIndex === index ? 1 : 0.4}
                style={{ transition: "opacity 200ms", cursor: "pointer" }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="max-w-[130px] text-center">
          <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
          <p className="truncate text-sm font-bold tracking-tight tabular-nums">
            {formatCurrencyIDR(total)}
          </p>
        </div>
      </div>
    </div>
  );
}