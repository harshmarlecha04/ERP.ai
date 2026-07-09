import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DemandForecast {
  id: string;
  formula_id: string;
  forecast_month: string;
  forecasted_bottles: number;
  forecasted_batches: number;
  confidence_score: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  generated_at: string;
}

export const useDemandForecasts = (formulaId?: string) => {
  return useQuery({
    queryKey: ['demand-forecasts', formulaId],
    queryFn: async (): Promise<DemandForecast[]> => {
      let query = supabase
        .from('demand_forecasts')
        .select('*')
        .order('forecast_month', { ascending: true });

      if (formulaId) {
        query = query.eq('formula_id', formulaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DemandForecast[];
    },
  });
};

export const useDemandAnomalies = () => {
  return useQuery({
    queryKey: ['demand-anomalies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demand_anomalies')
        .select('*, formulas(code, name)')
        .order('anomaly_month', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });
};

export const useAcknowledgeAnomaly = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data, error } = await supabase
        .from('demand_anomalies')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          notes,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demand-anomalies'] });
    },
  });
};