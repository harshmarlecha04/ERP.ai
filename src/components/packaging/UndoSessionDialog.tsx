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
import { format } from "date-fns";
import { UpdateSession } from "@/hooks/useInventoryUpdateSessions";
import { Loader2 } from "lucide-react";
import { formatET } from "@/utils/dateUtils";

interface UndoSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: UpdateSession | null;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const UndoSessionDialog = ({
  open,
  onOpenChange,
  session,
  onConfirm,
  isLoading = false,
}: UndoSessionDialogProps) => {
  return (
    <AlertDialog open={open && session !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {session && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Undo Inventory Update?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  This will permanently delete all inventory updates from this session:
                </p>
                <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
                  <div>
                    <strong>Date:</strong> {formatET(session.session_date, "PPP")}
                  </div>
                  <div>
                    <strong>Items affected:</strong> {session.item_count}
                  </div>
                  <div>
                    <strong>Total quantity:</strong> {session.total_deductions}
                  </div>
                </div>
                {session.items && session.items.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                    <strong>Items:</strong>
                    {session.items.map((item) => (
                      <div key={item.id} className="pl-4">
                        • {item.item_name}: -{item.quantity_deducted}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-destructive font-medium pt-2">
                  This action cannot be undone.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirm}
                disabled={isLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Undoing...
                  </>
                ) : (
                  "Undo Session"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};
