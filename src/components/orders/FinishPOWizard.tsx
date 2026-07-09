import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useOrderFulfillment } from '@/hooks/useOrderFulfillment';
import { useExcessAllocation } from '@/hooks/useExcessAllocation';
import { useOrderShipments } from '@/hooks/useOrderShipments';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';

import { StepConfirmInputs } from './wizard/StepConfirmInputs';
import { StepAllocateExcess, LineAllocation } from './wizard/StepAllocateExcess';
import { StepProductionSchedule, ScheduleEntry } from './wizard/StepProductionSchedule';
import { StepPackagingReconciliation, PackagingLine } from './wizard/StepPackagingReconciliation';
import { StepShipmentAcceptance, ShipmentData } from './wizard/StepShipmentAcceptance';
import { StepInvoiceSummary } from './wizard/StepInvoiceSummary';
import { todayET } from "@/utils/dateUtils";

const STEP_LABELS = [
  'Confirm Inputs',
  'Allocate Excess',
  'Production Schedule',
  'Packaging',
  'Shipment & Acceptance',
  'Invoice & Close',
];

interface FinishPOWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  customerName: string;
  dueDate: string;
  lineItems: Array<{
    id: string;
    line_number: string;
    formula_id: string;
    formula_code: string;
    formula_name: string;
    bottles_ordered: number;
    bottle_size: number;
    selected_bottle_id?: string | null;
    selected_cap_id?: string | null;
    selected_label_id?: string | null;
  }>;
  productionBatches: Array<{
    production_schedule_item_id: string;
    formula_code: string;
    estimated_bottles: number;
  }>;
}

