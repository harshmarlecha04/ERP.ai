import { useCallback, useState } from "react";
import { BarcodeScanner } from "@/components/receiving/BarcodeScanner";
import { ScanConfirmModal, type ScanMatch, type ScanPrefill } from "@/components/receiving/ScanConfirmModal";
import { LinkBarcodeModal } from "@/components/receiving/LinkBarcodeModal";
import { BarcodeImportModal } from "@/components/receiving/BarcodeImportModal";
import { LabelOcrModal } from "@/components/receiving/LabelOcrModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScanLine, ScanText, History, Wifi, WifiOff, Upload, RefreshCw, Trash2, AlertCircle, Check, Clock } from "lucide-react";
import { useScanQueue, type QueuedScan } from "@/hooks/useScanQueue";

export default function ReceiveScan() {
  const [scannerOn, setScannerOn] = useState(true);
  const [scannedCode, setScannedCode] = useState("");
  const [match, setMatch] = useState<ScanMatch | null>(null);
  const [prefill, setPrefill] = useState<ScanPrefill | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const { toast } = useToast();
  const { queue, history, online, syncing, enqueue, remove, syncAll } = useScanQueue();

  const lookup = useCallback(
    async (code: string) => {
      if (busy) return;
      setBusy(true);
      setScannerOn(false);
      setScannedCode(code);

      // Internal QR? {"rm":"<uuid>","lot":"..."}
      try {
        const parsed = JSON.parse(code);
        if (parsed?.rm && typeof parsed.rm === "string") {
          const { data } = await supabase
            .from("raw_materials")
            .select("id, code, name, supplier, uom")
            .eq("id", parsed.rm)
            .maybeSingle();
          if (data) {
            setMatch({
              raw_material_id: data.id,
              code: data.code,
              name: data.name,
              supplier: data.supplier,
              uom: data.uom,
              open_po_id: null,
              open_po_number: null,
              open_po_quantity: null,
              open_po_uom: null,
            });
            setConfirmOpen(true);
            setBusy(false);
            return;
          }
        }
      } catch {
        /* not JSON */
      }

      if (!online) {
        // Offline: try local barcode cache if present
        setBusy(false);
        toast({
          title: "Offline lookup limited",
          description: "Connect to identify unknown codes.",
          variant: "destructive",
        });
        setScannerOn(true);
        return;
      }

      const { data, error } = await supabase.rpc("find_raw_material_by_barcode", { _code: code });
      setBusy(false);

      if (error) {
        toast({ title: "Lookup failed", description: error.message, variant: "destructive" });
        setScannerOn(true);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setLinkOpen(true);
        return;
      }

      setMatch(row as ScanMatch);
      setConfirmOpen(true);
    },
    [busy, online, toast],
  );

  const handleClosed = () => {
    setConfirmOpen(false);
    setMatch(null);
    setPrefill(null);
    setScannerOn(true);
  };

  const handleOcrResult = (m: ScanMatch, pf: ScanPrefill) => {
    setScannerOn(false);
    setScannedCode("(label OCR)");
    setMatch(m);
    setPrefill(pf);
    setConfirmOpen(true);
  };

  const handleLinkClosed = (open: boolean) => {
    setLinkOpen(open);
    if (!open) setScannerOn(true);
  };

  const handleLinked = async () => {
    await lookup(scannedCode);
  };

  const statusIcon = (s: QueuedScan["status"]) => {
    switch (s) {
      case "pending": return <Clock className="h-3 w-3" />;
      case "syncing": return <RefreshCw className="h-3 w-3 animate-spin" />;
      case "synced": return <Check className="h-3 w-3" />;
      case "error": return <AlertCircle className="h-3 w-3" />;
    }
  };

  const pendingCount = queue.filter((q) => q.status !== "synced").length;

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <ScanLine className="h-5 w-5 text-primary" /> Receive
          </h1>
          <p className="text-xs text-muted-foreground">Scan barcodes or QR codes to log lots.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={online ? "secondary" : "destructive"} className="gap-1">
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? "Online" : "Offline"}
          </Badge>
          <Button size="icon" variant="ghost" onClick={() => setImportOpen(true)} title="Import barcodes">
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <Switch id="batch" checked={batchMode} onCheckedChange={setBatchMode} />
          <Label htmlFor="batch" className="cursor-pointer text-sm">Batch mode</Label>
        </div>
        {pendingCount > 0 && (
          <Button size="sm" variant="outline" onClick={syncAll} disabled={!online || syncing}>
            {syncing ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
            Sync {pendingCount}
          </Button>
        )}
      </div>

      <Tabs defaultValue="scan">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scan">Scan</TabsTrigger>
          <TabsTrigger value="queue">
            Queue {pendingCount > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-1 h-3 w-3" />History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-3">
          <BarcodeScanner paused={!scannerOn} onDetected={lookup} />
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const code = manualCode.trim();
              if (!code) return;
              setManualCode("");
              lookup(code);
            }}
          >
            <Input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Enter barcode manually"
              inputMode="text"
              autoCapitalize="off"
              autoCorrect="off"
            />
            <Button type="submit" disabled={!manualCode.trim() || busy}>Lookup</Button>
          </form>
          <Button variant="secondary" className="w-full" onClick={() => setOcrOpen(true)}>
            <ScanText className="mr-2 h-4 w-4" /> Scan label (OCR)
          </Button>
          {!scannerOn && !confirmOpen && !linkOpen && !ocrOpen && (
            <Button className="w-full" onClick={() => setScannerOn(true)}>
              Scan another
            </Button>
          )}
        </TabsContent>

        <TabsContent value="queue">
          {queue.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
              Nothing queued.
            </div>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {queue.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{q.raw_material_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      Lot {q.lot_number} • {q.quantity}
                    </div>
                    {q.error && <div className="truncate text-xs text-destructive">{q.error}</div>}
                  </div>
                  <Badge variant={q.status === "error" ? "destructive" : "secondary"} className="gap-1 text-[10px]">
                    {statusIcon(q.status)}
                    {q.status}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(q.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="history">
          {history.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
              No receipts yet.
            </div>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{h.raw_material_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      Lot {h.lot_number} • {h.quantity} • {h.raw_material_code}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(h.scanned_at).toLocaleString([], {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <ScanConfirmModal
        open={confirmOpen}
        match={match}
        scannedCode={scannedCode}
        online={online}
        batchMode={batchMode}
        prefill={prefill}
        onOpenChange={(o) => (o ? setConfirmOpen(o) : handleClosed())}
        onQueue={enqueue}
      />

      <LinkBarcodeModal
        open={linkOpen}
        code={scannedCode}
        onOpenChange={handleLinkClosed}
        onLinked={handleLinked}
      />

      <BarcodeImportModal open={importOpen} onOpenChange={setImportOpen} />

      <LabelOcrModal
        open={ocrOpen}
        onOpenChange={(o) => { setOcrOpen(o); if (!o) setScannerOn(true); }}
        onResult={handleOcrResult}
      />
    </div>
  );
}
