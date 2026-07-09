import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CustomerStatus {
  isCustomer: boolean;
  customerId: string | null;
  onboardingApproved: boolean;
}

/**
 * Single source of truth for the signed-in user's customer status.
 * Used by both ProtectedRoute and CustomerRoute so they agree without
 * re-fetching on every navigation.
 */
export const useCustomerStatus = () => {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ['customer-status', user?.id],
    enabled: !!user?.id,
    staleTime: Infinity,
    queryFn: async (): Promise<CustomerStatus> => {
      const [{ data: roles, error: rolesErr }, { data: customerId, error: idErr }] =
        await Promise.all([
          supabase.from('user_roles').select('role').eq('user_id', user!.id),
          supabase.rpc('get_my_customer_id'),
        ]);
      if (rolesErr) throw rolesErr;
      if (idErr) throw idErr;

      const isCustomer = (roles || []).some((r: any) => r.role === 'customer');
      const cid = (customerId as string | null) ?? null;

      let onboardingApproved = false;
      if (isCustomer && cid) {
        const { data: onboarding } = await (supabase as any)
          .from('customer_onboarding')
          .select('status')
          .eq('customer_id', cid)
          .maybeSingle();
        onboardingApproved = onboarding?.status === 'approved';
      }

      return { isCustomer, customerId: cid, onboardingApproved };
    },
  });

  return {
    loading: authLoading || (!!user && query.isLoading),
    isAuthed: !!user,
    isCustomer: query.data?.isCustomer === true,
    customerId: query.data?.customerId ?? null,
    onboardingApproved: query.data?.onboardingApproved === true,
  };
};

/** Back-compat wrapper for existing call sites. */
export const useIsCustomer = () => {
  const s = useCustomerStatus();
  return { isCustomer: s.isCustomer, loading: s.loading };
};
