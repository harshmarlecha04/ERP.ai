import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle, Clock, Package, Bell, Trash2, User } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  useInventoryAlerts, 
  useUnacknowledgedInventoryAlerts,
  useAcknowledgedInventoryAlerts,
  useAcknowledgeAlert, 
  useBulkAcknowledgeAlerts, 
  useRealTimeInventoryAlerts 
} from '@/hooks/useInventoryAlerts';
import { useInventoryThresholds, useDeleteInventoryThreshold } from '@/hooks/useInventoryThresholds';
import { useRawMaterialsOptimized } from '@/hooks/useRawMaterialsOptimized';
import { formatET, formatDistanceET } from "@/utils/dateUtils";

interface InventoryAlertsWidgetProps {
  showAll?: boolean;
  maxItems?: number;
  onAddAlert?: () => void;
}

export function InventoryAlertsWidget({ showAll = false, maxItems = 5, onAddAlert }: InventoryAlertsWidgetProps) {
  const { data: allAlerts = [], isLoading } = useInventoryAlerts();
  const { data: unacknowledgedAlerts = [] } = useUnacknowledgedInventoryAlerts();
  const { data: acknowledgedAlerts = [] } = useAcknowledgedInventoryAlerts();
  const acknowledgeAlert = useAcknowledgeAlert();
  const bulkAcknowledge = useBulkAcknowledgeAlerts();
  
  // Get thresholds and materials data
  const { data: thresholds = [] } = useInventoryThresholds();
  const { materials = [] } = useRawMaterialsOptimized({ isArchived: false });
  const deleteThreshold = useDeleteInventoryThreshold();
  
  // Enable real-time updates
  useRealTimeInventoryAlerts();

  const displayAlerts = showAll ? allAlerts : unacknowledgedAlerts;
  const visibleAlerts = maxItems ? displayAlerts.slice(0, maxItems) : displayAlerts;

  // Get materials with thresholds for display - only show if current quantity is at or below threshold
  const materialsWithThresholds = materials.filter(material => {
    const threshold = thresholds.find(t => t.raw_material_id === material.id);
    return threshold; // Only include materials that have an active threshold
  }).map(material => {
    const threshold = thresholds.find(t => t.raw_material_id === material.id);
    const currentQuantity = material.lots.reduce((sum, lot) => sum + lot.quantity, 0);
    return { material, threshold, currentQuantity };
  }).filter(({ currentQuantity, threshold }) => 
    threshold && currentQuantity <= threshold.min_quantity_kg
  );

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Package className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      critical: 'destructive',
      high: 'destructive',
      medium: 'secondary',
      low: 'outline'
    } as const;

    return (
      <Badge variant={variants[severity as keyof typeof variants] || 'outline'}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'border-l-destructive bg-destructive/5';
      case 'high':
        return 'border-l-orange-500 bg-orange-50';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50';
      default:
        return 'border-l-blue-500 bg-blue-50';
    }
  };

  const handleAcknowledgeAll = () => {
    const alertIds = unacknowledgedAlerts.map(alert => alert.id);
    if (alertIds.length > 0) {
      bulkAcknowledge.mutate(alertIds);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Inventory Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>Loading alerts...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Inventory Alerts
          </CardTitle>
          {unacknowledgedAlerts.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAcknowledgeAll}
              disabled={bulkAcknowledge.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Acknowledge All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">
              Active Alerts
              {unacknowledgedAlerts.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unacknowledgedAlerts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="acknowledged">
              Acknowledged
              {acknowledgedAlerts.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {acknowledgedAlerts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {visibleAlerts.length === 0 ? (
              <div>
                {materialsWithThresholds.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Bell className="h-5 w-5 text-blue-500" />
                      <h3 className="font-medium text-foreground">Materials with Thresholds ({materialsWithThresholds.length})</h3>
                    </div>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-base font-semibold">RM Code</TableHead>
                            <TableHead className="text-base font-semibold">Ingredient Name</TableHead>
                            <TableHead className="text-base font-semibold">Supplier</TableHead>
                            <TableHead className="text-center text-base font-semibold">Current Qty</TableHead>
                            <TableHead className="text-center text-base font-semibold">Threshold Qty</TableHead>
                            <TableHead className="text-center text-base font-semibold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {materialsWithThresholds.slice(0, 10).map(({ material, threshold, currentQuantity }) => (
                            <TableRow key={material.id} className="hover:bg-muted/20">
                              <TableCell className="font-mono text-base font-semibold text-primary">
                                {material.code}
                              </TableCell>
                              <TableCell className="font-medium text-base">{material.name}</TableCell>
                              <TableCell className="text-base">{material.supplier || "—"}</TableCell>
                              <TableCell className="text-center">
                                <span className="font-mono text-base">
                                  {currentQuantity.toFixed(2)} {material.uom}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="font-mono text-base">
                                    {threshold?.min_quantity_kg?.toFixed(2)} kg
                                  </span>
                                  {threshold?.alert_enabled && (
                                    <Bell className="h-4 w-4 text-blue-500" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => threshold && deleteThreshold.mutate(threshold.id)}
                                  disabled={deleteThreshold.isPending}
                                  className="h-8 w-8 p-0 hover:bg-destructive/10 text-destructive hover:text-destructive"
                                  title="Remove Threshold"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {materialsWithThresholds.length > 10 && (
                      <p className="text-sm mt-3 text-center text-muted-foreground">
                        +{materialsWithThresholds.length - 10} more materials have thresholds
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No inventory alerts or thresholds</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={onAddAlert}
                    >
                      Add Threshold
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleAlerts.map((alert) => (
                  <Alert 
                    key={alert.id} 
                    className={`border-l-4 ${getStatusColor(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getSeverityIcon(alert.severity)}
                        <div className="flex-1 min-w-0">
                          <AlertDescription className="font-medium">
                            {alert.details?.material_code} - {alert.details?.material_name}
                          </AlertDescription>
                          <AlertDescription className="text-sm mt-1">
                            Current: {alert.details?.current_quantity_kg?.toFixed(2)} kg | 
                            Minimum: {alert.details?.min_quantity_kg?.toFixed(2)} kg
                            {alert.details?.supplier && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                Supplier: {alert.details.supplier}
                              </span>
                            )}
                          </AlertDescription>
                          <div className="flex items-center gap-2 mt-2">
                            {getSeverityBadge(alert.severity)}
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceET(alert.created_at, { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => acknowledgeAlert.mutate(alert.id)}
                        disabled={acknowledgeAlert.isPending}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </Alert>
                ))}
                
                {displayAlerts.length > visibleAlerts.length && (
                  <div className="text-center text-sm text-muted-foreground">
                    ... and {displayAlerts.length - visibleAlerts.length} more alerts
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="acknowledged" className="mt-4">
            {acknowledgedAlerts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No acknowledged alerts yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {acknowledgedAlerts.slice(0, maxItems).map((alert) => (
                  <Alert 
                    key={alert.id} 
                    className="border-l-4 border-l-green-500 bg-green-50/50 opacity-75"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                      <div className="flex-1 min-w-0">
                        <AlertDescription className="font-medium text-muted-foreground">
                          {alert.details?.material_code} - {alert.details?.material_name}
                        </AlertDescription>
                        <AlertDescription className="text-sm mt-1">
                          Current: {alert.details?.current_quantity_kg?.toFixed(2)} kg | 
                          Minimum: {alert.details?.min_quantity_kg?.toFixed(2)} kg
                        </AlertDescription>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {alert.severity}
                          </Badge>
                          <span>Created: {formatDistanceET(alert.created_at, { addSuffix: true })}</span>
                          {alert.acknowledged_at && (
                            <>
                              <User className="h-3 w-3 ml-2" />
                              <span>Acknowledged {formatET(alert.acknowledged_at, "MMM d, h:mm a")}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Alert>
                ))}
                
                {acknowledgedAlerts.length > maxItems && (
                  <div className="text-center text-sm text-muted-foreground">
                    ... and {acknowledgedAlerts.length - maxItems} more acknowledged alerts
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}