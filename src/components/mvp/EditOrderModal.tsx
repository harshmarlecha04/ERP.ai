import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CalendarIcon, Loader2, Plus, Pencil, Trash2, Package, Search, Check } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useOrderHeaders } from '@/hooks/useOrderHeaders';
import { useOrderLineItems, OrderLineItem } from '@/hooks/useOrderLineItems';
import { useFormulas } from '@/hooks/useFormulas';
import { usePackagingBalances } from '@/hooks/usePackagingInventory';
import { useLabelInventory } from '@/hooks/useLabelInventory';
import { EditLineItemModal } from '@/components/orders/EditLineItemModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


interface EditOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    po_number: string;
    due_date: string | null;
    priority: string;
    notes: string | null;
    special_instructions?: string | null;
    customer_id: string;
  } | null;
  onSuccess?: () => void;
}

export function EditOrderModal({ open, onOpenChange, order, onSuccess }: EditOrderModalProps) {
  const { updateOrderHeader, addLineItemsToOrder } = useOrderHeaders();
  const { lineItems, isLoading: lineItemsLoading, deleteLineItem } = useOrderLineItems(order?.id);
  const { formulas } = useFormulas();
  
  // Header fields state
  const [poNumber, setPoNumber] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Product management state
  const [selectedLineItem, setSelectedLineItem] = useState<OrderLineItem | null>(null);
  const [showEditLineItem, setShowEditLineItem] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lineItemToDelete, setLineItemToDelete] = useState<OrderLineItem | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Add product form state
  const [newFormulaId, setNewFormulaId] = useState('');
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [newBottleSize, setNewBottleSize] = useState<60 | 70 | 90 | 120>(90);
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [newBatches, setNewBatches] = useState<number | null>(null);
  const [newBottleTypeId, setNewBottleTypeId] = useState<string>('none');
  const [newCapId, setNewCapId] = useState<string>('none');
  const [newLabelId, setNewLabelId] = useState<string>('none');
  const [addingProduct, setAddingProduct] = useState(false);

  // Filter formulas by customer
  const customerFormulas = useMemo(() => {
    if (!order?.customer_id) return formulas;
    return formulas.filter(f => f.customer_id === order.customer_id);
  }, [formulas, order?.customer_id]);

  // Fetch packaging data
  const { data: packagingBalances = [] } = usePackagingBalances({});
  
  // Get selected formula's customer ID for label filtering
  const selectedNewFormula = useMemo(() => {
    return formulas.find(f => f.id === newFormulaId);
  }, [formulas, newFormulaId]);
  
  const { data: labelInventory = [] } = useLabelInventory({
    customer_id: selectedNewFormula?.customer_id || undefined,
  });

  // Filter available packaging
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
    if (order) {
      setPoNumber(order.po_number || '');
      setDueDate(order.due_date ? new Date(order.due_date) : undefined);
      setPriority(order.priority || 'normal');
      setNotes(order.notes || '');
      setSpecialInstructions(order.special_instructions || '');
    }
  }, [order]);

  // Reset add product form
  const resetAddProductForm = () => {
    setNewFormulaId('');
    setNewBottleSize(90);
    setNewQuantity(0);
    setNewBatches(null);
    setNewBottleTypeId('none');
    setNewCapId('none');
    setNewLabelId('none');
    setShowAddProduct(false);
  };

  const handleSave = async () => {
    if (!order) return;

    await updateOrderHeader.mutateAsync({
      orderId: order.id,
      updates: {
        po_number: poNumber,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        priority,
        notes: notes || null,
        special_instructions: specialInstructions || null,
      },
    });

    onSuccess?.();
    onOpenChange(false);
  };

  const handleEditProduct = (lineItem: OrderLineItem) => {
    setSelectedLineItem(lineItem);
    setShowEditLineItem(true);
  };

  const handleDeleteProduct = (lineItem: OrderLineItem) => {
    setLineItemToDelete(lineItem);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteProduct = async () => {
    if (!lineItemToDelete) return;
    
    await deleteLineItem.mutateAsync(lineItemToDelete.id);
    setShowDeleteConfirm(false);
    setLineItemToDelete(null);
  };

  const handleAddProduct = async () => {
    if (!order || !newFormulaId || newQuantity <= 0) return;

    setAddingProduct(true);
    try {
      // Generate next line number
      const nextLineNumber = String(lineItems.length + 1).padStart(2, '0');
      
      await addLineItemsToOrder.mutateAsync({
        orderId: order.id,
        lineItems: [{
          line_number: nextLineNumber,
          formula_id: newFormulaId,
          order_type: 'production',
          bottle_size: newBottleSize,
          bottles_ordered: newQuantity,
          batches_required: newBatches,
          production_status: 'pending',
          scheduled_production_date: null,
          suggested_start_date: null,
          notes: null,
          selected_bottle_id: newBottleTypeId === 'none' ? null : newBottleTypeId,
          selected_cap_id: newCapId === 'none' ? null : newCapId,
          selected_label_id: newLabelId === 'none' ? null : newLabelId,
        }],
      });

      resetAddProductForm();
    } finally {
      setAddingProduct(false);
    }
  };


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[calc(90vh-140px)] pr-4">
            <div className="space-y-6 py-4">
              {/* Order Information Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Order Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="po-number">PO Number</Label>
                      <Input
                        id="po-number"
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                        placeholder="Enter PO number"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Due Date</Label>
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
                            {dueDate ? format(dueDate, 'MMM dd, yyyy') : 'Select date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dueDate}
                            onSelect={setDueDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Products Section */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Products ({lineItems.length})
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddProduct(!showAddProduct)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Product
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Product Form */}
                  {showAddProduct && (
                    <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Formula *</Label>
                          <Popover open={formulaOpen} onOpenChange={setFormulaOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={formulaOpen}
                                className="w-full justify-between overflow-hidden"
                              >
                                <span className="truncate">
                                  {selectedNewFormula
                                    ? `${selectedNewFormula.name} (${selectedNewFormula.code})`
                                    : "Search formula..."}
                                </span>
                                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search formulas..." />
                                <CommandList>
                                  <CommandEmpty>No formula found.</CommandEmpty>
                                  <CommandGroup>
                                    {customerFormulas.map((formula) => (
                                      <CommandItem
                                        key={formula.id}
                                        value={`${formula.name} ${formula.code}`}
                                        onSelect={() => {
                                          setNewFormulaId(formula.id);
                                          setFormulaOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            newFormulaId === formula.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {formula.name} ({formula.code})
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <Label>Bottle Size *</Label>
                          <Select
                            value={newBottleSize.toString()}
                            onValueChange={(v) => setNewBottleSize(parseInt(v) as 60 | 70 | 90 | 120)}
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
                          <Label>Quantity (bottles) *</Label>
                          <Input
                            type="number"
                            value={newQuantity || ''}
                            onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                            placeholder="e.g. 5000"
                            min={1}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Number of Batches</Label>
                          <Input
                            type="number"
                            value={newBatches ?? ''}
                            onChange={(e) => setNewBatches(e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="Optional"
                            min={0.1}
                            step="0.1"
                          />
                        </div>

                        {/* Bottle Type */}
                        <div className="space-y-2">
                          <Label>Bottle Type</Label>
                          <Select value={newBottleTypeId} onValueChange={setNewBottleTypeId}>
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

                        {/* Cap Type */}
                        <div className="space-y-2">
                          <Label>Cap Type</Label>
                          <Select value={newCapId} onValueChange={setNewCapId}>
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

                        {/* Label */}
                        <div className="space-y-2">
                          <Label>Label</Label>
                          <Select value={newLabelId} onValueChange={setNewLabelId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select label..." />
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
                      </div>

                      {selectedNewFormula && (
                        <p className="text-xs text-muted-foreground">
                          Selected: {selectedNewFormula.name} ({selectedNewFormula.code})
                        </p>
                      )}

                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={resetAddProductForm}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAddProduct}
                          disabled={!newFormulaId || newQuantity <= 0 || addingProduct}
                        >
                          {addingProduct ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            'Add to Order'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Products Table */}
                  {lineItemsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : lineItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No products added yet
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Size</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Shipped</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.formula_name}</p>
                                <p className="text-xs text-muted-foreground">{item.formula_code}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{item.bottle_size} ct</TableCell>
                            <TableCell className="text-right">{item.bottles_ordered.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{item.bottles_shipped.toLocaleString()}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditProduct(item)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteProduct(item)}
                                  disabled={item.bottles_shipped > 0}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Notes Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add notes..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="special-instructions">Special Instructions</Label>
                    <Textarea
                      id="special-instructions"
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      placeholder="Add special instructions..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateOrderHeader.isPending}>
              {updateOrderHeader.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Line Item Modal */}
      <EditLineItemModal
        open={showEditLineItem}
        onOpenChange={setShowEditLineItem}
        lineItem={selectedLineItem}
        onSuccess={() => setSelectedLineItem(null)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{lineItemToDelete?.formula_name}" from this order? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLineItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLineItem.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
