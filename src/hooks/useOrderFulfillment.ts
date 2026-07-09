import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface WizardRun {
  id: string;
  order_id: string;
  current_step: number;
  step_status: Record<string, any>;
  started_at: string;
  completed_at: string | null;
  completed_by: string | null;
}

export interface FulfillmentLineMetrics {
  lineItemId: string;
  lineNumber: string;
  formulaCode: string;
  formulaName: string;
  bottleSize: number;
  qtyRequested: number;
  qtyAllocatedFromExcess: number;
  qtyToProduce: number;
  qtyPacked: number;
  qtyShippedTotal: number;
  qtyAcceptedTotal: number;
  excessCreated: number;
  shortageQty: number;
  shortageStatus: string | null;
  invoiceableQty: number;
  invoiceStatus: string;
}

export const useOrderFulfillment = (orderId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch fulfillment metrics for all line items
  const { data: fulfillmentLines = [], isLoading: linesLoading } = useQuery({
    queryKey: ['order-fulfillment-lines', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_line_items')
        .select(`
          id, line_number, formula_id, bottles_ordered, bottle_size,
          qty_allocated_from_excess, qty_to_produce, qty_packed,
          qty_shipped_total, qty_accepted_total, invoiceable_qty,
          invoice_status, excess_created, shortage_qty, shortage_status,
          formulas!inner(name, code)
        `)
        .eq('order_id', orderId!);

      if (error) throw error;

      return (data || []).map((li: any) => ({
        lineItemId: li.id,
        lineNumber: li.line_number,
        formulaCode: li.formulas.code,
        formulaName: li.formulas.name,
        bottleSize: li.bottle_size,
        qtyRequested: li.bottles_ordered,
        qtyAllocatedFromExcess: li.qty_allocated_from_excess || 0,
        qtyToProduce: li.qty_to_produce || 0,
        qtyPacked: li.qty_packed || 0,
        qtyShippedTotal: li.qty_shipped_total || 0,
        qtyAcceptedTotal: li.qty_accepted_total || 0,
        excessCreated: li.excess_created || 0,
        shortageQty: li.shortage_qty || 0,
        shortageStatus: li.shortage_status,
        invoiceableQty: li.invoiceable_qty || 0,
        invoiceStatus: li.invoice_status || 'not_invoiced',
      })) as FulfillmentLineMetrics[];
    },
    enabled: !!orderId,
  });

  // Fetch or create wizard run
  const { data: wizardRun, isLoading: wizardLoading } = useQuery({
    queryKey: ['wizard-run', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_fulfillment_wizard_runs')
        .select('*')
        .eq('order_id', orderId!)
        .is('completed_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as WizardRun | null;
    },
    enabled: !!orderId,
  });

  const startWizard = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('order_fulfillment_wizard_runs')
        .insert({ order_id: orderId!, current_step: 1, step_status: {} })
        .select()
        .single();

      if (error) throw error;
      return data as WizardRun;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wizard-run', orderId] });
    },
  });

  const updateWizardStep = useMutation({
    mutationFn: async ({
      wizardRunId,
      step,
      stepData,
    }: {
      wizardRunId: string;
      step: number;
      stepData?: Record<string, any>;
    }) => {
      const updates: any = { current_step: step };
      if (stepData) {
        const currentStatus = wizardRun?.step_status || {};
        updates.step_status = {
          ...currentStatus,
          [`step_${step}`]: { ...stepData, completed_at: new Date().toISOString() },
        };
      }

      const { error } = await supabase
        .from('order_fulfillment_wizard_runs')
        .update(updates)
        .eq('id', wizardRunId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wizard-run', orderId] });
    },
  });

  const completeWizard = useMutation({
    mutationFn: async (wizardRunId: string) => {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('order_fulfillment_wizard_runs')
        .update({
          completed_at: new Date().toISOString(),
          completed_by: userData?.user?.id || null,
        })
        .eq('id', wizardRunId);

      if (error) throw error;

      // Update order fulfillment_status
      await supabase
        .from('order_headers')
        .update({ fulfillment_status: 'closed', wizard_run_id: wizardRunId } as any)
        .eq('id', orderId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wizard-run', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      toast({ title: 'PO completed successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to complete PO',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Computed totals
  const totals = fulfillmentLines.reduce(
    (acc, line) => ({
      qtyRequested: acc.qtyRequested + line.qtyRequested,
      qtyAllocatedFromExcess: acc.qtyAllocatedFromExcess + line.qtyAllocatedFromExcess,
      qtyToProduce: acc.qtyToProduce + line.qtyToProduce,
      qtyPacked: acc.qtyPacked + line.qtyPacked,
      qtyShippedTotal: acc.qtyShippedTotal + line.qtyShippedTotal,
      qtyAcceptedTotal: acc.qtyAcceptedTotal + line.qtyAcceptedTotal,
      excessCreated: acc.excessCreated + line.excessCreated,
      shortageQty: acc.shortageQty + line.shortageQty,
      invoiceableQty: acc.invoiceableQty + line.invoiceableQty,
    }),
    {
      qtyRequested: 0,
      qtyAllocatedFromExcess: 0,
      qtyToProduce: 0,
      qtyPacked: 0,
      qtyShippedTotal: 0,
      qtyAcceptedTotal: 0,
      excessCreated: 0,
      shortageQty: 0,
      invoiceableQty: 0,
    }
  );

  return {
    fulfillmentLines,
    totals,
    linesLoading,
    wizardRun,
    wizardLoading,
    startWizard,
    updateWizardStep,
    completeWizard,
  };
};
