import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart } from "recharts";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendDataPoint {
  date: string;
  displayDate: string;
  batches: number;
  bottles: number;
}

interface ProductionTrendChartProps {
  data: TrendDataPoint[];
  loading?: boolean;
  title?: string;
  description?: string;
}

const chartConfig = {
  batches: {
    label: "Batches",
    color: "hsl(var(--chart-1))",
  },
  bottles: {
    label: "Bottles (K)",
    color: "hsl(var(--chart-2))",
  },
};

export function ProductionTrendChart({ 
  data, 
  loading = false,
  title = "Production Trends",
  description = "Last 30 days overview"
}: ProductionTrendChartProps) {
  // Calculate trend percentage
  const calculateTrend = () => {
    if (data.length < 2) return { value: 0, isPositive: true };
    const recent = data.slice(-7).reduce((sum, d) => sum + d.batches, 0);
    const previous = data.slice(-14, -7).reduce((sum, d) => sum + d.batches, 0);
    if (previous === 0) return { value: 0, isPositive: true };
    const change = ((recent - previous) / previous) * 100;
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  const trend = calculateTrend();
  const TrendIcon = trend.isPositive ? TrendingUp : TrendingDown;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] bg-muted animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        {data.length >= 14 && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
            trend.isPositive 
              ? "bg-success/10 text-success" 
              : "bg-destructive/10 text-destructive"
          )}>
            <TrendIcon className="h-3 w-3" />
            {trend.value.toFixed(1)}% vs last week
          </div>
        )}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground text-sm">No production data available</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorBatches" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBottles" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="displayDate" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  yAxisId="left"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="batches"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#colorBatches)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="bottles"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  fill="url(#colorBottles)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
