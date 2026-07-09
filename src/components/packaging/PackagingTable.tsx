import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PackagingBalance } from "@/hooks/usePackagingInventory";
import { cn } from "@/lib/utils";
import { Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PackagingTableProps {
  data: PackagingBalance[];
  isLoading?: boolean;
  onItemClick?: (itemId: string) => void;
  onEdit?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
}

export const PackagingTable: React.FC<PackagingTableProps> = ({ 
  data, 
  isLoading, 
  onItemClick,
  onEdit,
  onDelete
}) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    setItemToDelete(itemId);
    setDeleteConfirmOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    onEdit?.(itemId);
  };

  const confirmDelete = () => {
    if (itemToDelete && onDelete) {
      onDelete(itemToDelete);
    }
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  };
  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4">Item Name</TableHead>
            <TableHead className="text-right px-4">On Hand</TableHead>
            <TableHead className="text-center px-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell className="px-4"><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell className="text-right px-4"><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell className="text-center px-4"><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4">Item Name</TableHead>
            <TableHead className="text-right px-4">On Hand</TableHead>
            <TableHead className="text-center px-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                No packaging items found
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => {
              return (
                <TableRow
                  key={item.item_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onItemClick?.(item.item_id)}
                >
                  <TableCell className="px-4 font-medium">{item.item_name}</TableCell>
                  <TableCell className="text-right px-4">
                    {item.on_hand.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleEditClick(e, item.item_id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteClick(e, item.item_id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Packaging Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this packaging item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};