import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompletedBatch {
  id: string;
  schedule_item_id: string;
  formula_code: string;
  formula_name: string;
  batch_count: number;
  total_produced_qty: number;
  completed_at: string;
  completed_by: string;
  status: string;
  tcp: number; // Total Cost of Production
  scheduled_date?: string;
  ingredient_deductions: Array<{
    id: string;
    ingredient_name: string;
    supplier_name: string | null;
    lot_number: string | null;
    deducted_quantity_kg: number;
  }>;
}

export const useCompletedBatches = () => {
  const [completedBatches, setCompletedBatches] = useState<CompletedBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const fetchInProgressRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCompletedBatches = useCallback(async () => {
    // Concurrency guard: skip if already fetching
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;

    try {
      setLoading(true);
      
      const { data: batchesData, error: batchesError } = await supabase
        .from('completed_batch_deductions')
        .select(`
          *,
          production_schedule_items!inner (
            production_schedules!inner (
              schedule_date
            )
          ),
          ingredient_deductions (
            id,
            ingredient_name,
            supplier_name,
            lot_number,
            deducted_quantity_kg
          )
        `)
        .order('completed_at', { ascending: false });

      if (batchesError) throw batchesError;

      // Return batches WITHOUT expensive TCP calculation (tcp: 0 default)
      const batches: CompletedBatch[] = (batchesData || []).map((batch: any) => {
        const scheduled_date = batch.production_schedule_items?.production_schedules?.schedule_date;
        return { ...batch, tcp: 0, scheduled_date };
      });

      setCompletedBatches(batches);
    } catch (error: any) {
      console.error('Error fetching completed batches:', error);
      toast({
        title: "Error",
        description: "Failed to load completed batches",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [toast]);

  const debouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchCompletedBatches();
    }, 300);
  }, [fetchCompletedBatches]);

  // On-demand TCP calculation for a single batch (used by Completed Batches tab)
  const calculateTCP = async (scheduleItemId: string, batchCount: number): Promise<number> => {
    try {
      const { data: scheduleItem, error: scheduleError } = await supabase
        .from('production_schedule_items')
        .select('formula_id')
        .eq('id', scheduleItemId)
        .maybeSingle();

      if (scheduleError || !scheduleItem) return 0;

      const { data: formula, error: formulaError } = await supabase
        .from('formulas')
        .select('recipe_json')
        .eq('id', scheduleItem.formula_id)
        .maybeSingle();

      if (formulaError || !formula?.recipe_json) return 0;

      const recipe = formula.recipe_json as any[];
      let totalCost = 0;

      for (const ingredient of recipe) {
        if (!ingredient.materialName || !ingredient.name) continue;
        
        const materialName = ingredient.materialName;
        const qtyPerBatch = parseFloat(ingredient.weightKg) || 0;
        
        const { data: rawMaterial, error: materialError } = await supabase
          .from('raw_materials')
          .select('id')
          .ilike('name', materialName)
          .maybeSingle();

        if (materialError || !rawMaterial) continue;
        
        const { data: lots, error: lotsError } = await supabase
          .from('raw_material_lots')
          .select('cost, quantity')
          .eq('raw_material_id', rawMaterial.id)
          .gt('quantity', 0);

        if (!lotsError && lots && lots.length > 0) {
          let totalWeight = 0;
          let weightedCostSum = 0;
          
          lots.forEach(lot => {
            const cost = lot.cost || 0;
            const quantity = lot.quantity || 0;
            weightedCostSum += cost * quantity;
            totalWeight += quantity;
          });
          
          const avgCostPerKg = totalWeight > 0 ? weightedCostSum / totalWeight : 0;
          totalCost += qtyPerBatch * batchCount * avgCostPerKg;
        }
      }

      return totalCost;
    } catch (error) {
      console.error('Error calculating TCP:', error);
      return 0;
    }
  };

  const deductInventoryForBatch = async (
    scheduleItemId: string,
    formulaCode: string,
    formulaName: string,
    batchCount: number,
    totalProducedQty: number
  ) => {
    try {
      const { data, error } = await supabase.rpc('deduct_inventory_for_batch', {
        p_schedule_item_id: scheduleItemId,
        p_formula_code: formulaCode,
        p_formula_name: formulaName,
        p_batch_count: batchCount,
        p_total_produced_qty: totalProducedQty
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        completed_batch_id?: string;
        total_processed?: number;
        total_success?: number;
        over_deductions?: number;
        warnings?: any[];
        successes?: any[];
        errors?: any[];
        message?: string;
        error?: string;
      };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to deduct inventory');
      }

      // Fire-and-forget: send production complete email if linked to an order
      supabase
        .from('production_schedule_items')
        .select('order_header_id')
        .eq('id', scheduleItemId)
        .maybeSingle()
        .then(({ data: scheduleItem }) => {
          if (scheduleItem?.order_header_id) {
            supabase.functions.invoke('send-order-email', {
              body: { order_id: scheduleItem.order_header_id, event_type: 'PRODUCTION_COMPLETE' },
            }).catch(err => console.error('Email notification error:', err));
          }
        });

      // Refresh the completed batches list
      await fetchCompletedBatches();
      
      return result;
    } catch (error: any) {
      console.error('Error deducting inventory:', error);
      return { 
        success: false, 
        error: error.message,
        total_processed: 0,
        total_success: 0,
        over_deductions: 0,
        warnings: [],
        successes: [],
        errors: [{ error: error.message }]
      };
    }
  };

  const undoDeduction = async (completedBatchId: string) => {
    try {
      const { data, error } = await supabase.rpc('undo_inventory_deduction', {
        p_completed_batch_id: completedBatchId
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to undo deduction');
      }

      toast({
        title: "Success",
        description: "Deduction reversed successfully.",
      });

      await fetchCompletedBatches();
      
      return { success: true };
    } catch (error: any) {
      console.error('Error undoing deduction:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to undo deduction",
        variant: "destructive"
      });
      return { success: false };
    }
  };

  useEffect(() => {
    fetchCompletedBatches();
    
    // Debounced realtime subscription
    const channel = supabase
      .channel(`completed-batches-changes-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'completed_batch_deductions' },
        () => debouncedFetch()
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchCompletedBatches, debouncedFetch]);

  return {
    completedBatches,
    loading,
    deductInventoryForBatch,
    undoDeduction,
    calculateTCP,
    refetch: fetchCompletedBatches
  };
};
