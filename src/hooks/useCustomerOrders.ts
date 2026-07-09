import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentCustomer } from './useCurrentCustomer';

export const useCustomerOrders = () => {
  const { data: customer } = useCurrentCustomer();
  return useQuery({
    queryKey: ['portal', 'orders', customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_headers')
        .select('id, order_number, po_number, due_date, status, header_status, fulfillment_status, total_bottles_ordered, total_bottles_shipped, created_at')
        .eq('customer_id', customer!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

export const useCustomerOrderDetail = (orderId?: string) => {
  return useQuery({
    queryKey: ['portal', 'order', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const [{ data: header, error: hErr }, { data: lines, error: lErr }, { data: shipments, error: sErr }] = await Promise.all([
        supabase.from('order_headers').select('*').eq('id', orderId!).single(),
        supabase.from('order_line_items').select('*').eq('order_id', orderId!),
        supabase.from('order_shipments').select('*').eq('order_id', orderId!).order('shipment_date', { ascending: false }),
      ]);
      if (hErr) throw hErr;
      if (lErr) throw lErr;
      if (sErr) throw sErr;
      return { header, lines: lines || [], shipments: shipments || [] };
    },
  });
};
