import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Returns true when the signed-in user has any staff role
 * (anything other than 'customer'). A user can be both a customer
 * and an employee — this hook is independent of customer status.
 */
export const useIsEmployee = () => {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ['is-employee', user?.id],
    enabled: !!user?.id,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data || []).some((r: any) => r.role && r.role !== 'customer');
    },
  });

  return {
    loading: authLoading || (!!user && query.isLoading),
    isEmployee: query.data === true,
  };
};
