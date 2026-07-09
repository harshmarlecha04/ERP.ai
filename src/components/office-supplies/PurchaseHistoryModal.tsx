import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useOfficeSupplyPurchases, useDeletePurchase } from "@/hooks/useOfficeSupplyPurchases";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { formatET } from "@/utils/dateUtils";

interface PurchaseHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
}

export const PurchaseHistoryModal = ({ 
  open, 
  onOpenChange, 
  itemId, 
  itemName 
}: PurchaseHistoryModalProps) => {
  const { data: purchases, isLoading } = useOfficeSupplyPurchases(itemId);
  const deletePurchase = useDeletePurchase();
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; quantity: number } | null>(null);

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deletePurchase.mutateAsync({ 
        id: deleteConfirm.id, 
        item_id: itemId,
        quantity: deleteConfirm.quantity 
      });
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="[--dialog-max-width:64rem] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Purchase History - {itemName}</DialogTitle>
          </DialogHeader>
          
          <div className="overflow-auto max-h-[70vh]">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading purchases...</div>
            ) : !purchases || purchases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No purchase history available</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Shipping</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>{formatET(purchase.purchase_date, "M/d/yyyy")}</TableCell>
                      <TableCell>{purchase.quantity}</TableCell>
                      <TableCell>${purchase.unit_cost.toFixed(2)}</TableCell>
                      <TableCell>${purchase.shipping_cost.toFixed(2)}</TableCell>
                      <TableCell>${purchase.tax.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">${purchase.total_cost.toFixed(2)}</TableCell>
                      <TableCell>{purchase.supplier || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">{purchase.notes || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm({ id: purchase.id, quantity: purchase.quantity })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this purchase record? This will reduce the item's quantity on hand.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
