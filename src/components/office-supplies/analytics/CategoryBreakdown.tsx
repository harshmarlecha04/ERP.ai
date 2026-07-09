import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package, DollarSign, TrendingUp } from "lucide-react";
import { CategoryStats } from "@/hooks/useOfficeSupplyAnalytics";

interface CategoryBreakdownProps {
  data: CategoryStats[];
}

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Breakdown</CardTitle>
        <CardDescription>Statistics by category</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No category data available
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((category) => (
              <div
                key={category.category}
                className="rounded-lg border bg-card p-4 hover:bg-accent/5 transition-colors"
              >
                <h4 className="font-semibold mb-3">{category.category}</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Package className="h-4 w-4" />
                      Items
                    </span>
                    <span className="font-medium">{category.item_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      Total Cost
                    </span>
                    <span className="font-medium">
                      ${category.total_cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Total Usage
                    </span>
                    <span className="font-medium">
                      {category.total_usage.toFixed(1)}
                    </span>
                  </div>
                  {category.avg_cost_per_item > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Avg/Item</span>
                      <span className="font-medium">
                        ${category.avg_cost_per_item.toFixed(2)}
                      </span>
                    </div>
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
