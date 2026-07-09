import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useOrderEmailEvents = (orderId: string) => {
  return useQuery({
    queryKey: ['order-email-events', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_events' as any)
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data as unknown) as Array<{
        id: string;
        order_id: string;
        event_type: string;
        recipient_email: string;
        sent_at: string;
        status: string;
        error_message: string | null;
        created_at: string;
      }>;
    },
    enabled: !!orderId,
  });
};
