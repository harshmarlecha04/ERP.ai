import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PackagingScheduleItem {
  id: string;
  schedule_date: string;
  customer_name: string;
  product_name: string;
  bottle_item_id: string | null;
  cap_item_id: string | null;
  label_customer_product: string | null;
  count: string;
  expected_bottles: number;
  status: 'pending' | 'in_progress' | 'completed';
  notes: string | null;
  lot_number: string | null;
  order_header_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  bottle_item?: {
    id: string;
    item_name: string;
    bottles_per_unit: number;
  };
  cap_item?: {
    id: string;
    item_name: string;
  };
}

export interface PackagingCompletionRecord {
  id: string;
  schedule_id: string;
  completion_date: string;
  bottles_packed: number;
  labels_used: number;
  caps_used: number;
  bottles_used: number;
  bright_stock_qty: number;
  bright_stock_id: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateScheduleInput {
  schedule_date: string;
  customer_name: string;
  product_name: string;
  bottle_item_id?: string | null;
  cap_item_id?: string | null;
  label_customer_product?: string | null;
  count: string;
  expected_bottles: number;
  notes?: string | null;
  lot_number?: string | null;
  order_header_id?: string | null;
}

export interface CompletePackagingInput {
  schedule_id: string;
  completion_date: string;
  bottles_packed: number;
  labels_used: number;
  caps_used: number;
  bottles_used: number;
  bright_stock_qty?: number;
  notes?: string;
  create_bright_stock?: boolean;
  order_line_item_id?: string | null;
  bright_stock_data?: {
    formula_id: string;
    bottle_size: number;
    customer_id?: string;
  };
  // New extras metadata
  extra_form?: 'bulk' | 'bottled' | null;
  extra_is_labeled?: boolean | null;
  extra_pouches_used?: number | null;
  extra_gummies_per_pouch?: number | null;
  extra_total_gummies?: number | null;
  extra_bottle_count?: string | null;
  extra_label_customer_product?: string | null;
  extra_pouch_inventory_id?: string | null;
}

export const usePackagingSchedule = (filters?: {
  status?: string;
  statuses?: string[];
  date?: string;
  showAll?: boolean;
}) => {
  return useQuery({
    queryKey: ['packaging-schedule', filters],
    queryFn: async () => {
      let query = supabase
        .from('packaging_schedule')
        .select(`
          *,
          bottle_item:packaging_item!packaging_schedule_bottle_item_id_fkey(id, item_name, bottles_per_unit),
          cap_item:packaging_item!packaging_schedule_cap_item_id_fkey(id, item_name)
        `)
        .order('schedule_date', { ascending: true })
        .order('customer_name', { ascending: true });

      if (filters?.statuses && filters.statuses.length > 0) {
        query = query.in('status', filters.statuses);
      } else if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.date && !filters.showAll) {
        query = query.eq('schedule_date', filters.date);
      }


      const { data, error } = await query;

      if (error) throw error;
      return data as PackagingScheduleItem[];
    },
  });
};

export const useCreatePackagingSchedule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: CreateScheduleInput[]) => {
      const { data: user } = await supabase.auth.getUser();
      
      const itemsWithUser = items.map(item => ({
        ...item,
        created_by: user?.user?.id,
      }));

      const { data, error } = await supabase
        .from('packaging_schedule')
        .insert(itemsWithUser)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-schedule'] });
      toast({
        title: 'Success',
        description: 'Schedule entries created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create schedule entries',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdatePackagingSchedule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PackagingScheduleItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('packaging_schedule')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-schedule'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update schedule',
        variant: 'destructive',
      });
    },
  });
};

export const useDeletePackagingSchedule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('packaging_schedule')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-schedule'] });
      toast({
        title: 'Success',
        description: 'Schedule entry deleted',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete schedule entry',
        variant: 'destructive',
      });
    },
  });
};

