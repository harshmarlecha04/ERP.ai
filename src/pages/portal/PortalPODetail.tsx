import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerOrderDetail } from '@/hooks/useCustomerOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatET } from "@/utils/dateUtils";

const isClosed = (h: any) => {
  const s = `${h?.fulfillment_status || ''} ${h?.status || ''} ${h?.header_status || ''}`.toLowerCase();
  return s.includes('closed') || s.includes('complete') || s.includes('cancelled');
};

export default function PortalPODetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useCustomerOrderDetail(id);
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  if (!data?.header) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/portal/purchase-orders">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div className="text-sm text-muted-foreground">Purchase order not found.</div>
      </div>
    );
  }

  const h = data.header;
  const closed = isClosed(h);

  const closePO = async () => {
    setClosing(true);
    try {
      const { error } = await supabase
        .from('order_headers')
        .update({ fulfillment_status: 'closed', status: 'closed' } as any)
        .eq('id', h.id);
      if (error) throw error;
      toast.success('Purchase order closed.');
      qc.invalidateQueries({ queryKey: ['portal', 'orders'] });
      qc.invalidateQueries({ queryKey: ['portal', 'order', h.id] });
      navigate('/portal/purchase-orders');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to close PO.');
    } finally {
      setClosing(false);
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link to="/portal/purchase-orders">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Purchase Orders
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">PO {h.po_number || h.order_number}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={closed ? 'secondary' : 'default'}>
              {h.fulfillment_status || h.status || 'Pending'}
            </Badge>
            {h.approval_status && (
              <Badge variant={h.approval_status === 'approved' ? 'default' : h.approval_status === 'rejected' ? 'destructive' : 'secondary'}>
                Approval: {h.approval_status}
              </Badge>
            )}
            {h.due_date && (
              <span className="text-sm text-muted-foreground">
                Due {formatET(h.due_date, 'MMM d, yyyy')}
              </span>
            )}
          </div>
          {h.approval_status === 'rejected' && h.rejection_reason && (
            <div className="mt-2 text-sm text-destructive">Rejected: {h.rejection_reason}</div>
          )}
        </div>
        {!closed && (
          <Button variant="outline" onClick={() => setConfirming(true)}>
            <Lock className="h-4 w-4 mr-2" />
            Close PO
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">PO number</div>
            <div className="font-medium">{h.po_number || '—'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Order number</div>
            <div className="font-medium">{h.order_number}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Requested ship date</div>
            <div className="font-medium">
              {h.due_date ? formatET(h.due_date, 'MMM d, yyyy') : '—'}
            </div>
          </div>
          <div className="md:col-span-3">
            <div className="text-muted-foreground">Notes</div>
            <div className="whitespace-pre-wrap">{h.notes || '—'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items ({data.lines.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!data.lines.length ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No line items.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Ct</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead className="text-right">Price/unit</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Shipped</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lines.map((l: any) => {
                  const price = Number(l.price_per_unit ?? 0);
                  const total = Number(l.line_total ?? price * (l.bottles_ordered ?? 0));
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{l.line_number}</TableCell>
                      <TableCell className="font-medium">{l.product_name || '—'}</TableCell>
                      <TableCell>{l.bottle_size} ct</TableCell>
                      <TableCell>{l.bottle_container || '—'}</TableCell>
                      <TableCell className="text-right">
                        {price ? price.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '—'}
                      </TableCell>
                      <TableCell className="text-right">{l.bottles_ordered}</TableCell>
                      <TableCell className="text-right">{l.qty_shipped_total ?? l.bottles_shipped ?? 0}</TableCell>
                      <TableCell className="text-right">
                        {total ? total.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{l.notes || '—'}</TableCell>
                    </TableRow>
                  );
                })}
                {(() => {
                  const grand = data.lines.reduce(
                    (s: number, l: any) =>
                      s + Number(l.line_total ?? (Number(l.price_per_unit ?? 0) * (l.bottles_ordered ?? 0))),
                    0,
                  );
                  if (!grand) return null;
                  return (
                    <TableRow>
                      <TableCell colSpan={7} className="text-right font-medium">
                        Order total
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {grand.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  );
                })()}
              </TableBody>
            </Table>

          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              Once closed, this PO will be moved to your closed list. You can still view it but it
              cannot be reopened from the portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={closePO} disabled={closing}>
              {closing ? 'Closing…' : 'Close PO'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
