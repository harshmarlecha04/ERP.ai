import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatET } from "@/utils/dateUtils";


interface CompleteBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  batchInfo: {
    formulaCode: string;
    formulaName: string;
    batches: number;
    scheduleDate: string;
  } | null;
}

export const CompleteBatchModal: React.FC<CompleteBatchModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  batchInfo
}) => {
  if (!batchInfo) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Complete this batch?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <div>
              This will deduct ingredients from inventory and finalize this production. Continue?
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="text-sm">
                <strong>Formula:</strong> {batchInfo.formulaCode} - {batchInfo.formulaName}
              </div>
              <div className="text-sm">
                <strong>Batches:</strong> {batchInfo.batches}
              </div>
              <div className="text-sm">
                <strong>Scheduled Date:</strong> {formatET(batchInfo.scheduleDate, "M/d/yyyy")}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Yes, Complete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};