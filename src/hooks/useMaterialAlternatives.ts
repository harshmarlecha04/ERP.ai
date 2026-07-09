import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MaterialAlternative {
  alternative_id: string;
  material_code: string;
  material_name: string;
  supplier: string | null;
  available_qty: number;
  uom: string;
  lot_count: number;
  lots: Array<{
    lot_id: string;
    lot_number: string | null;
    quantity: number;
    cost: number;
    receiving_date: string | null;
    expires_on: string | null;
  }>;
}

export const useMaterialAlternatives = (materialId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['material-alternatives', materialId],
    queryFn: async (): Promise<MaterialAlternative[]> => {
      const { data, error } = await supabase
        .rpc('get_material_alternatives', {
          p_material_id: materialId
        });

      if (error) throw error;
      return (data || []) as MaterialAlternative[];
    },
    enabled: enabled && !!materialId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};
