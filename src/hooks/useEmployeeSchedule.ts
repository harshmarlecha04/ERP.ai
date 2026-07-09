import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

export interface ScheduleEntry {
  id: string;
  employee_id: string;
  date: string;
  entry_type: 'shift' | 'leave';
  team: string | null;
  building: string | null;
  start_time: string | null;
  end_time: string | null;
  leave_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useScheduleEntries = (fromDate: string, toDate: string) => {
  return useQuery({
    queryKey: ['employee-schedule', fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_schedule' as any)
        .select('*')
        .gte('date', fromDate)
        .lte('date', toDate)
        .order('date', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ScheduleEntry[];
    },
  });
};

export const useUpsertScheduleEntry = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (entry: Partial<ScheduleEntry> & { date: string; employee_id: string; entry_type: 'shift' | 'leave' }) => {
      const payload: any = { ...entry };
      if (!entry.id) payload.created_by = user?.id;
      const { data, error } = await supabase
        .from('employee_schedule' as any)
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-schedule'] });
      toast.success('Schedule saved');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });
};

export const useDeleteScheduleEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employee_schedule' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-schedule'] });
      toast.success('Entry removed');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  });
};

export const useCreateLeaveRange = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: { employee_id?: string | null; team?: string | null; from: string; to: string; leave_type: string; notes?: string }) => {
      const days = eachDayOfInterval({ start: parseISO(params.from), end: parseISO(params.to) });
      const rows = days.map(d => ({
        employee_id: params.employee_id ?? null,
        team: params.team ?? null,
        date: format(d, 'yyyy-MM-dd'),
        entry_type: 'leave' as const,
        leave_type: params.leave_type,
        notes: params.notes || null,
        created_by: user?.id,
      }));
      const { error } = await supabase.from('employee_schedule' as any).insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-schedule'] });
      toast.success('Leave added');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add leave'),
  });
};

export interface AssignParams {
  employees: { kind: 'profile' | 'roster'; id: string }[];
  teams: string[];
  building?: string | null;
  from: string;
  to: string;
  mode: 'shift' | 'leave';
  fullDay?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  leaveType?: string | null;
  notes?: string;
}

export const useBulkAssign = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (p: AssignParams) => {
      if (!p.employees.length || !p.teams.length) throw new Error('Pick at least one employee and one team');
      const days = eachDayOfInterval({ start: parseISO(p.from), end: parseISO(p.to) });
      const rows: any[] = [];
      for (const emp of p.employees) {
        for (const team of p.teams) {
          for (const d of days) {
            rows.push({
              employee_id: emp.kind === 'profile' ? emp.id : null,
              roster_employee_id: emp.kind === 'roster' ? emp.id : null,
              team,
              date: format(d, 'yyyy-MM-dd'),
              entry_type: p.mode,
              building: p.mode === 'shift' ? (p.building ?? null) : null,
              start_time: p.mode === 'shift' && !p.fullDay ? p.startTime ?? null : null,
              end_time: p.mode === 'shift' && !p.fullDay ? p.endTime ?? null : null,
              leave_type: p.mode === 'leave' ? p.leaveType ?? null : null,
              notes: p.notes || null,
              created_by: user?.id,
            });
          }
        }
      }
      const { error } = await supabase.from('employee_schedule' as any).insert(rows as any);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['employee-schedule'] });
      toast.success(`Assigned ${count} entr${count === 1 ? 'y' : 'ies'}`);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to assign'),
  });
};

