"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { GROUP_COLORS } from "@/lib/dashboard";
import { formatMXN } from "@/lib/project-pipeline";

type Col = { group: string; label: string; count: number; totalValue: number };
const chartConfig = { totalValue: { label: "Valor" } } satisfies ChartConfig;

export function PipelineGroupChart({ columns }: { columns: Col[] }) {
  const router = useRouter();
  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <BarChart accessibilityLayer data={columns} layout="vertical" margin={{ left: 8, right: 16 }}>
        <YAxis
          type="category"
          dataKey="label"
          width={96}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
        />
        <XAxis type="number" hide />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(_v, _n, item) =>
                `${item.payload.count} · ${formatMXN(item.payload.totalValue)}`
              }
            />
          }
        />
        <Bar
          dataKey="totalValue"
          radius={4}
          cursor="pointer"
          onClick={(_, index) => router.push(`/pipeline?group=${columns[index].group}`)}
        >
          {columns.map((c) => (
            <Cell key={c.group} fill={GROUP_COLORS[c.group] ?? "var(--pipe-1)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
