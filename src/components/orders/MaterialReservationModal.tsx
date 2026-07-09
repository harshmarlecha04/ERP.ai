import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, AlertTriangle, CheckCircle2, Package } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface Lot {
  id: string;
  lot_number: string;
  supplier: string;
  quantity: number;
  allocated_qty: number;
  after_deduction: number;
}

interface IngredientReservation {
  ingredient_name: string;
  required_kg: number;
  available_kg: number;
  lots: Lot[];
  shortage_kg?: number;
}

interface MaterialReservationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  scheduleItemIds: string[];
  onSuccess?: () => void;
}

export function MaterialReservationModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  scheduleItemIds,
  onSuccess,
}: MaterialReservationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isReserving, setIsReserving] = useState(false);
  const [reservationPreview, setReservationPreview] = useState<IngredientReservation[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const loadReservationPreview = async () => {
    if (!open || scheduleItemIds.length === 0) return;

    setIsLoadingPreview(true);
    try {
      // Load preview for each schedule item
      const previews: IngredientReservation[] = [];
      
      for (const itemId of scheduleItemIds) {
        const { data, error } = await supabase.rpc('get_formula_ingredients_with_lots', {
          p_formula_id: '', // Will get from schedule item
          p_batches: 1
        });

        if (error) throw error;
        // Transform data to reservation preview format
        // This is a simplified preview - full implementation would query actual schedule items
      }

      setReservationPreview(previews);
    } catch (error: any) {
      toast({
        title: 'Failed to load preview',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmReservation = async () => {
    setIsReserving(true);
    try {
      const reservationDetails: any[] = [];

      // Reserve materials for each schedule item
      for (const itemId of scheduleItemIds) {
        const { data, error } = await supabase.rpc('fn_reserve_materials', {
          p_schedule_item_id: itemId,
        });

        if (error) throw error;
        if (data && (data as any).ok) {
          reservationDetails.push(...((data as any).reservations || []));
        }
      }

      // Log reservation history
      await supabase.from('material_reservations_history').insert({
        order_id: orderId,
        schedule_item_id: scheduleItemIds[0],
        reservation_details: reservationDetails,
        notes: `Materials reserved for order ${orderNumber}`,
      });

      // Update order status
      await supabase
        .from('order_headers')
        .update({ status: 'materials_reserved' })
        .eq('id', orderId);

      toast({
        title: 'Materials Reserved',
        description: `Successfully reserved materials for ${orderNumber}`,
      });

      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Reservation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsReserving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:48rem] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Reserve Materials - {orderNumber}
          </DialogTitle>
          <DialogDescription>
            Review and confirm material reservations for production
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Package className="h-4 w-4" />
            <AlertDescription>
              This will commit inventory for {scheduleItemIds.length} production batch
              {scheduleItemIds.length !== 1 ? 'es' : ''}. Materials will be reserved using FIFO (First-In-First-Out) allocation.
            </AlertDescription>
          </Alert>

          {reservationPreview.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Reservation Details</h3>
              {reservationPreview.map((ingredient, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{ingredient.ingredient_name}</span>
                    <Badge variant={ingredient.shortage_kg ? 'destructive' : 'default'}>
                      {ingredient.shortage_kg ? (
                        <>
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Shortage: {ingredient.shortage_kg.toFixed(2)} kg
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Sufficient
                        </>
                      )}
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Required: {ingredient.required_kg.toFixed(2)} kg | Available: {ingredient.available_kg.toFixed(2)} kg
                  </div>

                  {ingredient.lots.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-sm font-medium">Lots to be reserved:</div>
                      {ingredient.lots.map((lot) => (
                        <div key={lot.id} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded">
                          <div>
                            <span className="font-medium">{lot.lot_number}</span>
                            <span className="text-muted-foreground ml-2">({lot.supplier})</span>
                          </div>
                          <div className="flex gap-4 text-xs">
                            <span>Current: {lot.quantity.toFixed(2)} kg</span>
                            <span className="text-primary">Reserve: {lot.allocated_qty.toFixed(2)} kg</span>
                            <span>After: {lot.after_deduction.toFixed(2)} kg</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isReserving}>
            Cancel
          </Button>
          <Button onClick={handleConfirmReservation} disabled={isReserving || reservationPreview.some(i => i.shortage_kg)}>
            {isReserving ? 'Reserving...' : 'Confirm Reservation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}