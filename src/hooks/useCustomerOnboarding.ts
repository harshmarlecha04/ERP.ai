import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentCustomer } from './useCurrentCustomer';

export const ONBOARDING_STEPS = [
  'company_info',
  'contacts',
  'compliance_docs',
  'payment_terms',
  'signed_agreement',
] as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[number];

export const useCustomerOnboarding = () => {
  const qc = useQueryClient();
  const { data: customer } = useCurrentCustomer();
  const customerId = customer?.id;

  const query = useQuery({
    queryKey: ['portal', 'onboarding', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_onboarding')
        .select('*')
        .eq('customer_id', customerId!)
        .maybeSingle();
      if (error) throw error;

      // Auto-create row if it doesn't exist (e.g. legacy customers)
      if (!data) {
        const { data: created, error: insErr } = await supabase
          .from('customer_onboarding')
          .insert({ customer_id: customerId! })
          .select()
          .single();
        if (insErr) throw insErr;
        return created;
      }
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!customerId) throw new Error('No customer');
      const { data, error } = await supabase
        .from('customer_onboarding')
        .update(patch as any)
        .eq('customer_id', customerId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'onboarding', customerId] }),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error('No customer');
      const { data, error } = await supabase
        .from('customer_onboarding')
        .update({
          status: 'pending_review',
          current_step: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('customer_id', customerId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'onboarding', customerId] }),
  });

  return { ...query, customerId, update, submit };
};
