import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface OrderHeader {
  id: string;
  order_number: string;
  po_number: string;
  customer_id: string;
  due_date: string;
  status: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  special_instructions: string | null;
  total_line_items: number;
  total_bottles_ordered: number;
  total_bottles_shipped: number;
  header_status: string;
  received_via?: string | null;
  received_from_email?: string | null;
  received_date?: string | null;
  fulfillment_status?: string;
  wizard_run_id?: string | null;
}

export interface OrderLineItem {
  id: string;
  order_id: string;
  line_number: string;
  formula_id: string;
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
  formula_name?: string;
  formula_code?: string;
  bottle_type_name?: string | null;
}

export interface OrderWithLines extends OrderHeader {
  customer_name?: string;
  line_items: OrderLineItem[];
  earliest_scheduled_date?: string | null;
}

export const useOrderHeaders = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all orders with line items
  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['order-headers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_headers')
        .select(`
          *,
          customers!inner(company_name),
          order_line_items(
            *,
            formulas!inner(name, code),
            packaging_item!selected_bottle_id(item_name)
          ),
          production_schedule_items!order_header_id(
            id,
            production_schedules(schedule_date)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(order => {
        // Calculate earliest scheduled date from linked production batches
        const scheduledDates = (order.production_schedule_items || [])
          .map((item: any) => item.production_schedules?.schedule_date)
          .filter((date: any) => date !== null && date !== undefined);
        
        const earliestScheduledDate = scheduledDates.length > 0
          ? scheduledDates.sort()[0]
          : null;
        
        return {
          ...order,
          customer_name: order.customers?.company_name,
          earliest_scheduled_date: earliestScheduledDate,
          line_items: (order.order_line_items || []).map((item: any) => ({
            ...item,
            formula_name: item.formulas?.name,
            formula_code: item.formulas?.code,
            bottle_type_name: item.packaging_item?.item_name || null,
          })),
        };
      }) as OrderWithLines[];
    },
  });

  // Check if order number exists
  const checkOrderNumber = async (orderNumber: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('order_headers')
      .select('id')
      .eq('order_number', orderNumber)
      .maybeSingle();
    
    return !!data;
  };

  // Create order with line items
  const createOrderWithLines = useMutation({
    mutationFn: async (orderData: {
      header: Omit<OrderHeader, 'id' | 'created_at' | 'updated_at' | 'total_line_items' | 'total_bottles_ordered' | 'total_bottles_shipped' | 'header_status'>;
      lineItems: Omit<OrderLineItem, 'id' | 'order_id' | 'bottles_shipped' | 'bottles_remaining' | 'created_at' | 'updated_at' | 'formula_name' | 'formula_code'>[];
    }) => {
      const { header, lineItems } = orderData;
      
      // Validate order number is not empty
      if (!header.order_number || header.order_number.trim() === '') {
        throw new Error('Order number is required');
      }
      
      // Check for duplicate order number
      const exists = await checkOrderNumber(header.order_number);
      if (exists) {
        throw new Error(`Order number "${header.order_number}" already exists. Please use a different order number.`);
      }
      
      // Validate at least one line item
      if (lineItems.length === 0) {
        throw new Error('At least one product line is required');
      }
      
      // 1. Create header
      const { data: newHeader, error: headerError } = await supabase
        .from('order_headers')
        .insert([{
          ...header,
          header_status: 'pending',
        }])
        .select()
        .single();
      
      if (headerError) throw headerError;
      
      // 2. Create line items
      const lineItemsWithOrderId = lineItems.map((item) => ({
        ...item,
        order_id: newHeader.id,
      }));
      
      const { error: linesError } = await supabase
        .from('order_line_items')
        .insert(lineItemsWithOrderId as any);
      
      if (linesError) throw linesError;
      
      return newHeader;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      toast({ title: 'Order created successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to create order', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Add line items to existing order
  const addLineItemsToOrder = useMutation({
    mutationFn: async ({ orderId, lineItems }: {
      orderId: string;
      lineItems: Omit<OrderLineItem, 'id' | 'order_id' | 'bottles_shipped' | 'bottles_remaining' | 'created_at' | 'updated_at' | 'formula_name' | 'formula_code'>[];
    }) => {
      const newLines = lineItems.map((item) => ({
        ...item,
        order_id: orderId,
      }));
      
      const { error } = await supabase
        .from('order_line_items')
        .insert(newLines as any);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['order-line-items'] });
      toast({ title: 'Product lines added successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to add product lines', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Delete order
  const deleteOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('order_headers')
        .delete()
        .eq('id', orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      toast({ title: 'Order deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to delete order', 
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
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      toast({ title: 'Product line deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to delete product line', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Update order header
  const updateOrderHeader = useMutation({
    mutationFn: async ({ orderId, updates }: {
      orderId: string;
      updates: Partial<{
        po_number: string;
        due_date: string | null;
        priority: string;
        notes: string | null;
        special_instructions: string | null;
        header_status: string;
      }>;
    }) => {
      const { error } = await supabase
        .from('order_headers')
        .update(updates)
        .eq('id', orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      toast({ title: 'Order updated successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update order', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  return {
    orders,
    isLoading,
    error,
    createOrderWithLines,
    addLineItemsToOrder,
    deleteOrder,
    deleteLineItem,
    updateOrderHeader,
    checkOrderNumber,
  };
};