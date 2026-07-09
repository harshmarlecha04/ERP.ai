import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  created_by: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  completed_at: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface TaskFilter {
  assigneeId?: string | null;
  status?: TaskStatus | 'all';
  relatedEntityType?: string;
  relatedEntityId?: string;
  mine?: boolean;
}

export function useTasks(filter: TaskFilter = {}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ['tasks', filter, user?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from('tasks').select('*').order('due_at', { ascending: true, nullsFirst: false });
      if (filter.mine) q = q.eq('assignee_id', user!.id);
      else if (filter.assigneeId) q = q.eq('assignee_id', filter.assigneeId);
      if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status);
      if (filter.relatedEntityType) q = q.eq('related_entity_type', filter.relatedEntityType);
      if (filter.relatedEntityId) q = q.eq('related_entity_id', filter.relatedEntityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Task[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('tasks-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () =>
        qc.invalidateQueries({ queryKey: ['tasks'] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const create = useMutation({
    mutationFn: async (input: Partial<Task>) => {
      const payload = { ...input, created_by: user!.id };
      const { data, error } = await supabase.from('tasks').insert(payload as any).select('*').single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const completedAt =
        patch.status === 'done' ? new Date().toISOString() : patch.status ? null : undefined;
      const final: any = { ...patch };
      if (completedAt !== undefined) final.completed_at = completedAt;
      const { data, error } = await supabase.from('tasks').update(final).eq('id', id).select('*').single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return { ...query, create, update, remove };
}
