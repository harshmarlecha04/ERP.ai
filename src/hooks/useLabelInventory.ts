import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface LabelInventoryRecord {
  id: string;
  customer_product: string;
  date: string;
  received_qty: number | null;
  used_qty: number | null;
  on_hand: number | null;
  source_sheet: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  customer_id: string | null;
  product_name: string | null;
  lot_number?: string | null;
  order_header_id?: string | null;
}

export interface LabelInventoryFilters {
  customer_product?: string;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface LabelInventorySummary {
  total_received: number;
  total_used: number;
  current_on_hand: number;
}

export const useLabelInventory = (filters?: LabelInventoryFilters) => {
  const queryClient = useQueryClient();

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('label-inventory-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'label_inventory'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['label_inventory'] });
          queryClient.invalidateQueries({ queryKey: ['label_inventory_summary'] });
          queryClient.invalidateQueries({ queryKey: ['customer_products'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['label_inventory', filters],
    queryFn: async () => {
      let query = supabase
        .from('label_inventory')
        .select('*')
        .order('date', { ascending: false });

      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }

      if (filters?.customer_product) {
        query = query.ilike('customer_product', `%${filters.customer_product}%`);
      }

      if (filters?.date_from) {
        query = query.gte('date', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('date', filters.date_to);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data as LabelInventoryRecord[];
    },
    enabled: true, // Always enable query, filtering handled by conditions above
  });
};

export const useLabelInventorySummary = (filters?: LabelInventoryFilters) => {
  return useQuery({
    queryKey: ['label_inventory_summary', filters],
    queryFn: async () => {
      let query = supabase
        .from('label_inventory')
        .select('received_qty, used_qty, on_hand');

      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }

      if (filters?.customer_product) {
        query = query.ilike('customer_product', `%${filters.customer_product}%`);
      }

      if (filters?.date_from) {
        query = query.gte('date', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('date', filters.date_to);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const summary = data.reduce(
        (acc, record) => ({
          total_received: acc.total_received + (record.received_qty || 0),
          total_used: acc.total_used + (record.used_qty || 0),
          current_on_hand: acc.current_on_hand + (record.on_hand || 0),
        }),
        { total_received: 0, total_used: 0, current_on_hand: 0 }
      );

      return summary as LabelInventorySummary;
    },
  });
};

export const useCustomerProducts = () => {
  return useQuery({
    queryKey: ['customer_products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('label_inventory')
        .select('customer_product')
        .order('customer_product');

      if (error) {
        throw error;
      }

      // Get unique customer products
      const uniqueProducts = [...new Set(data.map(item => item.customer_product))];
      return uniqueProducts;
    },
  });
};

export const useCreateLabelInventoryRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: Omit<LabelInventoryRecord, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('label_inventory')
        .insert({
          ...record,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['label_inventory_summary'] });
      queryClient.invalidateQueries({ queryKey: ['customer_products'] });
    },
  });
};

export const useUpdateLabelInventoryRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LabelInventoryRecord> & { id: string }) => {
      const { data, error } = await supabase
        .from('label_inventory')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['label_inventory_summary'] });
    },
  });
};

export const useDeleteLabelInventoryRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('label_inventory')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['label_inventory_summary'] });
    },
  });
};

export const useUpdateOrCreateLabelInventory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: Omit<LabelInventoryRecord, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if a record exists for this customer + product combination
      const { data: existingRecords, error: queryError } = await supabase
        .from('label_inventory')
        .select('*')
        .eq('customer_id', record.customer_id)
        .eq('product_name', record.product_name);

      if (queryError) throw queryError;

      if (existingRecords && existingRecords.length > 0) {
        // Update existing record
        const existing = existingRecords[0];
        const { error: updateError } = await supabase
          .from('label_inventory')
          .update({
            received_qty: (existing.received_qty || 0) + (record.received_qty || 0),
            on_hand: (existing.on_hand || 0) + (record.received_qty || 0),
            date: record.date, // Use the latest receipt date
            source_sheet: record.source_sheet,
            lot_number: record.lot_number ?? existing.lot_number,
            order_header_id: record.order_header_id ?? existing.order_header_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // Create new record
        const { error: insertError } = await supabase
          .from('label_inventory')
          .insert([{
            ...record,
            created_by: user.id,
          }]);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['label_inventory_summary'] });
      queryClient.invalidateQueries({ queryKey: ['customer_products'] });
    },
  });
};

export const useBulkCreateLabelInventory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (records: Omit<LabelInventoryRecord, 'id' | 'created_at' | 'updated_at' | 'created_by'>[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const recordsWithUser = records.map(record => ({
        ...record,
        created_by: user?.id,
      }));

      const { data, error } = await supabase
        .from('label_inventory')
        .insert(recordsWithUser)
        .select();

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['label_inventory_summary'] });
      queryClient.invalidateQueries({ queryKey: ['customer_products'] });
    },
  });
};