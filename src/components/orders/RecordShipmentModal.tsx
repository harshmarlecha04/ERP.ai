import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOrderShipments } from '@/hooks/useOrderShipments';
import { useOrderMilestones } from '@/hooks/useOrderMilestones';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface LineItemForShipment {
  id: string;
  line_number: string;
  formula_code: string;
  formula_name: string;
  bottles_ordered: number;
  bottles_shipped: number;
  bottles_remaining: number;
}

interface RecordShipmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  lineItems: LineItemForShipment[];
  // Legacy props for backwards compat
  lineItemId?: string;
  bottlesOrdered?: number;
  bottlesShipped?: number;
}

export const RecordShipmentModal = ({
  open,
  onOpenChange,
  orderId,
  lineItems,
}: RecordShipmentModalProps) => {
  const { applyShipmentToMilestones } = useOrderMilestones(orderId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [date, setDate] = useState<Date>(new Date());
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Per-line quantities
  const [lineQuantities, setLineQuantities] = useState<Record<string, string>>({});

  const getQty = (lineId: string) => parseInt(lineQuantities[lineId] || '0') || 0;
  const totalShipping = lineItems.reduce((sum, li) => sum + getQty(li.id), 0);

  const hasOverShip = lineItems.some(li => {
    const qty = getQty(li.id);
    return qty > li.bottles_remaining;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalShipping <= 0 || hasOverShip) return;

    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      // 1. Create order-level shipment
      const { data: shipment, error: shipError } = await supabase
        .from('order_shipments')
        .insert({
          order_id: orderId,
          line_item_id: lineItems[0]?.id || null, // backwards compat
          shipped_quantity: totalShipping,
          shipment_date: format(date, 'yyyy-MM-dd'),
          tracking_number: tracking || null,
          carrier: carrier || null,
          notes: notes || null,
          shipped_by: userData?.user?.id || null,
        })
        .select()
        .single();

      if (shipError) throw shipError;

      // 2. Create shipment lines for each line item with qty > 0
      const shipmentLines = lineItems
        .filter(li => getQty(li.id) > 0)
        .map(li => ({
          shipment_id: shipment.id,
          order_line_id: li.id,
          qty_shipped: getQty(li.id),
          acceptance_status: 'PENDING',
        }));

      if (shipmentLines.length > 0) {
        const { error: linesError } = await supabase
          .from('order_shipment_lines')
          .insert(shipmentLines);

        if (linesError) throw linesError;
      }

      // 3. Update qty_shipped_total on each line item
      for (const li of lineItems) {
        const qty = getQty(li.id);
        if (qty > 0) {
          await supabase
            .from('order_line_items')
            .update({
              qty_shipped_total: li.bottles_shipped + qty,
            } as any)
            .eq('id', li.id);
        }
      }

      // 4. Apply shipment to milestones
      await applyShipmentToMilestones.mutateAsync({
        orderId,
        quantity: totalShipping,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['order-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['order-headers'] });
      queryClient.invalidateQueries({ queryKey: ['order-fulfillment-lines'] });
      queryClient.invalidateQueries({ queryKey: ['shipment-lines'] });

      toast({ title: 'Shipment recorded successfully' });

      // Reset
      setLineQuantities({});
      setTracking('');
      setCarrier('');
      setNotes('');
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Failed to record shipment',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:40rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Record Shipment
          </DialogTitle>
          <DialogDescription>
            Enter quantities shipped per product line.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Per-line quantities */}
          <div className="space-y-2">
            <Label>Quantities per Line</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Formula</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Qty to Ship</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((li) => {
                  const qty = getQty(li.id);
                  const isOver = qty > li.bottles_remaining;
                  return (
                    <TableRow key={li.id}>
                      <TableCell className="font-medium">{li.line_number}</TableCell>
                      <TableCell>
                        <span className="text-sm">{li.formula_code}</span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {li.bottles_remaining.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className={cn("w-24 ml-auto", isOver && "border-destructive")}
                          value={lineQuantities[li.id] || ''}
                          onChange={(e) =>
                            setLineQuantities(prev => ({ ...prev, [li.id]: e.target.value }))
                          }
                          min="0"
                          max={li.bottles_remaining}
                          placeholder="0"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {totalShipping > 0 && (
              <p className="text-sm text-muted-foreground text-right">
                Total shipping: <span className="font-semibold">{totalShipping.toLocaleString()}</span> bottles
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Shipment Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger>
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="FedEx">FedEx</SelectItem>
                  <SelectItem value="USPS">USPS</SelectItem>
                  <SelectItem value="DHL">DHL</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tracking Number</Label>
              <Input
                placeholder="Enter tracking number"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Additional notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || totalShipping <= 0 || hasOverShip}
            >
              {isSubmitting ? 'Recording...' : 'Record Shipment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