export const useCompletePackaging = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CompletePackagingInput) => {
      const { data: user } = await supabase.auth.getUser();

      // 1. Create completion record (incl. extras metadata)
      const { data: completionRecord, error: completionError } = await supabase
        .from('packaging_completion_records')
        .insert({
          schedule_id: input.schedule_id,
          completion_date: input.completion_date,
          bottles_packed: input.bottles_packed,
          labels_used: input.labels_used,
          caps_used: input.caps_used,
          bottles_used: input.bottles_used,
          bright_stock_qty: input.bright_stock_qty || 0,
          completed_by: user?.user?.id,
          notes: input.notes,
          order_line_item_id: input.order_line_item_id || null,
          extra_form: input.extra_form ?? null,
          extra_is_labeled: input.extra_is_labeled ?? null,
          extra_pouches_used: input.extra_pouches_used ?? null,
          extra_gummies_per_pouch: input.extra_gummies_per_pouch ?? null,
          extra_total_gummies: input.extra_total_gummies ?? null,
          extra_bottle_count: input.extra_bottle_count ?? null,
          extra_label_customer_product: input.extra_label_customer_product ?? null,
          extra_pouch_inventory_id: input.extra_pouch_inventory_id ?? null,
        } as any)
        .select()
        .single();

      if (completionError) throw completionError;

      // 2. Update schedule status
      const { error: updateError } = await supabase
        .from('packaging_schedule')
        .update({ status: 'completed' })
        .eq('id', input.schedule_id);

      if (updateError) throw updateError;

      // 3. Deduct pouches if bulk extra
      if (input.extra_form === 'bulk' && input.extra_pouch_inventory_id && (input.extra_pouches_used || 0) > 0) {
        const { data: pouch } = await supabase
          .from('pouch_inventory')
          .select('quantity_on_hand')
          .eq('id', input.extra_pouch_inventory_id)
          .single();
        const next = Math.max(0, ((pouch?.quantity_on_hand as number) ?? 0) - (input.extra_pouches_used || 0));
        await supabase
          .from('pouch_inventory')
          .update({ quantity_on_hand: next })
          .eq('id', input.extra_pouch_inventory_id);
      }

      // 4. Create bright stock if requested
      let brightStockId: string | null = null;
      if (input.create_bright_stock && input.bright_stock_data) {
        const isBulk = input.extra_form === 'bulk';
        const qtyBottles = isBulk ? 0 : (input.bright_stock_qty || 0);
        const qtyGummies = isBulk ? (input.extra_total_gummies || 0) : null;

        if ((isBulk && qtyGummies && qtyGummies > 0) || (!isBulk && qtyBottles > 0)) {
          const { data: brightStock, error: brightStockError } = await supabase
            .from('bright_stock')
            .insert({
              formula_id: input.bright_stock_data.formula_id,
              bottle_size: input.bright_stock_data.bottle_size,
              quantity_bottles: qtyBottles,
              production_date: input.completion_date,
              customer_id: input.bright_stock_data.customer_id || null,
              notes: `From packaging completion: ${input.notes || ''}`,
              form: isBulk ? 'bulk' : 'bottled',
              qty_gummies: qtyGummies,
              pouch_inventory_id: input.extra_pouch_inventory_id ?? null,
              pouches_used: input.extra_pouches_used ?? null,
              gummies_per_pouch: input.extra_gummies_per_pouch ?? null,
              is_labeled: input.extra_is_labeled ?? !isBulk,
              label_customer_product: input.extra_label_customer_product ?? null,
            } as any)
            .select()
            .single();

          if (brightStockError) throw brightStockError;
          brightStockId = brightStock.id;

          await supabase
            .from('packaging_completion_records')
            .update({ bright_stock_id: brightStockId })
            .eq('id', completionRecord.id);

          await supabase.from('finished_goods_excess_transactions').insert({
            bright_stock_id: brightStockId,
            order_id: null,
            line_item_id: input.order_line_item_id || null,
            transaction_type: 'ADD_FROM_PACKAGING',
            qty: isBulk ? (qtyGummies || 0) : qtyBottles,
            created_by: user?.user?.id,
            notes: isBulk ? 'Bulk gummies created from packaging completion' : 'Created from packaging completion',
          });
        }
      }

      // 4. Update order line item fulfillment fields if linked
      if (input.order_line_item_id) {
        const { data: lineItem } = await supabase
          .from('order_line_items')
          .select('bottles_ordered, qty_allocated_from_excess, qty_packed, excess_created, shortage_qty')
          .eq('id', input.order_line_item_id)
          .single();

        if (lineItem) {
          const newQtyPacked = (lineItem.qty_packed || 0) + input.bottles_packed;
          const planned = lineItem.bottles_ordered;
          const newExcessCreated = (lineItem.excess_created || 0) + (input.bright_stock_qty || 0);
          
          const updates: any = {
            qty_packed: newQtyPacked,
            excess_created: newExcessCreated,
          };

          // Check for shortage
          if (newQtyPacked < planned) {
            updates.shortage_qty = planned - newQtyPacked;
            updates.shortage_status = 'unresolved';
          } else {
            updates.shortage_qty = 0;
            updates.shortage_status = null;
          }

          await supabase
            .from('order_line_items')
            .update(updates as any)
            .eq('id', input.order_line_item_id);
        }
      }

      return { completionRecord, brightStockId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['packaging-balances'] });
      queryClient.invalidateQueries({ queryKey: ['label-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['bright-stock'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['order-fulfillment-lines'] });
      queryClient.invalidateQueries({ queryKey: ['pouch-inventory'] });
      toast({
        title: 'Success',
        description: 'Packaging run completed and inventory updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete packaging run',
        variant: 'destructive',
      });
    },
  });
};

export const usePackagingCompletionRecords = (scheduleId?: string) => {
  return useQuery({
    queryKey: ['packaging-completion-records', scheduleId],
    queryFn: async () => {
      let query = supabase
        .from('packaging_completion_records')
        .select('*')
        .order('completion_date', { ascending: false });

      if (scheduleId) {
        query = query.eq('schedule_id', scheduleId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as PackagingCompletionRecord[];
    },
  });
};
