import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOrderMilestones } from '@/hooks/useOrderMilestones';
import { format } from 'date-fns';
import { formatET } from "@/utils/dateUtils";

interface AddMilestoneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderDueDate: string;
  totalBottles: number;
  currentMilestoneCount: number;
  existingMilestoneBottles: number;
}

export const AddMilestoneModal = ({
  open,
  onOpenChange,
  orderId,
  orderDueDate,
  totalBottles,
  currentMilestoneCount,
  existingMilestoneBottles,
}: AddMilestoneModalProps) => {
  const { createMilestone } = useOrderMilestones(orderId);
  
  const [targetBottles, setTargetBottles] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    const bottles = parseInt(targetBottles);
    
    if (!bottles || bottles <= 0) {
      return;
    }

    const totalWithNew = existingMilestoneBottles + bottles;
    if (totalWithNew > totalBottles) {
      return;
    }

    await createMilestone.mutateAsync({
      order_id: orderId,
      milestone_number: currentMilestoneCount + 1,
      target_bottles: bottles,
      target_date: targetDate,
      notes: notes || undefined,
    });

    // Reset form
    setTargetBottles('');
    setTargetDate('');
    setNotes('');
    onOpenChange(false);
  };

  const remainingBottles = totalBottles - existingMilestoneBottles;
  const isOverLimit = parseInt(targetBottles) > remainingBottles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Delivery Milestone</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="target-bottles">Target Bottles</Label>
            <Input
              id="target-bottles"
              type="number"
              value={targetBottles}
              onChange={(e) => setTargetBottles(e.target.value)}
              placeholder="Enter number of bottles"
            />
            {isOverLimit && (
              <p className="text-sm text-destructive">
                Exceeds remaining bottles ({remainingBottles} available)
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Remaining unallocated: {remainingBottles.toLocaleString()} bottles
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-date">Target Date</Label>
            <Input
              id="target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              max={orderDueDate}
            />
            {targetDate && targetDate > orderDueDate && (
              <p className="text-sm text-amber-600">
                Date is after order due date ({formatET(orderDueDate, 'MMM d, yyyy')})
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any special instructions..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !targetBottles || 
              !targetDate || 
              isOverLimit || 
              createMilestone.isPending
            }
          >
            {createMilestone.isPending ? 'Creating...' : 'Add Milestone'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
