import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRejectVersion } from "@/hooks/useRDProjectVersions";

interface RejectVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionId: string;
  rdProjectId: string;
  versionNumber: string;
  flavor: string;
  color: string;
}

export function RejectVersionDialog({
  open,
  onOpenChange,
  versionId,
  rdProjectId,
  versionNumber,
  flavor,
  color,
}: RejectVersionDialogProps) {
  const [reason, setReason] = useState("");
  const rejectVersion = useRejectVersion();

  const handleReject = async () => {
    if (!reason.trim()) {
      return;
    }

    await rejectVersion.mutateAsync({
      id: versionId,
      rd_project_id: rdProjectId,
      reason: reason,
    });
    onOpenChange(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject Version {versionNumber}</DialogTitle>
          <DialogDescription>
            Please provide a reason for rejecting this version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Version:</span>
              <Badge variant="outline">{versionNumber}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Flavor:</span>
              <span className="text-sm text-muted-foreground">{flavor}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Color:</span>
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="rejection-reason">Rejection Reason *</Label>
            <Textarea
              id="rejection-reason"
              placeholder="e.g., Color too light, customer prefers darker red"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setReason("");
            }}
            disabled={rejectVersion.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={rejectVersion.isPending || !reason.trim()}
          >
            {rejectVersion.isPending ? "Rejecting..." : "Reject Version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
