import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CompanySettings {
  id: number;
  company_name: string;
  industry: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  setup_complete: boolean;
}

export function useCompanySettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['company-settings'],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CompanySettings | null> => {
      const { data, error } = await supabase
        .from('company_settings' as any)
        .select('*')
        .maybeSingle();
      if (error) return null;
      return data as unknown as CompanySettings | null;
    },
  });

  return {
    settings: query.data ?? null,
    loading: query.isLoading,
    refresh: () => qc.invalidateQueries({ queryKey: ['company-settings'] }),
  };
}
