import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, Droplets, Package, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { formatET } from "@/utils/dateUtils";

interface YieldData {
  scheduleItemId: string;
  formulaCode: string;
  formulaName: string;
  scheduleDate: string;
  bottlesPacked: number;
  bottleSize: number;
  actualGummiesProduced: number | null;
  wetWeightKg: number | null;
  avgWetPieceWeightG: number | null;
  moistureLossPercent: number | null;
  yieldPercent: number | null;
}

export const YieldAnalytics = () => {
  const [yieldData, setYieldData] = useState<YieldData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchYieldData();
  }, []);

  const fetchYieldData = async () => {
    try {
      const { data, error } = await supabase
        .from("production_schedule_items")
        .select(`
          id,
          formula_code,
          batches,
          bottles_packed,
          actual_gummies_produced,
          actual_yield_kg,
          avg_wet_piece_weight_g,
          moisture_loss_percent,
          yield_variance_percent,
          production_schedules!inner(schedule_date)
        `)
        .not("bottles_packed", "is", null)
        .order("production_schedules(schedule_date)", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Transform and calculate moisture loss
      const processedData: YieldData[] = data.map((item: any) => {
        const bottlesPacked = item.bottles_packed || 0;
        const actualGummiesProduced = item.actual_gummies_produced || 0;
        const wetWeightKg = item.actual_yield_kg || 0;
        const avgWetPieceWeightG = item.avg_wet_piece_weight_g || 3.5;

        // Assume 60 count bottles if not specified
        const bottleSize = 60;
        const gummiesPacked = bottlesPacked * bottleSize;

        let moistureLossPercent = item.moisture_loss_percent;
        let yieldPercent = item.yield_variance_percent;

        // Backward calculation if weigh-up data missing
        if (!moistureLossPercent && bottlesPacked > 0) {
          const estimatedWetWeight = gummiesPacked * avgWetPieceWeightG / 1000;
          const estimatedDriedWeight = gummiesPacked * 2.9 / 1000;
          moistureLossPercent = ((estimatedWetWeight - estimatedDriedWeight) / estimatedWetWeight) * 100;
        }

        // Calculate true yield if weigh-up data exists
        if (actualGummiesProduced > 0 && gummiesPacked > 0) {
          yieldPercent = (gummiesPacked / actualGummiesProduced) * 100;
        }

        return {
          scheduleItemId: item.id,
          formulaCode: item.formula_code,
          formulaName: "", // Could join with formulas table
          scheduleDate: item.production_schedules?.schedule_date || "",
          bottlesPacked,
          bottleSize,
          actualGummiesProduced,
          wetWeightKg,
          avgWetPieceWeightG,
          moistureLossPercent: moistureLossPercent ? parseFloat(moistureLossPercent.toFixed(2)) : null,
          yieldPercent: yieldPercent ? parseFloat(yieldPercent.toFixed(2)) : null,
        };
      });

      setYieldData(processedData);
    } catch (error) {
      console.error("Error fetching yield data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate average moisture loss
  const avgMoistureLoss = yieldData.length > 0
    ? yieldData
        .filter(d => d.moistureLossPercent !== null)
        .reduce((sum, d) => sum + (d.moistureLossPercent || 0), 0) / 
        yieldData.filter(d => d.moistureLossPercent !== null).length
    : 0;

  // Calculate average yield
  const avgYield = yieldData.length > 0
    ? yieldData
        .filter(d => d.yieldPercent !== null)
        .reduce((sum, d) => sum + (d.yieldPercent || 0), 0) / 
        yieldData.filter(d => d.yieldPercent !== null).length
    : 0;

  // Prepare chart data
  const chartData = yieldData
    .filter(d => d.moistureLossPercent !== null)
    .slice(0, 20)
    .reverse()
    .map(d => ({
      date: new Date(d.scheduleDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      moistureLoss: d.moistureLossPercent,
      yield: d.yieldPercent,
      formula: d.formulaCode,
    }));

  // Find outliers
  const outliers = yieldData.filter(d => 
    d.moistureLossPercent && (d.moistureLossPercent > 25 || d.moistureLossPercent < 10)
  );

  if (loading) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-500" />
              Avg Moisture Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgMoistureLoss.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Typical range: 17-20%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-green-500" />
              Avg Yield
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgYield.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Target: 95%+ efficiency
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Outliers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outliers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Unusual moisture loss detected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Moisture Loss Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Moisture Loss & Yield Trend</CardTitle>
          <CardDescription>Historical tracking of moisture loss and yield percentage</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="moistureLoss" 
                stroke="hsl(var(--chart-1))" 
                name="Moisture Loss %" 
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="yield" 
                stroke="hsl(var(--chart-2))" 
                name="Yield %" 
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Outliers Table */}
      {outliers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Moisture Loss Outliers</CardTitle>
            <CardDescription>Batches with unusual moisture loss patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {outliers.map(item => (
                <div key={item.scheduleItemId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{item.formulaCode}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatET(item.scheduleDate, "M/d/yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.moistureLossPercent! > 25 ? "destructive" : "secondary"}>
                      {item.moistureLossPercent}% moisture loss
                    </Badge>
                    {item.moistureLossPercent! > 25 ? (
                      <TrendingUp className="h-4 w-4 text-destructive" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Batches */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Batch Details</CardTitle>
          <CardDescription>Latest 10 batches with packaging data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {yieldData.slice(0, 10).map(item => (
              <div key={item.scheduleItemId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{item.formulaCode}</p>
                    <Badge variant="outline" className="text-xs">
                      {formatET(item.scheduleDate, "M/d/yyyy")}
                    </Badge>
                  </div>
                  <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                    <span>Bottles: {item.bottlesPacked}</span>
                    {item.actualGummiesProduced && (
                      <span>Gummies: {item.actualGummiesProduced.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {item.moistureLossPercent && (
                    <Badge variant="secondary">
                      {item.moistureLossPercent}% moisture
                    </Badge>
                  )}
                  {item.yieldPercent && (
                    <Badge className={item.yieldPercent >= 95 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                      {item.yieldPercent}% yield
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
