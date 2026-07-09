import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePackagingHistory } from "@/hooks/usePackagingInventory";
import { format } from "date-fns";
import { Loader2, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatET } from "@/utils/dateUtils";

interface CapHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CapHistoryDialog({ open, onOpenChange }: CapHistoryDialogProps) {
  const { data: history, isLoading } = usePackagingHistory({
    category: ["CAPS"],
    move_type: "RECEIPT",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <DialogTitle>Cap Receipt History</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            All cap inventory receipts
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !history || history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No cap entries recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cap Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.item_name}</TableCell>
                    <TableCell className="text-right">
                      {Number(entry.qty).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.notes || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatET(entry.move_date, "MMM dd, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
