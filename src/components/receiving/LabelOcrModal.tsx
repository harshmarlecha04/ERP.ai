import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Loader2, ScanText, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ScanMatch, ScanPrefill } from "./ScanConfirmModal";

interface ParsedLabel {
  raw_material_name: string | null;
  supplier_name: string | null;
  lot_number: string | null;
  manufacture_date: string | null;
  expiry_date: string | null;
  quantity: string | null;
  uom: string | null;
  confidence: number;
}
interface MatchRow {
  id: string; code: string; name: string; supplier: string | null; uom: string; score: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (match: ScanMatch, prefill: ScanPrefill) => void;
}

const MAX_DIM = 1600;

async function downscale(file: File): Promise<{ base64: string; mime: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85)!);
  const buf = await blob.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return { base64: btoa(bin), mime: "image/jpeg" };
}

export function LabelOcrModal({ open, onOpenChange, onResult }: Props) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParsedLabel | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const { toast } = useToast();

  const reset = () => {
    setPreview(null); setParsed(null); setMatches([]); setBusy(false);
    if (cameraInput.current) cameraInput.current.value = "";
    if (uploadInput.current) uploadInput.current.value = "";
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFile = async (file: File) => {
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    setParsed(null); setMatches([]);
    try {
      const { base64, mime } = await downscale(file);
      const { data, error } = await supabase.functions.invoke("parse-label-ocr", {
        body: { fileBase64: base64, mimeType: mime },
      });
      if (error) throw error;
      const p = data.parsed as ParsedLabel;
      const ms = (data.matches ?? []) as MatchRow[];
      setParsed(p);
      setMatches(ms);
      // Auto-pick if top match is strong
      if (ms.length && ms[0].score >= 0.75) {
        pickMatch(ms[0], p);
      }
    } catch (e: any) {
      toast({ title: "Label read failed", description: e?.message || "Try another photo", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const pickMatch = (m: MatchRow, p: ParsedLabel | null = parsed) => {
    onResult(
      {
        raw_material_id: m.id, code: m.code, name: m.name, supplier: m.supplier, uom: m.uom,
        open_po_id: null, open_po_number: null, open_po_quantity: null, open_po_uom: null,
      },
      {
        lot_number: p?.lot_number ?? undefined,
        expires_on: p?.expiry_date ?? undefined,
        quantity: p?.quantity ?? undefined,
      },
    );
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanText className="h-5 w-5 text-primary" /> Scan label (OCR)
          </DialogTitle>
        </DialogHeader>

        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <input ref={uploadInput} type="file" accept="image/*" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

        {!preview ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Take or upload a clear photo of the label showing the material name, supplier, lot #, and expiry.
            </p>
            <Button className="w-full" onClick={() => cameraInput.current?.click()}>
              <Camera className="mr-2 h-4 w-4" /> Take photo
            </Button>
            <Button variant="outline" className="w-full" onClick={() => uploadInput.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Upload photo
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg border bg-muted">
              <img src={preview} alt="Label" className="max-h-56 w-full object-contain" />
              {busy && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading label…
                </div>
              )}
            </div>

            {parsed && !busy && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                  <div><span className="text-muted-foreground">Material:</span> {parsed.raw_material_name ?? <em className="text-muted-foreground">not found</em>}</div>
                  <div><span className="text-muted-foreground">Supplier:</span> {parsed.supplier_name ?? "—"}</div>
                  <div className="grid grid-cols-2 gap-x-2">
                    <div><span className="text-muted-foreground">Lot:</span> {parsed.lot_number ?? "—"}</div>
                    <div><span className="text-muted-foreground">Exp:</span> {parsed.expiry_date ?? "—"}</div>
                    <div><span className="text-muted-foreground">Qty:</span> {parsed.quantity ?? "—"} {parsed.uom ?? ""}</div>
                    <div><span className="text-muted-foreground">Conf:</span> {(parsed.confidence * 100).toFixed(0)}%</div>
                  </div>
                </div>

                {matches.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Pick the raw material</div>
                    <ul className="divide-y rounded-lg border">
                      {matches.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                            onClick={() => pickMatch(m)}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{m.name}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {m.code}{m.supplier ? ` • ${m.supplier}` : ""}
                              </div>
                            </div>
                            <Badge variant="secondary">{(m.score * 100).toFixed(0)}%</Badge>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    No matching raw material found. You can link it manually.
                  </div>
                )}

                <Button variant="outline" className="w-full" onClick={reset}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Retake
                </Button>
              </div>
            )}

            {!parsed && !busy && (
              <Button variant="outline" className="w-full" onClick={reset}>
                <RefreshCw className="mr-2 h-4 w-4" /> Try another photo
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
