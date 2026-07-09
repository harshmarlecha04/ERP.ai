import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CalendarIcon, Plus, Loader2, CheckCircle2, AlertTriangle, XCircle, Rocket } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCustomers } from '@/hooks/useCustomers';
import { useFormulas } from '@/hooks/useFormulas';
import { useOrderHeaders } from '@/hooks/useOrderHeaders';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AddCustomerModal } from './AddCustomerModal';
import { ProductionDateSuggestion } from './ProductionDateSuggestion';
import { useMaterialCheck } from '@/hooks/useMaterialCheck';
import { calculateBatchesNeeded, calculateTotalGummies, formatScheduleForDatabase, type ProductionSchedule } from '@/hooks/useSmartScheduling';

interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editOrder?: any;
}

export const NewOrderModal = ({ open, onOpenChange, editOrder }: NewOrderModalProps) => {
  const { customers } = useCustomers();
  const { formulas } = useFormulas();
  const { createOrderWithLines } = useOrderHeaders();
  const { toast } = useToast();
  
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [formulaId, setFormulaId] = useState('');
  const [orderType, setOrderType] = useState<'production' | 'rd_sample' | 'rd_development'>('production');
  const [bottleSize, setBottleSize] = useState<60 | 90 | 120>(60);
  const [bottlesOrdered, setBottlesOrdered] = useState('');
  const [dueDate, setDueDate] = useState<Date>();
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [notes, setNotes] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  
  const [calculations, setCalculations] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [productionSchedule, setProductionSchedule] = useState<ProductionSchedule | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  // Calculate batches needed for material check
  const totalGummies = bottlesOrdered ? calculateTotalGummies(parseInt(bottlesOrdered), bottleSize) : 0;
  const batchesNeeded = bottlesOrdered ? calculateBatchesNeeded(totalGummies) : 0;

  // Material availability check
  const { status: materialStatus, result: materialResult, isChecking: isCheckingMaterials, canMakeBatches } = useMaterialCheck(formulaId, batchesNeeded);

  useEffect(() => {
    if (editOrder) {
      setCustomerId(editOrder.customer_id);
      setFormulaId(editOrder.formula_id);
      setOrderType(editOrder.order_type);
      setBottleSize(editOrder.bottle_size);
      setBottlesOrdered(editOrder.bottles_ordered.toString());
      setDueDate(new Date(editOrder.due_date));
      setPriority(editOrder.priority);
      setNotes(editOrder.notes || '');
      setSpecialInstructions(editOrder.special_instructions || '');
    }
  }, [editOrder]);

  useEffect(() => {
    if (formulaId && bottlesOrdered && parseInt(bottlesOrdered) > 0) {
      calculateBatches();
    } else {
      setCalculations(null);
    }
  }, [formulaId, bottlesOrdered, bottleSize]);

  const calculateBatches = async () => {
    setIsCalculating(true);
    try {
      const { data, error } = await supabase.rpc('calculate_batches_needed', {
        p_formula_id: formulaId,
        p_bottles_ordered: parseInt(bottlesOrdered),
        p_bottle_size: bottleSize
      });

      if (error) throw error;
      setCalculations(data);
    } catch (error: any) {
      toast({
        title: 'Calculation failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = async () => {
    if (!customerId || !formulaId || !bottlesOrdered || !dueDate) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    // Note: This modal is deprecated - use CreateOrderModal instead
    // This is a simplified legacy modal that creates single-product orders
    toast({
      title: 'Please use the new order modal',
      description: 'This modal is deprecated. Use the "New Order" button instead.',
      variant: 'destructive'
    });
    onOpenChange(false);
  };

  const handleScheduleProduction = async (orderId: string) => {
    if (!productionSchedule) return;

    setIsScheduling(true);
    try {
      const dailyAllocation = formatScheduleForDatabase(productionSchedule);
      
      const { data, error } = await supabase.rpc('schedule_production_for_order', {
        p_order_id: orderId,
        p_start_date: format(productionSchedule.startDate, 'yyyy-MM-dd'),
        p_daily_batch_allocation: dailyAllocation,
        p_reserve_materials: false, // Materials will be reserved separately
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; total_batches_scheduled?: number };

      if (result.success) {
        toast({
          title: 'Production Scheduled!',
          description: `${result.total_batches_scheduled} batches scheduled. You can reserve materials from the Order Detail page.`,
        });
      } else {
        throw new Error(result.error || 'Failed to schedule production');
      }
    } catch (error: any) {
      console.error('Scheduling error:', error);
      toast({
        title: 'Failed to schedule production',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsScheduling(false);
    }
  };

  const resetForm = () => {
    setCustomerId('');
    setFormulaId('');
    setOrderType('production');
    setBottleSize(60);
    setBottlesOrdered('');
    setDueDate(undefined);
    setPriority('normal');
    setNotes('');
    setSpecialInstructions('');
    setCalculations(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="[--dialog-max-width:42rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editOrder ? 'Edit Order' : 'New Customer Order'}</DialogTitle>
            <DialogDescription>
              {editOrder ? 'Update order details' : 'Create a new production or R&D order'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label>Customer *</Label>
              <div className="flex gap-2">
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.company_name} ({customer.company_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAddCustomer(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Order Type */}
            <div className="space-y-2">
              <Label>Order Type *</Label>
              <RadioGroup value={orderType} onValueChange={(value: any) => setOrderType(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="production" id="production" />
                  <Label htmlFor="production" className="font-normal cursor-pointer">
                    Production Order
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="rd_sample" id="rd_sample" />
                  <Label htmlFor="rd_sample" className="font-normal cursor-pointer">
                    R&D Sample
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="rd_development" id="rd_development" />
                  <Label htmlFor="rd_development" className="font-normal cursor-pointer">
                    R&D Development
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Formula Selection */}
            <div className="space-y-2">
              <Label>Product/Formula *</Label>
              <Select value={formulaId} onValueChange={setFormulaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select formula" />
                </SelectTrigger>
                <SelectContent>
                  {formulas.map((formula) => (
                    <SelectItem key={formula.id} value={formula.id}>
                      {formula.code} - {formula.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bottle Size */}
            <div className="space-y-2">
              <Label>Bottle Size *</Label>
              <RadioGroup value={bottleSize.toString()} onValueChange={(value) => setBottleSize(parseInt(value) as 60 | 90 | 120)}>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="60" id="size-60" />
                    <Label htmlFor="size-60" className="font-normal cursor-pointer">
                      60 count
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="90" id="size-90" />
                    <Label htmlFor="size-90" className="font-normal cursor-pointer">
                      90 count
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="120" id="size-120" />
                    <Label htmlFor="size-120" className="font-normal cursor-pointer">
                      120 count
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Bottles Ordered */}
            <div className="space-y-2">
              <Label>Bottles Ordered *</Label>
              <Input
                type="number"
                min="1"
                value={bottlesOrdered}
                onChange={(e) => setBottlesOrdered(e.target.value)}
                placeholder="e.g., 25000"
              />
            </div>

            {/* Material Availability Status */}
            {formulaId && bottlesOrdered && parseInt(bottlesOrdered) > 0 && (
              <div className="space-y-3">
                {isCheckingMaterials && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Checking material availability...</span>
                  </div>
                )}

                {materialStatus === 'sufficient' && (
                  <Alert className="border-green-600 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-900">Materials Available</AlertTitle>
                    <AlertDescription className="text-green-800">
                      Sufficient materials for {batchesNeeded} batches ({totalGummies.toLocaleString()} gummies)
                    </AlertDescription>
                  </Alert>
                )}

                {materialStatus === 'partial' && materialResult && (
                  <Alert variant="destructive" className="border-yellow-600 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-900">Partial Materials</AlertTitle>
                    <AlertDescription className="text-yellow-800">
                      Can make {canMakeBatches} batches, need {batchesNeeded - canMakeBatches} more batches worth of materials.
                      {materialResult.limiting_ingredient && (
                        <p className="mt-1 text-sm">
                          Limited by: <strong>{materialResult.limiting_ingredient.ingredient_name}</strong>
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {materialStatus === 'insufficient' && materialResult && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Insufficient Materials</AlertTitle>
                    <AlertDescription>
                      Missing materials for this order. 
                      {materialResult.limiting_ingredient && (
                        <p className="mt-1 text-sm">
                          Critical shortage: <strong>{materialResult.limiting_ingredient.ingredient_name}</strong>
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Production Schedule Suggestion */}
            {dueDate && bottlesOrdered && parseInt(bottlesOrdered) > 0 && (
              <ProductionDateSuggestion
                targetDate={dueDate}
                bottlesOrdered={parseInt(bottlesOrdered)}
                bottleSize={bottleSize}
                onScheduleCalculated={setProductionSchedule}
              />
            )}

            {/* Due Date */}
            <div className="space-y-2">
              <Label>Due Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Special Instructions (for R&D) */}
            {orderType !== 'production' && (
              <div className="space-y-2">
                <Label>Special Instructions</Label>
                <Textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any special requirements for this R&D order..."
                  rows={3}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!customerId || !formulaId || !bottlesOrdered || !dueDate}
              className="w-full"
            >
              This modal is deprecated - use Create Order instead
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddCustomerModal
        open={showAddCustomer}
        onOpenChange={setShowAddCustomer}
        onSuccess={(customer) => {
          setCustomerId(customer.id);
          setShowAddCustomer(false);
        }}
      />
    </>
  );
};
