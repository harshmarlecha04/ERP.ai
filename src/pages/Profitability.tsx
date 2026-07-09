import React, { useState } from "react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, TrendingUp, AlertTriangle, Download, Calendar } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useProfitabilityMetrics } from "@/hooks/useProfitabilityMetrics";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";

export default function Profitability() {
  const { currentUserRoles } = useUserRoles();
  const { metrics, isLoading } = useProfitabilityMetrics();
  const [dateRange, setDateRange] = useState("this-month");

  const isAdmin = currentUserRoles?.role === 'admin';
  const isProductionManager = currentUserRoles?.role === 'production_manager';

  // Access control
  if (!isAdmin && !isProductionManager) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to view profitability data. This page is only accessible to administrators and production managers.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  // Prepare chart data
  const pieChartData = [
    { name: 'Material', value: metrics.costBreakdown.material, color: 'hsl(var(--chart-1))' },
    { name: 'Labor', value: metrics.costBreakdown.labor, color: 'hsl(var(--chart-2))' },
    { name: 'Overhead', value: metrics.costBreakdown.overhead, color: 'hsl(var(--chart-3))' },
    { name: 'Packaging', value: metrics.costBreakdown.packaging, color: 'hsl(var(--chart-4))' }
  ];

  const formatCurrency = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profitability Dashboard</h1>
          <p className="text-muted-foreground">
            Cost analysis and variance tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="this-quarter">This Quarter</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Total COGS"
          value={formatCurrency(metrics.totalCOGS)}
          subtitle="This month • All products"
          icon={<DollarSign className="h-4 w-4" />}
          color="primary"
        />
        
        <MetricCard
          title="Avg Cost Per Unit"
          value={formatCurrency(metrics.avgCostPerUnit)}
          subtitle="Weighted average"
          icon={<TrendingUp className="h-4 w-4" />}
          color="success"
        />
        
        <MetricCard
          title="Gross Margin %"
          value={`${metrics.grossMarginPercent.toFixed(1)}%`}
          subtitle="Target: 45%"
          icon={<TrendingUp className="h-4 w-4" />}
          color="warning"
        />
        
        <MetricCard
          title="Total Cost Variance"
          value={formatCurrency(Math.abs(metrics.totalVariance))}
          subtitle={metrics.totalVariance < 0 ? "Over budget" : "Under budget"}
          icon={<AlertTriangle className="h-4 w-4" />}
          color={metrics.totalVariance < 0 ? "destructive" : "success"}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cost Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
            <CardDescription>Distribution by cost category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${((entry.value / metrics.totalCOGS) * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Material Costs</p>
                <p className="text-lg font-bold">{formatCurrency(metrics.costBreakdown.material)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Labor Costs</p>
                <p className="text-lg font-bold">{formatCurrency(metrics.costBreakdown.labor)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Overhead Costs</p>
                <p className="text-lg font-bold">{formatCurrency(metrics.costBreakdown.overhead)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Packaging Costs</p>
                <p className="text-lg font-bold">{formatCurrency(metrics.costBreakdown.packaging)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* COGS Trend Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>COGS Trend</CardTitle>
            <CardDescription>Monthly cost trend (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.cogsTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="material" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Material" />
                <Line type="monotone" dataKey="labor" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Labor" />
                <Line type="monotone" dataKey="overhead" stroke="hsl(var(--chart-3))" strokeWidth={2} name="Overhead" />
                <Line type="monotone" dataKey="packaging" stroke="hsl(var(--chart-4))" strokeWidth={2} name="Packaging" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Product Profitability Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Product Profitability</CardTitle>
          <CardDescription>Actual vs. Standard cost comparison by formula</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={metrics.productPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="formulaCode" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-semibold">{data.formulaName}</p>
                        <p className="text-sm text-muted-foreground">{data.batches} batches</p>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm">
                            <span className="text-muted-foreground">Actual:</span> {formatCurrency(data.actualCost)}
                          </p>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Standard:</span> {formatCurrency(data.standardCost)}
                          </p>
                          <p className={`text-sm font-semibold ${data.variance > 0 ? 'text-destructive' : 'text-success'}`}>
                            Variance: {formatCurrency(Math.abs(data.variance))} ({formatPercent(data.variancePercent)})
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Bar dataKey="actualCost" fill="hsl(var(--chart-1))" name="Actual Cost" />
              <Bar dataKey="standardCost" fill="hsl(var(--chart-2))" name="Standard Cost" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--chart-1))' }} />
                <span className="text-muted-foreground">Actual Cost</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
                <span className="text-muted-foreground">Standard Cost</span>
              </div>
            </div>
            <p className="text-muted-foreground">
              Total batches: {metrics.productPerformance.reduce((sum, p) => sum + p.batches, 0)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cost Variance Analysis Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Variance Analysis</CardTitle>
          <CardDescription>Detailed variance breakdown by formula</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Formula</TableHead>
                <TableHead className="text-center">Batches</TableHead>
                <TableHead className="text-right">Actual Cost</TableHead>
                <TableHead className="text-right">Standard Cost</TableHead>
                <TableHead className="text-right">Variance $</TableHead>
                <TableHead className="text-right">Variance %</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.costVariances.map((row) => (
                <TableRow key={row.formulaCode} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <p className="font-medium">{row.formulaCode}</p>
                      <p className="text-sm text-muted-foreground">{row.formulaName}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{row.batches}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(row.actualCost)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(row.standardCost)}</TableCell>
                  <TableCell className={`text-right font-mono ${row.varianceDollar > 0 ? 'text-destructive' : 'text-success'}`}>
                    {row.varianceDollar > 0 ? '+' : ''}{formatCurrency(row.varianceDollar)}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${row.variancePercent > 0 ? 'text-destructive' : 'text-success'}`}>
                    {formatPercent(row.variancePercent)}
                  </TableCell>
                  <TableCell className="text-center">
                    {Math.abs(row.variancePercent) > 10 ? (
                      <Badge variant="destructive">Critical</Badge>
                    ) : Math.abs(row.variancePercent) > 5 ? (
                      <Badge variant="secondary">Warning</Badge>
                    ) : (
                      <Badge variant="outline">Good</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
