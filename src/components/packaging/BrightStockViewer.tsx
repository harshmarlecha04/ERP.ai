import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Calendar, Trash2, AlertCircle } from 'lucide-react';
import { useBrightStock } from '@/hooks/useBrightStock';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { formatDistanceET, formatET } from "@/utils/dateUtils";

export const BrightStockViewer = () => {
  const { brightStock, isLoading, deleteBrightStock } = useBrightStock();

  // Group by formula and bottle size
  const groupedStock = brightStock.reduce((acc, item) => {
    const key = `${item.formula_id}-${item.bottle_size}`;
    if (!acc[key]) {
      acc[key] = {
        formula_id: item.formula_id,
        formula_code: item.formula?.code || 'Unknown',
        formula_name: item.formula?.name || 'Unknown',
        bottle_size: item.bottle_size,
        items: [],
        total_bottles: 0,
      };
    }
    acc[key].items.push(item);
    acc[key].total_bottles += item.quantity_bottles;
    return acc;
  }, {} as Record<string, any>);

  if (isLoading) {
    return <div className="text-center py-8">Loading bright stock...</div>;
  }

  if (brightStock.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No bright stock inventory available</p>
            <p className="text-sm mt-2">
              Excess bottles from production will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bright Stock Inventory</h2>
        <Badge variant="secondary">
          {Object.keys(groupedStock).length} Formula/Size Combinations
        </Badge>
      </div>

      {Object.values(groupedStock).map((group: any) => (
        <Card key={`${group.formula_id}-${group.bottle_size}`}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-lg">{group.formula_code}</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    {group.formula_name} • {group.bottle_size}ct bottles
                  </div>
                </div>
              </div>
              <Badge className="text-lg px-4 py-2" variant="default">
                {group.total_bottles.toLocaleString()} bottles
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {group.items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Produced {formatDistanceET(item.production_date, { addSuffix: true })}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm">
                        {formatET(item.production_date, "M/d/yyyy")}
                      </span>
                    </div>
                    {item.notes && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {item.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-base px-3">
                      {item.quantity_bottles} bottles
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            Delete Bright Stock Entry?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {item.quantity_bottles} bottles from bright stock.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteBrightStock(item.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
