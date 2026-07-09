import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Loader2, ChevronDown, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ComprehensiveMaterialStatus, PackagingItemDetail } from '@/hooks/useComprehensiveMaterialCheck';

interface MaterialStatusCardProps {
  materialStatus: ComprehensiveMaterialStatus;
  selectedBottleId?: string;
  selectedCapId?: string;
  selectedLabelId?: string;
  onBottleSelect?: (id: string) => void;
  onCapSelect?: (id: string) => void;
  onLabelSelect?: (id: string) => void;
}

export const MaterialStatusCard: React.FC<MaterialStatusCardProps> = ({ 
  materialStatus,
  selectedBottleId,
  selectedCapId,
  selectedLabelId,
  onBottleSelect,
  onCapSelect,
  onLabelSelect
}) => {
  const [ingredientsExpanded, setIngredientsExpanded] = useState(false);

  const safeNumber = (value: number | undefined): string => {
    return value !== undefined && value !== null ? value.toLocaleString() : '0';
  };

  const renderPackagingItems = (items: PackagingItemDetail[] | undefined, type: 'bottles' | 'caps' | 'labels') => {
    if (!items || items.length === 0) {
      return <p className="text-xs text-muted-foreground">No items found</p>;
    }

    return (
      <div className="mt-2 space-y-1">
        {items.map((item, index) => (
          <div key={index} className="text-xs border-l-2 border-muted pl-2 py-1">
            {type === 'labels' ? (
              <>
                <p className="font-medium">{item.customer_product || 'Unknown'}</p>
                {item.product_name && <p className="text-muted-foreground">{item.product_name}</p>}
                <p className="text-muted-foreground">
                  On hand: {item.on_hand !== undefined ? item.on_hand.toLocaleString() : 'N/A'}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">{item.item_name || 'Unknown Item'}</p>
                {item.description && <p className="text-muted-foreground">{item.description}</p>}
                {item.sku && <p className="text-muted-foreground">SKU: {item.sku}</p>}
                <p className="text-muted-foreground">
                  On hand: {item.on_hand !== undefined ? item.on_hand.toLocaleString() : 'N/A'}
                  {item.location && ` • ${item.location}`}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Circle className="h-4 w-4 text-muted-foreground" />;
      case 'checking':
        return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="default" className="bg-green-500">Available</Badge>;
      case 'partial':
        return <Badge variant="default" className="bg-yellow-500">Partial</Badge>;
      case 'critical':
        return <Badge variant="destructive">Missing</Badge>;
      case 'pending':
        return <Badge variant="outline">Enter Order Details</Badge>;
      case 'checking':
        return <Badge variant="secondary">Checking...</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const { ingredients, bottles, caps, labels, overallStatus } = materialStatus;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Material Availability</h3>
        {getStatusBadge(overallStatus)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Ingredients */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(ingredients?.status || overallStatus)}
              <span className="font-medium">Ingredients</span>
            </div>
            {getStatusBadge(ingredients?.status || overallStatus)}
          </div>
          {ingredients && ingredients.status !== 'available' && (
            <div className="text-sm space-y-2">
              <p className="text-muted-foreground">
                Can make {ingredients.maxBatches} batches
              </p>
              {ingredients.shortages.length > 0 && (
                <Collapsible open={ingredientsExpanded} onOpenChange={setIngredientsExpanded}>
                  <CollapsibleTrigger className="flex items-center gap-1 text-destructive text-xs hover:underline cursor-pointer">
                    <ChevronDown className={`h-3 w-3 transition-transform ${ingredientsExpanded ? 'rotate-180' : ''}`} />
                    {ingredients.shortages.length} ingredient(s) short
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    <div className="border-t pt-2">
                      {ingredients.shortages
                        .sort((a, b) => b.shortage_kg - a.shortage_kg)
                        .map((shortage, index) => (
                          <div key={index} className="flex items-start gap-2 py-2 border-b last:border-0">
                            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{shortage.ingredient_name}</p>
                              <p className="text-destructive font-semibold text-sm">
                                Need {shortage.shortage_kg.toFixed(2)} kg more
                              </p>
                              <p className="text-muted-foreground text-xs">
                                Available: {shortage.available_kg.toFixed(2)} kg / Required: {shortage.required_kg.toFixed(2)} kg
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
        </div>

        {/* Bottles */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(bottles?.status || overallStatus)}
              <span className="font-medium">Bottles</span>
            </div>
            {getStatusBadge(bottles?.status || overallStatus)}
          </div>
          {bottles && (
            <div className="space-y-2">
              {onBottleSelect && bottles.items && bottles.items.length > 1 && (
                <Select value={selectedBottleId} onValueChange={onBottleSelect}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select bottle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {bottles.items.map((bottle) => (
                      <SelectItem key={bottle.item_id} value={bottle.item_id || ''}>
                        {bottle.item_name} - On hand: {safeNumber(bottle.on_hand)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="text-sm">
                <p className="text-muted-foreground">
                  {safeNumber(bottles.available)} / {safeNumber(bottles.needed)}
                  {(bottles.shortage || 0) > 0 && (
                    <span className="text-red-600 ml-2">
                      (need {safeNumber(bottles.shortage)})
                    </span>
                )}
              </p>
              <ScrollArea className="max-h-[300px] pr-4">
                {renderPackagingItems(bottles.items, 'bottles')}
              </ScrollArea>
            </div>
          </div>
          )}
        </div>

        {/* Caps */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(caps?.status || overallStatus)}
              <span className="font-medium">Caps</span>
            </div>
            {getStatusBadge(caps?.status || overallStatus)}
          </div>
          {caps && (
            <div className="space-y-2">
              {onCapSelect && caps.items && caps.items.length > 1 && (
                <Select value={selectedCapId} onValueChange={onCapSelect}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select cap type" />
                  </SelectTrigger>
                  <SelectContent>
                    {caps.items.map((cap) => (
                      <SelectItem key={cap.item_id} value={cap.item_id || ''}>
                        {cap.item_name} - On hand: {safeNumber(cap.on_hand)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="text-sm">
                <p className="text-muted-foreground">
                  {safeNumber(caps.available)} / {safeNumber(caps.needed)}
                  {(caps.shortage || 0) > 0 && (
                    <span className="text-red-600 ml-2">
                      (need {safeNumber(caps.shortage)})
                    </span>
                )}
              </p>
              <ScrollArea className="max-h-[300px] pr-4">
                {renderPackagingItems(caps.items, 'caps')}
              </ScrollArea>
            </div>
          </div>
          )}
        </div>

        {/* Labels */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(labels?.status || overallStatus)}
              <span className="font-medium">Labels</span>
            </div>
            {getStatusBadge(labels?.status || overallStatus)}
          </div>
          {labels && (
            <div className="space-y-2">
              {onLabelSelect && (
                <Select value={selectedLabelId} onValueChange={onLabelSelect}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select label type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__brite_stock__">Brite Stock</SelectItem>
                    {labels.items?.map((label) => (
                      <SelectItem key={label.label_id} value={label.label_id || ''}>
                        {label.customer_product} - On hand: {safeNumber(label.on_hand)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="text-sm">
                <p className="text-muted-foreground">
                  {safeNumber(labels.available)} / {safeNumber(labels.needed)}
                  {(labels.shortage || 0) > 0 && (
                    <span className="text-red-600 ml-2">
                      (need {safeNumber(labels.shortage)})
                    </span>
                )}
              </p>
              <ScrollArea className="max-h-[300px] pr-4">
                {renderPackagingItems(labels.items, 'labels')}
              </ScrollArea>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
