import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, FileDown, FileText, X } from "lucide-react";
import { ShippingEntry } from "@/hooks/useShippingEntries";
import { useCreateInvoice } from "@/hooks/useCustomerInvoices";
import { generateInvoicePdf } from "@/utils/invoicePdfGenerator";
import { supabase } from "@/integrations/supabase/client";
import { CustomerPOPickerModal } from "./CustomerPOPickerModal";
import { todayET } from "@/utils/dateUtils";

interface Props {
  open: boolean;
  onClose: () => void;
  entries: ShippingEntry[];
}

interface LineRow {
  id: string;
  shipping_entry_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
}

export const CreateInvoiceModal: React.FC<Props> = ({ open, onClose, entries }) => {
  const createInvoice = useCreateInvoice();

  const customers = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((e) => {
      const k = e.customer_id || e.customer_name || "unknown";
      map.set(k, e.customer_name || "Unknown");
    });
    return Array.from(map.entries());
  }, [entries]);

  const mixedCustomers = customers.length > 1;
  const primary = entries[0];

  const [customerId, setCustomerId] = useState<string | null>(primary?.customer_id ?? null);
  const [customerName, setCustomerName] = useState(primary?.customer_name ?? "");
  const [orderHeaderId, setOrderHeaderId] = useState<string | null>(primary?.order_header_id ?? null);
  const [issueDate, setIssueDate] = useState(todayET());
  const [dueDate, setDueDate] = useState("");
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState("");
  const [poNumber, setPoNumber] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load initial PO number when modal opens with a pre-filled order_header_id
  React.useEffect(() => {
    if (!orderHeaderId) { setPoNumber(null); return; }
    let cancelled = false;
    supabase
      .from("order_headers")
      .select("po_number, order_number")
      .eq("id", orderHeaderId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setPoNumber((data as any)?.po_number || (data as any)?.order_number || null);
      });
    return () => { cancelled = true; };
  }, [orderHeaderId]);

  const [lines, setLines] = useState<LineRow[]>(() =>
    entries.map((e) => ({
      id: e.id,
      shipping_entry_id: e.id,
      description: `${e.product_name ?? ""} — ${e.bottle_size ?? ""}${e.lot_number ? ` · Lot ${e.lot_number}` : ""}`.trim(),
      quantity: e.bottle_count ?? 0,
      unit_price: 0,
    }))
  );

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const total = subtotal + (Number(tax) || 0);

  const updateLine = (id: string, patch: Partial<LineRow>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  const addBlankLine = () =>
    setLines((p) => [
      ...p,
      { id: crypto.randomUUID(), shipping_entry_id: null, description: "", quantity: 1, unit_price: 0 },
    ]);

  const handleSubmit = async (downloadPdf: boolean) => {
    const created = await createInvoice.mutateAsync({
      customer_id: customerId,
      customer_name: customerName,
      order_header_id: orderHeaderId,
      issue_date: issueDate,
      due_date: dueDate || null,
      notes: notes || null,
      tax: Number(tax) || 0,
      lines: lines.map((l) => ({
        shipping_entry_id: l.shipping_entry_id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
      })),
      shipping_entry_ids: entries.map((e) => e.id),
    });

    // poNumber already resolved via effect when orderHeaderId is set

    if (downloadPdf) {
      generateInvoicePdf({
        invoice_number: (created as any).invoice_number,
        issue_date: issueDate,
        due_date: dueDate || null,
        customer_name: customerName,
        order_po: poNumber,
        notes,
        lines: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          line_total: Number((l.quantity * l.unit_price).toFixed(2)),
        })),
        subtotal,
        tax: Number(tax) || 0,
        total,
      });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[98vw] w-[98vw] min-w-[98vw] max-h-[90vh] overflow-y-auto rounded-lg" style={{ maxWidth: '98vw' }}>
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>

        {mixedCustomers && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
            ⚠ Selected items span multiple customers ({customers.map((c) => c[1]).join(", ")}).
            The invoice will be issued to the customer name below.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Customer Name *</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <Label>Issue Date *</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label>Tax ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={tax}
              onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="col-span-2">
            <Label>Customer PO</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-muted/30 min-h-10">
                {orderHeaderId ? (
                  <>
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-mono">{poNumber || "(loading…)"}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">No PO attached</span>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                {orderHeaderId ? "Change" : "Attach PO"}
              </Button>
              {orderHeaderId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => { setOrderHeaderId(null); setPoNumber(null); }}
                  title="Clear PO"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">Line Items</h4>
            <Button variant="outline" size="sm" onClick={addBlankLine}>
              + Add line
            </Button>
          </div>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Description</th>
                  <th className="text-right p-2 w-24">Qty</th>
                  <th className="text-right p-2 w-32">Unit Price</th>
                  <th className="text-right p-2 w-32">Line Total</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2">
                      <Input
                        value={l.description}
                        onChange={(e) => updateLine(l.id, { description: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        className="text-right"
                        value={l.quantity}
                        onChange={(e) =>
                          updateLine(l.id, { quantity: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right"
                        value={l.unit_price}
                        onChange={(e) =>
                          updateLine(l.id, { unit_price: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      ${(l.quantity * l.unit_price).toFixed(2)}
                    </td>
                    <td className="p-2">
                      <Button variant="ghost" size="icon" onClick={() => removeLine(l.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-3 text-sm tabular-nums">
            <div className="space-y-1 text-right">
              <div>Subtotal: <span className="font-medium">${subtotal.toFixed(2)}</span></div>
              <div>Tax: <span className="font-medium">${(Number(tax) || 0).toFixed(2)}</span></div>
              <div className="text-base font-bold">Total: ${total.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit(false)}
            disabled={createInvoice.isPending}
          >
            Save Draft
          </Button>
          <Button onClick={() => handleSubmit(true)} disabled={createInvoice.isPending}>
            <FileDown className="h-4 w-4 mr-2" />
            Save & Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
      <CustomerPOPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        customerId={customerId}
        customerName={customerName}
        selectedPoId={orderHeaderId}
        onSelect={(id) => { setOrderHeaderId(id); setPickerOpen(false); }}
      />
    </Dialog>
  );
};
