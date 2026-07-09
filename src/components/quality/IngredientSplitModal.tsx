import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertCircle, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRawMaterials } from '@/hooks/useRawMaterials';
import { cn } from '@/lib/utils';

interface AvailableLot {
  id: string;
  lot_number: string;
  supplier: string;
  quantity: number;
  qty_reserved_kg: number;
  available_qty: number;
  receiving_date: string;
  expires_on: string;
  cost: number;
}

interface IngredientData {
  ingredient_id: string;
  ingredient_name: string;
  ingredient_code: string;
  required_quantity_kg: number;
  available_lots: AvailableLot[];
  splits?: IngredientSplit[];
}

interface IngredientSplit {
  raw_material_id: string;
  lot_id?: string;
  supplier_name: string;
  lot_number?: string;
  batches_used: number;
  actual_quantity_kg: number;
}

interface IngredientSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredient: IngredientData | null;
  totalBatches: number;
  onSave: (ingredientId: string, splits: IngredientSplit[]) => void;
}

export const IngredientSplitModal: React.FC<IngredientSplitModalProps> = ({
  isOpen,
  onClose,
  ingredient,
  totalBatches,
  onSave
}) => {
  const [splits, setSplits] = useState<IngredientSplit[]>([]);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [openPopovers, setOpenPopovers] = useState<Record<number, boolean>>({});
  const { toast } = useToast();
  const { rawMaterials, loading: materialsLoading } = useRawMaterials();

  useEffect(() => {
    if (isOpen && ingredient) {
      console.log('IngredientSplitModal opened with ingredient:', ingredient.ingredient_name);
      console.log('Available lots count:', ingredient.available_lots?.length || 0);
      console.log('Available lots data:', ingredient.available_lots);
      
      // Initialize with existing splits or create default split
      if (ingredient.splits && ingredient.splits.length > 0) {
        setSplits([...ingredient.splits]);
      } else {
        // Find the matching raw material for the ingredient
        const matchingMaterial = rawMaterials.find(rm => rm.id === ingredient.ingredient_id);
        const firstAvailableLot = matchingMaterial?.lots?.[0] || ingredient.available_lots?.[0];
        
        setSplits([{
          raw_material_id: ingredient.ingredient_id,
          supplier_name: matchingMaterial?.supplier || (ingredient.available_lots?.[0] as any)?.supplier || 'Unknown',
          lot_number: firstAvailableLot?.lot_number || '',
          lot_id: firstAvailableLot?.id || undefined,
          batches_used: totalBatches,
          actual_quantity_kg: ingredient.required_quantity_kg
        }]);
      }
    }
  }, [isOpen, ingredient, totalBatches, rawMaterials]);

  const addSplit = () => {
    if (!ingredient) return;
    
    setSplits(prev => [...prev, {
      raw_material_id: ingredient.ingredient_id,
      supplier_name: '',
      lot_number: '',
      lot_id: undefined,
      batches_used: 0,
      actual_quantity_kg: 0
    }]);
  };

  const removeSplit = (index: number) => {
    setSplits(prev => prev.filter((_, i) => i !== index));
  };

  const updateSplit = (index: number, field: keyof IngredientSplit, value: any) => {
    setSplits(prev => prev.map((split, i) => 
      i === index ? { ...split, [field]: value } : split
    ));
  };

  const selectLot = (index: number, value: string) => {
    if (!rawMaterials || rawMaterials.length === 0) return;
    
    if (value === 'custom') {
      // Clear lot data for custom entry
      updateSplit(index, 'lot_id', undefined);
      updateSplit(index, 'supplier_name', '');
      updateSplit(index, 'lot_number', '');
      return;
    }
    
    // Find the lot across all raw materials
    let selectedLot = null;
    let selectedMaterial = null;
    
    for (const material of rawMaterials) {
      const lot = material.lots.find(l => l.id === value);
      if (lot) {
        selectedLot = lot;
        selectedMaterial = material;
        break;
      }
    }
    
    if (selectedLot && selectedMaterial) {
      updateSplit(index, 'raw_material_id', selectedMaterial.id);
      updateSplit(index, 'lot_id', selectedLot.id);
      updateSplit(index, 'supplier_name', selectedMaterial.supplier || 'Unknown');
      updateSplit(index, 'lot_number', selectedLot.lot_number || '');
    }
  };

  const calculateQuantityPerBatch = () => {
    if (!ingredient || totalBatches === 0) return 0;
    return ingredient.required_quantity_kg / totalBatches;
  };

  const autoCalculateQuantity = (index: number, batches: number) => {
    const qtyPerBatch = calculateQuantityPerBatch();
    const quantity = batches * qtyPerBatch;
    updateSplit(index, 'actual_quantity_kg', Number(quantity.toFixed(3)));
  };

  const validateSplits = () => {
    if (splits.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one split is required",
        variant: "destructive"
      });
      return false;
    }

    const totalBatchesUsed = splits.reduce((sum, split) => sum + split.batches_used, 0);
    const totalQuantity = splits.reduce((sum, split) => sum + split.actual_quantity_kg, 0);

    if (totalBatchesUsed !== totalBatches) {
      toast({
        title: "Validation Error",
        description: `Total batches (${totalBatchesUsed}) must equal scheduled batches (${totalBatches})`,
        variant: "destructive"
      });
      return false;
    }

    if (!ingredient) return false;

    if (Math.abs(totalQuantity - ingredient.required_quantity_kg) > 0.01) {
      toast({
        title: "Validation Error",
        description: `Total quantity (${totalQuantity} kg) must equal required quantity (${ingredient.required_quantity_kg} kg)`,
        variant: "destructive"
      });
      return false;
    }

    // Check for empty suppliers
    for (const split of splits) {
      if (!split.supplier_name.trim()) {
        toast({
          title: "Validation Error",
          description: "All splits must have a supplier name",
          variant: "destructive"
        });
        return false;
      }
    }

    return true;
  };

  const handleSave = () => {
    if (!ingredient || !validateSplits()) return;
    
    onSave(ingredient.ingredient_id, splits);
  };

  if (!ingredient) return null;

  const totalBatchesUsed = splits.reduce((sum, split) => sum + split.batches_used, 0);
  const totalQuantityUsed = splits.reduce((sum, split) => sum + split.actual_quantity_kg, 0);
  const qtyPerBatch = calculateQuantityPerBatch();
  
  // Helper functions for managing per-split state
  const getSearchTerm = (index: number) => searchTerms[index] || "";
  const setSearchTerm = (index: number, value: string) => {
    setSearchTerms(prev => ({ ...prev, [index]: value }));
  };
  const isPopoverOpen = (index: number) => openPopovers[index] || false;
  const setPopoverOpen = (index: number, value: boolean) => {
    setOpenPopovers(prev => ({ ...prev, [index]: value }));
  };
  
  // Filter materials based on search term for specific split
  const getFilteredMaterials = (index: number) => {
    const searchTerm = getSearchTerm(index);
    if (!searchTerm.trim()) return rawMaterials;
    
    const lowerSearch = searchTerm.toLowerCase();
    return rawMaterials.filter(material => 
      material.name.toLowerCase().includes(lowerSearch) ||
      material.supplier?.toLowerCase().includes(lowerSearch) ||
      material.lots.some(lot => 
        lot.lot_number?.toLowerCase().includes(lowerSearch)
      )
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="[--dialog-max-width:56rem] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Split Ingredient: {ingredient.ingredient_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Ingredient Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ingredient Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Code:</span>
                  <div className="font-medium">{ingredient.ingredient_code}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Required:</span>
                  <div className="font-medium">{ingredient.required_quantity_kg} kg</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Per Batch:</span>
                  <div className="font-medium">{qtyPerBatch.toFixed(3)} kg</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Batches:</span>
                  <div className="font-medium">{totalBatches}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Splits */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Ingredient Splits</h3>
              <Button onClick={addSplit} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Split
              </Button>
            </div>

            {splits.map((split, index) => (
              <Card key={index} className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Split #{index + 1}</h4>
                    {splits.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeSplit(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Ingredient/Lot Selection */}
                    <div className="space-y-2">
                      <Label>Available Ingredient/Lot</Label>
                      <Popover 
                        open={isPopoverOpen(index)} 
                        onOpenChange={(open) => setPopoverOpen(index, open)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={isPopoverOpen(index)}
                            className="w-full justify-between"
                          >
                            {split.lot_id ? (
                              (() => {
                                // Find the selected lot to display
                                for (const material of rawMaterials) {
                                  const lot = material.lots.find(l => l.id === split.lot_id);
                                  if (lot) {
                                    return (
                                      <div className="flex items-center gap-2 truncate">
                                        <span className="font-medium">{material.name}</span>
                                        <span className="text-muted-foreground">-</span>
                                        <span className="text-sm">{material.supplier || 'Unknown'}</span>
                                        <span className="text-muted-foreground">-</span>
                                        <span className="text-sm">Lot {lot.lot_number || 'N/A'}</span>
                                      </div>
                                    );
                                  }
                                }
                                return "Select ingredient and lot";
                              })()
                            ) : (
                              "Select ingredient and lot"
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[500px] p-0 overflow-hidden" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Search ingredients, suppliers, or lot numbers..."
                              value={getSearchTerm(index)}
                              onValueChange={(value) => setSearchTerm(index, value)}
                            />
                            <CommandList className="max-h-[300px] overflow-y-auto">
                              <CommandEmpty>No ingredients found.</CommandEmpty>
                              <CommandGroup>
                                {materialsLoading ? (
                                  <div className="p-2 text-sm text-muted-foreground">
                                    Loading ingredients...
                                  </div>
                                ) : (
                                  getFilteredMaterials(index).flatMap((material) =>
                                    material.lots
                                      .filter(lot => lot.quantity > 0)
                                      .sort((a, b) => b.quantity - a.quantity)
                                      .map((lot) => (
                                        <CommandItem
                                          key={lot.id}
                                          value={`${material.name} ${material.supplier || ''} ${lot.lot_number || ''}`}
                                          onSelect={() => {
                                            selectLot(index, lot.id);
                                            setPopoverOpen(index, false);
                                            setSearchTerm(index, "");
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              split.lot_id === lot.id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex-1">
                                            <div className="font-medium">
                                              {material.name} - {material.supplier || 'Unknown'} - Lot {lot.lot_number || 'N/A'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              Available: {lot.quantity} {material.unit_of_measure}
                                            </div>
                                          </div>
                                        </CommandItem>
                                      ))
                                  )
                                )}
                                <CommandItem
                                  value="custom-entry"
                                  onSelect={() => {
                                    selectLot(index, 'custom');
                                    setPopoverOpen(index, false);
                                    setSearchTerm(index, "");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      !split.lot_id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <span className="font-medium">Custom (Enter manually)</span>
                                </CommandItem>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Supplier Name */}
                    <div className="space-y-2">
                      <Label>Supplier Name</Label>
                      <Input
                        value={split.supplier_name}
                        onChange={(e) => updateSplit(index, 'supplier_name', e.target.value)}
                        placeholder="Supplier name"
                      />
                    </div>

                    {/* Lot Number */}
                    <div className="space-y-2">
                      <Label>Lot Number</Label>
                      <Input
                        value={split.lot_number || ''}
                        onChange={(e) => updateSplit(index, 'lot_number', e.target.value)}
                        placeholder="Lot number"
                      />
                    </div>

                    {/* Batches Used */}
                    <div className="space-y-2">
                      <Label>Batches Used</Label>
                      <Input
                        type="number"
                        min="0"
                        max={totalBatches}
                        value={split.batches_used}
                        onChange={(e) => {
                          const batches = Number(e.target.value);
                          updateSplit(index, 'batches_used', batches);
                          autoCalculateQuantity(index, batches);
                        }}
                        placeholder="Batches"
                      />
                    </div>

                    {/* Actual Quantity */}
                    <div className="space-y-2 md:col-span-2 lg:col-span-1">
                      <Label>Actual Quantity (kg)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        value={split.actual_quantity_kg}
                        onChange={(e) => updateSplit(index, 'actual_quantity_kg', Number(e.target.value))}
                        placeholder="Quantity in kg"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Split Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Batches Used</div>
                  <div className={`text-lg font-medium ${
                    totalBatchesUsed === totalBatches 
                      ? 'text-success' 
                      : 'text-destructive'
                  }`}>
                    {totalBatchesUsed} / {totalBatches}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Quantity Used</div>
                  <div className={`text-lg font-medium ${
                    Math.abs(totalQuantityUsed - ingredient.required_quantity_kg) < 0.01
                      ? 'text-success' 
                      : 'text-destructive'
                  }`}>
                    {totalQuantityUsed.toFixed(3)} / {ingredient.required_quantity_kg} kg
                  </div>
                </div>
              </div>

              {(totalBatchesUsed !== totalBatches || Math.abs(totalQuantityUsed - ingredient.required_quantity_kg) > 0.01) && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Splits must total exactly {totalBatches} batches and {ingredient.required_quantity_kg} kg
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Splits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};