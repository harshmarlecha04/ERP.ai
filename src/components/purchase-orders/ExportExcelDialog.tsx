import { useState } from "react";
import { format, parseISO, startOfDay, endOfDay, subDays } from "date-fns";
import { CalendarIcon, Download, Loader2 } from "lucide-react";
import ExcelJS from "exceljs";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseOrder } from "@/hooks/usePurchaseOrders";

interface ExportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrders: PurchaseOrder[];
}

export function ExportExcelDialog({ open, onOpenChange, purchaseOrders }: ExportExcelDialogProps) {
  const { toast } = useToast();
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [isExporting, setIsExporting] = useState(false);

  const parseSafe = (s?: string | null): Date | null => {
    if (!s) return null;
    try {
      const d = parseISO(s);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  const handleExport = async () => {
    if (!fromDate || !toDate) {
      toast({ variant: "destructive", title: "Pick a date range" });
      return;
    }
    if (fromDate > toDate) {
      toast({ variant: "destructive", title: "Invalid range", description: "From date must be before To date." });
      return;
    }

    setIsExporting(true);
    try {
      const start = startOfDay(fromDate).getTime();
      const end = endOfDay(toDate).getTime();

      const received = (purchaseOrders || []).filter((po) => {
        if (po.status !== "received") return false;
        const d = parseSafe(po.expected_delivery);
        if (!d) return false;
        const t = d.getTime();
        return t >= start && t <= end;
      });

      const rows: Array<{
        ingredient: string;
        quantity: number | string;
        uom: string;
        status: string;
        expected: string;
      }> = [];

      received.forEach((po) => {
        const expected = po.expected_delivery
          ? format(parseISO(po.expected_delivery), "yyyy-MM-dd")
          : "";
        if (po.items && po.items.length > 0) {
          po.items.forEach((item) => {
            rows.push({
              ingredient: item.ingredient_name || "",
              quantity: item.quantity ?? "",
              uom: item.uom || "",
              status: "Received",
              expected,
            });
          });
        }
      });

      if (rows.length === 0) {
        toast({
          title: "No data to export",
          description: "No received purchase orders in this date range.",
        });
        setIsExporting(false);
        return;
      }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Received POs");
      ws.columns = [
        { header: "Ingredient", key: "ingredient", width: 32 },
        { header: "Quantity", key: "quantity", width: 14 },
        { header: "UoM", key: "uom", width: 10 },
        { header: "Status", key: "status", width: 14 },
        { header: "Expected Delivery", key: "expected", width: 18 },
      ];
      ws.getRow(1).font = { bold: true };
      rows.forEach((r) => ws.addRow(r));

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `purchase-orders_received_${format(fromDate, "yyyy-MM-dd")}_${format(toDate, "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Export complete", description: `${rows.length} row(s) exported.` });
      onOpenChange(false);
    } catch (e: any) {
      console.error("Excel export failed:", e);
      toast({ variant: "destructive", title: "Export failed", description: e?.message ?? "Unknown error" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[460px]"
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Export Purchase Orders</DialogTitle>
          <DialogDescription>
            Exports <strong>Received</strong> purchase orders only, filtered by Expected Delivery date.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("justify-start text-left font-normal", !fromDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate ? format(fromDate, "PP") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" onClick={(e) => e.stopPropagation()}>
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={setFromDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-2">
            <Label>To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("justify-start text-left font-normal", !toDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toDate ? format(toDate, "PP") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" onClick={(e) => e.stopPropagation()}>
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={setToDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
