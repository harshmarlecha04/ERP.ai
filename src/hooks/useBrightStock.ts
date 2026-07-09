import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BrightStockItem {
  id: string;
  formula_id: string;
  bottle_size: number;
  quantity_bottles: number;
  production_date: string;
  production_schedule_item_id: string | null;
  customer_id: string | null;
  notes: string | null;
  is_allocated: boolean;
  allocated_to_order_id: string | null;
  created_at: string;
  formula?: {
    code: string;
    name: string;
  };
}

export const useBrightStock = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: brightStock, isLoading } = useQuery({
    queryKey: ['bright-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bright_stock')
        .select(`
          *,
          formula:formulas(code, name)
        `)
        .eq('is_allocated', false)
        .order('production_date', { ascending: true });

      if (error) throw error;
      return data as BrightStockItem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      formula_id: string;
      bottle_size: number;
      quantity_bottles: number;
      production_date: string;
      customer_id?: string | null;
      notes?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('bright_stock')
        .insert({
          formula_id: data.formula_id,
          bottle_size: data.bottle_size,
          quantity_bottles: data.quantity_bottles,
          production_date: data.production_date,
          customer_id: data.customer_id || null,
          notes: data.notes || null,
          is_allocated: false,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bright-stock'] });
      toast({
        title: 'Success',
        description: 'Bright stock entry created',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const allocateMutation = useMutation({
    mutationFn: async ({ 
      brightStockId, 
      orderId, 
      quantityToAllocate 
    }: { 
      brightStockId: string; 
      orderId: string; 
      quantityToAllocate: number;
    }) => {
      const { data: stock } = await supabase
        .from('bright_stock')
        .select('quantity_bottles')
        .eq('id', brightStockId)
        .single();

      if (!stock) throw new Error('Bright stock not found');

      const remainingQty = stock.quantity_bottles - quantityToAllocate;

      if (remainingQty === 0) {
        // Fully allocated - mark as allocated
        const { error } = await supabase
          .from('bright_stock')
          .update({
            is_allocated: true,
            allocated_to_order_id: orderId,
            quantity_bottles: 0,
          })
          .eq('id', brightStockId);

        if (error) throw error;
      } else if (remainingQty > 0) {
        // Partial allocation - reduce quantity
        const { error } = await supabase
          .from('bright_stock')
          .update({
            quantity_bottles: remainingQty,
          })
          .eq('id', brightStockId);

        if (error) throw error;

        // Create order_production_batch entry for allocated bottles
        const { data: stockData } = await supabase
          .from('bright_stock')
          .select('formula_id, bottle_size')
          .eq('id', brightStockId)
          .single();

        if (stockData) {
          await supabase
            .from('order_production_batches')
            .insert({
              customer_order_id: orderId,
              production_schedule_item_id: null,
              estimated_bottles: quantityToAllocate,
              actual_bottles_packed: quantityToAllocate,
              batch_sequence: 0,
              is_bright_stock: true,
              bright_stock_id: brightStockId,
            } as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bright-stock'] });
      toast({
        title: 'Success',
        description: 'Bright stock allocated to order',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (brightStockId: string) => {
      const { error } = await supabase
        .from('bright_stock')
        .delete()
        .eq('id', brightStockId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bright-stock'] });
      toast({
        title: 'Success',
        description: 'Bright stock entry deleted',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Get available bright stock for a specific formula and bottle size
  const getAvailableForFormula = (formulaId: string, bottleSize: number) => {
    return brightStock?.filter(
      item => item.formula_id === formulaId && 
              item.bottle_size === bottleSize &&
              !item.is_allocated
    ) || [];
  };

  // Calculate total available bottles for a formula/size combo
  const getTotalAvailable = (formulaId: string, bottleSize: number) => {
    return getAvailableForFormula(formulaId, bottleSize)
      .reduce((sum, item) => sum + item.quantity_bottles, 0);
  };

  return {
    brightStock: brightStock || [],
    isLoading,
    createBrightStock: createMutation.mutate,
    createBrightStockAsync: createMutation.mutateAsync,
    allocate: allocateMutation.mutate,
    deleteBrightStock: deleteMutation.mutate,
    getAvailableForFormula,
    getTotalAvailable,
  };
};
