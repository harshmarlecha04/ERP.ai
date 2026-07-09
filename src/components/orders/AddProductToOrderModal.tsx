import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFormulas } from '@/hooks/useFormulas';
import { useOrderHeaders } from '@/hooks/useOrderHeaders';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface AddProductToOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  nextLineNumber: string;
  onSuccess?: () => void;
}

export const AddProductToOrderModal = ({ 
  open, 
  onOpenChange, 
  orderId,
  nextLineNumber,
  onSuccess
}: AddProductToOrderModalProps) => {
  const { formulas } = useFormulas();
  const { addLineItemsToOrder } = useOrderHeaders();

  const [lineItems, setLineItems] = useState([{
    line_number: nextLineNumber,
    formula_id: '',
    bottle_size: 90 as 60 | 70 | 90 | 120,
    bottles_ordered: 0,
    production_status: 'pending',
    scheduled_production_date: null,
    suggested_start_date: null,
    notes: null,
    order_type: 'production' as const
  }]);

  const addLine = () => {
    const currentMaxLine = Math.max(...lineItems.map(l => parseInt(l.line_number)));
    setLineItems([...lineItems, {
      line_number: String(currentMaxLine + 1).padStart(3, '0'),
      formula_id: '',
      bottle_size: 90 as 60 | 70 | 90 | 120,
      bottles_ordered: 0,
      production_status: 'pending',
      scheduled_production_date: null,
      suggested_start_date: null,
      notes: null,
      order_type: 'production' as const
    }]);
  };

  const removeLine = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSubmit = async () => {
    const validLines = lineItems.filter(l => l.formula_id && l.bottles_ordered > 0);
    
    if (validLines.length === 0) {
      toast.error('Please add at least one product with formula and quantity');
      return;
    }

    await addLineItemsToOrder.mutateAsync({
      orderId,
      lineItems: validLines
    });

    onSuccess?.();

    // Reset and close
    setLineItems([{
      line_number: nextLineNumber,
      formula_id: '',
      bottle_size: 90,
      bottles_ordered: 0,
      production_status: 'pending',
      scheduled_production_date: null,
      suggested_start_date: null,
      notes: null,
      order_type: 'production'
    }]);
    onOpenChange(false);
  };

  const isValid = lineItems.some(l => l.formula_id && l.bottles_ordered > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:48rem] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Products to Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {lineItems.map((item, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Line {item.line_number}</h4>
                {lineItems.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Formula *</Label>
                  <Select
                    value={item.formula_id}
                    onValueChange={(value) => updateLineItem(index, 'formula_id', value)}
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

                <div className="space-y-2">
                  <Label>Bottle Size *</Label>
                  <Select
                    value={item.bottle_size.toString()}
                    onValueChange={(value) => updateLineItem(index, 'bottle_size', parseInt(value))}
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
                  <Label>Bottles Ordered *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.bottles_ordered || ''}
                    onChange={(e) => updateLineItem(index, 'bottles_ordered', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={addLine}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Product
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || addLineItemsToOrder.isPending}
          >
            {addLineItemsToOrder.isPending ? 'Adding...' : 'Add Products'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
