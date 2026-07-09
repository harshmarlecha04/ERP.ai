import React, { useState } from 'react';
import { TrendingUp, AlertTriangle, Package, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDemandForecasts, useDemandAnomalies, useAcknowledgeAnomaly } from '@/hooks/useDemandForecasts';
import { useSafetyStockRecommendations } from '@/hooks/useSafetyStockRecommendations';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatET } from "@/utils/dateUtils";

export default function Forecasting() {
  const { toast } = useToast();
  const { data: forecasts, isLoading: forecastsLoading } = useDemandForecasts();
  const { data: anomalies, isLoading: anomaliesLoading } = useDemandAnomalies();
  const { data: safetyStockRecs, isLoading: safetyStockLoading } = useSafetyStockRecommendations();
  const acknowledgeMutation = useAcknowledgeAnomaly();

  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState('');

  const handleAcknowledge = async () => {
    if (!selectedAnomaly) return;

    try {
      await acknowledgeMutation.mutateAsync({
        id: selectedAnomaly.id,
        notes: acknowledgeNotes,
      });

      toast({
        title: 'Anomaly Acknowledged',
        description: 'The demand anomaly has been acknowledged.',
      });

      setSelectedAnomaly(null);
      setAcknowledgeNotes('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to acknowledge anomaly',
        variant: 'destructive',
      });
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return '↗️';
      case 'decreasing':
        return '↘️';
      default:
        return '→';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'exceeding':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <TrendingUp className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Demand Forecasting</h1>
          <p className="text-muted-foreground">
            AI-powered demand predictions and inventory planning
          </p>
        </div>
      </div>

      <Tabs defaultValue="forecasts" className="w-full">
        <TabsList>
          <TabsTrigger value="forecasts">
            <Calendar className="h-4 w-4 mr-2" />
            Forecasts
          </TabsTrigger>
          <TabsTrigger value="anomalies">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Demand Anomalies
          </TabsTrigger>
          <TabsTrigger value="safety-stock">
            <Package className="h-4 w-4 mr-2" />
            Safety Stock
          </TabsTrigger>
        </TabsList>

        {/* Forecasts Tab */}
        <TabsContent value="forecasts" className="space-y-4">
          {forecastsLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading forecasts...
              </CardContent>
            </Card>
          ) : forecasts && forecasts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {forecasts.map((forecast) => (
                <Card key={forecast.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {formatET(forecast.forecast_month, 'MMMM yyyy')}
                    </CardTitle>
                    <CardDescription>
                      Confidence: {(forecast.confidence_score * 100).toFixed(0)}%
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Forecasted Bottles:</span>
                        <span className="font-semibold">{forecast.forecasted_bottles}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Forecasted Batches:</span>
                        <span className="font-semibold">{forecast.forecasted_batches}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Trend:</span>
                        <Badge variant="outline">
                          {getTrendIcon(forecast.trend)} {forecast.trend}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No forecasts available yet. Forecasts are generated monthly based on historical data.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-4">
          {anomaliesLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading anomalies...
              </CardContent>
            </Card>
          ) : anomalies && anomalies.length > 0 ? (
            <div className="space-y-4">
              {anomalies.map((anomaly: any) => (
                <Card key={anomaly.id} className={anomaly.acknowledged ? 'opacity-60' : ''}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">
                          {anomaly.formulas?.code} - {anomaly.formulas?.name}
                        </CardTitle>
                        <CardDescription>
                          {formatET(anomaly.anomaly_month, 'MMMM yyyy')}
                        </CardDescription>
                      </div>
                      <Badge variant={getSeverityColor(anomaly.severity)}>
                        {anomaly.severity}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Expected Orders:</span>
                        <span className="font-semibold">{anomaly.expected_orders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Actual Orders:</span>
                        <span className="font-semibold">{anomaly.actual_orders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Variance:</span>
                        <span className={anomaly.variance_percent < 0 ? 'text-destructive font-semibold' : 'text-green-600 font-semibold'}>
                          {anomaly.variance_percent > 0 ? '+' : ''}{anomaly.variance_percent}%
                        </span>
                      </div>
                      {!anomaly.acknowledged && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
                          onClick={() => setSelectedAnomaly(anomaly)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      {anomaly.acknowledged && anomaly.notes && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <strong>Notes:</strong> {anomaly.notes}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No demand anomalies detected. The system monitors order patterns daily.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Safety Stock Tab */}
        <TabsContent value="safety-stock" className="space-y-4">
          {safetyStockLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading safety stock recommendations...
              </CardContent>
            </Card>
          ) : safetyStockRecs && safetyStockRecs.length > 0 ? (
            <div className="space-y-4">
              {safetyStockRecs.map((rec: any) => (
                <Card key={rec.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {rec.raw_materials?.code} - {rec.raw_materials?.name}
                    </CardTitle>
                    <CardDescription>
                      Supplier: {rec.raw_materials?.supplier || 'N/A'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Recommended Min:</span>
                        <span className="font-semibold">{rec.recommended_min_kg} {rec.raw_materials?.uom}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Recommended Reorder:</span>
                        <span className="font-semibold">{rec.recommended_reorder_kg} {rec.raw_materials?.uom}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Avg Daily Usage:</span>
                        <span>{rec.avg_daily_usage_kg?.toFixed(2)} {rec.raw_materials?.uom}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Confidence:</span>
                        <span>{(rec.confidence_score * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No safety stock recommendations available. Recommendations are generated based on usage patterns.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Acknowledge Anomaly Dialog */}
      <Dialog open={!!selectedAnomaly} onOpenChange={() => setSelectedAnomaly(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Demand Anomaly</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add notes about why this anomaly occurred (optional):
            </p>
            <Textarea
              value={acknowledgeNotes}
              onChange={(e) => setAcknowledgeNotes(e.target.value)}
              placeholder="E.g., Seasonal dip, customer delay, market conditions..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAnomaly(null)}>
              Cancel
            </Button>
            <Button onClick={handleAcknowledge}>
              Acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}