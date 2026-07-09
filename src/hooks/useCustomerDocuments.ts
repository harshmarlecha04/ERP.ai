import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentCustomer } from './useCurrentCustomer';

export const useCustomerDocuments = (kindFilter?: string) => {
  const { data: customer } = useCurrentCustomer();
  return useQuery({
    queryKey: ['portal', 'documents', customer?.id, kindFilter],
    enabled: !!customer?.id,
    queryFn: async () => {
      let q = supabase
        .from('customer_documents')
        .select('id, kind, title, storage_path, formula_id, order_id, created_at')
        .eq('customer_id', customer!.id)
        .eq('visible_to_customer', true)
        .order('created_at', { ascending: false });
      if (kindFilter) q = q.eq('kind', kindFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
};

export const getSignedDocUrl = async (storagePath: string) => {
  const { data, error } = await supabase.storage
    .from('customer-portal')
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
};
