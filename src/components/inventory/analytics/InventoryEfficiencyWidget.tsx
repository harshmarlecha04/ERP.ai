import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { InventoryEfficiency } from "@/hooks/useRawMaterialAnalytics";
import { AlertTriangle, TrendingUp, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface InventoryEfficiencyWidgetProps {
  data: InventoryEfficiency;
}

export function InventoryEfficiencyWidget({ data }: InventoryEfficiencyWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Efficiency</CardTitle>
        <CardDescription>Material movement and aging analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="slow" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="slow" className="text-xs">
              Slow Movers
            </TabsTrigger>
            <TabsTrigger value="fast" className="text-xs">
              Fast Movers
            </TabsTrigger>
            <TabsTrigger value="expiring" className="text-xs">
              Expiring Soon
            </TabsTrigger>
          </TabsList>

          <TabsContent value="slow" className="mt-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-4">
                {data.slow_moving_materials.length > 0 ? (
                  data.slow_moving_materials.map((material) => (
                    <div 
                      key={material.material_id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{material.name}</p>
                          <p className="text-xs text-muted-foreground">{material.code}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {material.days_since_last_use !== null 
                            ? `${material.days_since_last_use}d ago`
                            : 'Never used'
                          }
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {material.quantity_on_hand.toFixed(1)} kg on hand
                        </span>
                        {material.estimated_value > 0 && (
                          <span className="font-medium">
                            ~${material.estimated_value.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">All materials are actively used</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="fast" className="mt-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-4">
                {data.fast_moving_materials.length > 0 ? (
                  data.fast_moving_materials.map((material) => (
                    <div 
                      key={material.material_id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{material.name}</p>
                          <p className="text-xs text-muted-foreground">{material.code}</p>
                        </div>
                        <Badge className="text-xs">
                          {material.usage_frequency} uses
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        <span>
                          Used every {material.avg_days_between_use.toFixed(1)} days
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No fast-moving materials</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="expiring" className="mt-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-4">
                {data.expiring_soon.length > 0 ? (
                  data.expiring_soon.map((material, idx) => (
                    <div 
                      key={`${material.material_id}-${idx}`}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{material.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {material.code} • Lot: {material.lot_number || 'N/A'}
                          </p>
                        </div>
                        <Badge 
                          variant={material.days_until_expiry <= 30 ? "destructive" : "outline"}
                          className="text-xs"
                        >
                          {material.days_until_expiry}d left
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {material.quantity.toFixed(1)} kg
                        </span>
                        {material.days_until_expiry <= 30 && (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            Urgent
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No materials expiring soon</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
