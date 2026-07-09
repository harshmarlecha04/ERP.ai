import { useState } from "react";
import { useOfficeSupplies, useDeleteOfficeSupply, OfficeSupply, useOfficeSupplyStats } from "@/hooks/useOfficeSupplies";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, ShoppingCart, History, Copy, ExternalLink } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AddPurchaseModal } from "./AddPurchaseModal";
import { PurchaseHistoryModal } from "./PurchaseHistoryModal";
import { AdjustQuantityModal } from "./AdjustQuantityModal";
import { useToast } from "@/hooks/use-toast";

interface OfficeSupplyInventoryTableProps {
  onEdit: (supply: OfficeSupply) => void;
}

export const OfficeSupplyInventoryTable = ({
  onEdit
}: OfficeSupplyInventoryTableProps) => {
  const {
    data: supplies,
    isLoading
  } = useOfficeSupplies();
  const { data: stats } = useOfficeSupplyStats();
  const deleteSupply = useDeleteOfficeSupply();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [purchaseModal, setPurchaseModal] = useState<{
    itemId: string;
    itemName: string;
    uom: string;
  } | null>(null);
  const [historyModal, setHistoryModal] = useState<{
    itemId: string;
    itemName: string;
  } | null>(null);
  const [adjustModal, setAdjustModal] = useState<OfficeSupply | null>(null);

  const filteredSupplies = supplies?.filter(supply => 
    supply.item_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    supply.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
    supply.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteSupply.mutateAsync(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied to clipboard!" });
  };

  const isLowStock = (supply: OfficeSupply) => {
    return supply.min_quantity && supply.min_quantity > 0 && supply.quantity_on_hand <= supply.min_quantity;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading inventory...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Input 
          placeholder="Search by item name, category, or supplier..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filteredSupplies || filteredSupplies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No office supplies found
                </TableCell>
              </TableRow>
            ) : (
              filteredSupplies.map(supply => (
                <TableRow key={supply.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {supply.item_name}
                      {isLowStock(supply) && <Badge variant="destructive">Low Stock</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{supply.category}</Badge>
                  </TableCell>
                  <TableCell>
                    {supply.quantity_on_hand > 0 
                      ? `${supply.quantity_on_hand} ${supply.unit_of_measure}` 
                      : <span className="text-muted-foreground">No stock</span>
                    }
                  </TableCell>
                  <TableCell>{supply.supplier || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {supply.buy_link && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleCopyLink(supply.buy_link!)} 
                            title="Copy Buy Link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => window.open(supply.buy_link, '_blank')} 
                            title="Open Buy Link"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setPurchaseModal({
                          itemId: supply.id,
                          itemName: supply.item_name,
                          uom: supply.unit_of_measure
                        })} 
                        title="Record Purchase"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setHistoryModal({
                          itemId: supply.id,
                          itemName: supply.item_name
                        })} 
                        title="View Purchase History"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onEdit(supply)} 
                        title="Edit Item Details"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setDeleteConfirm(supply.id)} 
                        title="Delete Item"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone and will also delete all purchase history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {purchaseModal && (
        <AddPurchaseModal 
          open={!!purchaseModal} 
          onOpenChange={open => !open && setPurchaseModal(null)} 
          itemId={purchaseModal.itemId} 
          itemName={purchaseModal.itemName} 
          unitOfMeasure={purchaseModal.uom} 
        />
      )}

      {historyModal && (
        <PurchaseHistoryModal 
          open={!!historyModal} 
          onOpenChange={open => !open && setHistoryModal(null)} 
          itemId={historyModal.itemId} 
          itemName={historyModal.itemName} 
        />
      )}

      <AdjustQuantityModal 
        open={!!adjustModal} 
        onOpenChange={open => !open && setAdjustModal(null)} 
        supply={adjustModal} 
      />
    </div>
  );
};