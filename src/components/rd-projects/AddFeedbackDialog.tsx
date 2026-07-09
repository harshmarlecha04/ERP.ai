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
import { useAddFeedback, useUpdateFeedback } from "@/hooks/useRDProjects";

interface AddFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string | null;
  editingFeedback?: any;
}

export const AddFeedbackDialog = ({
  open,
  onOpenChange,
  batchId,
  editingFeedback,
}: AddFeedbackDialogProps) => {
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSource, setFeedbackSource] = useState("");

  const addFeedback = useAddFeedback();
  const updateFeedback = useUpdateFeedback();

  useEffect(() => {
    if (open && !editingFeedback) {
      setFeedbackText("");
      setFeedbackSource("");
    } else if (open && editingFeedback) {
      setFeedbackText(editingFeedback.feedback_text);
      setFeedbackSource(editingFeedback.feedback_source || "");
    }
  }, [open, editingFeedback]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!batchId || !feedbackText.trim()) return;

    const feedbackData = {
      rd_batch_id: batchId,
      feedback_text: feedbackText,
      feedback_source: feedbackSource || undefined,
    };

    if (editingFeedback) {
      await updateFeedback.mutateAsync({
        ...feedbackData,
        id: editingFeedback.id,
      });
    } else {
      await addFeedback.mutateAsync(feedbackData);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingFeedback ? "Edit Feedback" : "Add Feedback"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback / Comments *</Label>
            <Textarea
              id="feedback"
              placeholder="Enter feedback, test results, observations..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={5}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">Source (Optional)</Label>
            <Input
              id="source"
              placeholder="e.g., Customer, Lab, Internal QC"
              value={feedbackSource}
              onChange={(e) => setFeedbackSource(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addFeedback.isPending || updateFeedback.isPending}
            >
              {editingFeedback ? "Update Feedback" : "Add Feedback"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};