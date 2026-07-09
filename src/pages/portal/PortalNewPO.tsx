import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentCustomer } from '@/hooks/useCurrentCustomer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const CT_SIZES = [60, 70, 90, 120] as const;
const BOTTLE_CONTAINERS = [
  '250 cc White',
  '250 cc Clear',
  '300 cc Clear',
  '300 cc White',
  '400 cc Clear',
  '500 cc Clear',
] as const;

interface LineDraft {
  product_name: string;
  bottle_size: number | null;
  bottle_container: string;
  price_per_unit: string;
  bottles_ordered: string;
  notes: string;
}

const blankLine = (): LineDraft => ({
  product_name: '',
  bottle_size: null,
  bottle_container: '',
  price_per_unit: '',
  bottles_ordered: '',
  notes: '',
});

const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export default function PortalNewPO() {
  const navigate = useNavigate();
  const { data: customer } = useCurrentCustomer();
  const [searchParams, setSearchParams] = useSearchParams();

  const [poNumber, setPoNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [scannedPdfPath, setScannedPdfPath] = useState<string | null>(null);
  const [scannedFileName, setScannedFileName] = useState<string | null>(null);
  const [hydratedFromScan, setHydratedFromScan] = useState(false);

  useEffect(() => {
    if (searchParams.get('from') !== 'scan' || hydratedFromScan) return;
    (async () => {
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult.user?.id;
      if (!userId) return;
      const { data: draft } = await supabase
        .from('order_drafts')
        .select('order_data')
        .eq('user_id', userId)
        .maybeSingle();
      const payload = (draft?.order_data as any) || null;
      if (!payload || payload.kind !== 'po_scan' || !payload.extraction) {
        setHydratedFromScan(true);
        return;
      }
      const ex = payload.extraction;
      if (ex.po_number) setPoNumber(String(ex.po_number));
      if (ex.due_date && /^\d{4}-\d{2}-\d{2}$/.test(ex.due_date)) setDueDate(ex.due_date);
      if (ex.special_instructions) setNotes(String(ex.special_instructions));
      const scannedLines: LineDraft[] = (ex.line_items || []).map((it: any) => {
        const sizeNum = Number(it.bottle_size) || 0;
        const allowedSize = [60, 70, 90, 120].includes(sizeNum) ? sizeNum : null;
        const hint = String(it.bottle_container_hint || '').trim();
        const matchedContainer =
          BOTTLE_CONTAINERS.find((c) => c.toLowerCase() === hint.toLowerCase()) ||
          BOTTLE_CONTAINERS.find((c) => hint.toLowerCase().includes(c.toLowerCase())) ||
          '';
        return {
          product_name: String(it.product_name || ''),
          bottle_size: allowedSize,
          bottle_container: matchedContainer,
          price_per_unit: it.unit_price ? String(it.unit_price) : '',
          bottles_ordered: it.bottle_count ? String(it.bottle_count) : '',
          notes: String(it.notes || ''),
        };
      });
      if (scannedLines.length) setLines(scannedLines);
      if (payload.pdf_path) setScannedPdfPath(String(payload.pdf_path));
      if (payload.file_name) setScannedFileName(String(payload.file_name));
      setHydratedFromScan(true);
      // Clear the draft so a future visit doesn't re-hydrate the old scan
      await supabase.from('order_drafts').delete().eq('user_id', userId);
    })();
  }, [searchParams, hydratedFromScan]);

  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const lineTotals = useMemo(
    () =>
      lines.map((l) => {
        const price = parseFloat(l.price_per_unit) || 0;
        const qty = parseInt(l.bottles_ordered, 10) || 0;
        return price * qty;
      }),
    [lines],
  );
  const grandTotal = lineTotals.reduce((s, n) => s + n, 0);

  const submit = async () => {
    if (!customer) {
      toast.error('Customer record not loaded yet — please retry in a moment.');
      return;
    }
    if (!poNumber.trim()) return toast.error('PO number is required.');
    if (!dueDate) return toast.error('Requested ship date is required.');

    const cleaned = lines.map((l) => ({
      ...l,
      qty: parseInt(l.bottles_ordered, 10) || 0,
      price: parseFloat(l.price_per_unit) || 0,
    }));

    for (const [i, l] of cleaned.entries()) {
      if (!l.product_name.trim()) return toast.error(`Line ${i + 1}: product name is required.`);
      if (!l.bottle_size) return toast.error(`Line ${i + 1}: ct size is required.`);
      if (l.qty <= 0) return toast.error(`Line ${i + 1}: number of bottles must be greater than 0.`);
      if (l.price <= 0) return toast.error(`Line ${i + 1}: price per unit must be greater than 0.`);
    }

    setSaving(true);
    try {
      const orderNumber = `CUST-${Date.now()}`;
      const totalBottles = cleaned.reduce((s, l) => s + l.qty, 0);

      const { data: header, error: hErr } = await supabase
        .from('order_headers')
        .insert({
          order_number: orderNumber,
          customer_id: customer.id,
          due_date: dueDate,
          po_number: poNumber.trim(),
          notes: notes.trim() || null,
          source: 'customer_portal',
          received_via: 'portal',
          total_line_items: cleaned.length,
          total_bottles_ordered: totalBottles,
          ...(scannedPdfPath ? { pdf_url: scannedPdfPath } : {}),
        } as any)
        .select('id')
        .single();
      if (hErr) throw hErr;

      const lineRows = cleaned.map((l, i) => ({
        order_id: header.id,
        line_number: String(i + 1),
        product_name: l.product_name.trim(),
        bottle_size: l.bottle_size,
        bottle_container: l.bottle_container || null,
        price_per_unit: l.price,
        bottles_ordered: l.qty,
        notes: l.notes.trim() || null,
      }));
      const { error: lErr } = await supabase.from('order_line_items').insert(lineRows as any);
      if (lErr) throw lErr;

      const { error: approvalErr } = await supabase.rpc('submit_po_for_approval' as any, { _order_id: header.id });
      if (approvalErr) console.error('submit_po_for_approval failed', approvalErr);

      toast.success('Purchase order submitted for approval.');
      navigate(`/portal/purchase-orders/${header.id}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to submit PO.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/portal/purchase-orders">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Purchase Orders
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">New Purchase Order</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Edit any field freely. Once you submit, the PO is locked.
        </p>
      </div>

      {scannedPdfPath && (
        <div className="border border-primary/30 bg-primary/5 rounded-md p-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm flex-1">
            <div className="font-medium">We pre-filled this PO from your uploaded file{scannedFileName ? `: ${scannedFileName}` : ''}.</div>
            <div className="text-muted-foreground mt-1">
              Review every field carefully before submitting. The original file will be attached to the order for our team.
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setScannedPdfPath(null);
              setScannedFileName(null);
              setSearchParams({});
            }}
          >
            Dismiss
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="po">PO number *</Label>
              <Input
                id="po"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="e.g. PO-2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due">Requested ship date *</Label>
              <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything we should know about this order…"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line items</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, blankLine()])}>
            <Plus className="h-4 w-4 mr-2" />
            Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.map((l, idx) => (
            <div key={idx} className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Line {idx + 1}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={lines.length === 1}
                  onClick={() => setLines((p) => p.filter((_, i) => i !== idx))}
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2 md:col-span-2">
                  <Label>Product name *</Label>
                  <Input
                    value={l.product_name}
                    onChange={(e) => updateLine(idx, { product_name: e.target.value })}
                    placeholder="e.g. Vitamin C Gummies"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ct size *</Label>
                  <Select
                    value={l.bottle_size != null ? String(l.bottle_size) : undefined}
                    onValueChange={(v) => updateLine(idx, { bottle_size: parseInt(v, 10) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ct size" />
                    </SelectTrigger>
                    <SelectContent>
                      {CT_SIZES.map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          {s} ct
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bottle container</Label>
                  <Select
                    value={l.bottle_container || undefined}
                    onValueChange={(v) => updateLine(idx, { bottle_container: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bottle container" />
                    </SelectTrigger>
                    <SelectContent>
                      {BOTTLE_CONTAINERS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Price per unit ($) *</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.price_per_unit}
                    onChange={(e) => updateLine(idx, { price_per_unit: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number of bottles *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={l.bottles_ordered}
                    onChange={(e) => updateLine(idx, { bottles_ordered: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input value={fmtMoney(lineTotals[idx] || 0)} readOnly className="bg-muted" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={l.notes}
                  onChange={(e) => updateLine(idx, { notes: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
          ))}

          <div className="flex justify-end border-t pt-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">Order total</span>
              <span className="text-lg font-semibold">{fmtMoney(grandTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link to="/portal/purchase-orders">Cancel</Link>
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit PO'}
        </Button>
      </div>
    </div>
  );
}
