import React from "react";
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
import { Archive } from "lucide-react";

interface ArchiveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  materialName: string;
  materialCode: string;
  isBulk?: boolean;
}

export function ArchiveConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  materialName,
  materialCode,
  isBulk = false,
}: ArchiveConfirmationModalProps) {
  const [isArchiving, setIsArchiving] = React.useState(false);

  const handleConfirm = async () => {
    setIsArchiving(true);
    try {
      await onConfirm();
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="z-[9999] fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBulk ? "Archive Materials" : "Archive Material"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk 
              ? `Are you sure you want to archive ${materialName}? They will be moved to the archived materials section.`
              : `Are you sure you want to archive "${materialName}" (${materialCode})? It will be moved to the archived materials section.`
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isArchiving}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isArchiving}
            className="bg-orange-600 text-white hover:bg-orange-700"
          >
            {isArchiving ? "Archiving..." : isBulk ? "Archive Materials" : "Archive Material"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}