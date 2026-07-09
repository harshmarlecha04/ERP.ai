import React, { useState, useMemo } from "react";
import { format, addDays } from "date-fns";
import { CalendarRange, ArrowRight, Plus, Minus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatET } from "@/utils/dateUtils";

interface ScheduleItem {
  id: string;
  schedule_date: string | null;
  formula_code: string;
  formula_name?: string;
}

interface BulkRescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dayShift: number) => Promise<void>;
  selectedItems: ScheduleItem[];
  isLoading?: boolean;
}

export function BulkRescheduleModal({
  isOpen,
  onClose,
  onConfirm,
  selectedItems,
  isLoading = false,
}: BulkRescheduleModalProps) {
  const [dayShift, setDayShift] = useState<number>(1);

  // Group items by their current date and calculate preview
  const preview = useMemo(() => {
    const dateGroups: Record<string, { count: number; newDate: string }> = {};
    
    selectedItems.forEach((item) => {
      if (!item.schedule_date) return;
      
      const currentDate = item.schedule_date;
      const newDate = addDays(new Date(currentDate + 'T00:00:00'), dayShift);
      const newDateStr = format(newDate, 'yyyy-MM-dd');
      
      if (!dateGroups[currentDate]) {
        dateGroups[currentDate] = { count: 0, newDate: newDateStr };
      }
      dateGroups[currentDate].count++;
    });
    
    return Object.entries(dateGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currentDate, { count, newDate }]) => ({
        from: formatET(currentDate, 'MMM dd'),
        to: formatET(newDate, 'MMM dd'),
        count,
      }));
  }, [selectedItems, dayShift]);

  const handleConfirm = async () => {
    await onConfirm(dayShift);
    setDayShift(1); // Reset for next use
  };

  const handleClose = () => {
    setDayShift(1);
    onClose();
  };

  // Check if any items would move to the past
  const wouldMoveToPast = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return selectedItems.some((item) => {
      if (!item.schedule_date) return false;
      const newDate = addDays(new Date(item.schedule_date + 'T00:00:00'), dayShift);
      return newDate < today;
    });
  }, [selectedItems, dayShift]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5" />
            Bulk Reschedule
          </DialogTitle>
          <DialogDescription>
            Shift {selectedItems.length} selected item{selectedItems.length !== 1 ? 's' : ''} by a number of days
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Day shift input */}
          <div className="space-y-2">
            <Label htmlFor="dayShift">Shift by (days)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="dayShift"
                type="number"
                value={dayShift}
                onChange={(e) => setDayShift(parseInt(e.target.value) || 0)}
                className="text-center"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Positive = move forward, Negative = move backward
            </p>
          </div>

          {/* Quick action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDayShift(-7)}
              className="gap-1"
            >
              <Minus className="h-3 w-3" />
              1 week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDayShift(-1)}
              className="gap-1"
            >
              <Minus className="h-3 w-3" />
              1 day
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDayShift(1)}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              1 day
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDayShift(7)}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              1 week
            </Button>
          </div>

          {/* Preview */}
          {dayShift !== 0 && preview.length > 0 && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="rounded-md border bg-muted/50 p-3 space-y-1">
                {preview.map((group, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{group.from}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{group.to}</span>
                    <span className="text-muted-foreground">
                      ({group.count} item{group.count !== 1 ? 's' : ''})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning for past dates */}
          {wouldMoveToPast && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
              ⚠️ Some items will be moved to past dates
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || dayShift === 0}
          >
            {isLoading ? "Updating..." : "Apply Reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
