import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBrightStock, BrightStockItem } from './useBrightStock';

export interface ExcessAllocationEntry {
  brightStockId: string;
  qtyToAllocate: number;
}

export const useExcessAllocation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { brightStock, getAvailableForFormula, getTotalAvailable } = useBrightStock();

  // Suggest FIFO allocation for a formula + bottle size
  const suggestAllocation = (
    formulaId: string,
    bottleSize: number,
    qtyNeeded: number
  ): { entries: ExcessAllocationEntry[]; totalAllocatable: number } => {
    const availableLots = getAvailableForFormula(formulaId, bottleSize);
    // Already sorted by production_date ascending (FIFO) from the hook
    const entries: ExcessAllocationEntry[] = [];
    let remaining = qtyNeeded;

    for (const lot of availableLots) {
      if (remaining <= 0) break;
      const allocate = Math.min(lot.quantity_bottles, remaining);
      entries.push({ brightStockId: lot.id, qtyToAllocate: allocate });
      remaining -= allocate;
    }

    return {
      entries,
      totalAllocatable: qtyNeeded - Math.max(remaining, 0),
    };
  };

  // Execute allocation: reduce bright stock quantities and create ledger entries
  const allocateExcess = useMutation({
    mutationFn: async ({
      orderId,
      lineItemId,
      allocations,
    }: {
      orderId: string;
      lineItemId: string;
      allocations: ExcessAllocationEntry[];
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || null;

      for (const alloc of allocations) {
        // Get current stock
        const { data: stock } = await supabase
          .from('bright_stock')
          .select('quantity_bottles')
          .eq('id', alloc.brightStockId)
          .single();

        if (!stock) throw new Error('Bright stock lot not found');

        const newQty = stock.quantity_bottles - alloc.qtyToAllocate;

        if (newQty === 0) {
          await supabase
            .from('bright_stock')
            .update({
              is_allocated: true,
              allocated_to_order_id: orderId,
              quantity_bottles: 0,
            })
            .eq('id', alloc.brightStockId);
        } else {
          await supabase
            .from('bright_stock')
            .update({ quantity_bottles: newQty })
            .eq('id', alloc.brightStockId);
        }

        // Create ledger transaction
        await supabase.from('finished_goods_excess_transactions').insert({
          bright_stock_id: alloc.brightStockId,
          order_id: orderId,
          line_item_id: lineItemId,
          transaction_type: 'ALLOCATE_TO_PO',
          qty: alloc.qtyToAllocate,
          created_by: userId,
          notes: `Allocated ${alloc.qtyToAllocate} bottles from bright stock to order`,
        });
      }

      // Update line item fulfillment fields
      const totalAllocated = allocations.reduce((s, a) => s + a.qtyToAllocate, 0);
      
      // Get current line item to compute qty_to_produce
      const { data: lineItem } = await supabase
        .from('order_line_items')
        .select('bottles_ordered')
        .eq('id', lineItemId)
        .single();

      if (lineItem) {
        await supabase
          .from('order_line_items')
          .update({
            qty_allocated_from_excess: totalAllocated,
            qty_to_produce: lineItem.bottles_ordered - totalAllocated,
          } as any)
          .eq('id', lineItemId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bright-stock'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['order-line-items'] });
      toast({ title: 'Excess inventory allocated to order' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to allocate excess',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    brightStock,
    suggestAllocation,
    getAvailableForFormula,
    getTotalAvailable,
    allocateExcess,
  };
};
