import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MaterialRequirement {
  raw_material_id: string;
  material_code: string;
  material_name: string;
  supplier: string | null;
  uom: string;
  total_required_kg: number;
  current_inventory_kg: number;
  reserved_kg: number;
  available_kg: number;
  on_order_kg: number;
  net_shortage_kg: number;
  net_after_orders_kg: number;
  formulas_using: Array<{ formula_code: string; formula_name: string; batches: number }>;
  schedule_dates: string[];
  pending_po_numbers: string[];
  pending_po_details: Array<{ po_number: string; expected_delivery: string }>;
}

export const useMaterialRequirements = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['material-requirements', startDate, endDate],
    queryFn: async (): Promise<MaterialRequirement[]> => {
      console.log('🔍 Fetching material requirements for date range:', { startDate, endDate });
      
      const { data, error } = await supabase
        .rpc('get_material_requirements_by_date_range', {
          p_start_date: startDate,
          p_end_date: endDate
        });

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      // Log raw response
      console.log('📦 Raw database response - count:', data?.length || 0);
      
      try {
        // Validate and transform data
        const validatedData = (data || []).map((item: any, index: number) => {
          try {
            // Ensure formulas_using is a valid array
            let formulasUsing = item.formulas_using;
            if (!Array.isArray(formulasUsing)) {
              console.warn(`⚠️ Invalid formulas_using for material ${item.material_name}:`, formulasUsing);
              formulasUsing = [];
            }

            // Ensure pending_po_details is a valid array
            let pendingPoDetails = item.pending_po_details;
            if (!Array.isArray(pendingPoDetails)) {
              console.warn(`⚠️ Invalid pending_po_details for material ${item.material_name}:`, pendingPoDetails);
              pendingPoDetails = [];
            }

            // Ensure schedule_dates is a valid array
            let scheduleDates = item.schedule_dates;
            if (!Array.isArray(scheduleDates)) {
              console.warn(`⚠️ Invalid schedule_dates for material ${item.material_name}:`, scheduleDates);
              scheduleDates = [];
            }

            // Ensure pending_po_numbers is a valid array
            let pendingPoNumbers = item.pending_po_numbers;
            if (!Array.isArray(pendingPoNumbers)) {
              console.warn(`⚠️ Invalid pending_po_numbers for material ${item.material_name}:`, pendingPoNumbers);
              pendingPoNumbers = [];
            }

            return {
              ...item,
              formulas_using: formulasUsing,
              pending_po_details: pendingPoDetails,
              schedule_dates: scheduleDates,
              pending_po_numbers: pendingPoNumbers,
              // Ensure numeric fields are valid
              total_required_kg: Number(item.total_required_kg) || 0,
              current_inventory_kg: Number(item.current_inventory_kg) || 0,
              reserved_kg: Number(item.reserved_kg) || 0,
              available_kg: Number(item.available_kg) || 0,
              on_order_kg: Number(item.on_order_kg) || 0,
              net_shortage_kg: Number(item.net_shortage_kg) || 0,
              net_after_orders_kg: Number(item.net_after_orders_kg) || 0,
            } as MaterialRequirement;
          } catch (itemError) {
            console.error(`❌ Error processing material at index ${index}:`, item.material_name, itemError);
            // Return null for invalid items - we'll filter them out
            return null;
          }
        }).filter((item): item is MaterialRequirement => item !== null);

        console.log('✅ Validated data - count:', validatedData.length);
        console.log('📊 Material names:', validatedData.map(r => r.material_name).slice(0, 5));
        
        // Check for specific materials
        const watermelon = validatedData.find(r => r.material_name?.toLowerCase().includes('watermelon'));
        console.log('🍉 Watermelon found in validated data?', watermelon ? 'YES' : 'NO', watermelon?.material_name);
        
        const droppedCount = (data?.length || 0) - validatedData.length;
        if (droppedCount > 0) {
          console.warn(`⚠️ Dropped ${droppedCount} invalid records during validation`);
        }

        return validatedData;
      } catch (processingError) {
        console.error('❌ Error processing material requirements:', processingError);
        // Return raw data as fallback
        return (data || []) as MaterialRequirement[];
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!startDate && !!endDate,
  });
};
