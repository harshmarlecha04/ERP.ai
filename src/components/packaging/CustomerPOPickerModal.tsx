import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, RefreshCw, ExternalLink, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomerPOsByCustomer, type CustomerPOFullOption } from "@/hooks/useCustomerPOsByCustomer";
import { getSignedPdfUrl } from "@/utils/pdfStorage";

interface CustomerPOPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string | null;
  customerName?: string | null;
  selectedPoId: string | null;
  onSelect: (poId: string | null) => void;
}

function statusVariant(status?: string | null): "default" | "secondary" | "outline" | "destructive" {
  const s = (status || "").toLowerCase();
  if (s.includes("complete") || s.includes("closed")) return "secondary";
  if (s.includes("cancel") || s.includes("reject")) return "destructive";
  if (s.includes("progress") || s.includes("ship") || s.includes("packag")) return "default";
  return "outline";
}

function getPdfViewerUrl(url: string) {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
}

export const CustomerPOPickerModal: React.FC<CustomerPOPickerModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  selectedPoId,
  onSelect,
}) => {
  const { data: pos = [], isLoading } = useCustomerPOsByCustomer(customerId);
  const [search, setSearch] = React.useState("");
  const [highlightedId, setHighlightedId] = React.useState<string | null>(selectedPoId);
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = React.useState(false);
  const [pdfError, setPdfError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setHighlightedId(selectedPoId);
      setSearch("");
    }
  }, [isOpen, selectedPoId]);

  // Auto-highlight the first PO when none selected
  React.useEffect(() => {
    if (isOpen && !highlightedId && pos.length > 0) {
      setHighlightedId(pos[0].id);
    }
  }, [isOpen, pos, highlightedId]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pos;
    return pos.filter((p) =>
      [p.po_number, p.order_number, p.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [pos, search]);

  const highlighted: CustomerPOFullOption | undefined = React.useMemo(
    () => pos.find((p) => p.id === highlightedId),
    [pos, highlightedId]
  );

  // Load signed PDF URL whenever highlighted PO changes
  React.useEffect(() => {
    let cancelled = false;
    setSignedUrl(null);
    setPdfError(null);
    if (highlighted?.resolved_pdf_url) {
      setLoadingPdf(true);
      getSignedPdfUrl(highlighted.resolved_pdf_url)
        .then((url) => {
          if (!cancelled) {
            setSignedUrl(url);
            if (!url) setPdfError("PDF file could not be found in storage.");
          }
        })
        .catch(() => {
          if (!cancelled) setPdfError("PDF file could not be found in storage.");
        })
        .finally(() => {
          if (!cancelled) setLoadingPdf(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [highlighted?.resolved_pdf_url]);


  const handleConfirm = () => {
    if (highlightedId) {
      onSelect(highlightedId);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="[--dialog-max-width:min(1200px,95vw)] w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Customer PO
            {customerName && (
              <span className="text-sm font-normal text-muted-foreground">
                — {customerName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Left: PO list */}
          <div className="w-[36%] border-r flex flex-col min-h-0">
            <div className="p-3 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PO# / order # / status"
                  className="pl-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {!customerId ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  Select a customer first to see their POs.
                </div>
              ) : isLoading ? (
                <div className="p-6 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading POs…
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  {pos.length === 0
                    ? `No POs found for ${customerName || "this customer"}.`
                    : "No POs match your search."}
                </div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((po) => {
                    const isHighlighted = po.id === highlightedId;
                    const isCurrent = po.id === selectedPoId;
                    return (
                      <li key={po.id}>
                        <button
                          type="button"
                          onClick={() => setHighlightedId(po.id)}
                          onDoubleClick={() => {
                            onSelect(po.id);
                            onClose();
                          }}
                          className={cn(
                            "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex flex-col gap-1",
                            isHighlighted && "bg-muted"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm truncate">
                              {po.po_number || po.order_number || "(no PO#)"}
                            </span>
                            {isCurrent && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground truncate">
                              {po.order_number && po.po_number && po.order_number !== po.po_number
                                ? `Order: ${po.order_number}`
                                : po.due_date
                                ? `Due ${po.due_date}`
                                : ""}
                            </span>
                            {po.status && (
                              <Badge variant={statusVariant(po.status)} className="text-[10px] capitalize">
                                {po.status.replace(/_/g, " ")}
                              </Badge>
                            )}
                          </div>
                          {(po.total_bottles_ordered ?? null) !== null && (
                            <div className="text-[11px] text-muted-foreground">
                              {po.total_bottles_ordered} bottles ordered
                              {po.total_bottles_shipped
                                ? ` • ${po.total_bottles_shipped} shipped`
                                : ""}
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Right: viewer */}
          <div className="flex-1 flex flex-col min-h-0">
            {highlighted ? (
              <>
                <div className="px-5 py-3 border-b shrink-0 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base truncate">
                        {highlighted.po_number || highlighted.order_number || "(no PO#)"}
                      </h3>
                      {highlighted.status && (
                        <Badge variant={statusVariant(highlighted.status)} className="capitalize">
                          {highlighted.status.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {highlighted.customer_name && <span>{highlighted.customer_name}</span>}
                      {highlighted.due_date && <span>Due: {highlighted.due_date}</span>}
                      {(highlighted.total_bottles_ordered ?? null) !== null && (
                        <span>
                          {highlighted.total_bottles_ordered} bottles ordered
                          {highlighted.total_bottles_shipped
                            ? ` • ${highlighted.total_bottles_shipped} shipped`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {signedUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(signedUrl, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                  )}
                </div>
                <div className="flex-1 min-h-0 bg-muted">
                  {!highlighted.resolved_pdf_url ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <FileText className="h-10 w-10" />
                      <p className="text-sm">No PDF attached to this PO.</p>
                    </div>
                  ) : loadingPdf ? (
                    <div className="h-full flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : signedUrl ? (
                    <iframe
                      key={signedUrl}
                      src={getPdfViewerUrl(signedUrl)}
                      className="block w-full h-full"
                      title={`PO PDF - ${highlighted.po_number || ""}`}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground p-6 text-center">
                      <FileText className="h-10 w-10" />
                      <p>{pdfError || "Unable to load PDF preview for this PO."}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a PO from the list to preview.
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t px-6 py-3 flex items-center justify-between gap-2">
          <div>
            {selectedPoId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSelect(null);
                  onClose();
                }}
              >
                Clear selection
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!highlightedId}>
              Use this PO
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
