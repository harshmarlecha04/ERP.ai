import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, PackageCheck, Printer, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import type { QueuedScan } from "@/hooks/useScanQueue";
import { formatET } from "@/utils/dateUtils";

export interface ScanMatch {
  raw_material_id: string;
  code: string;
  name: string;
  supplier: string | null;
  uom: string;
  open_po_id: string | null;
  open_po_number: string | null;
  open_po_quantity: number | null;
  open_po_uom: string | null;
}

export interface ScanPrefill {
  lot_number?: string;
  quantity?: string;
  expires_on?: string;
}

interface Props {
  open: boolean;
  match: ScanMatch | null;
  scannedCode: string;
  online: boolean;
  batchMode: boolean;
  prefill?: ScanPrefill | null;
  onOpenChange: (open: boolean) => void;
  onQueue: (item: Omit<QueuedScan, "id" | "scanned_at" | "status">) => QueuedScan;
}

export function ScanConfirmModal({ open, match, scannedCode, online, batchMode, prefill, onOpenChange, onQueue }: Props) {
  const [lotNumber, setLotNumber] = useState("");
  const [quantity, setQuantity] = useState<string>("");
  const [cost, setCost] = useState<string>("");
  const [expiresOn, setExpiresOn] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [savedLot, setSavedLot] = useState<{ lot_number: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setLotNumber(prefill?.lot_number ?? "");
      setQuantity(prefill?.quantity ?? (match?.open_po_quantity ? String(match.open_po_quantity) : ""));
      setCost("");
      setExpiresOn(prefill?.expires_on ?? "");
      setSavedLot(null);
      setQrDataUrl("");
    }
  }, [open, match, prefill]);

  const save = async () => {
    if (!match) return;
    const qty = Number(quantity);
    if (!lotNumber.trim() || !qty || qty <= 0) {
      toast({ title: "Missing info", description: "Lot # and quantity are required.", variant: "destructive" });
      return;
    }
    setSaving(true);

    onQueue({
      raw_material_id: match.raw_material_id,
      raw_material_name: match.name,
      raw_material_code: match.code,
      lot_number: lotNumber.trim(),
      quantity: qty,
      cost: cost ? Number(cost) : 0,
      expires_on: expiresOn || null,
      open_po_id: match.open_po_id,
    });

    setSavedLot({ lot_number: lotNumber.trim() });
    setSaving(false);

    const payload = JSON.stringify({ rm: match.raw_material_id, lot: lotNumber.trim() });
    try {
      const url = await QRCode.toDataURL(payload, { width: 256, margin: 1 });
      setQrDataUrl(url);
    } catch {}

    toast({
      title: online ? "Received" : "Queued (offline)",
      description: `${match.name} • ${qty} ${match.uom}`,
    });

    if (batchMode) {
      // Auto-close immediately for batch mode
      setTimeout(() => onOpenChange(false), 400);
    }
  };

  const printLabel = () => {
    if (!qrDataUrl || !match) return;
    const w = window.open("", "_blank", "width=400,height=500");
    if (!w) return;
    w.document.write(`
      <html><head><title>Lot label</title>
      <style>body{font-family:system-ui;padding:16px;text-align:center}img{width:240px;height:240px}h2{margin:8px 0}p{margin:2px 0;font-size:12px}</style>
      </head><body>
      <h2>${match.name}</h2>
      <p>${match.code}${match.supplier ? " • " + match.supplier : ""}</p>
      <img src="${qrDataUrl}" />
      <p><strong>Lot:</strong> ${savedLot?.lot_number}</p>
      <p>${formatET(new Date(), "M/d/yyyy")}</p>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            {savedLot ? (online ? "Received ✓" : "Queued ✓") : "Confirm receipt"}
            {!online && <Badge variant="outline" className="ml-auto gap-1"><WifiOff className="h-3 w-3" />Offline</Badge>}
          </DialogTitle>
        </DialogHeader>

        {!match ? null : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-sm font-semibold">{match.name}</div>
              <div className="text-xs text-muted-foreground">
                {match.code}
                {match.supplier ? ` • ${match.supplier}` : ""}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="font-mono text-[10px]">{scannedCode}</Badge>
                {match.open_po_number && <Badge variant="default">PO {match.open_po_number}</Badge>}
              </div>
            </div>

            {!savedLot ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lot">Lot #</Label>
                  <Input id="lot" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="qty">Quantity ({match.uom})</Label>
                    <Input id="qty" type="number" inputMode="decimal" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Unit cost ($)</Label>
                    <Input id="cost" type="number" inputMode="decimal" step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp">Expires on</Label>
                  <Input id="exp" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={save} disabled={saving}>
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : (online ? "Receive" : "Queue offline")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3 text-center">
                {qrDataUrl && <img src={qrDataUrl} alt="Lot QR" className="mx-auto h-40 w-40" />}
                <p className="text-sm text-muted-foreground">
                  Lot <span className="font-mono text-foreground">{savedLot.lot_number}</span> {online ? "saved" : "queued"}.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={printLabel} disabled={!qrDataUrl}>
                    <Printer className="mr-2 h-4 w-4" /> Print label
                  </Button>
                  <Button className="flex-1" onClick={() => onOpenChange(false)}>
                    {batchMode ? "Scan next" : "Done"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
