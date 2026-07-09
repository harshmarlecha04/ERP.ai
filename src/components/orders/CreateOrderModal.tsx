import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useOrderHeaders, OrderLineItem } from '@/hooks/useOrderHeaders';
import { useCustomers } from '@/hooks/useCustomers';
import { useFormulas } from '@/hooks/useFormulas';
import { useMaterialCheck } from '@/hooks/useMaterialCheck';
import { useOrderMilestones } from '@/hooks/useOrderMilestones';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, X, AlertCircle, CheckCircle2, ChevronLeft, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { MilestoneAssignment, LineItemMilestones } from './MilestoneAssignment';
import { supabase } from '@/integrations/supabase/client';
import { formatET } from "@/utils/dateUtils";

interface CreateOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ProductLine = Omit<OrderLineItem, 'id' | 'order_id' | 'bottles_shipped' | 'bottles_remaining' | 'created_at' | 'updated_at' | 'formula_name' | 'formula_code'> & {
  materialStatus?: 'available' | 'partial' | 'unavailable';
  materialDetails?: string;
};

export const CreateOrderModal = ({ open, onOpenChange }: CreateOrderModalProps) => {
  const { createOrderWithLines } = useOrderHeaders();
  const { customers } = useCustomers();
  const { formulas } = useFormulas();

  const [step, setStep] = useState<'header' | 'products' | 'milestones'>('header');
  
  // Header fields
  const [orderNumber, setOrderNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [receivedVia, setReceivedVia] = useState<string>('direct_from_customer');
  const [receivedFromEmail, setReceivedFromEmail] = useState('');
  const [receivedDate, setReceivedDate] = useState<Date>(new Date());

  // Product lines
  const [productLines, setProductLines] = useState<ProductLine[]>([{
    line_number: '1',
    formula_id: '',
    order_type: 'production',
    bottle_size: 90,
    bottles_ordered: 0,
    production_status: 'pending',
    scheduled_production_date: null,
    suggested_start_date: null,
    notes: null,
  }]);

  // Milestones
  const [milestonesByLine, setMilestonesByLine] = useState<LineItemMilestones[]>([]);

  const handleAddProductLine = () => {
    setProductLines([...productLines, {
      line_number: (productLines.length + 1).toString(),
      formula_id: '',
      order_type: 'production',
      bottle_size: 90,
      bottles_ordered: 0,
      production_status: 'pending',
      scheduled_production_date: null,
      suggested_start_date: null,
      notes: null,
    }]);
  };

  const handleRemoveProductLine = (index: number) => {
    setProductLines(productLines.filter((_, i) => i !== index));
  };

  const handleProductLineChange = async (index: number, field: keyof ProductLine, value: any) => {
    const updated = [...productLines];
    updated[index] = { ...updated[index], [field]: value };
    setProductLines(updated);
  };

  const handleNext = () => {
    if (step === 'header') {
      setStep('products');
    } else if (step === 'products') {
      setStep('milestones');
    }
  };

  const handleBack = () => {
    if (step === 'milestones') {
      setStep('products');
    } else if (step === 'products') {
      setStep('header');
    }
  };

  const handleSubmit = async () => {
    if (!orderNumber || !customerId || productLines.length === 0) {
      return;
    }

    // Validate all product lines have required fields
    const invalidLines = productLines.filter(line => !line.formula_id || !line.bottles_ordered || !line.line_number);
    if (invalidLines.length > 0) {
      return;
    }

    try {
      // Calculate due_date from latest milestone or set to null
      let calculatedDueDate = null;
      if (milestonesByLine.length > 0) {
        const allDates = milestonesByLine.flatMap(line => 
          line.milestones.map(m => new Date(m.target_date))
        );
        if (allDates.length > 0) {
          calculatedDueDate = formatET(new Date(Math.max(...allDates.map(d => d.getTime()))), 'yyyy-MM-dd');
        }
      }

      // Create order with line items
      const result = await createOrderWithLines.mutateAsync({
        header: {
          order_number: orderNumber,
          po_number: orderNumber,
          customer_id: customerId,
          due_date: calculatedDueDate,
          status: 'pending',
          priority: 'normal',
          notes: notes || null,
          special_instructions: null,
          created_by: null,
          received_via: receivedVia,
          received_from_email: receivedFromEmail || null,
          received_date: receivedDate.toISOString(),
        },
        lineItems: productLines.map(line => ({
          line_number: line.line_number,
          formula_id: line.formula_id,
          order_type: line.order_type,
          bottle_size: line.bottle_size,
          bottles_ordered: line.bottles_ordered,
          production_status: line.production_status,
          scheduled_production_date: line.scheduled_production_date,
          suggested_start_date: line.suggested_start_date,
          notes: line.notes,
        })),
      });

      // If milestones exist, create them
      if (milestonesByLine.length > 0 && result) {
        // Fetch the created line items to get their IDs
        const { data: createdLineItems } = await supabase
          .from('order_line_items')
          .select('id, line_number')
          .eq('order_id', result.id)
          .order('line_number');

        if (createdLineItems) {
          // Create all milestones
          const milestonesToCreate = milestonesByLine.flatMap(lineEntry => {
            const lineItem = createdLineItems.find((_, idx) => idx === lineEntry.lineItemIndex);
            if (!lineItem) return [];

            return lineEntry.milestones.map((milestone, idx) => ({
              order_id: result.id,
              line_item_id: lineItem.id,
              milestone_number: idx + 1,
              target_bottles: milestone.target_bottles,
              target_date: milestone.target_date,
              shipped_bottles: 0,
              notes: milestone.notes || null,
            }));
          });

          if (milestonesToCreate.length > 0) {
            await supabase
              .from('order_delivery_milestones')
              .insert(milestonesToCreate);
          }
        }
      }

      // Fire-and-forget: send PO_CREATED email
      if (result?.id) {
        supabase.functions.invoke('send-order-email', {
          body: { order_id: result.id, event_type: 'PO_CREATED' },
        }).catch(() => {});
      }

      // Reset form
      setStep('header');
      setOrderNumber('');
      setCustomerId('');
      setNotes('');
      setReceivedVia('direct_from_customer');
      setReceivedFromEmail('');
      setReceivedDate(new Date());
      setProductLines([{
        line_number: '1',
        formula_id: '',
        order_type: 'production',
        bottle_size: 90,
        bottles_ordered: 0,
        production_status: 'pending',
        scheduled_production_date: null,
        suggested_start_date: null,
        notes: null,
      }]);
      setMilestonesByLine([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const totalBottles = productLines.reduce((sum, line) => sum + (line.bottles_ordered || 0), 0);
  const allValid = productLines.every(line => line.formula_id && line.bottles_ordered > 0 && line.line_number);
  
  // Enrich product lines with formula info for milestone step
  const enrichedProductLines = productLines.map(line => {
    const formula = formulas.find(f => f.id === line.formula_id);
    return {
      ...line,
      formula_code: formula?.code,
      formula_name: formula?.name,
    };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:48rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {step === 'header' && 'Create New Order'}
            {step === 'products' && `Order ${orderNumber} - Add Products`}
            {step === 'milestones' && `Order ${orderNumber} - Delivery Milestones`}
          </DialogTitle>
        </DialogHeader>

        {step === 'header' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orderNumber">Order Number *</Label>
              <Input
                id="orderNumber"
                placeholder="e.g., 24129, PO-2024-A"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                Enter a unique order number (letters and numbers allowed)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>PO Received Via</Label>
              <Select value={receivedVia} onValueChange={setReceivedVia}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct_from_customer">Direct from Customer</SelectItem>
                  <SelectItem value="forwarded_by_boss">Forwarded by Boss</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receivedFromEmail">Received From Email (optional)</Label>
              <Input
                id="receivedFromEmail"
                type="email"
                placeholder="e.g., john@customer.com"
                value={receivedFromEmail}
                onChange={(e) => setReceivedFromEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>PO Received Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !receivedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {receivedDate ? format(receivedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={receivedDate}
                    onSelect={(d) => d && setReceivedDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={handleNext}
                disabled={!orderNumber || !customerId}
              >
                Next: Add Products →
              </Button>
            </div>
          </div>
        ) : step === 'products' ? (
          <div className="space-y-4">
            {productLines.map((line, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Line #{index + 1}</Label>
                    {productLines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProductLine(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Line Number *</Label>
                      <Input
                        placeholder="e.g., 1, 1a, 2"
                        value={line.line_number}
                        onChange={(e) => handleProductLineChange(index, 'line_number', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Formula *</Label>
                      <Select 
                        value={line.formula_id} 
                        onValueChange={(value) => handleProductLineChange(index, 'formula_id', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select formula" />
                        </SelectTrigger>
                        <SelectContent>
                          {formulas.map((formula) => (
                            <SelectItem key={formula.id} value={formula.id}>
                              {formula.name} ({formula.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Bottle Size *</Label>
                      <Select 
                        value={line.bottle_size.toString()} 
                        onValueChange={(value) => handleProductLineChange(index, 'bottle_size', parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="60">60 ct</SelectItem>
                          <SelectItem value="90">90 ct</SelectItem>
                          <SelectItem value="120">120 ct</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>Quantity (bottles) *</Label>
                      <Input
                        type="number"
                        placeholder="Enter bottle quantity"
                        value={line.bottles_ordered || ''}
                        onChange={(e) => handleProductLineChange(index, 'bottles_ordered', parseInt(e.target.value) || 0)}
                        min="1"
                        required
                      />
                    </div>
                  </div>

                  {line.materialStatus && (
                    <Alert className={line.materialStatus === 'available' ? 'border-success' : 'border-warning'}>
                      {line.materialStatus === 'available' ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-warning" />
                      )}
                      <AlertDescription>
                        <div className="flex flex-col gap-1">
                          <span>{line.materialDetails}</span>
                          {line.suggested_start_date && (
                            <span className="text-sm">
                              Suggested production: {formatET(line.suggested_start_date, 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </Card>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={handleAddProductLine}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Product
            </Button>

            {productLines.length > 0 && (
              <Card className="p-4 bg-muted/50">
                <div className="space-y-2">
                  <h3 className="font-semibold">Order Summary</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Total Products:</div>
                    <div className="font-medium">{productLines.length}</div>
                    <div>Total Bottles:</div>
                    <div className="font-medium">{totalBottles.toLocaleString()}</div>
                    <div>Material Status:</div>
                    <div>
                      {productLines.every(l => l.materialStatus === 'available') && (
                        <Badge variant="default">All Available</Badge>
                      )}
                      {productLines.some(l => l.materialStatus === 'partial' || l.materialStatus === 'unavailable') && (
                        <Badge variant="secondary">Partial Availability</Badge>
                      )}
                      {!productLines.some(l => l.materialStatus) && (
                        <Badge variant="outline">Not Checked</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={!allValid}
              >
                Next: Delivery Milestones (Optional) →
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <MilestoneAssignment
              productLines={enrichedProductLines}
              milestonesByLine={milestonesByLine}
              onMilestonesChange={setMilestonesByLine}
            />

            <div className="space-y-2 mt-4">
              <Label htmlFor="orderNotes">Order Notes</Label>
              <Textarea
                id="orderNotes"
                placeholder="Optional notes for this order"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="p-4 bg-muted/50 rounded-md">
              <p className="text-sm text-muted-foreground">
                💡 <strong>Tip:</strong> Milestones are optional. You can add or edit them later from the order detail page.
                They're useful for tracking partial shipments and staggered deliveries.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={createOrderWithLines.isPending}
              >
                {createOrderWithLines.isPending ? 'Creating...' : 'Create Order'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};