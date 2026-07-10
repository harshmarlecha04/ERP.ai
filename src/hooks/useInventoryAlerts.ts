import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface InventoryAlert {
  id: string;
  alert_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details: {
    raw_material_id: string;
    material_code: string;
    material_name: string;
    supplier?: string;
    current_quantity_kg: number;
    min_quantity_kg: number;
    reorder_quantity_kg: number;
    message: string;
    triggered_by: string;
    triggered_at: string;
  };
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
}

export const useInventoryAlerts = () => {
  return useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: async (): Promise<InventoryAlert[]> => {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('alert_type', 'low_inventory')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as InventoryAlert[];
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });
};

export const useUnacknowledgedInventoryAlerts = () => {
  return useQuery({
    queryKey: ['unacknowledged-inventory-alerts'],
    queryFn: async (): Promise<InventoryAlert[]> => {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('alert_type', 'low_inventory')
        .eq('acknowledged', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as InventoryAlert[];
    },
    refetchInterval: 10000, // Refresh every 10 seconds for active alerts
  });
};

export const useAcknowledgedInventoryAlerts = () => {
  return useQuery({
    queryKey: ['acknowledged-inventory-alerts'],
    queryFn: async (): Promise<InventoryAlert[]> => {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('alert_type', 'low_inventory')
        .eq('acknowledged', true)
        .order('acknowledged_at', { ascending: false });

      if (error) throw error;
      return (data || []) as InventoryAlert[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds (less frequent than active alerts)
  });
};

export const useAcknowledgeAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data, error } = await supabase
        .from('security_alerts')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['unacknowledged-inventory-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['acknowledged-inventory-alerts'] });
      toast.success('Alert acknowledged');
    },
    onError: (error: any) => {
      toast.error('Failed to acknowledge alert: ' + error.message);
    },
  });
};

export const useBulkAcknowledgeAlerts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertIds: string[]) => {
      const { data, error } = await supabase
        .from('security_alerts')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })
        .in('id', alertIds)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['unacknowledged-inventory-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['acknowledged-inventory-alerts'] });
      toast.success(`${data.length} alerts acknowledged`);
    },
    onError: (error: any) => {
      toast.error('Failed to acknowledge alerts: ' + error.message);
    },
  });
};

export const useRealTimeInventoryAlerts = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`inventory-alerts-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_alerts',
          filter: 'alert_type=eq.low_inventory'
        },
        (payload) => {
          console.log('New inventory alert:', payload);
          
          // Show toast notification
          const alert = payload.new as InventoryAlert;
          const severity = alert.severity;
          const message = alert.details?.message || 'Low inventory alert';
          
          if (severity === 'critical') {
            toast.error(message, {
              duration: 10000,
              action: {
                label: 'View',
                onClick: () => window.location.href = '/inventory'
              }
            });
          } else if (severity === 'high') {
            toast.warning(message, {
              duration: 8000,
              action: {
                label: 'View',
                onClick: () => window.location.href = '/inventory'
              }
            });
          } else {
            toast.info(message, {
              duration: 5000,
              action: {
                label: 'View',
                onClick: () => window.location.href = '/inventory'
              }
            });
          }

          // Refresh queries
          queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
          queryClient.invalidateQueries({ queryKey: ['unacknowledged-inventory-alerts'] });
          queryClient.invalidateQueries({ queryKey: ['acknowledged-inventory-alerts'] });
          queryClient.invalidateQueries({ queryKey: ['inventory-status-with-thresholds'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'security_alerts',
          filter: 'alert_type=eq.low_inventory'
        },
        () => {
          // Refresh queries when alerts are deleted (threshold resolved)
          queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
          queryClient.invalidateQueries({ queryKey: ['unacknowledged-inventory-alerts'] });
          queryClient.invalidateQueries({ queryKey: ['acknowledged-inventory-alerts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};