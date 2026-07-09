import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePackagingHistory } from "@/hooks/usePackagingInventory";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { formatET } from "@/utils/dateUtils";

interface BottleHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BottleHistoryDialog: React.FC<BottleHistoryDialogProps> = ({ open, onOpenChange }) => {
  const { data: history = [], isLoading } = usePackagingHistory({ 
    category: ["BOTTLES"],
    move_type: "RECEIPT"
  });

  // Parse bottle entries from item names
  const bottleEntries = useMemo(() => {
    return history
      .filter(entry => entry.item_name?.includes("Bottle"))
      .map(entry => {
        // Parse "Clear 100cc Bottle" into color and size
        const parts = entry.item_name?.split(" ") || [];
        const color = parts[0] || "";
        const size = parts[1] || "";
        
        return {
          id: entry.id,
          color,
          size,
          quantity: entry.qty,
          dateAdded: entry.move_date,
        };
      })
      .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  }, [history]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Bottle Entry History</DialogTitle>
          <DialogDescription>
            View all recorded bottle inventory receipts
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 overflow-auto max-h-[60vh]">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : bottleEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No bottle entries found. Start by adding your first bottle receipt.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Date Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bottleEntries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">{entry.color}</TableCell>
                    <TableCell>{entry.size}</TableCell>
                    <TableCell className="text-right">{entry.quantity}</TableCell>
                    <TableCell>
                      {formatET(entry.dateAdded, "MMM dd, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
