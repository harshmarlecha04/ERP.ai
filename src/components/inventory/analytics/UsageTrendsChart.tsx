import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { UsageTrendData } from "@/hooks/useRawMaterialAnalytics";
import { format, parseISO } from "date-fns";

interface UsageTrendsChartProps {
  data: UsageTrendData[];
}

const chartConfig = {
  kg_used: {
    label: "KG Used",
    color: "hsl(var(--chart-1))",
  },
  batches: {
    label: "Batches",
    color: "hsl(var(--chart-2))",
  },
};

export function UsageTrendsChart({ data }: UsageTrendsChartProps) {
  const formattedData = data.map(item => ({
    ...item,
    displayDate: format(parseISO(item.date), 'MMM d'),
    kg_used: item.total_kg_used,
    batches: item.batch_count
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Trends</CardTitle>
        <CardDescription>Material consumption over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="displayDate" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                yAxisId="left"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                label={{ value: 'KG', angle: -90, position: 'insideLeft' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                label={{ value: 'Batches', angle: 90, position: 'insideRight' }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="kg_used" 
                stroke="var(--color-kg_used)" 
                strokeWidth={2}
                dot={{ fill: "var(--color-kg_used)" }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="batches" 
                stroke="var(--color-batches)" 
                strokeWidth={2}
                dot={{ fill: "var(--color-batches)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
