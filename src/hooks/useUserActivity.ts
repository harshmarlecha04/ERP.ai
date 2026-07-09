import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserActivity {
  id: string;
  user_id: string;
  user_email: string;
  user_display_name: string;
  activity_type: string;
  operation: string;
  table_name: string;
  record_id: string;
  details: any;
  ip_address: string | null;
  risk_level: string;
  created_at: string;
}

export const useUserActivity = () => {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated - temporarily allow all authenticated users
      if (!user) {
        setError('Please log in to view activity data');
        setActivities([]);
        return;
      }

      // Call the secure function to get all user activity
      const { data, error: rpcError } = await supabase
        .rpc('get_all_user_activity');

      if (rpcError) {
        throw rpcError;
      }

      setActivities((data || []).map((item: any) => ({
        ...item,
        ip_address: item.ip_address || null
      })));
    } catch (err) {
      console.error('Error fetching user activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user activities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchActivities();
    }
  }, [user?.id]);

  return {
    activities,
    loading,
    error,
    refetch: fetchActivities
  };
};