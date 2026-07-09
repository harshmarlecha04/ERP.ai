import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RawMaterialUsageStats } from '@/types/inventory';

export const useUsageStats = () => {
  return useQuery({
    queryKey: ['raw-material-usage-stats'],
    queryFn: async (): Promise<RawMaterialUsageStats[]> => {
      const { data, error } = await supabase
        .rpc('get_raw_material_usage_stats');

      if (error) throw error;
      
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};