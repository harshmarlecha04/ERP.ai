import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShippingEntry } from "@/hooks/useShippingEntries";
import { useCreateInvoice } from "@/hooks/useCustomerInvoices";
import { todayET } from "@/utils/dateUtils";

interface Props {
  open: boolean;
  onClose: () => void;
  entries: ShippingEntry[];
}

const NO_PO_KEY = "__no_po__";

export const MarkInvoicedModal: React.FC<Props> = ({ open, onClose, entries }) => {
  const createInvoice = useCreateInvoice();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [issueDate, setIssueDate] = useState(todayET());

  const groups = useMemo(() => {
    const map = new Map<string, { poNumber: string | null; orderHeaderId: string | null; entries: ShippingEntry[] }>();
    for (const e of entries) {
      const po = e.order_headers?.po_number || e.order_headers?.order_number || null;
      const key = e.order_header_id ? `oh:${e.order_header_id}` : NO_PO_KEY;
      if (!map.has(key)) map.set(key, { poNumber: po, orderHeaderId: e.order_header_id, entries: [] });
      map.get(key)!.entries.push(e);
    }
    return Array.from(map.entries());
  }, [entries]);

  const setPrice = (id: string, v: string) => setPrices((p) => ({ ...p, [id]: v }));

  const grandTotal = entries.reduce((s, e) => s + (Number(prices[e.id]) || 0), 0);

  const handleConfirm = async () => {
    for (const [, group] of groups) {
      const lines = group.entries.map((e) => ({
        shipping_entry_id: e.id,
        description: [e.product_name, e.bottle_size, e.lot_number ? `Lot ${e.lot_number}` : null]
          .filter(Boolean)
          .join(" · ") || "Shipment",
        quantity: 1,
        unit_price: Number(prices[e.id]) || 0,
      }));
      const customer = group.entries[0];
      await createInvoice.mutateAsync({
        customer_id: customer.customer_id,
        customer_name: customer.customer_name,
        order_header_id: group.orderHeaderId,
        issue_date: issueDate,
        lines,
        shipping_entry_ids: group.entries.map((e) => e.id),
      });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="w-[95vw] max-w-[1600px]"
        style={{ width: '95vw', maxWidth: '1600px' }}
      >
        <DialogHeader>
          <DialogTitle>Mark Invoiced</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 max-h-[75vh] overflow-y-auto">

          <div className="flex items-center gap-4">
            <Label className="text-sm whitespace-nowrap">Issue Date</Label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-64 shrink-0"
            />
          </div>

          {groups.map(([key, group]) => {
            const subtotal = group.entries.reduce((s, e) => s + (Number(prices[e.id]) || 0), 0);
            return (
              <div key={key} className="border rounded-md">
                <div className="bg-muted px-4 py-3 flex justify-between items-center">
                  <div className="font-medium text-sm">
                    PO: <span className="font-mono">{group.poNumber || "— No PO —"}</span>
                    <span className="ml-3 text-muted-foreground">({group.entries.length} row{group.entries.length > 1 ? "s" : ""})</span>
                  </div>
                  <div className="text-sm">Subtotal: <span className="font-semibold tabular-nums">${subtotal.toFixed(2)}</span></div>
                </div>
                <table className="w-full text-sm table-fixed">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-4 w-[18%]">Customer</th>
                      <th className="text-left p-4 w-[22%]">Product</th>
                      <th className="text-left p-4 w-[12%]">Size</th>
                      <th className="text-right p-4 w-[12%]">Bottles</th>
                      <th className="text-left p-4 w-[16%]">Lot #</th>
                      <th className="text-right p-4 w-[20%]">Line Total ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.entries.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="p-4 truncate">{e.customer_name || "—"}</td>
                        <td className="p-4 truncate">{e.product_name || "—"}</td>
                        <td className="p-4">{e.bottle_size || "—"}</td>
                        <td className="p-4 text-right tabular-nums">{e.bottle_count ?? 0}</td>
                        <td className="p-4 truncate">{e.lot_number || "—"}</td>
                        <td className="p-4">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={prices[e.id] ?? ""}
                            onChange={(ev) => setPrice(e.id, ev.target.value)}
                            className="text-right w-full min-w-[160px]"
                            placeholder="0.00"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="flex justify-end text-sm">
            <div>
              Grand Total: <span className="font-bold tabular-nums text-base">${grandTotal.toFixed(2)}</span>
              <span className="ml-3 text-muted-foreground">
                {groups.length} invoice{groups.length > 1 ? "s" : ""} will be created
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createInvoice.isPending}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={createInvoice.isPending || entries.length === 0}>
            {createInvoice.isPending ? "Creating…" : "Confirm & Mark Invoiced"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
