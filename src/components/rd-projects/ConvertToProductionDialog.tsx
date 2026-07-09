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
import { useConvertToProduction } from "@/hooks/useRDProjects";

interface ConvertToProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  onSuccess?: () => void;
}

export const ConvertToProductionDialog = ({
  open,
  onOpenChange,
  project,
  onSuccess,
}: ConvertToProductionDialogProps) => {
  const convertToProduction = useConvertToProduction();

  const handleConvert = async () => {
    const formulaId = await convertToProduction.mutateAsync(project.id);
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Convert to Production Formula</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This will create a new production formula based on R&D project{" "}
              <strong>{project?.project_number}</strong>.
            </p>
            <div className="bg-muted p-3 rounded-md text-sm space-y-2">
              <p className="font-semibold">What will be copied:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Customer: {project?.customer_name}</li>
                <li>Flavor & Color (in notes)</li>
                <li>Active Ingredients ({project?.actives?.length || 0} actives)</li>
                <li>Formula Code: {project?.project_number}-PROD</li>
              </ul>
            </div>
            <p className="text-sm">
              You will need to complete the formula with full recipe details in the Formula
              page after conversion.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConvert}>
            Convert to Production
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};