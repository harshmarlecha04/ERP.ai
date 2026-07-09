import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useVendors } from '@/hooks/useVendors';
import { useRawMaterials } from '@/hooks/useRawMaterials';
import { QuickRawMaterialCreate } from './QuickRawMaterialCreate';
import type { CreatePurchaseOrderData } from '@/hooks/usePurchaseOrders';

interface AddPurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderData: CreatePurchaseOrderData) => Promise<void>;
  initialData?: any;
}

interface IngredientItem {
  ingredient_id?: string;
  ingredient_name: string;
  quantity: number;
  uom: string;
  unit_cost: number;
}

const DRAFT_KEY = 'purchase_order_draft';

const getInitialFormData = () => ({
  vendor_name: '',
  po_number: '',
  ordered_date: '',
  expected_delivery: '',
  terms: '',
  invoice_total: 0,
  tracking_number: '',
  status: 'ordered' as 'ordered' | 'received'
});

const getInitialIngredientItems = (): IngredientItem[] => [
  { ingredient_name: '', quantity: 0, uom: 'kg', unit_cost: 0 }
];

export function AddPurchaseOrderModal({
  isOpen,
  onClose,
  onSave,
  initialData
}: AddPurchaseOrderModalProps) {
  const { vendors, loading: vendorsLoading, createVendor } = useVendors();
  const { rawMaterials, createRawMaterial, refetch: refetchMaterials } = useRawMaterials();
  
  const [formData, setFormData] = useState(getInitialFormData());
  const [ingredientItems, setIngredientItems] = useState<IngredientItem[]>(getInitialIngredientItems());
  const [loading, setLoading] = useState(false);
  const [filteredVendors, setFilteredVendors] = useState(vendors);
  const [filteredMaterials, setFilteredMaterials] = useState(rawMaterials);

  const uomOptions = ['kg', 'g', 'L', 'mL', 'lbs', 'Oz', 'gallon'];
  
  // Track if we've initialized from draft/initialData to prevent re-initialization
  const hasInitializedRef = useRef(false);
  const prevInitialDataRef = useRef(initialData);

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Save draft to localStorage (only for new orders, not edits)
  const saveDraft = useCallback(() => {
    if (!initialData && isOpen) {
      const draft = { formData, ingredientItems, savedAt: Date.now() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [formData, ingredientItems, initialData, isOpen]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  // Load draft from localStorage
  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const { formData: savedForm, ingredientItems: savedItems } = JSON.parse(saved);
        if (savedForm) setFormData(savedForm);
        if (savedItems?.length) setIngredientItems(savedItems);
        return true;
      }
    } catch (e) {
      console.error('Error loading draft:', e);
    }
    return false;
  }, []);

  // Initialize form when modal opens or initialData changes
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    // Only initialize once per modal open
    if (hasInitializedRef.current && prevInitialDataRef.current === initialData) {
      return;
    }

    hasInitializedRef.current = true;
    prevInitialDataRef.current = initialData;

    if (initialData) {
      // Editing existing order
      setFormData({
        vendor_name: initialData.vendor_name || '',
        po_number: initialData.po_number || '',
        ordered_date: formatDateForInput(initialData.ordered_date || ''),
        expected_delivery: formatDateForInput(initialData.expected_delivery || ''),
        terms: initialData.terms || '',
        invoice_total: initialData.invoice_total || 0,
        tracking_number: initialData.tracking_number || '',
        status: initialData.status || 'ordered'
      });

      if (initialData.items?.length > 0) {
        setIngredientItems(initialData.items);
      } else {
        setIngredientItems(getInitialIngredientItems());
      }
    } else {
      // New order - try to load draft first
      if (!loadDraft()) {
        setFormData(getInitialFormData());
        setIngredientItems(getInitialIngredientItems());
      }
    }
  }, [isOpen, initialData, loadDraft]);

  // Auto-save draft on form changes (debounced via dependency)
  useEffect(() => {
    if (isOpen && !initialData) {
      const timer = setTimeout(saveDraft, 500);
      return () => clearTimeout(timer);
    }
  }, [formData, ingredientItems, isOpen, initialData, saveDraft]);

  useEffect(() => {
    setFilteredVendors(vendors);
  }, [vendors]);

  useEffect(() => {
    setFilteredMaterials(rawMaterials);
  }, [rawMaterials]);


  const addIngredientItem = () => {
    setIngredientItems([
      ...ingredientItems,
      { ingredient_name: '', quantity: 0, uom: 'kg', unit_cost: 0 }
    ]);
  };

  const removeIngredientItem = (index: number) => {
    if (ingredientItems.length > 1) {
      setIngredientItems(ingredientItems.filter((_, i) => i !== index));
    }
  };

  const updateIngredientItem = (index: number, field: keyof IngredientItem, value: any) => {
    const updatedItems = [...ingredientItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setIngredientItems(updatedItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.vendor_name.trim()) {
      toast.error('Please select or enter a vendor name');
      return;
    }
    
    if (!formData.po_number.trim()) {
      toast.error('Please enter a PO number');
      return;
    }
    
    if (!formData.ordered_date) {
      toast.error('Please select an ordered date');
      return;
    }

    // Validate at least one ingredient
    const validItems = ingredientItems.filter(item => 
      item.ingredient_name.trim() && item.quantity > 0
    );

    if (validItems.length === 0) {
      toast.error('Please add at least one ingredient with valid quantity');
      return;
    }

    setLoading(true);
    
    try {
      // Calculate total from items if not provided
      const calculatedTotal = validItems.reduce((total, item) => 
        total + (item.quantity * item.unit_cost), 0
      );

      const orderData: CreatePurchaseOrderData = {
        ...formData,
        invoice_total: formData.invoice_total || calculatedTotal,
        items: validItems.map(item => ({
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name.trim(),
          quantity: Number(item.quantity),
          uom: item.uom,
          unit_cost: Number(item.unit_cost)
        }))
      };

      await onSave(orderData);
      clearDraft(); // Clear draft on successful save
      onClose();
      toast.success(`Purchase order ${initialData ? 'updated' : 'created'} successfully`);
    } catch (error: any) {
      console.error('Error saving purchase order:', error);
      toast.error(error.message || `Failed to ${initialData ? 'update' : 'create'} purchase order`);
      // Keep modal open on error - don't close
    } finally {
      setLoading(false);
    }
  };

  // Handle explicit cancel - clear draft and close
  const handleCancel = () => {
    clearDraft();
    onClose();
  };

  // Controlled onOpenChange - only allow explicit closes
  const handleOpenChange = (open: boolean) => {
    // Block implicit closes (clicking outside, escape key handled by preventClose)
    // Only allow closing through explicit button clicks
    if (!open) return;
  };

  const handleVendorCreated = (vendorId: string, vendorName: string) => {
    setFormData(prev => ({ ...prev, vendor_name: vendorName }));
  };

  const handleMaterialCreated = (materialId: string, materialName: string) => {
    // Refresh materials list to include the new material
    refetchMaterials();
    
    // Update the first empty ingredient item or add a new one
    const emptyIndex = ingredientItems.findIndex(item => !item.ingredient_name);
    if (emptyIndex >= 0) {
      updateIngredientItem(emptyIndex, 'ingredient_id', materialId);
      updateIngredientItem(emptyIndex, 'ingredient_name', materialName);
    } else {
      setIngredientItems([
        ...ingredientItems,
        {
          ingredient_id: materialId,
          ingredient_name: materialName,
          quantity: 0,
          uom: 'kg',
          unit_cost: 0
        }
      ]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="[--dialog-max-width:56rem] max-h-[90vh] overflow-y-auto" preventClose>
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Edit Purchase Order' : 'Add New Purchase Order'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* PO Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor_name">Vendor *</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="flex-1 justify-between font-normal"
                    >
                      <span className={cn("truncate", !formData.vendor_name && "text-muted-foreground")}>
                        {formData.vendor_name || "Select vendor or type to search"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                    <Command>
                      <CommandInput placeholder="Search vendors..." />
                      <CommandList>
                        <CommandEmpty>No vendor found.</CommandEmpty>
                        <CommandGroup>
                          {vendors.map((vendor) => (
                            <CommandItem
                              key={vendor.id}
                              value={vendor.name}
                              onSelect={(value) => setFormData(prev => ({ ...prev, vendor_name: value }))}
                            >
                              <Check className={cn("mr-2 h-4 w-4", formData.vendor_name === vendor.name ? "opacity-100" : "opacity-0")} />
                              {vendor.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {/* This will be handled by the QuickVendorCreate component */}}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>


            <div className="space-y-2">
              <Label htmlFor="po_number">PO Number *</Label>
              <Input
                id="po_number"
                value={formData.po_number}
                onChange={(e) => setFormData(prev => ({ ...prev, po_number: e.target.value }))}
                placeholder="Enter PO number"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ordered_date">Ordered Date *</Label>
              <Input
                id="ordered_date"
                type="date"
                value={formData.ordered_date}
                onChange={(e) => setFormData(prev => ({ ...prev, ordered_date: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_delivery">Expected Delivery</Label>
              <Input
                id="expected_delivery"
                type="date"
                value={formData.expected_delivery}
                onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery: e.target.value }))}
              />
            </div>
          </div>

          {/* Ingredient Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Ingredients *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addIngredientItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Ingredient
              </Button>
            </div>

            <div className="space-y-3">
              {ingredientItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Ingredient {index + 1}</span>
                    {ingredientItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeIngredientItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <Label>Ingredient Name *</Label>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              className="flex-1 justify-between font-normal"
                            >
                              <span className={cn("truncate", !item.ingredient_name && "text-muted-foreground")}>
                                {item.ingredient_name || "Select ingredient"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                            <Command>
                              <CommandInput placeholder="Search ingredients..." />
                              <CommandList>
                                <CommandEmpty>No ingredient found.</CommandEmpty>
                                <CommandGroup>
                                  {rawMaterials.map((material, mIdx) => (
                                    <CommandItem
                                      key={`${material.id}-${mIdx}`}
                                      value={`${material.name} ${material.code ?? ''}`}
                                      onSelect={() => {
                                        updateIngredientItem(index, 'ingredient_id', material.id);
                                        updateIngredientItem(index, 'ingredient_name', material.name);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", item.ingredient_name === material.name ? "opacity-100" : "opacity-0")} />
                                      {material.name} {material.code ? `(${material.code})` : ''}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                         <QuickRawMaterialCreate
                           onMaterialCreated={handleMaterialCreated}
                           createRawMaterial={createRawMaterial}
                         />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateIngredientItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>UoM</Label>
                      <Select
                        value={item.uom}
                        onValueChange={(value) => updateIngredientItem(index, 'uom', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {uomOptions.map((uom) => (
                            <SelectItem key={uom} value={uom}>
                              {uom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Unit Cost</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_cost}
                        onChange={(e) => updateIngredientItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {item.quantity > 0 && item.unit_cost > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Total: ${(item.quantity * item.unit_cost).toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_total">Invoice Total</Label>
              <Input
                id="invoice_total"
                type="number"
                min="0"
                step="0.01"
                value={formData.invoice_total}
                onChange={(e) => setFormData(prev => ({ ...prev, invoice_total: parseFloat(e.target.value) || 0 }))}
                placeholder="Auto-calculated from ingredients"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tracking_number">Tracking Number</Label>
              <Input
                id="tracking_number"
                value={formData.tracking_number}
                onChange={(e) => setFormData(prev => ({ ...prev, tracking_number: e.target.value }))}
                placeholder="Enter tracking number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="terms">Terms & Conditions</Label>
            <Textarea
              id="terms"
              value={formData.terms}
              onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
              placeholder="Enter terms and conditions"
              rows={3}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : (initialData ? 'Update Order' : 'Create Order')}
            </Button>
          </div>
        </form>

        {/* Quick Create Components - Simplified for now */}
      </DialogContent>
    </Dialog>
  );
}