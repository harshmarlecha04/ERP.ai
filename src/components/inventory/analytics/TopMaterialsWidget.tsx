import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TopMaterial } from "@/hooks/useRawMaterialAnalytics";
import { TrendingUp, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TopMaterialsWidgetProps {
  materials: TopMaterial[];
}

export function TopMaterialsWidget({ materials }: TopMaterialsWidgetProps) {
  const topMaterials = materials.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Top Materials
        </CardTitle>
        <CardDescription>Most used materials by quantity</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {topMaterials.length > 0 ? (
              topMaterials.map((material, index) => (
                <div 
                  key={material.material_id} 
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium leading-none">{material.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{material.code}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {material.total_kg_used.toFixed(1)} kg
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {material.usage_count} uses
                      </span>
                      {material.supplier && (
                        <span>• {material.supplier}</span>
                      )}
                    </div>
                    {material.total_cost > 0 && (
                      <p className="text-xs font-medium text-muted-foreground">
                        ${material.total_cost.toFixed(2)} total cost
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No usage data available</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
