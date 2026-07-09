import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useOrderHeaders } from '@/hooks/useOrderHeaders';

interface CloseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    po_number: string;
    total_bottles_ordered: number;
    total_bottles_shipped: number;
  } | null;
  onSuccess?: () => void;
}

export function CloseOrderDialog({ open, onOpenChange, order, onSuccess }: CloseOrderDialogProps) {
  const { updateOrderHeader } = useOrderHeaders();
  const [closeReason, setCloseReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  if (!order) return null;

  const totalOrdered = order.total_bottles_ordered || 0;
  const totalShipped = order.total_bottles_shipped || 0;
  const fulfillmentPercent = totalOrdered > 0 ? Math.round((totalShipped / totalOrdered) * 100) : 0;
  const isPartialFulfillment = fulfillmentPercent < 100;
  const remainingBottles = totalOrdered - totalShipped;

  const handleClose = async () => {
    const notes = closeReason 
      ? `Order closed. Reason: ${closeReason}` 
      : isPartialFulfillment 
        ? `Order closed with ${fulfillmentPercent}% fulfillment (${remainingBottles.toLocaleString()} bottles not shipped)`
        : 'Order completed - fully shipped';

    await updateOrderHeader.mutateAsync({
      orderId: order.id,
      updates: {
        header_status: 'closed',
        notes: notes,
      },
    });

    setCloseReason('');
    setConfirmed(false);
    onSuccess?.();
    onOpenChange(false);
  };

  const canClose = !isPartialFulfillment || confirmed;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isPartialFulfillment ? (
              <>
                <AlertTriangle className="h-5 w-5 text-warning" />
                Close Partial Order?
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-success" />
                Complete Order?
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {isPartialFulfillment ? (
                <>
                  <p>This order is <strong>{fulfillmentPercent}%</strong> fulfilled.</p>
                  <Alert variant="destructive">
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>{totalShipped.toLocaleString()} of {totalOrdered.toLocaleString()} bottles shipped</li>
                        <li><strong>{remainingBottles.toLocaleString()} bottles</strong> will NOT be shipped</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <p>
                  All items have been shipped!<br />
                  <strong>{totalShipped.toLocaleString()} / {totalOrdered.toLocaleString()}</strong> bottles shipped (100%)
                </p>
              )}

              {isPartialFulfillment && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="close-reason">Reason for partial close (optional)</Label>
                    <Textarea
                      id="close-reason"
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                      placeholder="e.g., Customer cancelled remaining items..."
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="confirm-partial"
                      checked={confirmed}
                      onCheckedChange={(checked) => setConfirmed(checked === true)}
                    />
                    <Label htmlFor="confirm-partial" className="text-sm font-normal cursor-pointer">
                      I confirm that remaining items will not be fulfilled
                    </Label>
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => {
            setCloseReason('');
            setConfirmed(false);
          }}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleClose}
            disabled={!canClose || updateOrderHeader.isPending}
            className={isPartialFulfillment ? 'bg-warning hover:bg-warning/90' : ''}
          >
            {isPartialFulfillment ? 'Close Order' : 'Mark Complete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
