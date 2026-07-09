import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MaterialCheckResult {
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

export type MaterialStatus = 'checking' | 'sufficient' | 'partial' | 'insufficient' | null;

export const useMaterialCheck = (formulaId: string | undefined, batchesNeeded: number) => {
  const [status, setStatus] = useState<MaterialStatus>(null);
  const [result, setResult] = useState<MaterialCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!formulaId || batchesNeeded <= 0) {
      setStatus(null);
      setResult(null);
      return;
    }

    const checkMaterials = async () => {
      setIsChecking(true);
      setStatus('checking');

      try {
        const { data, error } = await supabase
          .rpc('calculate_max_batches', { p_formula_id: formulaId });

        if (error) throw error;

        const materialData = data as unknown as MaterialCheckResult;
        setResult(materialData);

        if (materialData.has_sufficient_inventory && materialData.max_batches >= batchesNeeded) {
          setStatus('sufficient');
        } else if (materialData.max_batches > 0 && materialData.max_batches < batchesNeeded) {
          setStatus('partial');
        } else {
          setStatus('insufficient');
        }
      } catch (error: any) {
        console.error('Material check failed:', error);
        toast({
          title: 'Material check failed',
          description: error.message,
          variant: 'destructive',
        });
        setStatus(null);
      } finally {
        setIsChecking(false);
      }
    };

    checkMaterials();
  }, [formulaId, batchesNeeded, toast]);

  return {
    status,
    result,
    isChecking,
    canMakeBatches: result?.max_batches || 0,
  };
};
