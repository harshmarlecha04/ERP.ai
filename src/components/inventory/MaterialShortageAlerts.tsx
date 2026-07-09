import { useEffect, useState } from "react";
import { AlertTriangle, Package, Calendar, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { formatET } from "@/utils/dateUtils";

interface ShortageItem {
  schedule_item_id: string;
  formula_code: string;
  schedule_date: string;
  batches: number;
  shortages: Array<{
    ingredient_name: string;
    required_kg: number;
    available_kg: number;
    shortfall_kg: number;
  }>;
}

interface ShortageData {
  total_items_with_shortages: number;
  shortages: ShortageItem[];
  checked_at: string;
}

export function MaterialShortageAlerts() {
  const [shortageData, setShortageData] = useState<ShortageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadShortages();
  }, []);

  const loadShortages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_upcoming_material_shortages", {
        p_days_ahead: 30,
      });

      if (error) throw error;
      setShortageData(data as any);
    } catch (error: any) {
      console.error("Error loading shortages:", error);
      toast({
        title: "Error loading material shortages",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique ingredients with shortages
  const getUniqueIngredients = (): Map<string, number> => {
    const ingredientMap = new Map<string, number>();
    
    shortageData?.shortages.forEach((item) => {
      item.shortages.forEach((shortage) => {
        const current = ingredientMap.get(shortage.ingredient_name) || 0;
        ingredientMap.set(shortage.ingredient_name, current + shortage.shortfall_kg);
      });
    });
    
    return ingredientMap;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Material Shortage Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalShortages = shortageData?.total_items_with_shortages || 0;
  const uniqueIngredients = getUniqueIngredients();

  if (totalShortages === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-success" />
            Material Shortage Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-success">
            <AlertDescription className="text-success">
              All scheduled production has sufficient materials for the next 30 days.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Material Shortage Alerts
          </CardTitle>
          <Badge variant="destructive">{totalShortages} affected production items</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Alert */}
        <Alert variant="destructive">
          <TrendingDown className="h-4 w-4" />
          <AlertDescription>
            <strong>{uniqueIngredients.size} ingredients</strong> are in shortage for upcoming production.
            This affects <strong>{totalShortages} production items</strong> scheduled in the next 30 days.
          </AlertDescription>
        </Alert>

        {/* Ingredients with Shortages */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Ingredients Needed
          </h4>
          <div className="space-y-2">
            {Array.from(uniqueIngredients.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([ingredient, totalShortfall]) => (
                <div
                  key={ingredient}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{ingredient}</p>
                    <p className="text-sm text-muted-foreground">
                      Shortfall: {totalShortfall.toFixed(2)} kg
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/purchase-orders")}
                  >
                    Order
                  </Button>
                </div>
              ))}
          </div>
          
          {uniqueIngredients.size > 5 && (
            <p className="text-sm text-muted-foreground mt-2">
              + {uniqueIngredients.size - 5} more ingredients
            </p>
          )}
        </div>

        {/* Affected Production Items */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Affected Production
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {shortageData?.shortages.slice(0, 10).map((item) => (
              <div
                key={item.schedule_item_id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{item.formula_code}</Badge>
                  <div>
                    <p className="text-sm font-medium">{item.batches} batches</p>
                    <p className="text-xs text-muted-foreground">
                      {formatET(item.schedule_date, "MMM dd, yyyy")}
                    </p>
                  </div>
                </div>
                <Badge variant="destructive">
                  {item.shortages.length} shortages
                </Badge>
              </div>
            ))}
          </div>
          
          {(shortageData?.shortages.length || 0) > 10 && (
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => navigate("/production")}
            >
              View All Affected Items
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1"
            onClick={() => navigate("/purchase-orders")}
          >
            Create Purchase Orders
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/material-requirements")}
          >
            View Material Requirements
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
