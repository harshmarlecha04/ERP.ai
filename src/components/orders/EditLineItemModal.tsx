import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFormulas } from '@/hooks/useFormulas';
import { useOrderLineItems, OrderLineItem } from '@/hooks/useOrderLineItems';
import { usePackagingBalances } from '@/hooks/usePackagingInventory';
import { useLabelInventory } from '@/hooks/useLabelInventory';
import { Package, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EditLineItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItem: OrderLineItem | null;
  onSuccess?: () => void;
}

export const EditLineItemModal = ({ open, onOpenChange, lineItem, onSuccess }: EditLineItemModalProps) => {
  const { formulas } = useFormulas();
  const { updateLineItem } = useOrderLineItems();

  const [formulaId, setFormulaId] = useState('');
  const [bottleSize, setBottleSize] = useState<60 | 70 | 90 | 120>(90);
  const [bottlesOrdered, setBottlesOrdered] = useState(0);
  const [batchesRequired, setBatchesRequired] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedBottleId, setSelectedBottleId] = useState<string>('none');
  const [selectedCapId, setSelectedCapId] = useState<string>('none');
  const [selectedLabelId, setSelectedLabelId] = useState<string>('none');

  // Fetch packaging data based on bottle size
  const { data: packagingBalances = [] } = usePackagingBalances({
    category: ['BOTTLES', 'CAPS'],
  });

  // Get selected formula's customer ID for label filtering
  const selectedFormula = formulas.find(f => f.id === formulaId);
  const { data: labelInventory = [] } = useLabelInventory({
    customer_id: selectedFormula?.customer_id || undefined,
  });

  // Filter bottles and caps by category only (show all available)
  const availableBottles = useMemo(() => {
    return packagingBalances.filter(item => item.category === 'BOTTLES');
  }, [packagingBalances]);

  const availableCaps = useMemo(() => {
    return packagingBalances.filter(item => item.category === 'CAPS');
  }, [packagingBalances]);

  const availableLabels = useMemo(() => {
    return labelInventory.filter(label => (label.on_hand || 0) > 0);
  }, [labelInventory]);

  useEffect(() => {
    if (lineItem && open) {
      setFormulaId(lineItem.formula_id);
      setBottleSize(lineItem.bottle_size);
      setBottlesOrdered(lineItem.bottles_ordered);
      setBatchesRequired(lineItem.batches_required || null);
      setNotes(lineItem.notes || '');
      setSelectedBottleId(lineItem.selected_bottle_id || 'none');
      setSelectedCapId(lineItem.selected_cap_id || 'none');
      setSelectedLabelId(lineItem.selected_label_id || 'none');
    }
  }, [lineItem, open]);

  const handleSubmit = async () => {
    if (!lineItem) return;

    await updateLineItem.mutateAsync({
      lineItemId: lineItem.id,
      updates: {
        formula_id: formulaId,
        bottle_size: bottleSize,
        bottles_ordered: bottlesOrdered,
        batches_required: batchesRequired,
        notes: notes || null,
        selected_bottle_id: selectedBottleId === 'none' ? null : selectedBottleId,
        selected_cap_id: selectedCapId === 'none' ? null : selectedCapId,
        selected_label_id: selectedLabelId === 'none' ? null : selectedLabelId,
      },
    });

    onSuccess?.();
    onOpenChange(false);
  };

  const canReduceQuantity = !lineItem || bottlesOrdered >= lineItem.bottles_shipped;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Edit Product Line
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {lineItem && lineItem.bottles_shipped > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {lineItem.bottles_shipped.toLocaleString()} bottles have already been shipped. 
                You cannot reduce quantity below this amount.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="formula">Formula *</Label>
            <Select value={formulaId} onValueChange={setFormulaId}>
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
            <Label htmlFor="bottleSize">Bottle Size *</Label>
            <Select
              value={bottleSize.toString()}
              onValueChange={(value) => setBottleSize(parseInt(value) as 60 | 70 | 90 | 120)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="60">60 ct</SelectItem>
                <SelectItem value="70">70 ct</SelectItem>
                <SelectItem value="90">90 ct</SelectItem>
                <SelectItem value="120">120 ct</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batches">Number of Batches</Label>
            <Input
              id="batches"
              type="number"
              value={batchesRequired || ''}
              onChange={(e) => setBatchesRequired(e.target.value ? parseInt(e.target.value) : null)}
              min={1}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bottle">Bottle Type</Label>
            <Select value={selectedBottleId} onValueChange={setSelectedBottleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select bottle..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any available</SelectItem>
                {availableBottles.map(bottle => (
                  <SelectItem key={bottle.item_id} value={String(bottle.item_id)}>
                    {bottle.item_name} - {bottle.on_hand.toLocaleString()} on hand
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cap">Cap Type</Label>
            <Select value={selectedCapId} onValueChange={setSelectedCapId}>
              <SelectTrigger>
                <SelectValue placeholder="Select cap..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any available</SelectItem>
                {availableCaps.map(cap => (
                  <SelectItem key={cap.item_id} value={String(cap.item_id)}>
                    {cap.item_name} - {cap.on_hand.toLocaleString()} on hand
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Select value={selectedLabelId} onValueChange={setSelectedLabelId}>
              <SelectTrigger>
                <SelectValue placeholder="Any label for this customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any available</SelectItem>
                {availableLabels.map(label => (
                  <SelectItem key={label.id} value={String(label.id)}>
                    {label.customer_product} - {label.on_hand?.toLocaleString() || 0} on hand
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity (bottles) *</Label>
            <Input
              id="quantity"
              type="number"
              value={bottlesOrdered}
              onChange={(e) => setBottlesOrdered(parseInt(e.target.value) || 0)}
              min={lineItem?.bottles_shipped || 0}
              required
            />
            {lineItem && lineItem.bottles_shipped > 0 && (
              <p className="text-xs text-muted-foreground">
                Minimum: {lineItem.bottles_shipped.toLocaleString()} (already shipped)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              rows={2}
            />
          </div>

          {selectedFormula && (
            <div className="p-3 bg-muted rounded-md text-sm space-y-1">
              <p className="font-medium">Selected Formula:</p>
              <p className="text-muted-foreground">
                {selectedFormula.name} ({selectedFormula.code})
              </p>
              {selectedBottleId && selectedBottleId !== 'none' && (
                <p className="text-xs text-muted-foreground">
                  Bottle: {availableBottles.find(b => b.item_id === selectedBottleId)?.item_name}
                </p>
              )}
              {selectedCapId && selectedCapId !== 'none' && (
                <p className="text-xs text-muted-foreground">
                  Cap: {availableCaps.find(c => c.item_id === selectedCapId)?.item_name}
                </p>
              )}
              {selectedLabelId && selectedLabelId !== 'none' && (
                <p className="text-xs text-muted-foreground">
                  Label: {availableLabels.find(l => l.id === selectedLabelId)?.customer_product}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!formulaId || bottlesOrdered <= 0 || !canReduceQuantity || updateLineItem.isPending}
          >
            {updateLineItem.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};