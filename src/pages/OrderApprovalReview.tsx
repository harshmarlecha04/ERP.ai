import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isPoApprover, PO_APPROVER_EMAILS } from '@/lib/poApprovers';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatET } from "@/utils/dateUtils";


const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export default function OrderApprovalReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = useUserRoles();

  const isAdmin = hasPermission('admin');
  const isApprover = isPoApprover(user?.email);
  const authorized = isAdmin || isApprover;

  const { data, isLoading } = useQuery({
    queryKey: ['po-approval', id],
    enabled: !!id,
    queryFn: async () => {
      const [headerRes, linesRes, custRes] = await Promise.all([
        supabase.from('order_headers').select('*').eq('id', id!).single(),
        supabase.from('order_line_items').select('*').eq('order_id', id!).order('line_number'),
        supabase.from('order_headers').select('customer_id').eq('id', id!).single(),
      ]);
      if (headerRes.error) throw headerRes.error;
      if (linesRes.error) throw linesRes.error;
      let customer: any = null;
      if (custRes.data?.customer_id) {
        const { data: c } = await supabase
          .from('customers').select('id, company_name').eq('id', custRes.data.customer_id).single();
        customer = c;
      }
      return { header: headerRes.data, lines: linesRes.data || [], customer };
    },
  });

  const { data: formulas } = useQuery({
    queryKey: ['formulas-active', data?.customer?.id],
    enabled: !!data,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('formulas')
        .select('id, name, formula_code, customer_id, status')
        .eq('status', 'active')
        .or(`customer_id.is.null,customer_id.eq.${data!.customer?.id ?? '00000000-0000-0000-0000-000000000000'}`)
        .order('name');
      if (error) throw error;
      return rows || [];
    },
  });

  const [lineFormulas, setLineFormulas] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data?.lines) {
      const init: Record<string, string> = {};
      for (const l of data.lines) if (l.formula_id) init[l.id] = l.formula_id;
      setLineFormulas(init);
    }
  }, [data?.lines]);

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const grandTotal = useMemo(
    () => (data?.lines || []).reduce(
      (s: number, l: any) => s + Number(l.line_total ?? (Number(l.price_per_unit ?? 0) * (l.bottles_ordered ?? 0))), 0),
    [data?.lines],
  );

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data?.header) return <div className="text-sm text-muted-foreground">Order not found.</div>;

  if (!authorized) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to={`/orders/${id}`}><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
        </Button>
        <Card><CardContent className="p-6 text-sm">
          Only PO approvers can review this order. Approver list: {PO_APPROVER_EMAILS.join(', ')}.
        </CardContent></Card>
      </div>
    );
  }

  const h = data.header;
  const decided = h.approval_status === 'approved' || h.approval_status === 'rejected';

  const submit = async (decision: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('decide_po_approval' as any, {
        _order_id: id!,
        _decision: decision,
        _rejection_reason: decision === 'rejected' ? (reason.trim() || null) : null,
        _line_formulas: lineFormulas,
      });
      if (error) throw error;
      toast.success(decision === 'approved' ? 'PO approved.' : 'PO rejected.');
      qc.invalidateQueries({ queryKey: ['po-approval', id] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      navigate(`/orders/${id}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to record decision.');
    } finally {
      setBusy(false);
      setRejecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to={`/orders/${id}`}><ArrowLeft className="h-4 w-4 mr-2" />Back to order</Link>
        </Button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Review PO {h.po_number || h.order_number}</h1>
          <Badge variant={h.approval_status === 'approved' ? 'default' : h.approval_status === 'rejected' ? 'destructive' : 'secondary'}>
            {h.approval_status || 'pending'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {data.customer?.company_name || 'Customer'} · submitted {h.created_at ? formatET(h.created_at, 'MMM d, yyyy h:mm a') : '—'}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Order details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div><div className="text-muted-foreground">PO number</div><div className="font-medium">{h.po_number || '—'}</div></div>
          <div><div className="text-muted-foreground">Order number</div><div className="font-medium">{h.order_number}</div></div>
          <div><div className="text-muted-foreground">Requested ship date</div><div className="font-medium">{h.due_date ? formatET(h.due_date, 'MMM d, yyyy') : '—'}</div></div>
          <div className="md:col-span-3"><div className="text-muted-foreground">Notes</div><div className="whitespace-pre-wrap">{h.notes || '—'}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Line items ({data.lines.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Ct</TableHead>
                <TableHead>Container</TableHead>
                <TableHead className="text-right">Price/unit</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="min-w-[220px]">Formula (optional)</TableHead>
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
                    <TableCell className="text-right">{price ? fmtMoney(price) : '—'}</TableCell>
                    <TableCell className="text-right">{l.bottles_ordered}</TableCell>
                    <TableCell className="text-right">{total ? fmtMoney(total) : '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={lineFormulas[l.id] || '__none__'}
                        onValueChange={(v) => setLineFormulas((p) => ({ ...p, [l.id]: v === '__none__' ? '' : v }))}
                        disabled={decided}
                      >
                        <SelectTrigger><SelectValue placeholder="No formula" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No formula</SelectItem>
                          {(formulas || []).map((f: any) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.formula_code ? `${f.formula_code} — ` : ''}{f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={6} className="text-right font-medium">Order total</TableCell>
                <TableCell className="text-right font-semibold">{fmtMoney(grandTotal)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {h.approval_status === 'rejected' && h.rejection_reason && (
        <Card><CardContent className="p-4 text-sm">
          <span className="font-medium">Rejection reason: </span>{h.rejection_reason}
        </CardContent></Card>
      )}

      {!decided && (
        <div className="flex justify-end gap-2">
          <Button variant="destructive" onClick={() => setRejecting(true)} disabled={busy}>
            <X className="h-4 w-4 mr-2" />Reject
          </Button>
          <Button onClick={() => submit('approved')} disabled={busy}>
            <Check className="h-4 w-4 mr-2" />Approve PO
          </Button>
        </div>
      )}

      <AlertDialog open={rejecting} onOpenChange={setRejecting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              The customer will be notified in their portal. Add a brief reason so they know what to fix.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection…" rows={4} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit('rejected')} disabled={busy}>
              {busy ? 'Rejecting…' : 'Reject PO'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
