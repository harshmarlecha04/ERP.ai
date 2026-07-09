import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface OrderShipment {
  id: string;
  line_item_id: string;
  shipped_quantity: number;
  shipment_date: string;
  tracking_number?: string;
  carrier?: string;
  notes?: string;
  shipped_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateShipmentData {
  line_item_id: string;
  shipped_quantity: number;
  shipment_date: string;
  tracking_number?: string;
  carrier?: string;
  notes?: string;
}

export const useOrderShipments = (idOrLineItemId: string, mode: 'order' | 'line_item' = 'line_item') => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all shipments for the order or line item
  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['order-shipments', idOrLineItemId, mode],
    queryFn: async () => {
      let query = supabase
        .from('order_shipments')
        .select('*')
        .order('shipment_date', { ascending: false });
      
      if (mode === 'order') {
        query = query.eq('order_id', idOrLineItemId);
      } else {
        query = query.eq('line_item_id', idOrLineItemId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as OrderShipment[];
    },
    enabled: !!idOrLineItemId,
  });

  // Record a new shipment
  const recordShipment = useMutation({
    mutationFn: async (shipmentData: CreateShipmentData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('order_shipments')
        .insert([{
          ...shipmentData,
          shipped_by: user?.id,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      toast({ title: 'Shipment recorded successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to record shipment', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Delete a shipment
  const deleteShipment = useMutation({
    mutationFn: async (shipmentId: string) => {
      const { error } = await supabase
        .from('order_shipments')
        .delete()
        .eq('id', shipmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      toast({ title: 'Shipment deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to delete shipment', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const totalShipped = shipments.reduce((sum, s) => sum + s.shipped_quantity, 0);

  return {
    shipments,
    isLoading,
    totalShipped,
    recordShipment,
    deleteShipment,
  };
};
