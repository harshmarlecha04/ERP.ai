import React, { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Truck, PackageCheck, Receipt, Undo2, FileDown, Link2, FileText } from "lucide-react";
import { GeneratePackingListModal } from "./GeneratePackingListModal";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useShippingEntries,
  useMarkReadyToShip,
  useRevertShippingStatus,
  useAttachShippingPO,
  ShippingEntry,
} from "@/hooks/useShippingEntries";
import { useCustomerInvoicesList } from "@/hooks/useCustomerInvoices";
import { MarkInvoicedModal } from "./MarkInvoicedModal";
import { CustomerPOPickerModal } from "./CustomerPOPickerModal";
import { generateInvoicePdf } from "@/utils/invoicePdfGenerator";
import { supabase } from "@/integrations/supabase/client";

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    pending: "bg-slate-200 text-slate-800",
    ready_to_ship: "bg-blue-200 text-blue-900",
    invoiced: "bg-emerald-200 text-emerald-900",
  };
  return <Badge className={map[status] || ""}>{status.replace("_", " ")}</Badge>;
};

const EntryTable: React.FC<{
  entries: ShippingEntry[];
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  actions?: (e: ShippingEntry) => React.ReactNode;
  onAttachPO?: (e: ShippingEntry) => void;
}> = ({ entries, selectable, selected, onToggle, onToggleAll, actions, onAttachPO }) => {
  return (
    <div className="border rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {selectable && (
              <th className="w-10 p-2">
                <Checkbox
                  checked={entries.length > 0 && selected?.size === entries.length}
                  onCheckedChange={onToggleAll}
                />
              </th>
            )}
            <th className="text-left p-2">Completed</th>
            <th className="text-left p-2">Customer</th>
            <th className="text-left p-2">Product</th>
            <th className="text-left p-2">Size</th>
            <th className="text-right p-2">Bottles</th>
            <th className="text-left p-2">Lot #</th>
            <th className="text-left p-2">PO #</th>
            <th className="text-left p-2">Status</th>
            <th className="text-right p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr>
              <td colSpan={selectable ? 10 : 9} className="p-6 text-center text-muted-foreground">
                No entries
              </td>
            </tr>
          )}
          {entries.map((e) => (
            <tr key={e.id} className="border-t">
              {selectable && (
                <td className="p-2">
                  <Checkbox
                    checked={selected?.has(e.id)}
                    onCheckedChange={() => onToggle?.(e.id)}
                  />
                </td>
              )}
              <td className="p-2">{e.completed_date}</td>
              <td className="p-2">{e.customer_name || "—"}</td>
              <td className="p-2">{e.product_name || "—"}</td>
              <td className="p-2">{e.bottle_size || "—"}</td>
              <td className="p-2 text-right tabular-nums">{e.bottle_count ?? 0}</td>
              <td className="p-2">{e.lot_number || "—"}</td>
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">
                    {e.order_headers?.po_number || e.order_headers?.order_number || "—"}
                  </span>
                  {onAttachPO && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title={e.order_header_id ? "Change PO" : "Attach PO"}
                      onClick={() => onAttachPO(e)}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </td>
              <td className="p-2"><StatusBadge status={e.status} /></td>
              <td className="p-2 text-right">{actions?.(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const ShippingView: React.FC = () => {
  const [tab, setTab] = useState("pending");

  const { data: pending = [] } = useShippingEntries("pending");
  const { data: ready = [] } = useShippingEntries("ready_to_ship");
  const { data: invoiced = [] } = useShippingEntries("invoiced");
  const { data: invoices = [] } = useCustomerInvoicesList();

  const markReady = useMarkReadyToShip();
  const revert = useRevertShippingStatus();
  const attachPO = useAttachShippingPO();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [pickerEntry, setPickerEntry] = useState<ShippingEntry | null>(null);
  const [confirmEntry, setConfirmEntry] = useState<ShippingEntry | null>(null);
  const [showPLModal, setShowPLModal] = useState(false);
  const { toast } = useToast();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((prev) => (prev.size === ready.length ? new Set() : new Set(ready.map((e) => e.id))));

  const selectedEntries = useMemo(
    () => ready.filter((e) => selected.has(e.id)),
    [ready, selected]
  );

  const handleAttachPO = (entry: ShippingEntry) => setPickerEntry(entry);

  const handleSelectPO = (orderHeaderId: string | null) => {
    if (!pickerEntry) return;
    attachPO.mutate({ id: pickerEntry.id, order_header_id: orderHeaderId });
    setPickerEntry(null);
  };

  const handleMarkReady = (entry: ShippingEntry) => {
    const poNumber = entry.order_headers?.po_number || entry.order_headers?.order_number;
    if (entry.order_header_id && poNumber) {
      markReady.mutate([entry.id]);
    } else {
      setConfirmEntry(entry);
    }
  };

  const confirmMarkReady = () => {
    if (!confirmEntry) return;
    markReady.mutate([confirmEntry.id]);
    setConfirmEntry(null);
  };

  const downloadInvoicePdf = async (invoice: any) => {
    const { data: lines } = await supabase
      .from("customer_invoice_lines" as any)
      .select("*")
      .eq("invoice_id", invoice.id);
    let orderPo: string | null = null;
    if (invoice.order_header_id) {
      const { data: oh } = await supabase
        .from("order_headers")
        .select("po_number, order_number")
        .eq("id", invoice.order_header_id)
        .maybeSingle();
      orderPo = (oh as any)?.po_number || (oh as any)?.order_number || null;
    }
    generateInvoicePdf({
      invoice_number: invoice.invoice_number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      customer_name: invoice.customer_name,
      order_po: orderPo,
      notes: invoice.notes,
      lines: (lines as any[] | null)?.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        line_total: Number(l.line_total),
      })) || [],
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
    });
  };

  return (
    <div className="space-y-4">


      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelected(new Set()); }}>
        <TabsList>
          <TabsTrigger value="pending">
            <PackageCheck className="h-4 w-4 mr-2" />
            Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="ready">
            <Truck className="h-4 w-4 mr-2" />
            Ready to Ship ({ready.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <Receipt className="h-4 w-4 mr-2" />
            Invoices ({invoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <EntryTable
            entries={pending}
            onAttachPO={handleAttachPO}
            actions={(e) => (
              <Button
                size="sm"
                onClick={() => handleMarkReady(e)}
                disabled={markReady.isPending}
              >
                Mark Ready to Ship
              </Button>
            )}
          />
        </TabsContent>

        <TabsContent value="ready" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selected.size} selected
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={selected.size === 0}
                onClick={() => {
                  const custIds = new Set(selectedEntries.map((e) => e.customer_id));
                  if (custIds.size > 1) {
                    toast({
                      title: "Multiple customers selected",
                      description: "Select rows from a single customer to generate a packing list.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setShowPLModal(true);
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate PL
              </Button>
              <Button
                disabled={selected.size === 0}
                onClick={() => setShowInvoiceModal(true)}
              >
                <Receipt className="h-4 w-4 mr-2" />
                Mark Invoiced
              </Button>
            </div>

          </div>
          <EntryTable
            entries={ready}
            selectable
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            actions={(e) => (
              <Button size="sm" variant="ghost" onClick={() => revert.mutate(e.id)}>
                <Undo2 className="h-3 w-3 mr-1" /> Revert
              </Button>
            )}
          />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Invoice #</th>
                  <th className="text-left p-2">Customer</th>
                  <th className="text-left p-2">PO #</th>
                  <th className="text-left p-2">Issue</th>
                  <th className="text-left p-2">Due</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-right p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      No invoices yet
                    </td>
                  </tr>
                )}
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-t">
                    <td className="p-2 font-mono">{inv.invoice_number}</td>
                    <td className="p-2">{inv.customer_name || "—"}</td>
                    <td className="p-2 font-mono text-xs">
                      {inv.order_headers?.po_number || inv.order_headers?.order_number || "—"}
                    </td>
                    <td className="p-2">{inv.issue_date}</td>
                    <td className="p-2">{inv.due_date || "—"}</td>
                    <td className="p-2 text-right tabular-nums">
                      ${Number(inv.total).toFixed(2)}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">{inv.status}</Badge>
                    </td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => downloadInvoicePdf(inv)}>
                        <FileDown className="h-3 w-3 mr-1" /> PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {showInvoiceModal && (
        <MarkInvoicedModal
          open={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelected(new Set());
          }}
          entries={selectedEntries}
        />
      )}

      {showPLModal && (
        <GeneratePackingListModal
          open={showPLModal}
          onClose={() => setShowPLModal(false)}
          entries={selectedEntries}
        />
      )}


      {pickerEntry && (
        <CustomerPOPickerModal
          isOpen={!!pickerEntry}
          onClose={() => setPickerEntry(null)}
          customerId={pickerEntry.customer_id}
          customerName={pickerEntry.customer_name}
          selectedPoId={pickerEntry.order_header_id}
          onSelect={handleSelectPO}
        />
      )}

      <AlertDialog open={!!confirmEntry} onOpenChange={(open) => { if (!open) setConfirmEntry(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark ready to ship without a PO?</AlertDialogTitle>
            <AlertDialogDescription>
              There is no customer PO linked to {confirmEntry?.customer_name ? ` ${confirmEntry.customer_name}` : "this entry"}
              {confirmEntry?.product_name ? ` — ${confirmEntry.product_name}` : ""}. Are you sure you want to mark it ready to ship?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmEntry(null)} disabled={markReady.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmMarkReady} disabled={markReady.isPending}>
              Mark Ready to Ship
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
