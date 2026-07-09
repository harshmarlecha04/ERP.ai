import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SafetyStockRecommendation {
  id: string;
  raw_material_id: string;
  recommended_min_kg: number;
  recommended_reorder_kg: number;
  based_on_months_data: number;
  confidence_score: number;
  avg_daily_usage_kg: number;
  max_daily_usage_kg: number;
  usage_variability: number;
  generated_at: string;
}

export const useSafetyStockRecommendations = () => {
  return useQuery({
    queryKey: ['safety-stock-recommendations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safety_stock_recommendations')
        .select(`
          *,
          raw_materials(code, name, supplier, uom)
        `)
        .order('usage_variability', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};