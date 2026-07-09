import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InventoryThreshold {
  id: string;
  raw_material_id: string;
  min_quantity_kg: number;
  reorder_quantity_kg: number;
  alert_enabled: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryStatusWithThreshold {
  raw_material_id: string;
  material_code: string;
  material_name: string;
  supplier: string | null;
  current_quantity_kg: number;
  min_quantity_kg: number;
  reorder_quantity_kg: number;
  alert_enabled: boolean;
  status: 'critical' | 'low' | 'approaching_low' | 'good' | 'no_threshold';
  percentage_of_minimum: number | null;
}

export const useInventoryThresholds = () => {
  return useQuery({
    queryKey: ['inventory-thresholds'],
    queryFn: async (): Promise<InventoryThreshold[]> => {
      const { data, error } = await supabase
        .from('inventory_thresholds')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useInventoryStatusWithThresholds = () => {
  return useQuery({
    queryKey: ['inventory-status-with-thresholds'],
    queryFn: async (): Promise<InventoryStatusWithThreshold[]> => {
      const { data, error } = await supabase
        .rpc('get_inventory_status_with_thresholds');

      if (error) throw error;
      return (data || []) as InventoryStatusWithThreshold[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useCreateInventoryThreshold = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (threshold: Omit<InventoryThreshold, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('inventory_thresholds')
        .upsert([threshold], { 
          onConflict: 'raw_material_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-thresholds'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-status-with-thresholds'] });
      toast.success('Inventory threshold saved successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to save inventory threshold: ' + error.message);
    },
  });
};

export const useUpdateInventoryThreshold = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InventoryThreshold> & { id: string }) => {
      const { data, error } = await supabase
        .from('inventory_thresholds')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-thresholds'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-status-with-thresholds'] });
      toast.success('Inventory threshold updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update inventory threshold: ' + error.message);
    },
  });
};

export const useDeleteInventoryThreshold = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_thresholds')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-thresholds'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-status-with-thresholds'] });
      toast.success('Inventory threshold deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete inventory threshold: ' + error.message);
    },
  });
};

export const useBulkUpdateThresholds = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (thresholds: Array<Partial<InventoryThreshold> & { raw_material_id: string }>) => {
      const { data, error } = await supabase
        .from('inventory_thresholds')
        .upsert(thresholds, { 
          onConflict: 'raw_material_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-thresholds'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-status-with-thresholds'] });
      toast.success(`${data.length} inventory thresholds updated successfully`);
    },
    onError: (error: any) => {
      toast.error('Failed to update inventory thresholds: ' + error.message);
    },
  });
};