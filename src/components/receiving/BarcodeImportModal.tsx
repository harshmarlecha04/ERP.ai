import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Row {
  identifier: string;
  barcode: string;
}

interface ImportResult {
  matched: number;
  unmatched: string[];
  errors: string[];
}

/**
 * CSV format (header row required, case-insensitive):
 *   code,barcode      OR     name,barcode
 * Extra columns ignored. Lines without both values are skipped.
 */
export function BarcodeImportModal({ open, onOpenChange }: Props) {
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [keyField, setKeyField] = useState<"code" | "name">("code");
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    setParsing(true);
    setResult(null);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setParsing(false);
      toast({ title: "Empty file", variant: "destructive" });
      return;
    }
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const barcodeIdx = header.indexOf("barcode");
    const codeIdx = header.indexOf("code");
    const nameIdx = header.indexOf("name");
    if (barcodeIdx === -1 || (codeIdx === -1 && nameIdx === -1)) {
      setParsing(false);
      toast({
        title: "Bad headers",
        description: "Need columns: barcode + (code or name)",
        variant: "destructive",
      });
      return;
    }
    const useCode = codeIdx !== -1;
    setKeyField(useCode ? "code" : "name");
    const idIdx = useCode ? codeIdx : nameIdx;
    const parsed: Row[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const identifier = cols[idIdx];
      const barcode = cols[barcodeIdx];
      if (identifier && barcode) parsed.push({ identifier, barcode });
    }
    setRows(parsed);
    setParsing(false);
  };

  const runImport = async () => {
    setImporting(true);
    const matched: number[] = [];
    const unmatched: string[] = [];
    const errors: string[] = [];

    for (const row of rows) {
      const q = supabase.from("raw_materials").update({ barcode: row.barcode });
      const filtered = keyField === "code"
        ? q.eq("code", row.identifier)
        : q.ilike("name", row.identifier);
      const { data, error } = await filtered.select("id");
      if (error) errors.push(`${row.identifier}: ${error.message}`);
      else if (!data || data.length === 0) unmatched.push(row.identifier);
      else matched.push(1);
    }

    setImporting(false);
    setResult({ matched: matched.length, unmatched, errors });
    toast({
      title: "Import complete",
      description: `${matched.length} updated, ${unmatched.length} unmatched`,
    });
  };

  const reset = () => {
    setRows([]);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Import supplier barcodes
          </DialogTitle>
          <DialogDescription>
            CSV with header: <code>code,barcode</code> or <code>name,barcode</code>.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="csv">CSV file</Label>
              <Input
                id="csv"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                disabled={parsing || importing}
              />
            </div>
            {rows.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">
                  {rows.length} rows parsed (key: <span className="font-mono">{keyField}</span>)
                </div>
                <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                  {rows.slice(0, 6).map((r, i) => (
                    <li key={i}>
                      {r.identifier} → <span className="font-mono">{r.barcode}</span>
                    </li>
                  ))}
                  {rows.length > 6 && <li>…+{rows.length - 6} more</li>}
                </ul>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={runImport} disabled={!rows.length || importing}>
                {importing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" />Import {rows.length || ""}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/30 p-3">
              <div><span className="font-medium text-foreground">{result.matched}</span> linked</div>
              <div className="text-muted-foreground">{result.unmatched.length} unmatched, {result.errors.length} errors</div>
            </div>
            {result.unmatched.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Unmatched ({result.unmatched.length})</summary>
                <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto pl-3">
                  {result.unmatched.map((u, i) => <li key={i}>{u}</li>)}
                </ul>
              </details>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>Import another</Button>
              <Button className="flex-1" onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
