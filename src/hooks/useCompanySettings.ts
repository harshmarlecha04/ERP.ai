import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { setCompanyInfo } from '@/lib/companyInfo';

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
  const { user, loading: authLoading } = useAuth();
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

  // Keep the app-wide company info store in sync for non-React consumers (PDFs, etc.)
  if (query.data) {
    setCompanyInfo({
      name: query.data.company_name,
      address: query.data.address ?? '',
      phone: query.data.phone ?? '',
      logoUrl: query.data.logo_url ?? null,
    });
  }

  return {
    settings: query.data ?? null,
    // Still "loading" while auth bootstraps (query is disabled then) or while fetching.
    loading: authLoading || (!!user && query.isPending),
    refresh: () => qc.invalidateQueries({ queryKey: ['company-settings'] }),
  };
}
