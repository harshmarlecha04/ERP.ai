import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, AlertTriangle, Trash2, Plus, RefreshCw, Check, UserCircle2, ChevronsUpDown } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScanPO, type ScannedLine, type ScanResponse, type CustomerMatch } from "@/hooks/useScanPO";
import { useToast } from "@/hooks/use-toast";
import { useCustomers } from "@/hooks/useCustomers";
import { usePackagingBalances } from "@/hooks/usePackagingInventory";
import { useLabelInventory } from "@/hooks/useLabelInventory";
import { getSignedPdfUrl } from "@/utils/pdfStorage";
import { cn } from "@/lib/utils";

const BOTTLE_SIZES = [60, 70, 90, 120];

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string;
  pdfPath: string;
  poNumber: string | null;
  onApplied?: () => void;
  /** When set, modal does NOT write to DB; instead calls onPrefill with the data. */
  mode?: "apply-to-order" | "prefill-form";
  customerId?: string | null;
  onPrefill?: (payload: {
    header: { po_number: string; due_date: string; special_instructions: string };
    customer_id: string | null;
    lines: ScannedLine[];
    po_total: number;
  }) => void;
}

type EditableLine = ScannedLine & { _key: string; _selected: boolean };

function newKey() {
  return Math.random().toString(36).slice(2);
}

function MatchBadge({ line }: { line: ScannedLine }) {
  if (!line.formula_id) {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-600">
        Unmatched
      </Badge>
    );
  }
  const score = Math.round((line.match_score || 0) * 100);
  const tone =
    score >= 90 ? "bg-green-500/10 text-green-700 border-green-500/30"
    : score >= 70 ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
    : "bg-orange-500/10 text-orange-700 border-orange-500/30";
  return (
    <Badge variant="outline" className={cn("text-[10px]", tone)}>
      {line.match_method?.replace("_", " ")} · {score}%
    </Badge>
  );
}

function AiSuggestBadge({ score }: { score?: number }) {
  if (!score) return null;
  return (
    <Badge variant="outline" className="text-[9px] ml-1 border-primary/30 text-primary">
      AI · {Math.round(score * 100)}%
    </Badge>
  );
}

