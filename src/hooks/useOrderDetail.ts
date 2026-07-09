import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrderDetailBatch {
  id: string;
  production_schedule_item_id: string;
  estimated_bottles: number;
  actual_bottles_packed: number | null;
  batch_sequence: number;
  schedule_date: string;
  batches: number;
  current_stage: string;
  materials_ok: boolean;
  formula_code: string;
  yield_variance_percent: number | null;
}

export interface OrderLineItemDetail {
  id: string;
  line_number: string;
  formula_id: string;
  formula_name: string;
  formula_code: string;
  order_type: string;
  bottles_ordered: number;
  bottle_size: number;
  bottles_shipped: number;
  bottles_remaining: number;
  production_status: string;
}

export interface OrderDetail {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  due_date: string;
  status: string;
  priority: string;
  created_at: string;
  notes: string | null;
  special_instructions: string | null;
  po_number: string | null;
  pdf_url: string | null;
  received_via: string | null;
  received_from_email: string | null;
  received_date: string | null;
  fulfillment_status: string;
  line_items: OrderLineItemDetail[];
  production_batches: OrderDetailBatch[];
  progress_percent: number;
  total_bottles_packed: number;
  total_bottles_shipped: number;
  total_bottles_ordered: number;
}

export const useOrderDetail = (orderId: string) => {
  return useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: async (): Promise<OrderDetail> => {
      // Fetch order header with customer details
      const { data: order, error: orderError } = await supabase
        .from('order_headers')
        .select(`
          *,
          customers!inner(company_name)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Fetch line items with formula details
      const { data: lineItems, error: lineItemsError } = await supabase
        .from('order_line_items')
        .select(`
          *,
          formulas!inner(name, code)
        `)
        .eq('order_id', orderId)
        .order('line_number', { ascending: true });

      if (lineItemsError) throw lineItemsError;

      // Fetch linked production batches from all line items
      const lineItemIds = lineItems?.map(li => li.id) || [];
      let batches: any[] = [];
      
      if (lineItemIds.length > 0) {
        const { data: batchData, error: batchesError } = await supabase
          .from('order_production_batches')
          .select(`
            *,
            production_schedule_items!inner(
              schedule_id,
              batches,
              current_stage,
              materials_ok,
              formula_code,
              yield_variance_percent,
              production_schedules!inner(schedule_date)
            )
          `)
          .in('line_item_id', lineItemIds)
          .order('batch_sequence', { ascending: true });

        if (batchesError) throw batchesError;
        batches = batchData || [];
      }

      // Calculate totals across all line items
      const totalBottlesOrdered = lineItems?.reduce((sum, li) => sum + li.bottles_ordered, 0) || 0;
      const totalBottlesShipped = lineItems?.reduce((sum, li) => sum + li.bottles_shipped, 0) || 0;
      const totalBottlesPacked = batches?.reduce(
        (sum, b) => sum + (b.actual_bottles_packed || 0),
        0
      ) || 0;
      
      const progressPercent = totalBottlesOrdered > 0
        ? Math.round((totalBottlesPacked / totalBottlesOrdered) * 100)
        : 0;

      // Transform batches
      const productionBatches: OrderDetailBatch[] = batches?.map(b => ({
        id: b.id,
        production_schedule_item_id: b.production_schedule_item_id,
        estimated_bottles: b.estimated_bottles,
        actual_bottles_packed: b.actual_bottles_packed,
        batch_sequence: b.batch_sequence,
        schedule_date: b.production_schedule_items.production_schedules.schedule_date,
        batches: b.production_schedule_items.batches,
        current_stage: b.production_schedule_items.current_stage,
        materials_ok: b.production_schedule_items.materials_ok,
        formula_code: b.production_schedule_items.formula_code,
        yield_variance_percent: b.production_schedule_items.yield_variance_percent,
      })) || [];

      // Transform line items
      const transformedLineItems: OrderLineItemDetail[] = lineItems?.map(li => ({
        id: li.id,
        line_number: li.line_number,
        formula_id: li.formula_id,
        formula_name: li.formulas.name,
        formula_code: li.formulas.code,
        order_type: li.order_type,
        bottles_ordered: li.bottles_ordered,
        bottle_size: li.bottle_size,
        bottles_shipped: li.bottles_shipped,
        bottles_remaining: li.bottles_remaining,
        production_status: li.production_status,
      })) || [];

      return {
        id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        customer_name: order.customers.company_name,
        due_date: order.due_date,
        status: order.status,
        priority: order.priority,
        created_at: order.created_at,
        notes: order.notes,
        special_instructions: order.special_instructions,
        po_number: order.po_number,
        pdf_url: order.pdf_url,
        received_via: (order as any).received_via || null,
        received_from_email: (order as any).received_from_email || null,
        received_date: (order as any).received_date || null,
        fulfillment_status: (order as any).fulfillment_status || 'open',
        line_items: transformedLineItems,
        production_batches: productionBatches,
        progress_percent: progressPercent,
        total_bottles_packed: totalBottlesPacked,
        total_bottles_shipped: totalBottlesShipped,
        total_bottles_ordered: totalBottlesOrdered,
      };
    },
    enabled: !!orderId,
  });
};
