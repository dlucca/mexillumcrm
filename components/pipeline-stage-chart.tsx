"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { GROUP_COLORS, type StageBucket } from "@/lib/dashboard";
import { formatMXN } from "@/lib/project-pipeline";

const chartConfig = { totalValue: { label: "Valor" } } satisfies ChartConfig;

export function PipelineStageChart({ stages }: { stages: StageBucket[] }) {
  const router = useRouter();
  return (
    <ChartContainer config={chartConfig} className="h-[360px] w-full">
      <BarChart accessibilityLayer data={stages} layout="vertical" margin={{ left: 8, right: 16 }}>
        <YAxis
          type="category"
          dataKey="label"
          width={130}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
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
          onClick={(_, index) => router.push(`/pipeline?stage=${stages[index].stage}`)}
        >
          {stages.map((s) => (
            <Cell key={s.stage} fill={GROUP_COLORS[s.group] ?? "var(--pipe-1)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
