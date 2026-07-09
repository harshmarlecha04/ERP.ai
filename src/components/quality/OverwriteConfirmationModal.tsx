import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ExistingAssignment {
  ingredient_name: string;
  supplier_name: string;
  lot_number: string;
  allocated_qty: number;
}

interface OverwriteConfirmationModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  existingAssignments: ExistingAssignment[];
  existingCount: number;
  scheduleItem: {
    formula_code: string;
    formula_name: string;
    batches: number;
    schedule_date: string;
  } | null;
}

export const OverwriteConfirmationModal: React.FC<OverwriteConfirmationModalProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  existingAssignments,
  existingCount,
  scheduleItem
}) => {
  if (!scheduleItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="[--dialog-max-width:56rem] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Overwrite Existing Ingredient Assignments?
          </DialogTitle>
          <DialogDescription className="space-y-3">
            <div className="text-foreground">
              <strong>Warning:</strong> This action will replace all existing ingredient assignments for this batch.
            </div>
            <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
              <div className="text-sm space-y-1">
                <div><strong>Formula:</strong> {scheduleItem.formula_code} - {scheduleItem.formula_name}</div>
                <div><strong>Batches:</strong> {scheduleItem.batches}</div>
                <div><strong>Scheduled Date:</strong> {new Date(scheduleItem.schedule_date + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
                <div><strong>Existing Assignments:</strong> {existingCount} ingredients currently assigned</div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Current Ingredient Assignments</h3>
              <Badge variant="outline">{existingCount} assignments</Badge>
            </div>
            
            {existingAssignments.length > 0 && (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Lot Number</TableHead>
                      <TableHead className="text-right">Allocated (kg)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {existingAssignments.map((assignment, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {assignment.ingredient_name}
                        </TableCell>
                        <TableCell>
                          {assignment.supplier_name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {assignment.lot_number || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          {assignment.allocated_qty.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-destructive mb-1">This action cannot be undone</div>
                  <div className="text-muted-foreground">
                    All {existingCount} current ingredient assignments will be permanently deleted and replaced 
                    with new FIFO-based allocations. Make sure this is what you want before proceeding.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Yes, Replace All Assignments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};