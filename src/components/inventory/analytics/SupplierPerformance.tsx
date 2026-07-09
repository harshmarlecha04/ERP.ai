import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SupplierCostAnalysis } from "@/hooks/useRawMaterialAnalytics";
import { Truck, DollarSign, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SupplierPerformanceProps {
  suppliers: SupplierCostAnalysis[];
}

export function SupplierPerformance({ suppliers }: SupplierPerformanceProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Supplier Performance
        </CardTitle>
        <CardDescription>Materials and costs by supplier</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {suppliers.length > 0 ? (
              suppliers.map((supplier) => (
                <div 
                  key={supplier.supplier} 
                  className="rounded-lg border p-4 space-y-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">{supplier.supplier}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {supplier.total_materials} material{supplier.total_materials !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      ${supplier.total_cost.toFixed(2)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Total KG</p>
                        <p className="font-medium">{supplier.total_kg_used.toFixed(1)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Avg $/KG</p>
                        <p className="font-medium">
                          ${supplier.total_kg_used > 0 
                            ? (supplier.total_cost / supplier.total_kg_used).toFixed(2)
                            : '0.00'
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {supplier.material_list.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-2">Materials:</p>
                      <div className="flex flex-wrap gap-1">
                        {supplier.material_list.slice(0, 3).map((material, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {material}
                          </Badge>
                        ))}
                        {supplier.material_list.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{supplier.material_list.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Truck className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No supplier data available</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
