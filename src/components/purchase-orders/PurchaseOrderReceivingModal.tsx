import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, ArrowRight, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { convertUnits, canConvert, getConversionDescription, convertUnitsWithDensity } from "@/utils/unitConversion";
import { RawMaterialModal } from "@/components/inventory/RawMaterialModal";
import { useRawMaterialsOptimized } from "@/hooks/useRawMaterialsOptimized";
import type { RawMaterialForm, RawMaterial } from "@/types/inventory";
import { formatET, todayET } from "@/utils/dateUtils";

interface PurchaseOrderItem {
  id: string;
  ingredient_id?: string;
  ingredient_name: string;
  quantity: number;
  uom?: string;
  unit_cost?: number;
  total_cost?: number;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_name?: string;
  ingredient_name?: string;
  quantity: number;
  uom?: string;
  ordered_date: string;
  expected_delivery?: string;
  terms?: string;
  invoice_total: number;
  tracking_number?: string;
  status: string;
  items?: PurchaseOrderItem[];
}

interface PurchaseOrderReceivingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  onReceived: (orderId: string) => void;
}

export function PurchaseOrderReceivingModal({
  isOpen,
  onClose,
  order,
  onReceived
}: PurchaseOrderReceivingModalProps) {
  const { toast } = useToast();
  const [rawMaterials, setRawMaterials] = useState<Array<{
    id: string;
    code: string;
    name: string;
    supplier: string | null;
    uom: string;
    density_kg_per_l?: number | null;
  }>>([]);
  const [selectedRmId, setSelectedRmId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [lots, setLots] = useState([{
    lotNumber: "",
    receivingDate: todayET(),
    expiryDate: "",
    cost: "",
    coaLink: "",
    notes: "",
    quantity: 0
  }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);

  // Raw material creation modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  
  // Get raw materials hook for creation functionality
  const { materials, upsertMaterial, refetch } = useRawMaterialsOptimized({});

  // Handle save material (create new)
  const handleSaveMaterial = async (data: RawMaterialForm) => {
    try {
      // Auto-populate supplier from PO vendor if not provided
      const materialData = {
        ...data,
        supplier: data.supplier || order?.vendor_name || null
      };
      
      await upsertMaterial.mutateAsync(materialData);
      setModalOpen(false);
      setEditingMaterial(null);
      // Refresh the local raw materials list
      await fetchRawMaterials();
      // Select the newly created material
      if (data.code) {
        const newMaterial = rawMaterials.find(rm => rm.code === data.code);
        if (newMaterial) {
          setSelectedRmId(newMaterial.id);
        }
      }
      toast({
        title: "Success",
        description: "Raw material created successfully."
      });
    } catch (error) {
      console.error('Save failed:', error);
      // Error handled by mutation's onError
    }
  };

  // Fetch raw materials on mount and reset RM selection
  useEffect(() => {
    if (isOpen) {
      // Reset RM selection to empty when modal opens - prevents leftover selections
      setSelectedRmId("");
      setSearchTerm("");
      
      fetchRawMaterials();
      // Pre-populate cost and quantity from PO item if available
      const currentItem = getCurrentPOItem();
      if (currentItem) {
        const unitCost = currentItem.unit_cost || 
          (currentItem.total_cost && currentItem.quantity > 0 ? 
            currentItem.total_cost / currentItem.quantity : 0);
        
        setLots([{
          lotNumber: "",
          receivingDate: todayET(),
          expiryDate: "",
          cost: unitCost ? unitCost.toString() : "",
          coaLink: "",
          notes: "",
          quantity: currentItem.quantity || 0
        }]);
      }
    }
  }, [isOpen, order, selectedItemIndex]);

  const fetchRawMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('id, code, name, supplier, uom, density_kg_per_l')
        .eq('is_archived', false)
        .order('code');

      if (error) throw error;
      setRawMaterials(data || []);
    } catch (error) {
      console.error('Error fetching raw materials:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load raw materials."
      });
    }
  };

  // Helper function to get current PO item data
  const getCurrentPOItem = (): PurchaseOrderItem | null => {
    if (!order) return null;
    
    // If we have items, use the selected item
    if (order.items && order.items.length > 0) {
      return order.items[selectedItemIndex] || order.items[0];
    }
    
    // Fallback to main PO data if no items (create a PurchaseOrderItem-compatible object)
    return {
      id: order.id,
      ingredient_name: order.ingredient_name || '',
      quantity: order.quantity,
      uom: order.uom || 'kg',
      unit_cost: order.quantity > 0 ? order.invoice_total / order.quantity : 0,
      total_cost: order.invoice_total
    };
  };

  const handleSubmit = async () => {
    if (!order || !selectedRmId) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select an RM code."
      });
      return;
    }

    // Validate all lots have lot numbers and quantities
    const invalidLots = lots.filter(lot => !lot.lotNumber.trim() || lot.quantity <= 0);
    if (invalidLots.length > 0) {
      toast({
        variant: "destructive",
        title: "Invalid Lot Data",
        description: "All lots must have a lot number and quantity greater than 0."
      });
      return;
    }

    // Validate total quantities match PO quantity
    const totalQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
    const currentItem = getCurrentPOItem();
    if (currentItem && Math.abs(totalQuantity - currentItem.quantity) > 0.01) {
      toast({
        variant: "destructive", 
        title: "Quantity Mismatch",
        description: `Total lot quantities (${totalQuantity}) must equal PO quantity (${currentItem.quantity}).`
      });
      return;
    }

    if (!currentItem) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not find purchase order item data."
      });
      return;
    }

    // All inventory is stored in kg - validate conversion from PO unit to kg
    const poUom = currentItem.uom || 'kg';
    const targetUom = 'kg'; // Always convert to kg for inventory
    
    // Note: Volume-to-weight conversions will use default density (1.0 kg/L) if material density is not specified
    
    if (poUom.toLowerCase() !== 'kg' && !canConvert(poUom, targetUom)) {
      toast({
        variant: "destructive",
        title: "Unit Conversion Error",
        description: `Cannot convert from ${poUom} to kg. Units are incompatible. Please verify the purchase order units.`
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Update raw material supplier if empty and we have vendor info
      if (selectedRawMaterial && !selectedRawMaterial.supplier && order.vendor_name) {
        const { error: updateError } = await supabase
          .from('raw_materials')
          .update({ supplier: order.vendor_name })
          .eq('id', selectedRmId);
        
        if (updateError) {
          console.warn('Failed to update raw material supplier:', updateError);
          // Don't throw error, just log warning as this is not critical
        }
      }

      // Create all lots in inventory - always convert to kg
      const lotInserts = lots.map(lot => {
        // Always convert to kg for inventory storage
        let quantityInKg = lot.quantity;
        const poUom = currentItem.uom || 'kg';
        
        if (poUom.toLowerCase() !== 'kg') {
          const result = convertUnitsWithDensity(
            lot.quantity,
            poUom,
            'kg',
            selectedRawMaterial?.density_kg_per_l
          );
          quantityInKg = result.convertedValue;
        }

        return {
          raw_material_id: selectedRmId,
          lot_number: lot.lotNumber.trim(),
          quantity: quantityInKg,
          cost: parseFloat(lot.cost) || 0,
          receiving_date: lot.receivingDate || null,
          expires_on: lot.expiryDate || null,
          coa_link: lot.coaLink.trim() || null
        };
      });

      const { error: lotError } = await supabase
        .from('raw_material_lots')
        .insert(lotInserts);

      if (lotError) throw lotError;

      // Update PO status to received
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'received',
          received_date: lots[0]?.receivingDate || todayET(),
          received_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', order.id);

      if (poError) throw poError;

      toast({
        title: "Successfully Received",
        description: `Purchase order ${order.po_number} with ${lots.length} lot(s) has been received into inventory.`
      });

      onReceived(order.id);
      onClose();
    } catch (error: any) {
      console.error('Error receiving purchase order:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to receive purchase order into inventory."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedRmId("");
    setSearchTerm("");
    setIsPopoverOpen(false);
    setLots([{
      lotNumber: "",
      receivingDate: todayET(),
      expiryDate: "",
      cost: "",
      coaLink: "",
      notes: "",
      quantity: 0
    }]);
    onClose();
  };

  const addLot = () => {
    const currentItem = getCurrentPOItem();
    const unitCost = currentItem?.unit_cost || 
      (currentItem?.total_cost && currentItem?.quantity > 0 ? 
        currentItem.total_cost / currentItem.quantity : 0);

    setLots([...lots, {
      lotNumber: "",
      receivingDate: todayET(),
      expiryDate: "",
      cost: unitCost ? unitCost.toString() : "",
      coaLink: "",
      notes: "",
      quantity: 0
    }]);
  };

  const removeLot = (index: number) => {
    if (lots.length > 1) {
      setLots(lots.filter((_, i) => i !== index));
    }
  };

  const updateLot = (index: number, field: string, value: any) => {
    setLots(lots.map((lot, i) => 
      i === index ? { ...lot, [field]: value } : lot
    ));
  };

  const filteredRawMaterials = rawMaterials.filter((rm) => {
    const matchesSearch = rm.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rm.supplier && rm.supplier.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // If we have PO item data, prioritize compatible units
    const currentItem = getCurrentPOItem();
    if (currentItem && currentItem.uom) {
      const isCompatible = canConvert(currentItem.uom, rm.uom);
      // Show compatible units first, then incompatible ones (but still show all)
      return matchesSearch;
    }
    
    return matchesSearch;
  }).sort((a, b) => {
    // Sort by compatibility first if we have PO item data
    const currentItem = getCurrentPOItem();
    if (currentItem && currentItem.uom) {
      const aCompatible = canConvert(currentItem.uom, a.uom);
      const bCompatible = canConvert(currentItem.uom, b.uom);
      
      if (aCompatible && !bCompatible) return -1;
      if (!aCompatible && bCompatible) return 1;
    }
    
    // Then sort by code
    return a.code.localeCompare(b.code);
  });

  const selectedRawMaterial = rawMaterials.find(rm => rm.id === selectedRmId);

  // Helper function to describe unit types
  const getUnitTypeDescription = (unit: string) => {
    const normalized = unit.toLowerCase().trim();
    if (['kg', 'lbs', 'g', 'oz', 'ton'].some(u => normalized.includes(u))) return 'weight';
    if (['gal', 'l', 'ml', 'qt', 'fl oz'].some(u => normalized.includes(u))) return 'volume';
    return 'unknown';
  };

  // Calculate unit conversion - always convert to kg for inventory
  const conversionResult = useMemo(() => {
    if (!selectedRawMaterial) return null;
    
    const currentItem = getCurrentPOItem();
    if (!currentItem) return null;
    
    const poUom = currentItem.uom || 'kg';
    const inventoryUom = 'kg'; // Always store inventory in kg
    
    try {
      // Use density-aware conversion to kg
      return convertUnitsWithDensity(
        currentItem.quantity, 
        poUom, 
        inventoryUom,
        selectedRawMaterial.density_kg_per_l
      );
    } catch (error) {
      console.error('Conversion error:', error);
      return null;
    }
  }, [order, selectedRawMaterial, selectedItemIndex]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
      ordered: { color: "bg-blue-100 text-blue-800", label: "Ordered" },
      shipped: { color: "bg-purple-100 text-purple-800", label: "Shipped" },
      delivered: { color: "bg-green-100 text-green-800", label: "Delivered" },
      received: { color: "bg-emerald-100 text-emerald-800", label: "Received" },
      cancelled: { color: "bg-red-100 text-red-800", label: "Cancelled" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return formatET(dateString, 'M/d/yyyy');
    } catch (error) {
      return dateString;
    }
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="[--dialog-max-width:42rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Purchase Order into Inventory</DialogTitle>
          <DialogDescription>
            Add this purchase order to your inventory by connecting it to an existing raw material code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* PO Information */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <h3 className="font-semibold text-lg">Purchase Order Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">PO Number:</span>
                <span className="ml-2">{order.po_number}</span>
              </div>
              <div>
                <span className="font-medium">Status:</span>
                <span className="ml-2">{getStatusBadge(order.status)}</span>
              </div>
              <div>
                <span className="font-medium">Vendor:</span>
                <span className="ml-2">{order.vendor_name || 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium">Ingredient:</span>
                <span className="ml-2">{getCurrentPOItem()?.ingredient_name || 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium">Quantity:</span>
                <span className="ml-2">
                  {(() => {
                    const currentItem = getCurrentPOItem();
                    if (!currentItem) return 'N/A';
                    
                    try {
                      const quantity = typeof currentItem.quantity === 'number' 
                        ? currentItem.quantity 
                        : parseFloat(currentItem.quantity) || 0;
                      
                      return `${quantity.toLocaleString()} ${currentItem.uom || 'kg'}`;
                    } catch (error) {
                      console.error('Error formatting quantity:', error);
                      return `${currentItem.quantity} ${currentItem.uom || 'kg'}`;
                    }
                  })()}
                </span>
              </div>
              <div>
                <span className="font-medium">Total Value:</span>
                <span className="ml-2">{formatCurrency(order.invoice_total)}</span>
              </div>
              {order.tracking_number && (
                <div>
                  <span className="font-medium">Tracking #:</span>
                  <span className="ml-2">{order.tracking_number}</span>
                </div>
              )}
            </div>
          </div>

          {/* Inventory Connection */}
          <div className="space-y-4">
            <h3 className="font-semibold">Connect to Inventory</h3>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="rm-select">Select Raw Material Code *</Label>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setEditingMaterial(null);
                    setModalOpen(true);
                  }}
                  className="flex items-center gap-1 text-sm"
                >
                  <Plus className="h-3 w-3" />
                  Create New
                </Button>
              </div>
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isPopoverOpen}
                    className="w-full justify-between"
                  >
                    {selectedRawMaterial ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{selectedRawMaterial.code}</span>
                        <span className="text-muted-foreground">-</span>
                        <span>{selectedRawMaterial.name}</span>
                        <span className="text-xs text-blue-600 font-medium">({selectedRawMaterial.uom})</span>
                        {selectedRawMaterial.supplier && (
                          <span className="text-xs text-muted-foreground">• {selectedRawMaterial.supplier}</span>
                        )}
                      </div>
                    ) : (
                      "Choose an RM code..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[300px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <Command>
                      <CommandInput
                        placeholder="Search raw materials..."
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                      />
                    <CommandList>
                      <CommandEmpty>No raw materials found.</CommandEmpty>
                      <CommandGroup>
                        {filteredRawMaterials.map((rm) => {
                          const currentItem = getCurrentPOItem();
                          const isCompatible = currentItem ? canConvert(currentItem.uom || 'kg', rm.uom) : true;
                          
                          return (
                            <CommandItem
                              key={rm.id}
                              value={`${rm.code} ${rm.name} ${rm.supplier || ''}`}
                              onSelect={() => {
                                setSelectedRmId(rm.id);
                                setIsPopoverOpen(false);
                                setSearchTerm("");
                              }}
                              className={!isCompatible ? "opacity-60" : ""}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedRmId === rm.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex items-center gap-2 w-full">
                                <span className="font-mono text-sm">{rm.code}</span>
                                <span className="text-muted-foreground">-</span>
                                <span className="flex-1">{rm.name}</span>
                                <div className="flex items-center gap-1">
                                  <span className={cn(
                                    "text-xs font-medium px-1.5 py-0.5 rounded",
                                    isCompatible 
                                      ? "text-green-700 bg-green-100" 
                                      : "text-red-700 bg-red-100"
                                  )}>
                                    {rm.uom}
                                  </span>
                                  {!isCompatible && (
                                    <span className="text-xs text-red-600">⚠</span>
                                  )}
                                </div>
                                {rm.supplier && (
                                  <span className="text-xs text-muted-foreground">• {rm.supplier}</span>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Multiple Lots Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Lot Details</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLot}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Lot
                </Button>
              </div>

              {lots.map((lot, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-sm">Lot #{index + 1}</h5>
                    {lots.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLot(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`lot-number-${index}`}>Lot Number *</Label>
                      <Input
                        id={`lot-number-${index}`}
                        value={lot.lotNumber}
                        onChange={(e) => updateLot(index, 'lotNumber', e.target.value)}
                        placeholder="Enter lot number"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`quantity-${index}`}>Quantity *</Label>
                      <Input
                        id={`quantity-${index}`}
                        type="number"
                        step="0.01"
                        value={lot.quantity}
                        onChange={(e) => updateLot(index, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`receiving-date-${index}`}>Receiving Date</Label>
                      <Input
                        id={`receiving-date-${index}`}
                        type="date"
                        value={lot.receivingDate}
                        onChange={(e) => updateLot(index, 'receivingDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`cost-${index}`}>Unit Cost ($)</Label>
                      <Input
                        id={`cost-${index}`}
                        type="number"
                        step="0.01"
                        value={lot.cost}
                        onChange={(e) => updateLot(index, 'cost', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`expiry-date-${index}`}>Expiry Date</Label>
                      <Input
                        id={`expiry-date-${index}`}
                        type="date"
                        value={lot.expiryDate}
                        onChange={(e) => updateLot(index, 'expiryDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`coa-link-${index}`}>COA Link</Label>
                      <Input
                        id={`coa-link-${index}`}
                        value={lot.coaLink}
                        onChange={(e) => updateLot(index, 'coaLink', e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`notes-${index}`}>Notes</Label>
                    <Textarea
                      id={`notes-${index}`}
                      value={lot.notes}
                      onChange={(e) => updateLot(index, 'notes', e.target.value)}
                      placeholder="Any additional notes about this lot..."
                      rows={2}
                    />
                  </div>
                </div>
              ))}
              
              {/* Total Quantity Summary */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span>Total Quantity:</span>
                  <span className="font-mono">
                    {lots.reduce((sum, lot) => sum + lot.quantity, 0).toLocaleString()} 
                    {getCurrentPOItem()?.uom || 'kg'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>PO Quantity:</span>
                  <span className="font-mono">
                    {getCurrentPOItem()?.quantity || 0} {getCurrentPOItem()?.uom || 'kg'}
                  </span>
                </div>
              </div>
            </div>

            {/* Unit Conversion Alert */}
            {selectedRawMaterial && conversionResult && (
              <div className="space-y-2">
                {conversionResult.isConverted ? (
                  <Alert className="border-blue-200 bg-blue-50">
                    <ArrowRight className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <div className="space-y-1">
                        <div className="font-medium">Converting to kg for Inventory</div>
                        <div className="text-sm">
                          PO: <span className="font-mono">
                            {(() => {
                              const currentItem = getCurrentPOItem();
                              if (!currentItem) return 'N/A';
                              
                              try {
                                const quantity = typeof currentItem.quantity === 'number' 
                                  ? currentItem.quantity 
                                  : parseFloat(currentItem.quantity) || 0;
                                
                                return `${quantity.toLocaleString()} ${currentItem.uom || 'kg'}`;
                              } catch (error) {
                                console.error('Error formatting quantity:', error);
                                return `${currentItem.quantity} ${currentItem.uom || 'kg'}`;
                              }
                            })()}
                          </span>
                          {" → "}
                          Inventory: <span className="font-mono">{conversionResult.convertedValue} kg</span>
                        </div>
                        <div className="text-xs text-blue-600">
                          {getConversionDescription(conversionResult)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          All inventory is stored in kg for consistency
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-green-200 bg-green-50">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <div className="font-medium">No conversion needed</div>
                      <div className="text-sm">Purchase order already in kg</div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            
            {/* Density Info */}
            {selectedRawMaterial && (() => {
              const currentItem = getCurrentPOItem();
              if (!currentItem) return null;
              
              const poUom = currentItem.uom || 'kg';
              const fromIsVolume = ['gal', 'l', 'ml', 'qt', 'fl oz'].some(u => poUom.toLowerCase().includes(u));
              const needsDensity = fromIsVolume;
              
              if (needsDensity && !selectedRawMaterial.density_kg_per_l) {
                return (
                  <Alert className="border-blue-200 bg-blue-50">
                    <AlertTriangle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <div className="font-medium">Using Default Density</div>
                      <div className="text-sm">
                        Converting from {poUom} to kg using default density of 1.0 kg/L (water). 
                        Edit "{selectedRawMaterial.name}" in Inventory to specify a different density if needed.
                      </div>
                    </AlertDescription>
                  </Alert>
                );
              }
              return null;
            })()}

          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Receiving..." : "Receive into Inventory"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Raw Material Creation Modal */}
      <RawMaterialModal
        open={modalOpen}
        initial={editingMaterial}
        onClose={() => {
          setModalOpen(false);
          setEditingMaterial(null);
        }}
        onSave={handleSaveMaterial}
        saving={upsertMaterial.isPending}
      />
    </Dialog>
  );
}