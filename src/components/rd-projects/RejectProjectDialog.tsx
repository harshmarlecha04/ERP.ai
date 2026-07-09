import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRejectRDProject } from "@/hooks/useRDProjects";

interface RejectProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  onSuccess?: () => void;
}

export const RejectProjectDialog = ({
  open,
  onOpenChange,
  project,
  onSuccess,
}: RejectProjectDialogProps) => {
  const [reason, setReason] = useState("");
  const rejectProject = useRejectRDProject();

  useEffect(() => {
    if (open) {
      setReason("");
    }
  }, [open]);

  const handleReject = async () => {
    if (!reason.trim()) return;

    await rejectProject.mutateAsync({ id: project.id, reason });
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject R&D Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You are about to reject <strong>{project?.project_number}</strong>. Please
            provide a reason for rejection.
          </p>

          <div className="space-y-2">
            <Label htmlFor="reason">Rejection Reason *</Label>
            <Textarea
              id="reason"
              placeholder="Why are you rejecting this project?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={!reason.trim() || rejectProject.isPending}
          >
            Reject Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};