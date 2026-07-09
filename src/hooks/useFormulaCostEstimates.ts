import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface LaborRow {
  id: string;
  role: string;
  payPerHour: number;
  hours: number;
}

export interface UtilityLine {
  id: string;
  name: string;
  cost: number;
}

export interface RMLine {
  materialName: string;
  qtyPerBatch: number;
  unit: string;
  unitCost: number;
  extendedCost: number;
  hasCost: boolean;
}

export interface PackagingMaterial {
  id?: string;
  name: string;
  unitCost: number;
}

export interface CostEstimateTotals {
  rmSubtotal: number;
  laborManufacturing: number;
  laborCoating: number;
  laborPackaging: number;
  laborTotal: number;
  utilitiesSubtotal: number;
  packagingMaterialsSubtotal?: number;
  grandTotal: number;
  costPerBatch: number;
  gummiesPerBatch?: number;
  bottleCount?: number;
  isCustomBottleCount?: boolean;
  packagingBottle?: PackagingMaterial;
  packagingCap?: PackagingMaterial;
  laborScalingMode?: 'flat' | 'per_batch';
  utilitiesScalingMode?: 'flat' | 'per_batch' | 'percent';
  laborMode?: 'detailed' | 'total';
  laborTotals?: {
    manufacturing: number;
    coating: number;
    packaging: number;
  };
}

export interface CostEstimate {
  id: string;
  formula_id: string;
  estimate_name: string;
  batches: number;
  rm_lines: RMLine[];
  labor_manufacturing: LaborRow[];
  labor_coating: LaborRow[];
  labor_packaging: LaborRow[];
  utilities_mode: 'percent' | 'manual';
  utilities_value: { percent?: number; lines?: UtilityLine[] };
  totals: CostEstimateTotals;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_default: boolean;
}

