import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface User {
  id: string;
  email: string;
  display_name: string;
  job_title: string;
  department: string;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
}

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission, user, rolesLoading } = useAuth();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user has admin permissions
      if (!hasPermission('admin')) {
        setError('Access denied: Administrator permissions required to view all users');
        setUsers([]);
        return;
      }

      // Call the secure function to get all users
      const { data, error: rpcError } = await supabase
        .rpc('get_all_users_admin');

      if (rpcError) {
        throw rpcError;
      }

      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for both user AND roles to be loaded before checking permissions
    if (user && !rolesLoading) {
      fetchUsers();
    }
  }, [user?.id, rolesLoading]);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers
  };
};