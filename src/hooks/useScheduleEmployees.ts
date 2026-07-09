import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export interface ScheduleEmployee {
  id: string;
  full_name: string;
  default_team: string | null;
  active: boolean;
  created_at: string;
}

export const useScheduleEmployees = () => {
  return useQuery({
    queryKey: ['schedule-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_employees' as any)
        .select('*')
        .eq('active', true)
        .order('full_name');
      if (error) throw error;
      return (data || []) as unknown as ScheduleEmployee[];
    },
  });
};

export const useCreateScheduleEmployee = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: { full_name: string; default_team?: string | null }) => {
      const { data, error } = await supabase
        .from('schedule_employees' as any)
        .insert({
          full_name: params.full_name,
          default_team: params.default_team ?? null,
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ScheduleEmployee;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-employees'] });
      toast.success('Employee added');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add employee'),
  });
};

export const useDeleteScheduleEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete: mark inactive so existing schedule rows referencing it are preserved
      const { error } = await supabase
        .from('schedule_employees' as any)
        .update({ active: false } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-employees'] });
      toast.success('Employee removed');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to remove employee'),
  });
};
