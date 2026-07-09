import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, FileText, AlertTriangle } from 'lucide-react';
import { FulfillmentLineMetrics } from '@/hooks/useOrderFulfillment';
import { ShipmentData } from './StepShipmentAcceptance';
import { PackagingLine } from './StepPackagingReconciliation';
import { LineAllocation } from './StepAllocateExcess';

interface StepInvoiceSummaryProps {
  fulfillmentLines: FulfillmentLineMetrics[];
  allocations: LineAllocation[];
  packagingLines: PackagingLine[];
  shipmentData: ShipmentData;
  closeAction: 'ready_to_invoice' | 'closed';
  closeReason: string;
  onCloseActionChange: (action: 'ready_to_invoice' | 'closed') => void;
  onCloseReasonChange: (reason: string) => void;
}

export const StepInvoiceSummary = ({
  fulfillmentLines,
  allocations,
  packagingLines,
  shipmentData,
  closeAction,
  closeReason,
  onCloseActionChange,
  onCloseReasonChange,
}: StepInvoiceSummaryProps) => {
  // Compute final reconciliation from wizard data
  const computedLines = fulfillmentLines.map(fl => {
    const alloc = allocations.find(a => a.lineItemId === fl.lineItemId);
    const pkg = packagingLines.find(p => p.lineItemId === fl.lineItemId);
    const ship = shipmentData.lines.find(s => s.lineItemId === fl.lineItemId);

    const qtyAllocated = alloc?.allocating || fl.qtyAllocatedFromExcess;
    const qtyPacked = pkg?.actualBottles || fl.qtyPacked;
    const qtyShipped = (fl.qtyShippedTotal || 0) + (ship?.qtyShipped || 0);
    const qtyAccepted = (fl.qtyAcceptedTotal || 0) + (ship?.qtyAccepted || 0);
    const excessCreated = pkg && pkg.delta > 0 ? pkg.delta : fl.excessCreated;
    const shortageQty = pkg && pkg.delta < 0 ? Math.abs(pkg.delta) : fl.shortageQty;
    const invoiceableQty = qtyAccepted > 0 ? qtyAccepted : qtyShipped;

    return {
      ...fl,
      qtyAllocatedFromExcess: qtyAllocated,
      qtyPacked,
      qtyShippedTotal: qtyShipped,
      qtyAcceptedTotal: qtyAccepted,
      excessCreated,
      shortageQty,
      invoiceableQty,
    };
  });

  const totals = computedLines.reduce(
    (acc, l) => ({
      qtyRequested: acc.qtyRequested + l.qtyRequested,
      qtyAllocated: acc.qtyAllocated + l.qtyAllocatedFromExcess,
      qtyPacked: acc.qtyPacked + l.qtyPacked,
      qtyShipped: acc.qtyShipped + l.qtyShippedTotal,
      qtyAccepted: acc.qtyAccepted + l.qtyAcceptedTotal,
      excess: acc.excess + l.excessCreated,
      shortage: acc.shortage + l.shortageQty,
      invoiceable: acc.invoiceable + l.invoiceableQty,
    }),
    { qtyRequested: 0, qtyAllocated: 0, qtyPacked: 0, qtyShipped: 0, qtyAccepted: 0, excess: 0, shortage: 0, invoiceable: 0 }
  );

  const hasPendingAcceptance = shipmentData.lines.some(l => l.qtyAccepted < l.qtyShipped && !shipmentData.quickAccept);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Final reconciliation summary. Review all quantities and mark the PO for invoicing.
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Line</TableHead>
              <TableHead>Formula</TableHead>
              <TableHead className="text-right">PO Qty</TableHead>
              <TableHead className="text-right">From Excess</TableHead>
              <TableHead className="text-right">Packed</TableHead>
              <TableHead className="text-right">Shipped</TableHead>
              <TableHead className="text-right">Accepted</TableHead>
              <TableHead className="text-right">Excess</TableHead>
              <TableHead className="text-right">Shortage</TableHead>
              <TableHead className="text-right font-bold">Invoiceable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {computedLines.map(line => (
              <TableRow key={line.lineItemId}>
                <TableCell className="font-medium">{line.lineNumber}</TableCell>
                <TableCell className="font-medium">{line.formulaCode}</TableCell>
                <TableCell className="text-right">{line.qtyRequested.toLocaleString()}</TableCell>
                <TableCell className="text-right text-blue-600">{line.qtyAllocatedFromExcess > 0 ? line.qtyAllocatedFromExcess.toLocaleString() : '—'}</TableCell>
                <TableCell className="text-right">{line.qtyPacked.toLocaleString()}</TableCell>
                <TableCell className="text-right">{line.qtyShippedTotal.toLocaleString()}</TableCell>
                <TableCell className="text-right text-green-600">{line.qtyAcceptedTotal > 0 ? line.qtyAcceptedTotal.toLocaleString() : '—'}</TableCell>
                <TableCell className="text-right text-purple-600">{line.excessCreated > 0 ? line.excessCreated.toLocaleString() : '—'}</TableCell>
                <TableCell className="text-right text-red-600">{line.shortageQty > 0 ? line.shortageQty.toLocaleString() : '—'}</TableCell>
                <TableCell className="text-right font-bold text-lg">{line.invoiceableQty.toLocaleString()}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell className="text-right">{totals.qtyRequested.toLocaleString()}</TableCell>
              <TableCell className="text-right text-blue-600">{totals.qtyAllocated.toLocaleString()}</TableCell>
              <TableCell className="text-right">{totals.qtyPacked.toLocaleString()}</TableCell>
              <TableCell className="text-right">{totals.qtyShipped.toLocaleString()}</TableCell>
              <TableCell className="text-right text-green-600">{totals.qtyAccepted.toLocaleString()}</TableCell>
              <TableCell className="text-right text-purple-600">{totals.excess.toLocaleString()}</TableCell>
              <TableCell className="text-right text-red-600">{totals.shortage.toLocaleString()}</TableCell>
              <TableCell className="text-right text-lg">{totals.invoiceable.toLocaleString()}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <div>
          <label className="text-sm font-medium mb-2 block">Close Action</label>
          <Select value={closeAction} onValueChange={(v) => onCloseActionChange(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ready_to_invoice">Mark Ready to Invoice</SelectItem>
              <SelectItem value="closed">Complete & Close PO</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasPendingAcceptance && (
          <div>
            <label className="text-sm font-medium mb-2 block">Reason (acceptance pending)</label>
            <Textarea
              value={closeReason}
              onChange={(e) => onCloseReasonChange(e.target.value)}
              placeholder="Closing with pending acceptance because..."
              rows={2}
            />
          </div>
        )}
      </div>

      {hasPendingAcceptance && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-700 rounded-lg">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm">Some shipment lines have pending acceptance. Invoiceable qty uses shipped qty as fallback.</span>
        </div>
      )}
    </div>
  );
};
