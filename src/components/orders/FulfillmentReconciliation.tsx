import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useOrderFulfillment, FulfillmentLineMetrics } from '@/hooks/useOrderFulfillment';
import { ClipboardCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface FulfillmentReconciliationProps {
  orderId: string;
}

const getInvoiceBadge = (status: string) => {
  switch (status) {
    case 'fully_invoiced':
      return <Badge className="bg-green-100 text-green-800 border-green-300">Fully Invoiced</Badge>;
    case 'partially_invoiced':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Partial</Badge>;
    default:
      return <Badge variant="outline">Not Invoiced</Badge>;
  }
};

const getShortageBadge = (qty: number, status: string | null) => {
  if (qty === 0) return null;
  switch (status) {
    case 'resolved':
      return <Badge className="bg-green-100 text-green-800 border-green-300">{qty} (Resolved)</Badge>;
    case 'accepted':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">{qty} (Accepted)</Badge>;
    default:
      return <Badge className="bg-red-100 text-red-800 border-red-300">{qty} (Unresolved)</Badge>;
  }
};

export const FulfillmentReconciliation = ({ orderId }: FulfillmentReconciliationProps) => {
  const { fulfillmentLines, totals, linesLoading } = useOrderFulfillment(orderId);

  if (linesLoading) {
    return <Skeleton className="h-48" />;
  }

  // Only show if there's any fulfillment data beyond the basics
  const hasAnyFulfillmentData = fulfillmentLines.some(
    (l) =>
      l.qtyAllocatedFromExcess > 0 ||
      l.qtyPacked > 0 ||
      l.qtyShippedTotal > 0 ||
      l.qtyAcceptedTotal > 0 ||
      l.excessCreated > 0 ||
      l.shortageQty > 0
  );

  if (fulfillmentLines.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Fulfillment Reconciliation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead>Formula</TableHead>
                <TableHead className="text-right">PO Qty</TableHead>
                <TableHead className="text-right">From Excess</TableHead>
                <TableHead className="text-right">To Produce</TableHead>
                <TableHead className="text-right">Packed</TableHead>
                <TableHead className="text-right">Shipped</TableHead>
                <TableHead className="text-right">Accepted</TableHead>
                <TableHead className="text-right">Excess Created</TableHead>
                <TableHead>Shortage</TableHead>
                <TableHead className="text-right">Invoiceable</TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fulfillmentLines.map((line) => (
                <TableRow key={line.lineItemId}>
                  <TableCell className="font-medium">{line.lineNumber}</TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{line.formulaCode}</span>
                      <span className="text-muted-foreground text-xs ml-1">({line.bottleSize}ct)</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{line.qtyRequested.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {line.qtyAllocatedFromExcess > 0 ? (
                      <span className="text-blue-600 font-medium">{line.qtyAllocatedFromExcess.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{line.qtyToProduce.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{line.qtyPacked.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{line.qtyShippedTotal.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {line.qtyAcceptedTotal > 0 ? (
                      <span className="text-green-600 font-medium">{line.qtyAcceptedTotal.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.excessCreated > 0 ? (
                      <span className="text-purple-600">{line.excessCreated.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{getShortageBadge(line.shortageQty, line.shortageStatus)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {line.invoiceableQty > 0 ? line.invoiceableQty.toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>{getInvoiceBadge(line.invoiceStatus)}</TableCell>
                </TableRow>
              ))}
              {/* Summary row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right">{totals.qtyRequested.toLocaleString()}</TableCell>
                <TableCell className="text-right text-blue-600">{totals.qtyAllocatedFromExcess.toLocaleString()}</TableCell>
                <TableCell className="text-right">{totals.qtyToProduce.toLocaleString()}</TableCell>
                <TableCell className="text-right">{totals.qtyPacked.toLocaleString()}</TableCell>
                <TableCell className="text-right">{totals.qtyShippedTotal.toLocaleString()}</TableCell>
                <TableCell className="text-right text-green-600">{totals.qtyAcceptedTotal.toLocaleString()}</TableCell>
                <TableCell className="text-right text-purple-600">{totals.excessCreated.toLocaleString()}</TableCell>
                <TableCell>{totals.shortageQty > 0 ? <Badge className="bg-red-100 text-red-800">{totals.shortageQty}</Badge> : null}</TableCell>
                <TableCell className="text-right">{totals.invoiceableQty.toLocaleString()}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
