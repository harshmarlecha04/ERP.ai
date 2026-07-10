import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileDown } from "lucide-react";
import { ShippingEntry } from "@/hooks/useShippingEntries";
import { supabase } from "@/integrations/supabase/client";
import {
  generatePackingListPdf,
  PackingListColumn,
  PL_ROW_KEYS,
  PL_ROW_LABELS,
  PLRowKey,
} from "@/utils/packingListPdfGenerator";
import { todayET } from "@/utils/dateUtils";


interface Props {
  open: boolean;
  onClose: () => void;
  entries: ShippingEntry[];
}

const DEFAULT_STORAGE = "Store in a cool dry place away from direct sunlight.";
const DEFAULT_SHIPPING_METHOD =
  "Customer arranges pickup. Enter your pickup address, hours, and contact here.";
const DEFAULT_SHIPPER_DIM = "10x8x5";
const DEFAULT_UNITS_PER_SHIPPER = "12 bottles per shipper";
const DEFAULT_PALLET_DIM = '48x40x60"';
const DEFAULT_SHIPPERS_PER_PALLET = "207";

const buildInitialColumn = (e: ShippingEntry): PackingListColumn => {
  const units = e.bottle_count ?? 0;
  const shippers = units > 0 ? Math.ceil(units / 12) : 0;
  const pallets = shippers > 0 ? Math.ceil(shippers / 207) : 0;
  return {
    product: e.product_name || "",
    countType: e.bottle_size ? `${e.bottle_size} count bottle` : "",
    units: units ? String(units) : "",
    batch: e.lot_number || "",
    exp: "",
    shippers: shippers ? String(shippers) : "",
    shipperDim: DEFAULT_SHIPPER_DIM,
    unitsPerShipper: DEFAULT_UNITS_PER_SHIPPER,
    storage: DEFAULT_STORAGE,
    shippersPerPallet: DEFAULT_SHIPPERS_PER_PALLET,
    pallets: pallets ? String(pallets) : "",
    palletDim: DEFAULT_PALLET_DIM,
    grossWeight: "",
    shippingMethod: DEFAULT_SHIPPING_METHOD,
  };
};

const todayMMDDYY = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
};

export const GeneratePackingListModal = ({ open, onClose, entries }: Props) => {
  const [date, setDate] = useState(todayMMDDYY());
  const [poNumbers, setPoNumbers] = useState("");
  const [billTo, setBillTo] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [columns, setColumns] = useState<PackingListColumn[]>([]);
  const [generating, setGenerating] = useState(false);

  const customerName = entries[0]?.customer_name || "";

  useEffect(() => {
    if (!open) return;
    setDate(todayMMDDYY());
    setColumns(entries.map(buildInitialColumn));
    const pos = Array.from(
      new Set(
        entries
          .map((e) => e.order_headers?.po_number || e.order_headers?.order_number)
          .filter(Boolean) as string[]
      )
    );
    setPoNumbers(pos.join(" / "));

    // Prefill Bill To with customer contact info
    (async () => {
      const cid = entries[0]?.customer_id;
      if (!cid) {
        setBillTo(customerName);
        setShipTo("");
        return;
      }
      const { data } = await supabase
        .from("customers")
        .select("company_name, contact_person, email, phone")
        .eq("id", cid)
        .maybeSingle();
      const c = data as any;
      const bill = [
        c?.company_name || customerName,
        c?.contact_person,
        c?.phone,
        c?.email,
      ]
        .filter(Boolean)
        .join("\n");
      setBillTo(bill);
      setShipTo("");
    })();
  }, [open, entries, customerName]);

  const setCell = (colIdx: number, key: PLRowKey, value: string) => {
    setColumns((prev) => {
      const next = [...prev];
      next[colIdx] = { ...next[colIdx], [key]: value };
      return next;
    });
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const safeCust = (customerName || "Customer").replace(/[^A-Za-z0-9]+/g, "_");
      const isoDate = todayET();
      await generatePackingListPdf({
        date,
        poNumbers,
        billTo,
        shipTo,
        columns,
        fileName: `${isoDate}_PL_${safeCust}.pdf`,
      });
      onClose();
    } finally {
      setGenerating(false);
    }
  };

  const productCount = columns.length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Packing List</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Date</Label>
            <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="MM/DD/YY" />
          </div>
          <div>
            <Label>PO Number(s)</Label>
            <Input value={poNumbers} onChange={(e) => setPoNumbers(e.target.value)} placeholder="PO1306 / PO1309" />
          </div>
          <div>
            <Label>Bill To</Label>
            <Textarea rows={5} value={billTo} onChange={(e) => setBillTo(e.target.value)} />
          </div>
          <div>
            <Label>Ship To</Label>
            <Textarea rows={5} value={shipTo} onChange={(e) => setShipTo(e.target.value)} placeholder="Shipping address..." />
          </div>
        </div>

        <div className="mt-4 border rounded-md overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 sticky left-0 bg-muted min-w-[140px]">Field</th>
                {columns.map((_, i) => (
                  <th key={i} className="text-left p-2 min-w-[160px]">Product {i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PL_ROW_KEYS.map((key, rowIdx) => (
                <tr key={key} className="border-t">
                  <td className="p-2 font-medium bg-muted/50 sticky left-0">{PL_ROW_LABELS[rowIdx]}</td>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="p-1">
                      {key === "storage" || key === "shippingMethod" ? (
                        <Textarea
                          rows={2}
                          value={col[key]}
                          onChange={(e) => setCell(colIdx, key, e.target.value)}
                          className="text-xs min-h-0"
                        />
                      ) : (
                        <Input
                          value={col[key]}
                          onChange={(e) => setCell(colIdx, key, e.target.value)}
                          className="h-8 text-xs"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Tip: identical values across all {productCount} product columns are merged into a single cell in the PDF.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={generating}>Cancel</Button>
          <Button onClick={handleDownload} disabled={generating || columns.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />
            {generating ? "Generating..." : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
