import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Plus } from "lucide-react";
import {
  useRDBatchFeedback,
  useDeleteBatch,
  useDeleteFeedback,
} from "@/hooks/useRDProjects";
import { StatusBadge } from "./StatusBadge";
import { AddBatchModal } from "./AddBatchModal";
import { AddFeedbackDialog } from "./AddFeedbackDialog";
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
import { useQueryClient } from "@tanstack/react-query";
import { formatET } from "@/utils/dateUtils";

interface BatchDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string | null;
  projectId: string | null;
}

export const BatchDetailModal = ({
  open,
  onOpenChange,
  batchId,
  projectId,
}: BatchDetailModalProps) => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addFeedbackOpen, setAddFeedbackOpen] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteFeedbackId, setDeleteFeedbackId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: feedbackList = [] } = useRDBatchFeedback(batchId);
  const deleteBatch = useDeleteBatch();
  const deleteFeedback = useDeleteFeedback();

  const batches = queryClient.getQueryData<any[]>(["rd-project-batches", projectId]);
  const batch = batches?.find((b) => b.id === batchId);

  const handleDelete = async () => {
    if (!batchId || !projectId) return;
    await deleteBatch.mutateAsync({ id: batchId, projectId });
    onOpenChange(false);
  };

  const handleDeleteFeedback = async () => {
    if (!deleteFeedbackId || !batchId) return;
    await deleteFeedback.mutateAsync({ id: deleteFeedbackId, batchId });
    setDeleteFeedbackId(null);
  };

  const handleEditFeedback = (feedback: any) => {
    setEditingFeedback(feedback);
    setAddFeedbackOpen(true);
  };

  if (!batch) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="[--dialog-max-width:48rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <DialogTitle className="text-2xl">{batch.batch_number}</DialogTitle>
                <StatusBadge status={batch.status} />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditModalOpen(true)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-1">Batch Date</h3>
                <p className="text-muted-foreground">
                  {formatET(batch.batch_date, "MMM d, yyyy")}
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Quantity Produced</h3>
                <p className="text-muted-foreground">{batch.quantity_produced || "-"}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Sent To</h3>
                <p className="text-muted-foreground">{batch.sent_to || "-"}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Status</h3>
                <StatusBadge status={batch.status} />
              </div>
            </div>

            {batch.notes && (
              <div>
                <h3 className="font-semibold mb-2">Batch Notes</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{batch.notes}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Feedback & Comments</h3>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingFeedback(null);
                    setAddFeedbackOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Feedback
                </Button>
              </div>

              {feedbackList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No feedback yet for this batch
                </div>
              ) : (
                <div className="space-y-4">
                  {feedbackList.map((feedback: any) => (
                    <div
                      key={feedback.id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="whitespace-pre-wrap">{feedback.feedback_text}</p>
                          {feedback.feedback_source && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Source: {feedback.feedback_source}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditFeedback(feedback)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteFeedbackId(feedback.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatET(feedback.created_at, "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddBatchModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        projectId={projectId}
        editingBatch={batch}
      />

      <AddFeedbackDialog
        open={addFeedbackOpen}
        onOpenChange={(open) => {
          setAddFeedbackOpen(open);
          if (!open) setEditingFeedback(null);
        }}
        batchId={batchId}
        editingFeedback={editingFeedback}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {batch.batch_number}? This will also delete
              all feedback associated with this batch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteFeedbackId}
        onOpenChange={(open) => !open && setDeleteFeedbackId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feedback</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this feedback?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFeedback}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};