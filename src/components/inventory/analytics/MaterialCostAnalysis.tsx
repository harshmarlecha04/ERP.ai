import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts";
import { SupplierCostAnalysis } from "@/hooks/useRawMaterialAnalytics";
import { DollarSign } from "lucide-react";

interface MaterialCostAnalysisProps {
  supplierData: SupplierCostAnalysis[];
  totalCost: number;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function MaterialCostAnalysis({ supplierData, totalCost }: MaterialCostAnalysisProps) {
  const chartData = supplierData.slice(0, 5).map((supplier, index) => ({
    name: supplier.supplier,
    value: supplier.total_cost,
    color: COLORS[index % COLORS.length],
    percentage: totalCost > 0 ? ((supplier.total_cost / totalCost) * 100).toFixed(1) : 0
  }));

  const chartConfig = supplierData.slice(0, 5).reduce((acc, supplier, index) => {
    acc[supplier.supplier] = {
      label: supplier.supplier,
      color: COLORS[index % COLORS.length],
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Cost Analysis by Supplier
        </CardTitle>
        <CardDescription>Top suppliers by material spend</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Material Cost</p>
            <p className="text-3xl font-bold">${totalCost.toFixed(2)}</p>
          </div>

          {chartData.length > 0 ? (
            <>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid gap-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium">{data.name}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">Cost:</span>
                                  <span className="text-sm font-bold">${Number(data.value).toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">Percentage:</span>
                                  <span className="text-sm font-bold">{data.percentage}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>

              <div className="space-y-2">
                {chartData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">${Number(item.value).toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground">({item.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">
              No cost data available for this period
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
