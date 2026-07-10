import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface QualityScheduleItem {
  id: string;
  formula_id: string;
  formula_code: string;
  formula_name: string;
  batches: number;
  schedule_date: string;
  status: string;
  materials_ok: boolean;
  total_required_kg: number;
  shortages_json: any[];
  completed: boolean;
  ingredient_assignments: number;
  actual_yield_kg?: number | null;
  avg_wet_piece_weight_g?: number | null;
  number_of_towers?: number | null;
  weighed_at?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
}

export const useQualityData = () => {
  const [scheduleItems, setScheduleItems] = useState<QualityScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const fetchInProgressRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchQualityData = useCallback(async () => {
    // Concurrency guard
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;

    try {
      setLoading(true);
      
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('production_schedule_items')
        .select(`
          *,
          production_schedules!inner(
            schedule_date, 
            status
          ),
          batch_records(
            status, 
            completed_at
          )
        `)
        .neq('production_schedules.status', 'completed');

      if (scheduleError) {
        console.error('Quality data fetch error:', scheduleError);
        throw scheduleError;
      }

      const { data: formulasData, error: formulasError } = await supabase.rpc('get_accessible_formulas');
      if (formulasError) {
        console.error('Formulas data fetch error:', formulasError);
        throw formulasError;
      }

      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, company_name');
      
      if (customersError) {
        console.error('Customers data fetch error:', customersError);
      }

      const customerMap = new Map<string, string>();
      (customersData || []).forEach(customer => {
        customerMap.set(customer.id, customer.company_name);
      });

      const scheduleItemIds = (scheduleData || []).map(item => item.id);
      const { data: usageData, error: usageError } = scheduleItemIds.length > 0 
        ? await supabase
            .from('production_ingredient_usage')
            .select('schedule_item_id')
            .in('schedule_item_id', scheduleItemIds)
        : { data: [], error: null };

      if (usageError) {
        console.error('Usage data fetch error:', usageError);
      }

      const usageCountMap = new Map<string, number>();
      (usageData || []).forEach(usage => {
        const count = usageCountMap.get(usage.schedule_item_id) || 0;
        usageCountMap.set(usage.schedule_item_id, count + 1);
      });

      const items: QualityScheduleItem[] = (scheduleData || []).map((item: any) => {
        const isCompleted = item.batch_records && item.batch_records.length > 0 && 
                           item.batch_records.some((record: any) => record.status === 'completed');
        
        const matchedFormula = formulasData?.find((f: any) => f.id === item.formula_id);
        const ingredientAssignments = usageCountMap.get(item.id) || 0;
        const customerId = matchedFormula?.customer_id;
        
        return {
          id: item.id,
          formula_id: item.formula_id,
          formula_code: matchedFormula?.code || item.formula_code || 'Unknown Code',
          formula_name: matchedFormula?.name || 'Unknown Formula',
          batches: item.batches,
          schedule_date: item.production_schedules?.schedule_date || '',
          status: item.production_schedules?.status || 'scheduled',
          materials_ok: item.materials_ok,
          total_required_kg: item.total_required_kg,
          shortages_json: item.shortages_json || [],
          completed: isCompleted,
          ingredient_assignments: ingredientAssignments,
          actual_yield_kg: item.actual_yield_kg,
          avg_wet_piece_weight_g: item.avg_wet_piece_weight_g,
          number_of_towers: item.number_of_towers,
          weighed_at: item.weighed_at,
          customer_id: customerId,
          customer_name: customerId ? customerMap.get(customerId) || null : null
        };
      });

      items.sort((a, b) => new Date(a.schedule_date).getTime() - new Date(b.schedule_date).getTime());

      setScheduleItems(items);
    } catch (error: any) {
      console.error('Error fetching quality data:', error);
      toast({
        title: "Error",
        description: `Failed to load quality control data: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [toast]);

  const debouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchQualityData();
    }, 300);
  }, [fetchQualityData]);

  const completeSchedule = async (scheduleId: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to complete batches",
        variant: "destructive"
      });
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('complete_schedule', {
        p_schedule_id: scheduleId,
        p_user_id: user.id
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result?.success) {
        toast({
          title: "Completion Failed",
          description: result?.error || "Unknown error occurred",
          variant: "destructive"
        });
        return false;
      }

      toast({
        title: "Success",
        description: "Batch completed and inventory updated",
        variant: "default"
      });

      setScheduleItems(prev => prev.filter(item => item.id !== scheduleId));
      
      return true;
    } catch (error: any) {
      console.error('Error completing schedule:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete batch",
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchQualityData();

    // All 4 table subscriptions use debounced fetch
    const channel = supabase
      .channel(`quality-production-sync-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_schedule_items' }, () => debouncedFetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_schedules' }, () => debouncedFetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batch_records' }, () => debouncedFetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_ingredient_usage' }, () => debouncedFetch())
      .subscribe();

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, fetchQualityData, debouncedFetch]);

  return {
    scheduleItems,
    loading,
    completeSchedule,
    refetch: fetchQualityData
  };
};
