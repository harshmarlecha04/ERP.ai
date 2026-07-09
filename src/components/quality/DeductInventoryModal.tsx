import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IngredientUsage {
  id: string;
  raw_material_id: string;
  ingredient_name: string;
  supplier_name: string | null;
  lot_number: string | null;
  lot_id: string | null;
  required_quantity_kg: number;
  actual_quantity_kg: number;
  current_lot_quantity: number;
  batches_used: number;
  after_deduction_quantity: number;
  is_over_deduction: boolean;
  will_use_fifo: boolean;
  fifo_allocation?: Array<{
    lot_number: string;
    supplier_name: string;
    available_qty: number;
    will_deduct: number;
    is_primary: boolean;
  }>;
}

interface DeductInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  batchInfo: {
    id: string;
    formulaCode: string;
    formulaName: string;
    batches: number;
    scheduleDate: string;
  } | null;
}

export const DeductInventoryModal: React.FC<DeductInventoryModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  batchInfo
}) => {
  const [ingredients, setIngredients] = useState<IngredientUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchIngredientUsage = async () => {
    if (!batchInfo?.id) return;

    try {
      setLoading(true);
      
      // First, fetch the basic production ingredient usage data
      const { data: usageData, error: usageError } = await supabase
        .from('production_ingredient_usage')
        .select('*')
        .eq('schedule_item_id', batchInfo.id);

      if (usageError) {
        console.error('Usage data fetch error:', usageError);
        throw usageError;
      }

      console.log('Production ingredient usage data:', usageData);

      if (!usageData || usageData.length === 0) {
        setIngredients([]);
        return;
      }

      // Fetch raw material names for the ingredients
      const materialIds = [...new Set(usageData.map(usage => usage.raw_material_id))];
      const { data: materialsData } = await supabase
        .from('raw_materials')
        .select('id, name')
        .in('id', materialIds);

      // Fetch lot quantities for lots that have lot_id
      const lotIds = usageData.filter(usage => usage.lot_id).map(usage => usage.lot_id);
      console.log('Fetching lot quantities for lot IDs:', lotIds);
      
      const { data: lotsData } = await supabase
        .from('raw_material_lots')
        .select('id, quantity, lot_number')
        .in('id', lotIds);

      console.log('Fetched lot data:', lotsData);

      // Create lookup maps
      const materialsMap = new Map(materialsData?.map(m => [m.id, m.name]) || []);
      const lotsMap = new Map(lotsData?.map(l => [l.id, l.quantity]) || []);
      
      console.log('Lots map:', Array.from(lotsMap.entries()));

      // Process each ingredient with FIFO allocation preview
      const ingredientsData: IngredientUsage[] = await Promise.all(
        usageData.map(async (usage: any) => {
          const ingredientName = materialsMap.get(usage.raw_material_id) || 'Unknown Ingredient';
          const currentQty = usage.lot_id ? (lotsMap.get(usage.lot_id) || 0) : 0;
          const deductionQty = usage.actual_quantity_kg;
          let remainingToDeduct = deductionQty;
          
          console.log(`\n=== Processing ingredient: ${ingredientName} ===`);
          console.log(`Raw material ID: ${usage.raw_material_id}`);
          console.log(`Required quantity: ${deductionQty} kg`);
          console.log(`Primary lot ID: ${usage.lot_id}`);
          console.log(`Primary lot quantity: ${currentQty} kg`);
          
          const fifoAllocation: Array<{
            lot_number: string;
            supplier_name: string;
            available_qty: number;
            will_deduct: number;
            is_primary: boolean;
          }> = [];

          // Check primary lot first
          if (usage.lot_id && currentQty > 0) {
            const primaryDeduction = Math.min(currentQty, remainingToDeduct);
            console.log(`Primary lot deduction: ${primaryDeduction} kg`);
            
            fifoAllocation.push({
              lot_number: usage.lot_number || 'Unknown',
              supplier_name: usage.supplier_name || 'Unknown',
              available_qty: currentQty,
              will_deduct: primaryDeduction,
              is_primary: true
            });
            remainingToDeduct -= primaryDeduction;
          }

          console.log(`Remaining to deduct after primary: ${remainingToDeduct} kg`);

          // If still need more, check ALL lots for this raw material (not just additional ones)
          if (remainingToDeduct > 0) {
            console.log(`Looking for ALL lots for ingredient: ${ingredientName}`);
            console.log(`Searching for raw_material_id: ${usage.raw_material_id}`);
            
            // Get ALL lots for this raw material, including the primary one
            const { data: allLots, error: lotsError } = await supabase
              .from('raw_material_lots')
              .select(`
                id, quantity, lot_number, receiving_date, created_at,
                raw_materials!inner(supplier)
              `)
              .eq('raw_material_id', usage.raw_material_id)
              .gt('quantity', 0)
              .order('receiving_date', { ascending: true, nullsFirst: false })
              .order('created_at', { ascending: true });

            if (lotsError) {
              console.error('All lots query error:', lotsError);
            }
            
            console.log(`Found ${allLots?.length || 0} total lots for ${ingredientName}:`);
            allLots?.forEach((lot, index) => {
              console.log(`  Lot ${index + 1}: ${lot.lot_number} - ${lot.quantity} kg available`);
            });

            // Process all lots except ones already added to FIFO allocation
            const alreadyUsedLotIds = new Set(fifoAllocation.map(alloc => alloc.lot_number));
            
            for (const lot of allLots || []) {
              if (remainingToDeduct <= 0) break;
              
              // Skip if we already used this lot
              if (alreadyUsedLotIds.has(lot.lot_number)) {
                console.log(`Skipping already used lot: ${lot.lot_number}`);
                continue;
              }
              
              const lotDeduction = Math.min(lot.quantity, remainingToDeduct);
              console.log(`Adding FIFO lot: ${lot.lot_number}, available: ${lot.quantity}, will deduct: ${lotDeduction}`);
              
              fifoAllocation.push({
                lot_number: lot.lot_number || 'Unknown',
                supplier_name: (lot.raw_materials as any)?.supplier || 'Unknown',
                available_qty: lot.quantity,
                will_deduct: lotDeduction,
                is_primary: false
              });
              remainingToDeduct -= lotDeduction;
            }
          }

          console.log(`Final remaining to deduct for ${ingredientName}: ${remainingToDeduct} kg`);
          console.log(`FIFO allocation for ${ingredientName}:`, fifoAllocation);

          const willUseFifo = fifoAllocation.length > 1 || (fifoAllocation.length === 1 && !fifoAllocation[0].is_primary);
          const totalCanDeduct = deductionQty - remainingToDeduct;
          const isOverDeduction = remainingToDeduct > 0;

          return {
            id: usage.id,
            raw_material_id: usage.raw_material_id,
            ingredient_name: materialsMap.get(usage.raw_material_id) || 'Unknown Ingredient',
            supplier_name: usage.supplier_name,
            lot_number: usage.lot_number,
            lot_id: usage.lot_id,
            required_quantity_kg: usage.required_quantity_kg,
            actual_quantity_kg: usage.actual_quantity_kg,
            current_lot_quantity: currentQty,
            batches_used: usage.batches_used,
            after_deduction_quantity: Math.max(currentQty - Math.min(currentQty, deductionQty), 0),
            is_over_deduction: isOverDeduction,
            will_use_fifo: willUseFifo,
            fifo_allocation: fifoAllocation
          };
        })
      );

      setIngredients(ingredientsData);
    } catch (error: any) {
      console.error('Error fetching ingredient usage:', error);
      toast({
        title: "Error",
        description: "Failed to load ingredient usage data. Please ensure production data has been updated first.",
        variant: "destructive"
      });
      setIngredients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && batchInfo?.id) {
      fetchIngredientUsage();
    }
  }, [isOpen, batchInfo?.id]);

  if (!batchInfo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="z-[9999] [--dialog-max-width:56rem] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Deduct Inventory for this batch?
          </DialogTitle>
          <DialogDescription>
            This will permanently deduct ingredients from inventory using automatic FIFO allocation. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Compact Batch Info */}
        <div className="flex-shrink-0 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
          <div className="text-sm space-y-1">
            <div><strong>Formula:</strong> {batchInfo.formulaCode} - {batchInfo.formulaName}</div>
            <div className="flex gap-4">
              <span><strong>Batches:</strong> {batchInfo.batches}</span>
              <span><strong>Date:</strong> {new Date(batchInfo.scheduleDate + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Ingredient Usage */}
        <div className="flex-1 min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4" />
            <h3 className="font-semibold">Ingredient Usage Details with FIFO Allocation</h3>
          </div>
          
          <ScrollArea className="h-[300px]">
            <div className="pr-4 space-y-4">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : ingredients.length > 0 ? (
                <div className="space-y-4">
                  {ingredients.map((ingredient) => (
                    <div key={ingredient.id} className="border rounded-lg p-4 bg-muted/20">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-foreground truncate">{ingredient.ingredient_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Required: {ingredient.actual_quantity_kg.toFixed(2)} kg
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {ingredient.is_over_deduction ? (
                            <Badge variant="destructive" className="text-xs">
                              Insufficient Stock
                            </Badge>
                          ) : ingredient.will_use_fifo ? (
                            <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">
                              FIFO Allocation
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Single Lot
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* FIFO Allocation Details */}
                      {ingredient.fifo_allocation && ingredient.fifo_allocation.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">
                            {ingredient.will_use_fifo ? 'Automatic FIFO Allocation:' : 'Lot Details:'}
                          </p>
                          
                          <div className="space-y-1">
                            {ingredient.fifo_allocation.map((allocation, index) => (
                              <div key={index} className="flex items-center gap-2 text-sm p-2 bg-background/50 rounded">
                                {allocation.is_primary && (
                                  <Badge variant="secondary" className="text-xs">Primary</Badge>
                                )}
                                <span className="font-mono text-xs">
                                  {allocation.lot_number}
                                </span>
                                <span className="text-muted-foreground">
                                  ({allocation.supplier_name})
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="font-semibold">
                                  {allocation.will_deduct.toFixed(2)} kg
                                </span>
                                <span className="text-muted-foreground text-xs">
                                  of {allocation.available_qty.toFixed(2)} kg
                                </span>
                              </div>
                            ))}
                          </div>

                          {ingredient.is_over_deduction && (
                            <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                              <p className="text-destructive font-medium">
                                ⚠️ Still short {(ingredient.actual_quantity_kg - 
                                  ingredient.fifo_allocation.reduce((sum, alloc) => sum + alloc.will_deduct, 0)
                                ).toFixed(2)} kg after using all available lots
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No production data found for this batch.</p>
                  <p className="text-sm">Please update production data first.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Compact Warning Messages */}
        <div className="flex-shrink-0 space-y-2 mt-3">
          <div className="text-sm text-muted-foreground">
            ⚠️ Make sure production data has been updated before deducting inventory.
          </div>
          {ingredients.some(i => i.will_use_fifo) && (
            <div className="text-xs bg-blue-50 dark:bg-blue-950/20 p-2 rounded border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
              🔄 <strong>FIFO (First In, First Out) Allocation:</strong> When a lot doesn't have enough stock, 
              the system will automatically use older lots to complete the deduction.
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={ingredients.length === 0}
          >
            Yes, Deduct Inventory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};