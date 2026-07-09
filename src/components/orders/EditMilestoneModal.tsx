import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Package, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useOrderMilestones, OrderMilestone } from '@/hooks/useOrderMilestones';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EditMilestoneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: OrderMilestone | null;
  maxBottles: number;
}

export const EditMilestoneModal = ({ open, onOpenChange, milestone, maxBottles }: EditMilestoneModalProps) => {
  const { updateMilestone } = useOrderMilestones();

  const [targetBottles, setTargetBottles] = useState(0);
  const [targetDate, setTargetDate] = useState<Date>();
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (milestone && open) {
      setTargetBottles(milestone.target_bottles);
      setTargetDate(new Date(milestone.target_date));
      setNotes(milestone.notes || '');
    }
  }, [milestone, open]);

  const handleSubmit = async () => {
    if (!milestone || !targetDate) return;

    await updateMilestone.mutateAsync({
      milestoneId: milestone.id,
      updates: {
        target_bottles: targetBottles,
        target_date: format(targetDate, 'yyyy-MM-dd'),
        notes: notes || null,
      },
    });

    onOpenChange(false);
  };

  const canReduceBottles = !milestone || targetBottles >= milestone.shipped_bottles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Edit Delivery Milestone
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {milestone && milestone.shipped_bottles > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {milestone.shipped_bottles.toLocaleString()} bottles have already been shipped for this milestone.
                You cannot reduce the target below this amount.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="targetBottles">Target Bottles *</Label>
            <Input
              id="targetBottles"
              type="number"
              value={targetBottles}
              onChange={(e) => setTargetBottles(parseInt(e.target.value) || 0)}
              min={milestone?.shipped_bottles || 0}
              max={maxBottles}
              required
            />
            <p className="text-xs text-muted-foreground">
              {milestone?.shipped_bottles ? (
                <>Minimum: {milestone.shipped_bottles.toLocaleString()} (already shipped)</>
              ) : (
                <>Maximum: {maxBottles.toLocaleString()} bottles</>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Target Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !targetDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targetDate ? format(targetDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={targetDate}
                  onSelect={setTargetDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional milestone notes"
              rows={2}
            />
          </div>

          {milestone && (
            <div className="p-3 bg-muted rounded-md text-sm space-y-1">
              <p className="font-medium">Current Progress:</p>
              <p className="text-muted-foreground">
                {milestone.shipped_bottles.toLocaleString()} of {milestone.target_bottles.toLocaleString()} bottles shipped
                ({Math.round((milestone.shipped_bottles / milestone.target_bottles) * 100)}%)
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!targetDate || targetBottles <= 0 || !canReduceBottles || updateMilestone.isPending}
          >
            {updateMilestone.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};