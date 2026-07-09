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
import { useApproveRDProject } from "@/hooks/useRDProjects";

interface ApproveProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  onSuccess?: () => void;
}

export const ApproveProjectDialog = ({
  open,
  onOpenChange,
  project,
  onSuccess,
}: ApproveProjectDialogProps) => {
  const approveProject = useApproveRDProject();

  const handleApprove = async () => {
    await approveProject.mutateAsync(project.id);
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve R&D Project</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to approve <strong>{project?.project_number}</strong> for{" "}
            <strong>{project?.customer_name}</strong>?
            <br />
            <br />
            This will mark the project as approved and allow it to be converted to a
            production formula.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleApprove}>Approve</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};