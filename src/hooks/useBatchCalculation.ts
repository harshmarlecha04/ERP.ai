import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BatchCalculationResult {
  max_batches: number;
  limiting_ingredient: {
    ingredient_id: string;
    ingredient_name: string;
    available_kg: number;
    required_per_batch_kg: number;
    max_batches: number;
  } | null;
  ingredient_details: Array<{
    ingredient_id: string;
    ingredient_name: string;
    matched_material_name?: string;
    available_kg: number;
    required_per_batch_kg: number;
    max_batches_from_ingredient: number;
    has_inventory_match?: boolean;
  }>;
  has_sufficient_inventory: boolean;
}

export const useBatchCalculation = (formulaId: string) => {
  return useQuery({
    queryKey: ['batch-calculation', formulaId],
    queryFn: async (): Promise<BatchCalculationResult> => {
      const { data, error } = await supabase
        .rpc('calculate_max_batches', { p_formula_id: formulaId });

      if (error) throw error;
      
      // Cast the data to the expected type
      const result = data as unknown as BatchCalculationResult;
      
      return result || {
        max_batches: 0,
        limiting_ingredient: null,
        ingredient_details: [],
        has_sufficient_inventory: false
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    enabled: !!formulaId,
  });
};