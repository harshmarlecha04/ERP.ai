import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useCreateBatch, useUpdateBatch } from "@/hooks/useRDProjects";
import { cn } from "@/lib/utils";

interface AddBatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  editingBatch?: any;
}

export const AddBatchModal = ({
  open,
  onOpenChange,
  projectId,
  editingBatch,
}: AddBatchModalProps) => {
  const [batchDate, setBatchDate] = useState<Date>(new Date());
  const [quantityProduced, setQuantityProduced] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [status, setStatus] = useState("in_progress");
  const [notes, setNotes] = useState("");

  const createBatch = useCreateBatch();
  const updateBatch = useUpdateBatch();

  useEffect(() => {
    if (open && !editingBatch) {
      setBatchDate(new Date());
      setQuantityProduced("");
      setSentTo("");
      setStatus("in_progress");
      setNotes("");
    } else if (open && editingBatch) {
      setBatchDate(new Date(editingBatch.batch_date));
      setQuantityProduced(editingBatch.quantity_produced || "");
      setSentTo(editingBatch.sent_to || "");
      setStatus(editingBatch.status);
      setNotes(editingBatch.notes || "");
    }
  }, [open, editingBatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) return;

    const batchData = {
      rd_project_id: projectId,
      batch_date: format(batchDate, "yyyy-MM-dd"),
      quantity_produced: quantityProduced,
      sent_to: sentTo,
      status,
      notes,
    };

    if (editingBatch) {
      await updateBatch.mutateAsync({
        ...batchData,
        id: editingBatch.id,
      });
    } else {
      await createBatch.mutateAsync(batchData);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingBatch ? "Edit Batch" : "Add New Batch"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Batch Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !batchDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {batchDate ? format(batchDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={batchDate}
                  onSelect={(date) => date && setBatchDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity Produced</Label>
            <Input
              id="quantity"
              placeholder="e.g., 500 gummies, 1kg, 10 bottles"
              value={quantityProduced}
              onChange={(e) => setQuantityProduced(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sentTo">Sent To</Label>
            <Input
              id="sentTo"
              placeholder="e.g., Customer - ABC Corp Lab, Internal Testing"
              value={sentTo}
              onChange={(e) => setSentTo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="sent_for_testing">Sent for Testing</SelectItem>
                <SelectItem value="feedback_received">Feedback Received</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Batch-specific notes, observations, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createBatch.isPending || updateBatch.isPending}
            >
              {editingBatch ? "Update Batch" : "Create Batch"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};