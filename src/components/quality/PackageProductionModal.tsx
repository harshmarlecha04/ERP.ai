import React, { useState, useEffect } from 'react';
import { parseDateString, formatET, todayET } from "@/utils/dateUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, AlertCircle, Container, Box } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PackageProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleItem: {
    id: string;
    formula_id: string;
    formula_code: string;
    formula_name: string;
    batches: number;
    schedule_date: string;
    actual_gummies_produced?: number;
  } | null;
  onSuccess: () => void;
}

export const PackageProductionModal: React.FC<PackageProductionModalProps> = ({
  isOpen,
  onClose,
  scheduleItem,
  onSuccess
}) => {
  const [bottlesPacked, setBottlesPacked] = useState('');
  const [bottleSize, setBottleSize] = useState('60');
  const [saving, setSaving] = useState(false);
  const [estimatedBottles, setEstimatedBottles] = useState(0);
  const [yieldVariance, setYieldVariance] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && scheduleItem) {
      loadFormulaData();
      setBottlesPacked('');
      setYieldVariance(0);
    }
  }, [isOpen, scheduleItem]);

  const loadFormulaData = async () => {
    if (!scheduleItem) return;

    try {
      const { data: formulaData, error } = await supabase
        .from('formulas')
        .select('gummies_per_batch')
        .eq('id', scheduleItem.formula_id)
        .single();

      if (error) throw error;

      if (formulaData?.gummies_per_batch) {
        const totalGummies = formulaData.gummies_per_batch * scheduleItem.batches;
        const estimatedBottlesCount = Math.floor(totalGummies / parseInt(bottleSize));
        setEstimatedBottles(estimatedBottlesCount);
      }
    } catch (error: any) {
      console.error('Error loading formula:', error);
    }
  };

  useEffect(() => {
    if (scheduleItem && bottleSize) {
      loadFormulaData();
    }
  }, [bottleSize]);

  const calculateYieldVariance = (packed: number) => {
    if (estimatedBottles === 0) return 0;
    return ((packed - estimatedBottles) / estimatedBottles) * 100;
  };

  const handleBottlesChange = (value: string) => {
    setBottlesPacked(value);
    const packed = parseInt(value) || 0;
    const variance = calculateYieldVariance(packed);
    setYieldVariance(variance);
  };

  const handleSave = async () => {
    if (!scheduleItem || !bottlesPacked) {
      toast({
        title: "Validation Error",
        description: "Please enter the number of bottles packed",
        variant: "destructive"
      });
      return;
    }

    const packedCount = parseInt(bottlesPacked);
    if (isNaN(packedCount) || packedCount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid number of bottles",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const bottleSizeNum = parseInt(bottleSize);
      const gummiesPacked = packedCount * bottleSizeNum;
      
      // Fetch current schedule item data to get weigh-up info
      const { data: scheduleData, error: fetchError } = await supabase
        .from("production_schedule_items")
        .select("actual_gummies_produced, actual_yield_kg, avg_wet_piece_weight_g")
        .eq("id", scheduleItem.id)
        .single();

      if (fetchError) throw fetchError;

      let trueYieldPercent = yieldVariance;
      let moistureLossPercent = null;

      // Calculate true yield if weigh-up data exists
      if (scheduleData?.actual_gummies_produced && scheduleData.actual_gummies_produced > 0) {
        trueYieldPercent = (gummiesPacked / scheduleData.actual_gummies_produced) * 100;
      }

      // Calculate moisture loss (backward calculation)
      const avgWetWeight = scheduleData?.avg_wet_piece_weight_g || 3.5;
      const avgDriedWeight = 2.9; // Assumed average dried weight
      const estimatedWetWeight = gummiesPacked * avgWetWeight;
      const estimatedDriedWeight = gummiesPacked * avgDriedWeight;
      moistureLossPercent = ((estimatedWetWeight - estimatedDriedWeight) / estimatedWetWeight) * 100;

      // Update production schedule item with bottles packed and moisture loss
      const { error: updateError } = await supabase
        .from('production_schedule_items')
        .update({
          bottles_packed: packedCount,
          yield_variance_percent: trueYieldPercent,
          moisture_loss_percent: moistureLossPercent,
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleItem.id);

      if (updateError) throw updateError;

      // Update linked order batches and handle bright stock for excess
      const { data: orderBatches, error: batchError } = await supabase
        .from('order_production_batches')
        .select('id, line_item_id, estimated_bottles')
        .eq('production_schedule_item_id', scheduleItem.id);

      if (batchError) throw batchError;

      let excessBottles = 0;
      
      if (orderBatches && orderBatches.length > 0) {
        // Calculate total estimated bottles from all order batches
        const totalEstimatedForOrders = orderBatches.reduce(
          (sum, batch) => sum + (batch.estimated_bottles || 0), 
          0
        );
        
        // Allocate bottles to orders up to their estimated amount
        const bottlesToAllocate = Math.min(packedCount, totalEstimatedForOrders);
        excessBottles = Math.max(0, packedCount - totalEstimatedForOrders);
        
        // Update order batches with actual bottles (capped at estimated)
        const { error: batchUpdateError } = await supabase
          .from('order_production_batches')
          .update({ actual_bottles_packed: bottlesToAllocate })
          .eq('production_schedule_item_id', scheduleItem.id);

        if (batchUpdateError) throw batchUpdateError;

        // Create bright stock entry for excess bottles
        if (excessBottles > 0) {
          // Get customer_id from line_item if exists
          let customerId = null;
          if (orderBatches[0]?.line_item_id) {
            const { data: lineItemData } = await supabase
              .from('order_line_items')
              .select('order_id, order_headers!inner(customer_id)')
              .eq('id', orderBatches[0].line_item_id)
              .single();
            customerId = lineItemData?.order_headers?.customer_id;
          }
          
          const { error: brightStockError } = await supabase
            .from('bright_stock')
            .insert({
              formula_id: scheduleItem.formula_id,
              bottle_size: bottleSizeNum,
              quantity_bottles: excessBottles,
              production_date: todayET(),
              production_schedule_item_id: scheduleItem.id,
              customer_id: customerId,
              notes: `Excess from production batch ${scheduleItem.formula_code}`,
              is_allocated: false
            });

          if (brightStockError) {
            console.error('Error creating bright stock:', brightStockError);
            toast({
              title: "Warning",
              description: `${excessBottles} excess bottles couldn't be added to bright stock`,
              variant: "destructive"
            });
          } else {
            toast({
              title: "Bright Stock Created",
              description: `${excessBottles} excess bottles added to bright stock inventory`,
            });
          }
        }
      } else {
        // No linked orders - all bottles go to bright stock
        excessBottles = packedCount;
        const { error: brightStockError } = await supabase
          .from('bright_stock')
          .insert({
            formula_id: scheduleItem.formula_id,
            bottle_size: bottleSizeNum,
            quantity_bottles: excessBottles,
            production_date: todayET(),
            production_schedule_item_id: scheduleItem.id,
            notes: `Production batch ${scheduleItem.formula_code} - no linked order`,
            is_allocated: false
          });

        if (brightStockError) {
          console.error('Error creating bright stock:', brightStockError);
        }
      }

      // Find packaging items for bottles, caps, and labels
      const { data: packagingItems } = await supabase
        .from('packaging_item')
        .select('id, item_name, category')
        .in('category', ['Bottles', 'Caps', 'Labels']);

      if (packagingItems) {
        for (const item of packagingItems) {
          const { error: movementError } = await supabase
            .from('packaging_movement')
            .insert({
              item_id: item.id,
              move_type: 'usage',
              qty: packedCount,
              move_date: todayET(),
              notes: `Production: ${scheduleItem.formula_code} (${scheduleItem.batches} batches)`
            });

          if (movementError) {
            console.error('Error recording packaging usage:', movementError);
          }
        }
      }

      toast({
        title: "Success",
        description: `Packaging recorded: ${packedCount} bottles | Yield: ${trueYieldPercent.toFixed(1)}% | Moisture Loss: ${moistureLossPercent.toFixed(1)}%`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving packaging data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save packaging data",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (!scheduleItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="[--dialog-max-width:42rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Container className="h-5 w-5" />
            Record Packaging - {scheduleItem.formula_code}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Batch Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Formula:</span>
                  <div className="font-medium">{scheduleItem.formula_name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Batches:</span>
                  <div className="font-medium">{scheduleItem.batches}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Scheduled Date:</span>
                  <div className="font-medium">
                    {formatET(scheduleItem.schedule_date, "M/d/yyyy")}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Estimated Bottles:</span>
                  <div className="font-medium">{estimatedBottles} bottles</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Packaging Input */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bottle-size">Bottle Size (gummies)</Label>
                <Input
                  id="bottle-size"
                  type="number"
                  value={bottleSize}
                  onChange={(e) => setBottleSize(e.target.value)}
                  placeholder="60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bottles-packed">Actual Bottles Packed *</Label>
                <Input
                  id="bottles-packed"
                  type="number"
                  value={bottlesPacked}
                  onChange={(e) => handleBottlesChange(e.target.value)}
                  placeholder="Enter bottles packed"
                />
              </div>
            </div>

            {/* Yield Variance Display */}
            {bottlesPacked && estimatedBottles > 0 && (
              <Alert className={Math.abs(yieldVariance) > 5 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}>
                <AlertCircle className={`h-4 w-4 ${Math.abs(yieldVariance) > 5 ? 'text-amber-600' : 'text-green-600'}`} />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>Yield Variance: </span>
                    <Badge variant={Math.abs(yieldVariance) > 5 ? "destructive" : "default"} className="ml-2">
                      {yieldVariance > 0 ? '+' : ''}{yieldVariance.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Expected: {estimatedBottles} bottles | Actual: {bottlesPacked} bottles
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Packaging Materials Info */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <Box className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <div className="font-medium mb-1">Packaging materials will be deducted:</div>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>{bottlesPacked || 0} bottles</li>
                    <li>{bottlesPacked || 0} caps</li>
                    <li>{bottlesPacked || 0} labels</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !bottlesPacked}>
            {saving ? 'Saving...' : 'Save Packaging'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
