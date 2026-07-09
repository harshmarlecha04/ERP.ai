import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PortalCustomer {
  id: string;
  company_name: string;
  company_code: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
}

export const useCurrentCustomer = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['portal', 'current-customer', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<PortalCustomer | null> => {
      const { data: customerId, error: idErr } = await supabase.rpc('get_my_customer_id');
      if (idErr) throw idErr;
      if (!customerId) return null;

      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, company_code, contact_person, email, phone')
        .eq('id', customerId as string)
        .single();
      if (error) throw error;
      return data as PortalCustomer;
    },
    staleTime: 60_000,
  });
};
