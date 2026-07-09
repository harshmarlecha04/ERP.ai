import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ShipmentLine {
  id: string;
  shipment_id: string;
  order_line_id: string;
  qty_shipped: number;
  qty_accepted: number | null;
  acceptance_status: string;
  customer_confirmation_doc_url: string | null;
  created_at: string;
}

export const useShipmentLines = (shipmentId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['shipment-lines', shipmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_shipment_lines')
        .select('*')
        .eq('shipment_id', shipmentId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ShipmentLine[];
    },
    enabled: !!shipmentId,
  });

  const markAccepted = useMutation({
    mutationFn: async ({
      lineId,
      qtyAccepted,
      status,
    }: {
      lineId: string;
      qtyAccepted: number;
      status: string;
    }) => {
      const { error } = await supabase
        .from('order_shipment_lines')
        .update({
          qty_accepted: qtyAccepted,
          acceptance_status: status,
        })
        .eq('id', lineId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment-lines'] });
      queryClient.invalidateQueries({ queryKey: ['order-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      toast({ title: 'Acceptance status updated' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update acceptance',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return { lines, isLoading, markAccepted };
};