export const useFormulaCostEstimates = (formulaId: string | null) => {
  const [estimates, setEstimates] = useState<CostEstimate[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchEstimates = async () => {
    if (!formulaId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('formula_cost_estimates')
        .select('*')
        .eq('formula_id', formulaId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Cast the data to our type
      const typedData: CostEstimate[] = (data || []).map(item => ({
        id: item.id,
        formula_id: item.formula_id,
        estimate_name: item.estimate_name,
        batches: Number(item.batches),
        rm_lines: (item.rm_lines as unknown as RMLine[]) || [],
        labor_manufacturing: (item.labor_manufacturing as unknown as LaborRow[]) || [],
        labor_coating: (item.labor_coating as unknown as LaborRow[]) || [],
        labor_packaging: (item.labor_packaging as unknown as LaborRow[]) || [],
        utilities_mode: item.utilities_mode as 'percent' | 'manual',
        utilities_value: (item.utilities_value as unknown as { percent?: number; lines?: UtilityLine[] }) || { percent: 5 },
        totals: (item.totals as unknown as CostEstimateTotals) || {
          rmSubtotal: 0,
          laborManufacturing: 0,
          laborCoating: 0,
          laborPackaging: 0,
          laborTotal: 0,
          utilitiesSubtotal: 0,
          grandTotal: 0,
          costPerBatch: 0,
        },
        created_by: item.created_by,
        created_at: item.created_at || '',
        updated_at: item.updated_at || '',
        is_default: item.is_default || false,
      }));
      
      setEstimates(typedData);
    } catch (error) {
      console.error('Error fetching estimates:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveEstimate = async (
    data: Omit<CostEstimate, 'id' | 'created_by' | 'created_at' | 'updated_at' | 'is_default'>,
    existingId?: string
  ): Promise<string | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to save estimates.',
          variant: 'destructive',
        });
        return null;
      }

      if (existingId) {
        // Update existing
        const { error } = await supabase
          .from('formula_cost_estimates')
          .update({
            estimate_name: data.estimate_name,
            batches: data.batches,
            rm_lines: data.rm_lines as unknown as Json,
            labor_manufacturing: data.labor_manufacturing as unknown as Json,
            labor_coating: data.labor_coating as unknown as Json,
            labor_packaging: data.labor_packaging as unknown as Json,
            utilities_mode: data.utilities_mode,
            utilities_value: data.utilities_value as unknown as Json,
            totals: data.totals as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId);

        if (error) throw error;
        
        toast({
          title: 'Estimate Updated',
          description: `"${data.estimate_name}" has been updated.`,
        });
        
        await fetchEstimates();
        return existingId;
      } else {
        // Create new
        const { data: newData, error } = await supabase
          .from('formula_cost_estimates')
          .insert({
            formula_id: data.formula_id,
            estimate_name: data.estimate_name,
            batches: data.batches,
            rm_lines: data.rm_lines as unknown as Json,
            labor_manufacturing: data.labor_manufacturing as unknown as Json,
            labor_coating: data.labor_coating as unknown as Json,
            labor_packaging: data.labor_packaging as unknown as Json,
            utilities_mode: data.utilities_mode,
            utilities_value: data.utilities_value as unknown as Json,
            totals: data.totals as unknown as Json,
            created_by: userData.user.id,
          })
          .select('id')
          .single();

        if (error) throw error;
        
        toast({
          title: 'Estimate Saved',
          description: `"${data.estimate_name}" has been saved.`,
        });
        
        await fetchEstimates();
        return newData?.id || null;
      }
    } catch (error) {
      console.error('Error saving estimate:', error);
      toast({
        title: 'Error',
        description: 'Failed to save estimate. Please try again.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteEstimate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('formula_cost_estimates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Estimate Deleted',
        description: 'The estimate has been removed.',
      });
      
      await fetchEstimates();
    } catch (error) {
      console.error('Error deleting estimate:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete estimate. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getDefaultCostTemplate = async (targetFormulaId: string): Promise<CostEstimate | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const { data, error } = await supabase
        .from('formula_cost_estimates')
        .select('*')
        .eq('formula_id', targetFormulaId)
        .eq('created_by', userData.user.id)
        .eq('is_default', true)
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        formula_id: data.formula_id,
        estimate_name: data.estimate_name,
        batches: Number(data.batches),
        rm_lines: (data.rm_lines as unknown as RMLine[]) || [],
        labor_manufacturing: (data.labor_manufacturing as unknown as LaborRow[]) || [],
        labor_coating: (data.labor_coating as unknown as LaborRow[]) || [],
        labor_packaging: (data.labor_packaging as unknown as LaborRow[]) || [],
        utilities_mode: data.utilities_mode as 'percent' | 'manual',
        utilities_value: (data.utilities_value as unknown as { percent?: number; lines?: UtilityLine[] }) || { percent: 5 },
        totals: (data.totals as unknown as CostEstimateTotals) || {
          rmSubtotal: 0,
          laborManufacturing: 0,
          laborCoating: 0,
          laborPackaging: 0,
          laborTotal: 0,
          utilitiesSubtotal: 0,
          grandTotal: 0,
          costPerBatch: 0,
        },
        created_by: data.created_by,
        created_at: data.created_at || '',
        updated_at: data.updated_at || '',
        is_default: true,
      };
    } catch (error) {
      console.error('Error fetching default cost template:', error);
      return null;
    }
  };

  const saveDefaultCostTemplate = async (
    data: Omit<CostEstimate, 'id' | 'created_by' | 'created_at' | 'updated_at' | 'is_default'>
  ): Promise<string | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to save cost templates.',
          variant: 'destructive',
        });
        return null;
      }

      // Check if a default already exists
      const existing = await getDefaultCostTemplate(data.formula_id);

      if (existing) {
        // Update existing default
        const { error } = await supabase
          .from('formula_cost_estimates')
          .update({
            estimate_name: 'Default Cost',
            batches: data.batches,
            rm_lines: data.rm_lines as unknown as Json,
            labor_manufacturing: data.labor_manufacturing as unknown as Json,
            labor_coating: data.labor_coating as unknown as Json,
            labor_packaging: data.labor_packaging as unknown as Json,
            utilities_mode: data.utilities_mode,
            utilities_value: data.utilities_value as unknown as Json,
            totals: data.totals as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;

        toast({
          title: 'Default Cost Updated',
          description: 'The default cost template has been updated.',
        });

        await fetchEstimates();
        return existing.id;
      } else {
        // Create new default
        const { data: newData, error } = await supabase
          .from('formula_cost_estimates')
          .insert({
            formula_id: data.formula_id,
            estimate_name: 'Default Cost',
            batches: 1, // Always save template with 1 batch as base
            rm_lines: data.rm_lines as unknown as Json,
            labor_manufacturing: data.labor_manufacturing as unknown as Json,
            labor_coating: data.labor_coating as unknown as Json,
            labor_packaging: data.labor_packaging as unknown as Json,
            utilities_mode: data.utilities_mode,
            utilities_value: data.utilities_value as unknown as Json,
            totals: data.totals as unknown as Json,
            created_by: userData.user.id,
            is_default: true,
          })
          .select('id')
          .single();

        if (error) throw error;

        toast({
          title: 'Default Cost Saved',
          description: 'The default cost template has been created.',
        });

        await fetchEstimates();
        return newData?.id || null;
      }
    } catch (error) {
      console.error('Error saving default cost template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save default cost template. Please try again.',
        variant: 'destructive',
      });
      return null;
    }
  };

  useEffect(() => {
    fetchEstimates();
  }, [formulaId]);

  return {
    estimates,
    loading,
    saveEstimate,
    deleteEstimate,
    refreshEstimates: fetchEstimates,
    getDefaultCostTemplate,
    saveDefaultCostTemplate,
  };
};
