import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface OrderLineItem {
  id: string;
  order_id: string;
  line_number: string;
  formula_id: string;
  formula_name?: string;
  formula_code?: string;
  order_type: 'production' | 'rd_sample' | 'rd_development';
  bottle_size: 60 | 70 | 90 | 120;
  bottles_ordered: number;
  bottles_shipped: number;
  bottles_remaining: number;
  batches_required?: number | null;
  production_status: string;
  scheduled_production_date: string | null;
  suggested_start_date: string | null;
  notes: string | null;
  selected_bottle_id?: string | null;
  selected_cap_id?: string | null;
  selected_label_id?: string | null;
  created_at: string;
  updated_at: string;
}

export const useOrderLineItems = (orderId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch line items for a specific order
  const { data: lineItems = [], isLoading, error } = useQuery({
    queryKey: ['order-line-items', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      
      const { data, error } = await supabase
        .from('order_line_items')
        .select(`
          *,
          formulas!inner(name, code)
        `)
        .eq('order_id', orderId)
        .order('line_number', { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        ...item,
        formula_name: item.formulas?.name,
        formula_code: item.formulas?.code,
      })) as OrderLineItem[];
    },
    enabled: !!orderId,
  });

  // Update line item
  const updateLineItem = useMutation({
    mutationFn: async ({ lineItemId, updates }: { lineItemId: string; updates: Partial<OrderLineItem> }) => {
      const { error } = await supabase
        .from('order_line_items')
        .update(updates as any)
        .eq('id', lineItemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-line-items'] });
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      toast({ title: 'Line item updated successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update line item', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Delete line item
  const deleteLineItem = useMutation({
    mutationFn: async (lineItemId: string) => {
      const { error } = await supabase
        .from('order_line_items')
        .delete()
        .eq('id', lineItemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-line-items'] });
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      toast({ title: 'Line item deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to delete line item', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  return {
    lineItems,
    isLoading,
    error,
    updateLineItem,
    deleteLineItem,
  };
};