function PdfCanvasPreview({ signedUrl }: { signedUrl: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any = null;
    const renderTasks: any[] = [];

    const renderPdf = async () => {
      setStatus("loading");
      setPageCount(0);
      if (pagesRef.current) pagesRef.current.innerHTML = "";

      try {
        loadingTask = pdfjsLib.getDocument({ url: signedUrl, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        setPageCount(pdf.numPages);
        const availableWidth = Math.max((containerRef.current?.clientWidth || 720) - 48, 320);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(2, availableWidth / baseViewport.width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const wrapper = document.createElement("div");
          const context = canvas.getContext("2d");
          const pixelRatio = window.devicePixelRatio || 1;

          if (!context) throw new Error("PDF preview is unavailable in this browser.");

          wrapper.className = "flex justify-center";
          canvas.className = "rounded border bg-background shadow-sm";
          canvas.width = Math.floor(viewport.width * pixelRatio);
          canvas.height = Math.floor(viewport.height * pixelRatio);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

          wrapper.appendChild(canvas);
          pagesRef.current?.appendChild(wrapper);

          const renderTask = page.render({ canvasContext: context, viewport });
          renderTasks.push(renderTask);
          await renderTask.promise;
        }

        if (!cancelled) setStatus("ready");
        await pdf.destroy();
      } catch (error: any) {
        if (!cancelled && error?.name !== "RenderingCancelledException") {
          console.warn("PDF preview failed:", error?.message || error);
          setStatus("error");
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      renderTasks.forEach((task) => task?.cancel?.());
      loadingTask?.destroy?.();
    };
  }, [signedUrl]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-auto bg-muted/40">
      <div className="sticky top-2 z-10 flex justify-end px-2">
        <a
          href={signedUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs bg-background/95 border rounded px-2 py-1 hover:bg-background shadow"
        >
          Open in new tab
        </a>
      </div>

      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading PDF…</span>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
          <p className="text-sm">PDF preview could not load here.</p>
          <Button variant="outline" size="sm" asChild>
            <a href={signedUrl} target="_blank" rel="noreferrer">Open PDF</a>
          </Button>
        </div>
      )}

      <div
        ref={pagesRef}
        className={cn("min-h-full space-y-4 p-4", status !== "ready" && "opacity-0")}
        aria-label={pageCount ? `PDF preview, ${pageCount} page${pageCount === 1 ? "" : "s"}` : "PDF preview"}
      />
    </div>
  );
}

interface SearchableSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

function SearchableSelect({ value, onChange, options, placeholder, emptyText = "No results", disabled, className }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("h-8 w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder || "Select…"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 min-w-[--radix-popover-trigger-width] w-[min(560px,calc(100vw-2rem))]"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search…" autoFocus />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="items-start"
                >
                  <Check className={cn("h-3.5 w-3.5 mr-2 mt-0.5 shrink-0", value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className="whitespace-normal break-words leading-snug">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function POScanReviewModal({ isOpen, onClose, orderId, pdfPath, poNumber, onApplied, mode = "apply-to-order", customerId, onPrefill }: Props) {
  const { toast } = useToast();
  const scan = useScanPO();
  const { customers } = useCustomers();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [scanData, setScanData] = useState<ScanResponse | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [unmatched, setUnmatched] = useState<EditableLine[]>([]);
  const [header, setHeader] = useState({
    po_number: "",
    customer_reference: "",
    due_date: "",
    special_instructions: "",
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerMatch, setCustomerMatch] = useState<CustomerMatch | null>(null);
  const [applying, setApplying] = useState(false);

  // Load formulas for the formula combobox
  const { data: formulas = [] } = useQuery({
    queryKey: ["formulas-for-po-scan"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formulas")
        .select("id, code, name")
        .eq("is_deleted", false)
        .order("code");
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });

  // Packaging dropdown options
  const { data: bottleOptions } = usePackagingBalances({ category: ["BOTTLES"] });
  const { data: capOptions } = usePackagingBalances({ category: ["CAPS"] });
  const { data: labelOptions } = useLabelInventory({
    customer_id: selectedCustomerId || undefined,
  });

  const bottles = bottleOptions || [];
  const caps = capOptions || [];
  const labels = labelOptions || [];

  // Resolve signed PDF URL
  useEffect(() => {
    if (!isOpen || !pdfPath) return;
    getSignedPdfUrl(pdfPath).then(setSignedUrl);
  }, [isOpen, pdfPath]);

  // Run the scan when the modal opens
  useEffect(() => {
    if (!isOpen || !pdfPath) return;
    setScanData(null);
    setLines([]);
    setUnmatched([]);
    setCustomerMatch(null);
    setSelectedCustomerId(customerId || "");
    runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId, pdfPath]);

  const runScan = async () => {
    try {
      const data = await scan.mutateAsync({ orderId, pdfPath, customerId: customerId ?? undefined });
      setScanData(data);
      setHeader({
        po_number: data.extraction.po_number || poNumber || "",
        customer_reference: data.extraction.customer_reference || "",
        due_date: data.extraction.due_date || "",
        special_instructions: data.extraction.special_instructions || "",
      });
      setCustomerMatch(data.customer_match || null);
      // Pre-select customer: prefer caller's existing selection, else AI detection
      if (!customerId && data.customer_match?.customer_id) {
        setSelectedCustomerId(data.customer_match.customer_id);
      }
      const mapLine = (l: ScannedLine): EditableLine => ({
        ...l,
        _key: newKey(),
        _selected: true,
        bottle_size: l.bottle_size || null,
        selected_bottle_id: l.suggested_bottle_id || null,
        selected_cap_id: l.suggested_cap_id || null,
        selected_label_id: l.suggested_label_id || null,
      });
      setLines((data.matched || []).map(mapLine));
      setUnmatched((data.unmatched || []).map((l) => ({ ...mapLine(l), _selected: false })));
    } catch (e: any) {
      const msg = e?.message || "Scan failed";
      toast({
        title: "AI scan failed",
        description: msg.includes("429")
          ? "Rate limited — please try again in a minute."
          : msg.includes("402")
          ? "AI credits exhausted. Check your Anthropic API billing."
          : msg,
        variant: "destructive",
      });
    }
  };

  const updateLine = (key: string, patch: Partial<EditableLine>) =>
    setLines((prev) => prev.map((l) => (l._key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) =>
    setLines((prev) => prev.filter((l) => l._key !== key));

  const addBlankLine = () =>
    setLines((prev) => [
      ...prev,
      {
        _key: newKey(),
        _selected: true,
        raw_formula_reference: "",
        raw_product_description: "",
        bottle_count: 0,
        bottle_size: null,
        unit_price: 0,
        notes: "",
        selected_bottle_id: null,
        selected_cap_id: null,
        selected_label_id: null,
      },
    ]);

  const promoteUnmatched = (key: string, formulaId: string) => {
    const line = unmatched.find((l) => l._key === key);
    if (!line) return;
    const f = formulas.find((x) => x.id === formulaId);
    setUnmatched((prev) => prev.filter((l) => l._key !== key));
    setLines((prev) => [
      ...prev,
      {
        ...line,
        _selected: true,
        formula_id: formulaId,
        matched_code: f?.code,
        matched_name: f?.name,
        match_score: 1,
        match_method: "manual",
      },
    ]);
  };

  const validLines = useMemo(
    () =>
      lines.filter(
        (l) => l._selected && l.formula_id && l.bottle_count > 0 && l.bottle_size
      ),
    [lines]
  );

  const poTotal = useMemo(
    () => lines.reduce((s, l) => s + (l._selected ? (l.bottle_count || 0) * (l.unit_price || 0) : 0), 0),
    [lines]
  );

  const customerMismatchWarning =
    !!customerId &&
    !!customerMatch?.customer_id &&
    customerMatch.customer_id !== customerId;

  const apply = async () => {
    if (!validLines.length) {
      toast({ title: "Nothing to apply", description: "Select at least one valid line.", variant: "destructive" });
      return;
    }
    if (mode === "prefill-form" && !selectedCustomerId) {
      toast({ title: "Customer required", description: "Pick a customer before applying.", variant: "destructive" });
      return;
    }
    setApplying(true);
    try {
      if (mode === "prefill-form") {
        onPrefill?.({
          header: {
            po_number: header.po_number,
            due_date: header.due_date,
            special_instructions: header.special_instructions,
          },
          customer_id: selectedCustomerId || null,
          lines: validLines.map((l) => ({
            raw_formula_reference: l.raw_formula_reference,
            raw_product_description: l.raw_product_description,
            bottle_count: l.bottle_count,
            bottle_size: l.bottle_size,
            unit_price: l.unit_price,
            notes: l.notes,
            formula_id: l.formula_id,
            matched_code: l.matched_code,
            matched_name: l.matched_name,
            match_score: l.match_score,
            match_method: l.match_method,
            selected_bottle_id: l.selected_bottle_id || null,
            selected_cap_id: l.selected_cap_id || null,
            selected_label_id: l.selected_label_id || null,
          })),
          po_total: poTotal,
        });
        toast({
          title: "Form pre-filled",
          description: `${validLines.length} line${validLines.length === 1 ? "" : "s"} added to the order draft.`,
        });
        onClose();
        return;
      }

      if (!orderId) throw new Error("Missing order_id");

      const { data: existing } = await supabase
        .from("order_line_items")
        .select("line_number")
        .eq("order_id", orderId);
      const used = new Set((existing || []).map((r: any) => r.line_number));
      let next = 1;
      const nextLineNumber = () => {
        while (used.has(String(next))) next++;
        const n = String(next);
        used.add(n);
        next++;
        return n;
      };

      const rows = validLines.map((l) => ({
        order_id: orderId,
        line_number: nextLineNumber(),
        formula_id: l.formula_id!,
        order_type: "new_production",
        bottle_size: l.bottle_size!,
        bottles_ordered: l.bottle_count,
        production_status: "pending",
        notes: l.notes || null,
        selected_bottle_id: l.selected_bottle_id || null,
        selected_cap_id: l.selected_cap_id || null,
        selected_label_id: l.selected_label_id || null,
      }));

      const { error: insertErr } = await supabase.from("order_line_items").insert(rows);
      if (insertErr) throw insertErr;

      const headerPatch: any = {};
      if (header.po_number) headerPatch.po_number = header.po_number;
      if (header.due_date) headerPatch.due_date = header.due_date;
      if (header.special_instructions) headerPatch.special_instructions = header.special_instructions;
      if (Object.keys(headerPatch).length) {
        await supabase.from("order_headers").update(headerPatch).eq("id", orderId);
      }

      if (scanData?.scan_id) {
        await supabase
          .from("po_scan_results")
          .update({ applied_at: new Date().toISOString() })
          .eq("id", scanData.scan_id);
      }

      toast({
        title: "Applied",
        description: `${rows.length} line item${rows.length === 1 ? "" : "s"} added to the order.`,
      });
      onApplied?.();
      onClose();
    } catch (e: any) {
      toast({ title: "Failed to apply", description: e.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const isLoading = scan.isPending && !scanData;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && !applying && onClose()}>
      <DialogContent className="[--dialog-max-width:90rem] max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review AI Scan {poNumber ? `· ${poNumber}` : ""}
            {scanData && (
              <Badge variant="outline" className="ml-2">
                {Math.round(scanData.confidence * 100)}% match confidence
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={runScan}
              disabled={scan.isPending}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", scan.isPending && "animate-spin")} />
              Re-scan
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
          {/* PDF preview */}
          <div className="border rounded-lg overflow-hidden bg-muted min-h-[400px]">
            {signedUrl ? (
              <PdfCanvasPreview signedUrl={signedUrl} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading PDF…
              </div>
            )}
          </div>

          {/* Extracted data */}
          <ScrollArea className="h-[70vh] pr-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Scanning PO with AI…</p>
              </div>
            ) : !scanData ? (
              <div className="text-sm text-muted-foreground p-4">No scan data.</div>
            ) : (
              <div className="space-y-4">
                {/* Customer */}
                <div className="border rounded-lg p-3 bg-card space-y-2">
                  <div className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4 text-primary" />
                    <Label className="text-xs font-semibold">Customer</Label>
                    {customerMatch?.customer_id ? (
                      <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-700 bg-green-500/5">
                        AI detected · {customerMatch.method?.replace("_", " ")} · {Math.round((customerMatch.score || 0) * 100)}%
                      </Badge>
                    ) : customerMatch?.raw_name ? (
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-700">
                        AI saw "{customerMatch.raw_name}" · no match
                      </Badge>
                    ) : null}
                    {selectedCustomerId &&
                      customerMatch?.customer_id &&
                      selectedCustomerId !== customerMatch.customer_id && (
                        <Badge variant="outline" className="text-[10px]">
                          Manual override
                        </Badge>
                      )}
                  </div>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select customer…" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {customerMismatchWarning && (
                    <p className="text-[11px] text-amber-700 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5" />
                      You already selected a different customer on the order form. AI suggests "{customerMatch?.matched_name}". Pick which one to use.
                    </p>
                  )}
                </div>

                {/* Header fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">PO Number</Label>
                    <Input
                      value={header.po_number}
                      onChange={(e) => setHeader({ ...header, po_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Due Date</Label>
                    <Input
                      type="date"
                      value={header.due_date}
                      onChange={(e) => setHeader({ ...header, due_date: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Special Instructions</Label>
                    <Textarea
                      rows={2}
                      value={header.special_instructions}
                      onChange={(e) => setHeader({ ...header, special_instructions: e.target.value })}
                    />
                  </div>
                </div>

                {/* Line items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">Line items ({lines.length})</h3>
                    <Button variant="ghost" size="sm" onClick={addBlankLine}>
                      <Plus className="h-3 w-3 mr-1" /> Add row
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {lines.length === 0 && (
                      <p className="text-sm text-muted-foreground">No matched lines yet.</p>
                    )}
                    {lines.map((l) => (
                      <div key={l._key} className="border rounded-lg p-3 space-y-2 bg-card">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={l._selected}
                            onChange={(e) => updateLine(l._key, { _selected: e.target.checked })}
                            className="mt-1.5"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">PO ref:</span>
                              <span className="text-xs font-mono">{l.raw_formula_reference || "—"}</span>
                              <MatchBadge line={l} />
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {l.raw_product_description}
                            </p>
                            <div className="grid grid-cols-12 gap-2">
                              <div className="col-span-6">
                                <Label className="text-[10px]">Formula</Label>
                                <SearchableSelect
                                  value={l.formula_id || ""}
                                  onChange={(v) => {
                                    const f = formulas.find((x) => x.id === v);
                                    updateLine(l._key, {
                                      formula_id: v,
                                      matched_code: f?.code,
                                      matched_name: f?.name,
                                      match_score: 1,
                                      match_method: "manual",
                                    });
                                  }}
                                  options={formulas.map((f: any) => ({ value: f.id, label: `${f.code} — ${f.name}` }))}
                                  placeholder="Select formula"
                                  emptyText="No formulas found"
                                />
                              </div>
                              <div className="col-span-2">
                                <Label className="text-[10px]">Bottles</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-8"
                                  value={l.bottle_count || ""}
                                  onChange={(e) =>
                                    updateLine(l._key, { bottle_count: parseInt(e.target.value) || 0 })
                                  }
                                />
                              </div>
                              <div className="col-span-2">
                                <Label className="text-[10px]">Size (ct)</Label>
                                <Select
                                  value={l.bottle_size ? String(l.bottle_size) : ""}
                                  onValueChange={(v) => updateLine(l._key, { bottle_size: parseInt(v) })}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Size" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {BOTTLE_SIZES.map((s) => (
                                      <SelectItem key={s} value={String(s)}>
                                        {s} ct
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2">
                                <Label className="text-[10px]">$/Bottle</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  className="h-8"
                                  value={l.unit_price || ""}
                                  onChange={(e) =>
                                    updateLine(l._key, { unit_price: parseFloat(e.target.value) || 0 })
                                  }
                                />
                              </div>
                            </div>

                            {/* Packaging picks */}
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              <div>
                                <Label className="text-[10px] flex items-center">
                                  Bottle
                                  <AiSuggestBadge score={l.suggested_bottle_id ? l.suggested_bottle_score : 0} />
                                </Label>
                                <Select
                                  value={l.selected_bottle_id || "__none__"}
                                  onValueChange={(v) =>
                                    updateLine(l._key, { selected_bottle_id: v === "__none__" ? null : v })
                                  }
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Pick bottle…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">—</SelectItem>
                                    {bottles.map((b) => (
                                      <SelectItem key={b.item_id} value={b.item_id}>
                                        {b.item_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {l.bottle_hint && (
                                  <p className="text-[9px] text-muted-foreground mt-0.5 truncate" title={l.bottle_hint}>
                                    PO: {l.bottle_hint}
                                  </p>
                                )}
                              </div>
                              <div>
                                <Label className="text-[10px] flex items-center">
                                  Cap
                                  <AiSuggestBadge score={l.suggested_cap_id ? l.suggested_cap_score : 0} />
                                </Label>
                                <Select
                                  value={l.selected_cap_id || "__none__"}
                                  onValueChange={(v) =>
                                    updateLine(l._key, { selected_cap_id: v === "__none__" ? null : v })
                                  }
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Pick cap…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">—</SelectItem>
                                    {caps.map((c) => (
                                      <SelectItem key={c.item_id} value={c.item_id}>
                                        {c.item_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {l.cap_hint && (
                                  <p className="text-[9px] text-muted-foreground mt-0.5 truncate" title={l.cap_hint}>
                                    PO: {l.cap_hint}
                                  </p>
                                )}
                              </div>
                              <div>
                                <Label className="text-[10px] flex items-center">
                                  Label
                                  <AiSuggestBadge score={l.suggested_label_id ? l.suggested_label_score : 0} />
                                </Label>
                                <SearchableSelect
                                  value={l.selected_label_id || ""}
                                  onChange={(v) =>
                                    updateLine(l._key, { selected_label_id: v || null })
                                  }
                                  disabled={!selectedCustomerId}
                                  options={[
                                    { value: "", label: "—" },
                                    ...labels.map((lb: any) => ({ value: lb.id, label: lb.customer_product })),
                                  ]}
                                  placeholder={selectedCustomerId ? "Pick label…" : "Select customer first"}
                                  emptyText="No labels found"
                                />
                                {l.label_hint && (
                                  <p className="text-[9px] text-muted-foreground mt-0.5 truncate" title={l.label_hint}>
                                    PO: {l.label_hint}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-right text-xs text-muted-foreground">
                              Line total: <span className="font-medium text-foreground">${((l.bottle_count || 0) * (l.unit_price || 0)).toFixed(2)}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => removeLine(l._key)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unmatched */}
                {unmatched.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <h3 className="text-sm font-semibold">
                        Needs attention — unmatched ({unmatched.length})
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      AI could not match these to an existing formula. Pick one to include, or skip.
                    </p>
                    <div className="space-y-2">
                      {unmatched.map((l) => (
                        <div key={l._key} className="border border-amber-500/30 rounded-lg p-3 bg-amber-500/5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono">{l.raw_formula_reference || "—"}</span>
                            <span className="text-xs text-muted-foreground">
                              {l.bottle_count} × {l.bottle_size || "?"} ct
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {l.raw_product_description}
                          </p>
                          <SearchableSelect
                            value=""
                            onChange={(v) => promoteUnmatched(l._key, v)}
                            options={formulas.map((f: any) => ({ value: f.id, label: `${f.code} — ${f.name}` }))}
                            placeholder="Pick formula to link…"
                            emptyText="No formulas found"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="border-t pt-3">
          <span className="text-xs text-muted-foreground mr-auto">
            {validLines.length} ready · {lines.length - validLines.length} incomplete · PO total <span className="font-semibold text-foreground">${poTotal.toFixed(2)}</span>
          </span>
          <Button variant="outline" onClick={onClose} disabled={applying}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={applying || !validLines.length}>
            {applying ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Apply {validLines.length} line{validLines.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
