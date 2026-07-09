import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMaterialAlternatives } from "@/hooks/useMaterialAlternatives";
import { format } from "date-fns";
import { Package, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatET } from "@/utils/dateUtils";

interface MaterialAlternativesProps {
  materialId: string;
  shortageKg: number;
}

export const MaterialAlternatives = ({ materialId, shortageKg }: MaterialAlternativesProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: alternatives, isLoading } = useMaterialAlternatives(materialId);

  if (isLoading) {
    return <div className="text-xs text-muted-foreground">Loading...</div>;
  }

  if (!alternatives || alternatives.length === 0) {
    return <div className="text-xs text-muted-foreground">None</div>;
  }

  const totalAlternativeQty = alternatives.reduce((sum, alt) => sum + alt.available_qty, 0);
  const canCoverShortage = totalAlternativeQty >= shortageKg;
  const coveragePercent = Math.min(100, (totalAlternativeQty / shortageKg) * 100);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 w-full justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">
                {alternatives.length} available
              </span>
              {canCoverShortage && (
                <Badge variant="default" className="h-5 text-xs">
                  Can Cover
                </Badge>
              )}
            </div>
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-2">
          {alternatives.map((alt) => (
            <Card key={alt.alternative_id} className="p-2 bg-muted/50">
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-medium truncate">
                      {alt.supplier || 'No Vendor'}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {alt.material_code}
                    </Badge>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-semibold text-primary">
                      {alt.available_qty.toFixed(1)} {alt.uom}
                    </div>
                  </div>
                </div>

                {/* Lot Details */}
                {alt.lots.length > 0 && (
                  <div className="pl-4 space-y-0.5">
                    {alt.lots.slice(0, 2).map((lot, idx) => (
                      <div key={lot.lot_id || idx} className="flex justify-between text-[10px] text-muted-foreground">
                        <span className="truncate">
                          Lot: {lot.lot_number || 'N/A'}
                          {lot.expires_on && ` • ${formatET(lot.expires_on, 'MM/dd/yy')}`}
                        </span>
                        <span className="font-medium ml-2 flex-shrink-0">
                          {lot.quantity.toFixed(1)}
                        </span>
                      </div>
                    ))}
                    {alt.lots.length > 2 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{alt.lots.length - 2} more lots
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}

          {canCoverShortage && (
            <div className="text-[10px] text-success bg-success/10 p-1.5 rounded text-center">
              ✓ Shortage fully covered by alternatives
            </div>
          )}
          {!canCoverShortage && totalAlternativeQty > 0 && (
            <div className="text-[10px] text-warning bg-warning/10 p-1.5 rounded text-center">
              ⚠ {coveragePercent.toFixed(0)}% covered by alternatives
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
