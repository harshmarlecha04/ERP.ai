import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Package } from "lucide-react";
import { PopularItem } from "@/hooks/useOfficeSupplyAnalytics";

interface PopularItemsWidgetProps {
  data: PopularItem[];
}

export function PopularItemsWidget({ data }: PopularItemsWidgetProps) {
  const topItems = data.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most Used Items</CardTitle>
        <CardDescription>Top 10 items by usage volume</CardDescription>
      </CardHeader>
      <CardContent>
        {topItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No usage data available
          </div>
        ) : (
          <div className="space-y-4">
            {topItems.map((item, index) => (
              <div
                key={item.item_id}
                className="flex items-start justify-between gap-4 pb-4 border-b last:border-0"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.item_name}</p>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {item.total_quantity.toFixed(1)} used
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {item.avg_monthly_usage.toFixed(1)}/month avg
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="gap-1">
                    <Package className="h-3 w-3" />
                    {item.current_stock}
                  </Badge>
                  {item.days_until_stockout !== null && (
                    <Badge
                      variant={item.days_until_stockout < 7 ? "destructive" : "secondary"}
                      className="gap-1"
                    >
                      {item.days_until_stockout < 7 && (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {item.days_until_stockout}d left
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