export const FinishPOWizard = ({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  customerName,
  dueDate,
  lineItems,
  productionBatches,
}: FinishPOWizardProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { fulfillmentLines, wizardRun, startWizard, updateWizardStep, completeWizard } = useOrderFulfillment(orderId);
  const { allocateExcess } = useExcessAllocation();

  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step state
  const [allocations, setAllocations] = useState<LineAllocation[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [packagingLines, setPackagingLines] = useState<PackagingLine[]>([]);
  const [shipmentData, setShipmentData] = useState<ShipmentData>({
    shipDate: '',
    carrier: '',
    trackingNumber: '',
    lines: [],
    quickAccept: true,
  });
  const [closeAction, setCloseAction] = useState<'ready_to_invoice' | 'closed'>('ready_to_invoice');
  const [closeReason, setCloseReason] = useState('');

  // Resume from existing wizard run
  useEffect(() => {
    if (wizardRun && open) {
      setCurrentStep(wizardRun.current_step);
    }
  }, [wizardRun, open]);

  // Start wizard if none exists
  useEffect(() => {
    if (open && !wizardRun) {
      startWizard.mutate();
    }
  }, [open]);

  const handleNext = async () => {
    setSaving(true);
    try {
      const runId = wizardRun?.id || startWizard.data?.id;
      if (runId) {
        await updateWizardStep.mutateAsync({
          wizardRunId: runId,
          step: currentStep + 1,
          stepData: { step: currentStep },
        });
      }

      // Step-specific saves
      if (currentStep === 2 && allocations.length > 0) {
        // Save excess allocations
        for (const alloc of allocations) {
          if (alloc.allocating > 0 && alloc.entries.length > 0) {
            await allocateExcess.mutateAsync({
              orderId,
              lineItemId: alloc.lineItemId,
              allocations: alloc.entries,
            });
          }
        }
      }

      if (currentStep === 4) {
        // Save packaging reconciliation
        for (const pkg of packagingLines) {
          if (!pkg.isRecorded) {
            await supabase
              .from('order_line_items')
              .update({ qty_packed: pkg.actualBottles } as any)
              .eq('id', pkg.lineItemId);

            if (pkg.delta > 0) {
              // Create excess bright stock
              const li = lineItems.find(l => l.id === pkg.lineItemId);
              if (li) {
                await supabase.from('bright_stock').insert({
                  formula_id: li.formula_id,
                  bottle_size: li.bottle_size,
                  quantity_bottles: pkg.delta,
                  production_date: todayET(),
                  is_allocated: false,
                });
                await supabase.from('finished_goods_excess_transactions').insert({
                  order_id: orderId,
                  line_item_id: pkg.lineItemId,
                  transaction_type: 'ADD_FROM_PACKAGING',
                  qty: pkg.delta,
                  notes: `Excess from packaging: ${pkg.delta} bottles`,
                });
                await supabase
                  .from('order_line_items')
                  .update({ excess_created: pkg.delta } as any)
                  .eq('id', pkg.lineItemId);
              }
            } else if (pkg.delta < 0) {
              await supabase
                .from('order_line_items')
                .update({
                  shortage_qty: Math.abs(pkg.delta),
                  shortage_status: pkg.shortageAction === 'accept_shortage' ? 'accepted' : 'unresolved',
                } as any)
                .eq('id', pkg.lineItemId);
            }
          }
        }
      }

      if (currentStep === 5) {
        // Save shipment
        if (shipmentData.lines.some(l => l.qtyShipped > 0)) {
          const { data: userData } = await supabase.auth.getUser();
          const { data: shipment } = await supabase
            .from('order_shipments')
            .insert({
              order_id: orderId,
              shipment_date: shipmentData.shipDate,
              tracking_number: shipmentData.trackingNumber || null,
              carrier: shipmentData.carrier || null,
              shipped_by: userData?.user?.id || null,
            } as any)
            .select()
            .single();

          if (shipment) {
            for (const line of shipmentData.lines) {
              if (line.qtyShipped > 0) {
                await supabase.from('order_shipment_lines').insert({
                  shipment_id: shipment.id,
                  order_line_id: line.lineItemId,
                  qty_shipped: line.qtyShipped,
                  qty_accepted: shipmentData.quickAccept ? line.qtyShipped : line.qtyAccepted,
                  acceptance_status: shipmentData.quickAccept ? 'ACCEPTED' : 'PENDING',
                });

                const accepted = shipmentData.quickAccept ? line.qtyShipped : line.qtyAccepted;
                await supabase
                  .from('order_line_items')
                  .update({
                    qty_shipped_total: (fulfillmentLines.find(f => f.lineItemId === line.lineItemId)?.qtyShippedTotal || 0) + line.qtyShipped,
                    qty_accepted_total: (fulfillmentLines.find(f => f.lineItemId === line.lineItemId)?.qtyAcceptedTotal || 0) + accepted,
                    invoiceable_qty: (fulfillmentLines.find(f => f.lineItemId === line.lineItemId)?.invoiceableQty || 0) + accepted,
                  } as any)
                  .eq('id', line.lineItemId);
              }
            }
          }
        }
      }

      setCurrentStep(prev => Math.min(prev + 1, 6));
    } catch (error: any) {
      toast({ title: 'Error saving step', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const runId = wizardRun?.id || startWizard.data?.id;

      // Update fulfillment status
      await supabase
        .from('order_headers')
        .update({ fulfillment_status: closeAction } as any)
        .eq('id', orderId);

      // Update invoice status on line items
      for (const line of fulfillmentLines) {
        const ship = shipmentData.lines.find(s => s.lineItemId === line.lineItemId);
        const invoiceable = line.invoiceableQty + (ship?.qtyAccepted || ship?.qtyShipped || 0);
        await supabase
          .from('order_line_items')
          .update({
            invoiceable_qty: invoiceable,
            invoice_status: invoiceable >= line.qtyRequested ? 'fully_invoiced' : invoiceable > 0 ? 'partially_invoiced' : 'not_invoiced',
          } as any)
          .eq('id', line.lineItemId);
      }

      if (runId) {
        await completeWizard.mutateAsync(runId);
      }

      // Fire-and-forget email notification for ready for pickup
      supabase.functions.invoke('send-order-email', {
        body: { order_id: orderId, event_type: 'READY_FOR_PICKUP' },
      }).catch(err => console.error('Email notification error:', err));

      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-fulfillment-lines', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-line-items', orderId] });

      onOpenChange(false);
      toast({ title: 'PO completed successfully!' });
    } catch (error: any) {
      toast({ title: 'Error completing PO', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const progressPercent = (currentStep / 6) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Finish PO: {orderNumber}</span>
            <Badge variant="outline">Step {currentStep} of 6</Badge>
          </DialogTitle>
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              {STEP_LABELS.map((label, idx) => (
                <span
                  key={label}
                  className={idx + 1 === currentStep ? 'text-primary font-semibold' : idx + 1 < currentStep ? 'text-green-600' : ''}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto py-4">
          {currentStep === 1 && (
            <StepConfirmInputs
              orderNumber={orderNumber}
              customerName={customerName}
              dueDate={dueDate}
              lines={fulfillmentLines}
              lineItems={lineItems}
            />
          )}
          {currentStep === 2 && (
            <StepAllocateExcess
              orderId={orderId}
              lineItems={lineItems}
              allocations={allocations}
              onAllocationsChange={setAllocations}
            />
          )}
          {currentStep === 3 && (
            <StepProductionSchedule
              allocations={allocations}
              existingBatches={productionBatches}
              scheduleEntries={scheduleEntries}
              onScheduleEntriesChange={setScheduleEntries}
            />
          )}
          {currentStep === 4 && (
            <StepPackagingReconciliation
              lineItems={lineItems}
              fulfillmentLines={fulfillmentLines}
              packagingLines={packagingLines}
              onPackagingLinesChange={setPackagingLines}
            />
          )}
          {currentStep === 5 && (
            <StepShipmentAcceptance
              lineItems={lineItems}
              fulfillmentLines={fulfillmentLines}
              packagingLines={packagingLines}
              shipmentData={shipmentData}
              onShipmentDataChange={setShipmentData}
            />
          )}
          {currentStep === 6 && (
            <StepInvoiceSummary
              fulfillmentLines={fulfillmentLines}
              allocations={allocations}
              packagingLines={packagingLines}
              shipmentData={shipmentData}
              closeAction={closeAction}
              closeReason={closeReason}
              onCloseActionChange={setCloseAction}
              onCloseReasonChange={setCloseReason}
            />
          )}
        </div>

        <div className="shrink-0 flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || saving}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>

          <div className="flex gap-2">
            {currentStep < 6 ? (
              <Button onClick={handleNext} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="mr-1 h-4 w-4" />
                )}
                {saving ? 'Saving...' : 'Save & Continue'}
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                )}
                {saving ? 'Completing...' : 'Complete PO'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
