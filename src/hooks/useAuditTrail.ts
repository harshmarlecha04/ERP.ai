import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  before: any;
  after: any;
  created_at: string;
}

export function useAuditTrail(entityType?: string, entityId?: string, limit = 100) {
  return useQuery({
    queryKey: ['audit-trail', entityType, entityId, limit],
    enabled: !!entityType && !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_events')
        .select('*')
        .eq('entity_type', entityType!)
        .eq('entity_id', entityId!)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as AuditEvent[];
    },
  });
}
