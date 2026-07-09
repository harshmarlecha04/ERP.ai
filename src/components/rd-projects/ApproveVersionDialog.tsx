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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useApproveVersion } from "@/hooks/useRDProjectVersions";

interface ApproveVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionId: string;
  rdProjectId: string;
  versionNumber: string;
  flavor: string;
  color: string;
  actives: Array<{ active_name: string; mg_per_gummy: number }>;
}

export function ApproveVersionDialog({
  open,
  onOpenChange,
  versionId,
  rdProjectId,
  versionNumber,
  flavor,
  color,
  actives,
}: ApproveVersionDialogProps) {
  const [setAsCurrent, setSetAsCurrent] = useState(true);
  const approveVersion = useApproveVersion();

  const handleApprove = async () => {
    await approveVersion.mutateAsync({
      id: versionId,
      rd_project_id: rdProjectId,
      setAsCurrent,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve Version {versionNumber}</DialogTitle>
          <DialogDescription>
            Are you sure you want to approve this version?
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
            {actives.length > 0 && (
              <div className="space-y-1">
                <span className="text-sm font-medium">Active Ingredients:</span>
                <ul className="text-sm text-muted-foreground pl-4 space-y-1">
                  {actives.map((active, idx) => (
                    <li key={idx}>
                      {active.active_name}: {active.mg_per_gummy}mg per gummy
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-4 border-t">
            <Checkbox
              id="set-current"
              checked={setAsCurrent}
              onCheckedChange={(checked) => setSetAsCurrent(checked === true)}
            />
            <Label
              htmlFor="set-current"
              className="text-sm font-normal cursor-pointer"
            >
              Set as current version for this project
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={approveVersion.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={approveVersion.isPending}
          >
            {approveVersion.isPending ? "Approving..." : "Approve Version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
