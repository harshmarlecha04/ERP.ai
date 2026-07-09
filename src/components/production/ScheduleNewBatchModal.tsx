import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarIcon, Check, ChevronsUpDown, AlertTriangle, FileText, Package, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Fuse from "fuse.js";
import { formatET } from "@/utils/dateUtils";

interface Formula {
  id: string;
  code: string;
  name: string;
  default_batch_size_kg: number;
  recipe_json: any;
}

interface OrderOption {
  id: string;
  po_number: string;
  customer_name: string;
  due_date: string;
}

interface MaterialShortage {
  ingredient_id: string;
  ingredient_name: string;
  required_kg: number;
  available_kg: number;
  shortfall_kg: number;
}

interface MaterialIngredient {
  ingredient_id: string;
  ingredient_name: string;
  required_kg: number;
  available_kg: number;
  is_sufficient: boolean;
}

interface MaterialsCheckResult {
  materials_ok: boolean;
  shortages: MaterialShortage[];
  all_ingredients?: MaterialIngredient[];
}

interface PackagingOption {
  item_id: string;
  item_name: string;
  category: string;
  on_hand: number;
  bottles_per_unit?: number;
}

// Synthetic bottle options — not real packaging_items rows. Selecting one
// stores `bottle_label_override` instead of `selected_bottle_id`.
const SYNTHETIC_BULK_ID = '__BULK__';
const SYNTHETIC_BRIGHT_STOCK_ID = '__BRIGHT_STOCK__';
const SYNTHETIC_BOTTLE_OPTIONS: PackagingOption[] = [
  { item_id: SYNTHETIC_BULK_ID, item_name: 'Bulk', category: 'BOTTLES', on_hand: 0 },
  { item_id: SYNTHETIC_BRIGHT_STOCK_ID, item_name: 'Bright Stock', category: 'BOTTLES', on_hand: 0 },
];
const isSyntheticBottleId = (id: string | null | undefined) =>
  id === SYNTHETIC_BULK_ID || id === SYNTHETIC_BRIGHT_STOCK_ID;
const syntheticIdToLabel = (id: string): string | null => {
  if (id === SYNTHETIC_BULK_ID) return 'Bulk';
  if (id === SYNTHETIC_BRIGHT_STOCK_ID) return 'Bright Stock';
  return null;
};

// Module-level so popover state isn't lost on parent re-render
const PackagingSelector = ({
  label,
  open,
  setOpen,
  selected,
  setSelected,
  options,
  search,
  setSearch,
  displayKey,
  placeholder,
}: {
  label: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  selected: any;
  setSelected: (item: any) => void;
  options: any[];
  search: string;
  setSearch: (s: string) => void;
  displayKey: string;
  placeholder: string;
}) => (
  <div className="space-y-2">
    <Label>{label} <span className="text-muted-foreground text-sm">(optional)</span></Label>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between">
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{selected[displayKey]}</span>
              {!isSyntheticBottleId(selected.item_id) && (
                <span className="text-muted-foreground text-xs shrink-0">({selected.on_hand} on hand)</span>
              )}
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover z-[100]"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="p-3 border-b">
          <input
            className="w-full p-2 text-sm border rounded-md bg-background"
            placeholder={`Search ${label.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div
          className="max-h-64 overflow-y-auto overscroll-contain p-1"
          style={{ pointerEvents: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y' }}
          onWheel={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {selected && (
            <div
              className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer text-muted-foreground"
              onClick={() => {
                setSelected(null);
                setOpen(false);
                setSearch("");
              }}
            >
              <span className="text-sm">Clear selection</span>
            </div>
          )}
          {options.length > 0 ? (
            options.map((item) => (
              <div
                key={item.item_id || item.id}
                className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                onClick={() => {
                  setSelected(item);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    (selected?.item_id || selected?.id) === (item.item_id || item.id) ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item[displayKey]}</div>
                  {!isSyntheticBottleId(item.item_id) && (
                    <div className="text-sm text-muted-foreground">
                      {(item.on_hand ?? 0).toLocaleString()} on hand
                      {item.bottles_per_unit && item.bottles_per_unit > 1 && ` • ${item.bottles_per_unit} bottles/unit`}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No items found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  </div>
);


interface LabelOption {
  id: string;
  customer_product: string;
  on_hand: number;
}

interface ScheduleNewBatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  orderId?: string;
  duplicateData?: {
    formula_id: string;
    formula_code: string;
    formula_name: string;
    batches: number;
    default_batch_size_kg: number;
    bottle_size?: number;
    gummies_per_batch?: number;
  } | null;
}

export function ScheduleNewBatchModal({ open, onOpenChange, onSuccess, orderId, duplicateData }: ScheduleNewBatchModalProps) {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [batches, setBatches] = useState<string>("");
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [materialsCheck, setMaterialsCheck] = useState<MaterialsCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formulaSearch, setFormulaSearch] = useState("");
  
  // PO Number selection state
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderOption | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  
  // Packaging selection state
  const [bottles, setBottles] = useState<PackagingOption[]>([]);
  const [caps, setCaps] = useState<PackagingOption[]>([]);
  const [corrugated, setCorrugated] = useState<PackagingOption[]>([]);
  const [labels, setLabels] = useState<LabelOption[]>([]);
  
  const [selectedBottle, setSelectedBottle] = useState<PackagingOption | null>(null);
  const [selectedCap, setSelectedCap] = useState<PackagingOption | null>(null);
  const [selectedCorrugated, setSelectedCorrugated] = useState<PackagingOption | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<LabelOption | null>(null);
  const [estimatedBottles, setEstimatedBottles] = useState<string>("");
  
  const [bottleOpen, setBottleOpen] = useState(false);
  const [capOpen, setCapOpen] = useState(false);
  const [corrugatedOpen, setCorrugatedOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  
  const [bottleSearch, setBottleSearch] = useState("");
  const [capSearch, setCapSearch] = useState("");
  const [corrugatedSearch, setCorrugatedSearch] = useState("");
  const [labelSearch, setLabelSearch] = useState("");
  
  // Manual entry mode state
  const [entryMode, setEntryMode] = useState<'dropdown' | 'manual'>('dropdown');
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualFormulaName, setManualFormulaName] = useState("");
  const [customers, setCustomers] = useState<{ id: string; company_name: string }[]>([]);
  const [selectedManualCustomer, setSelectedManualCustomer] = useState<{ id: string; company_name: string } | null>(null);
  const [manualCustomerOpen, setManualCustomerOpen] = useState(false);
  const [manualCustomerSearch, setManualCustomerSearch] = useState("");
  
  const { toast } = useToast();

  // Load formulas, orders, packaging options, and customers when modal opens
  useEffect(() => {
    if (open) {
      loadFormulas();
      loadOrders();
      loadPackagingOptions();
      loadCustomers();
      
      // Handle duplicate data
      if (duplicateData) {
        setBatches(String(duplicateData.batches));
        setEntryMode('dropdown');
        // Formula will be set after formulas are loaded
      } else {
        resetForm();
      }
    }
  }, [open, duplicateData]);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name')
        .order('company_name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error('Error loading customers:', error);
    }
  };

  const loadPackagingOptions = async () => {
    try {
      // Load packaging items from v_packaging_balances
      const { data: packagingData, error: packagingError } = await supabase
        .from('v_packaging_balances')
        .select('item_id, item_name, category, on_hand, bottles_per_unit')
        .in('category', ['BOTTLES', 'CAPS', 'CORRUGATED'])
        .order('item_name');

      if (packagingError) throw packagingError;

      const packaging = packagingData || [];
      setBottles([
        ...SYNTHETIC_BOTTLE_OPTIONS,
        ...packaging.filter(p => p.category === 'BOTTLES'),
      ]);
      setCaps(packaging.filter(p => p.category === 'CAPS'));
      setCorrugated(packaging.filter(p => p.category === 'CORRUGATED'));

      // Load labels
      const { data: labelData, error: labelError } = await supabase
        .from('label_inventory')
        .select('id, customer_product, on_hand')
        .gt('on_hand', 0)
        .order('customer_product');

      if (labelError) throw labelError;
      setLabels(labelData || []);
    } catch (error: any) {
      console.error('Error loading packaging options:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('order_headers')
        .select(`
          id, po_number, due_date,
          customers(company_name)
        `)
        .not('status', 'in', '("completed","shipped","cancelled")')
        .order('due_date', { ascending: true });

      if (error) throw error;
      
      setOrders((data || []).map((o: any) => ({
        id: o.id,
        po_number: o.po_number || 'No PO#',
        customer_name: o.customers?.company_name || 'Unknown Customer',
        due_date: o.due_date
      })));
    } catch (error: any) {
      console.error('Error loading orders:', error);
    }
  };

  // Set formula when duplicating after formulas load
  useEffect(() => {
    if (duplicateData && formulas.length > 0) {
      const formula = formulas.find(f => f.id === duplicateData.formula_id);
      if (formula) {
        setSelectedFormula(formula);
      }
    }
  }, [duplicateData, formulas]);

  // Auto-check materials when formula, batches, or date changes
  useEffect(() => {
    const batchNum = parseInt(batches);
    if (selectedFormula && batchNum > 0 && date) {
      checkMaterials();
    } else {
      setMaterialsCheck(null);
    }
  }, [selectedFormula, batches, date]);

  const loadFormulas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.rpc('get_accessible_formulas', {
        _user_id: user.id
      });

      if (error) throw error;
      // Map the data to include missing fields for compatibility
      const mappedFormulas = (data || []).map((formula: any) => ({
        ...formula,
        default_batch_size_kg: formula.default_batch_size_kg || 0,
        recipe_json: []  // Will be populated when needed
      }));
      setFormulas(mappedFormulas as Formula[]);
    } catch (error: any) {
      toast({
        title: "Error loading formulas",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const checkMaterials = async () => {
    const batchNum = parseInt(batches);
    if (!selectedFormula || !date || batchNum < 1) return;

    setIsChecking(true);
    try {
      // Format date as YYYY-MM-DD without timezone conversion
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      const { data, error } = await supabase.rpc('fn_check_materials', {
        p_formula_id: selectedFormula.id,
        p_batches: parseInt(batches),
        p_schedule_date: formattedDate
      });

      if (error) throw error;
      setMaterialsCheck(data as unknown as MaterialsCheckResult);
    } catch (error: any) {
      toast({
        title: "Error checking materials",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async () => {
    const batchNum = parseInt(batches);
    
    // Validation based on entry mode
    if (entryMode === 'dropdown') {
      if (!selectedFormula || !date || batchNum < 1 || !materialsCheck?.materials_ok) {
        return;
      }
    } else {
      // Manual mode: just need formula name and batches
      if (!manualFormulaName.trim() || !date || batchNum < 1) {
        return;
      }
    }

    // Check if scheduling in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduleDate = new Date(date);
    scheduleDate.setHours(0, 0, 0, 0);

    if (scheduleDate < today) {
      const confirmed = window.confirm("Are you sure you want to schedule this in the past?");
      if (!confirmed) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Format date as YYYY-MM-DD without timezone conversion
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      // Call RPC with optional formula_id and manual fields
      const { data, error } = await supabase.rpc('fn_create_schedule_item', {
        p_schedule_date: formattedDate,
        p_formula_id: entryMode === 'dropdown' ? selectedFormula?.id : null,
        p_batches: parseInt(batches),
        p_manual_customer_name: entryMode === 'manual' 
          ? (selectedManualCustomer?.company_name || manualCustomerName.trim() || null) 
          : null,
        p_manual_formula_name: entryMode === 'manual' ? manualFormulaName.trim() : null
      });

      if (error) throw error;

      // Both modes now return the same format: { ok: true, schedule_item_id: uuid }
      const scheduleItemId = (data as any)?.schedule_item_id;
      const isSuccess = (data as any)?.ok;

      if (isSuccess && scheduleItemId) {
        // Update with packaging selections and order link
        const updateData: any = {};
        
        if (selectedOrder) {
          updateData.order_header_id = selectedOrder.id;
        }
        if (selectedBottle) {
          const syntheticLabel = syntheticIdToLabel(selectedBottle.item_id);
          if (syntheticLabel) {
            updateData.bottle_label_override = syntheticLabel;
            updateData.selected_bottle_id = null;
          } else {
            updateData.selected_bottle_id = selectedBottle.item_id;
            updateData.bottle_label_override = null;
          }
        }
        if (selectedCap) {
          updateData.selected_cap_id = selectedCap.item_id;
        }
        if (selectedLabel) {
          updateData.selected_label_id = selectedLabel.id;
        }
        if (selectedCorrugated) {
          updateData.selected_corrugated_id = selectedCorrugated.item_id;
        }
        if (estimatedBottles) {
          updateData.estimated_bottles = parseInt(estimatedBottles);
        }
        
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('production_schedule_items')
            .update(updateData)
            .eq('id', scheduleItemId);
          
          if (updateError) {
            console.error('Error updating packaging selections:', updateError);
          }
        }
        
        // If this is linked to an order via orderId prop, create order_production_batches link
        if (orderId && selectedFormula) {
          // Get formula to calculate estimated bottles
          const { data: formulaData } = await supabase
            .from('formulas')
            .select('gummies_per_batch')
            .eq('id', selectedFormula.id)
            .single();
          
          const gummiesPerBatch = formulaData?.gummies_per_batch || 0;
          const estBottles = gummiesPerBatch > 0 
            ? Math.floor((gummiesPerBatch * parseInt(batches)) / 60)
            : 0;
          
          // Get next batch sequence for this line item
          const { data: existingBatches } = await supabase
            .from('order_production_batches')
            .select('batch_sequence')
            .eq('line_item_id', orderId)
            .order('batch_sequence', { ascending: false })
            .limit(1);
          
          const nextSequence = existingBatches?.[0]?.batch_sequence 
            ? existingBatches[0].batch_sequence + 1 
            : 1;
          
          await supabase
            .from('order_production_batches')
            .insert({
              line_item_id: orderId,
              production_schedule_item_id: scheduleItemId,
              estimated_bottles: estBottles,
              batch_sequence: nextSequence,
            });
        }
        
        const batchName = entryMode === 'dropdown' 
          ? selectedFormula?.name 
          : manualFormulaName.trim();
        
        const linkedTo = selectedOrder 
          ? ` and linked to ${selectedOrder.po_number}` 
          : orderId 
          ? ' and linked to order' 
          : '';
        
        // Fire-and-forget email notification for scheduled order
        if (selectedOrder?.id) {
          supabase.functions.invoke('send-order-email', {
            body: { order_id: selectedOrder.id, event_type: 'SCHEDULED', schedule_date: format(date, 'PPP') },
          }).catch(err => console.error('Email notification error:', err));
        } else if (orderId) {
          // orderId from props (when scheduling from order detail)
          supabase.functions.invoke('send-order-email', {
            body: { order_id: orderId, event_type: 'SCHEDULED', schedule_date: format(date, 'PPP') },
          }).catch(err => console.error('Email notification error:', err));
        }

        toast({
          title: "Batch scheduled successfully",
          description: `${parseInt(batches)} batch(es) of ${batchName} scheduled for ${format(date, 'PPP')}${linkedTo}`
        });
        onSuccess();
        onOpenChange(false);
        resetForm();
      } else {
        throw new Error((data as any)?.shortages ? "Material shortages detected" : "Failed to schedule batch");
      }
    } catch (error: any) {
      toast({
        title: "Error scheduling batch",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAnother = async () => {
    await handleSubmit();
    if (materialsCheck?.materials_ok) {
      // Keep date, reset other fields
      setSelectedFormula(null);
      setBatches("");
      setMaterialsCheck(null);
      setEstimatedBottles("");
    }
  };

  const resetForm = () => {
    setSelectedFormula(null);
    setSelectedOrder(null);
    setBatches("");
    setDate(new Date());
    setMaterialsCheck(null);
    setOrderSearch("");
    setSelectedBottle(null);
    setSelectedCap(null);
    setSelectedLabel(null);
    setSelectedCorrugated(null);
    setEstimatedBottles("");
    setEntryMode('dropdown');
    setManualCustomerName("");
    setManualFormulaName("");
    setSelectedManualCustomer(null);
    setManualCustomerSearch("");
  };

  // Fuzzy search for customers (for manual mode)
  const filteredCustomers = useMemo(() => {
    if (!manualCustomerSearch.trim()) return customers;
    const fuse = new Fuse(customers, { keys: ['company_name'], threshold: 0.3 });
    return fuse.search(manualCustomerSearch).map(r => r.item);
  }, [customers, manualCustomerSearch]);

  // Fuzzy search for orders
  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) {
      return orders;
    }

    const fuse = new Fuse(orders, {
      keys: ['po_number', 'customer_name'],
      threshold: 0.3,
      includeScore: true,
    });

    const results = fuse.search(orderSearch);
    return results.map(result => result.item);
  }, [orders, orderSearch]);

  const totalWeight = useMemo(() => {
    const batchNum = parseInt(batches) || 0;
    return selectedFormula ? selectedFormula.default_batch_size_kg * batchNum : 0;
  }, [selectedFormula, batches]);

  // Fuzzy search for formulas
  const filteredFormulas = useMemo(() => {
    if (!formulaSearch.trim()) {
      return formulas;
    }

    const fuse = new Fuse(formulas, {
      keys: ['code', 'name'],
      threshold: 0.3,
      includeScore: true,
    });

    const results = fuse.search(formulaSearch);
    return results.map(result => result.item);
  }, [formulas, formulaSearch]);

  // Fuzzy search for packaging
  const filteredBottles = useMemo(() => {
    if (!bottleSearch.trim()) return bottles;
    const fuse = new Fuse(bottles, { keys: ['item_name'], threshold: 0.3 });
    return fuse.search(bottleSearch).map(r => r.item);
  }, [bottles, bottleSearch]);

  const filteredCaps = useMemo(() => {
    if (!capSearch.trim()) return caps;
    const fuse = new Fuse(caps, { keys: ['item_name'], threshold: 0.3 });
    return fuse.search(capSearch).map(r => r.item);
  }, [caps, capSearch]);

  const filteredCorrugated = useMemo(() => {
    if (!corrugatedSearch.trim()) return corrugated;
    const fuse = new Fuse(corrugated, { keys: ['item_name'], threshold: 0.3 });
    return fuse.search(corrugatedSearch).map(r => r.item);
  }, [corrugated, corrugatedSearch]);

  const filteredLabels = useMemo(() => {
    if (!labelSearch.trim()) return labels;
    const fuse = new Fuse(labels, { keys: ['customer_product'], threshold: 0.3 });
    return fuse.search(labelSearch).map(r => r.item);
  }, [labels, labelSearch]);

  const canSubmit = useMemo(() => {
    const batchNum = parseInt(batches);
    if (!date || batchNum < 1 || isSubmitting) return false;
    
    if (entryMode === 'dropdown') {
      // Dropdown mode: formula optional, but if selected needs material check to pass
      return !selectedFormula || materialsCheck?.materials_ok;
    } else {
      // Manual mode: just need formula/product name
      return manualFormulaName.trim().length > 0;
    }
  }, [entryMode, selectedFormula, materialsCheck, batches, date, manualFormulaName, isSubmitting]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="[--dialog-max-width:42rem] max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{duplicateData ? 'Duplicate Batch' : 'Schedule New Batch'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* PO Number Selector */}
          <div className="space-y-2">
            <Label>PO Number <span className="text-muted-foreground text-sm">(optional)</span></Label>
            <Popover open={orderOpen} onOpenChange={setOrderOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={orderOpen}
                  className="w-full justify-between"
                >
                  {selectedOrder ? (
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      {selectedOrder.po_number} • {selectedOrder.customer_name}
                    </span>
                  ) : (
                    "Select PO number..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-full p-0 bg-popover z-[100]" 
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                style={{ pointerEvents: 'auto' }}
              >
                <div className="p-3 border-b">
                  <input
                    className="w-full p-2 text-sm border rounded-md bg-background"
                    placeholder="Search by PO# or customer..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <div 
                  className="max-h-64 overflow-y-auto overscroll-contain p-1"
                  style={{ pointerEvents: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y' }}
                  onWheel={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {/* Clear selection option */}
                  {selectedOrder && (
                    <div
                      className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer text-muted-foreground"
                      onClick={() => {
                        setSelectedOrder(null);
                        setOrderOpen(false);
                        setOrderSearch("");
                      }}
                    >
                      <span className="text-sm">Clear selection</span>
                    </div>
                  )}
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                        onClick={() => {
                          setSelectedOrder(order);
                          setOrderOpen(false);
                          setOrderSearch("");
                        }}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            selectedOrder?.id === order.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{order.po_number} • {order.customer_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Due {formatET(order.due_date, 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No active orders found
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {!selectedOrder && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                PO number not selected — batch will not be linked to an order.
              </p>
            )}
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Schedule Date</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
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
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => {
                    if (newDate) {
                      setDate(newDate);
                      setDatePickerOpen(false);
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Formula Entry Mode */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Formula Entry</Label>
              <RadioGroup 
                value={entryMode} 
                onValueChange={(value: 'dropdown' | 'manual') => {
                  setEntryMode(value);
                  // Clear relevant state when switching modes
                  if (value === 'dropdown') {
                    setManualCustomerName("");
                    setManualFormulaName("");
                    setSelectedManualCustomer(null);
                  } else {
                    setSelectedFormula(null);
                    setMaterialsCheck(null);
                  }
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dropdown" id="dropdown" />
                  <Label htmlFor="dropdown" className="cursor-pointer font-normal">Select from Library</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="cursor-pointer font-normal flex items-center gap-1">
                    <PenLine className="h-3 w-3" /> Manual Entry
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {entryMode === 'dropdown' ? (
              /* Formula Selector Dropdown */
              <div className="space-y-2">
                <Label>Formula <span className="text-muted-foreground text-sm">(optional)</span></Label>
                <Popover open={formulaOpen} onOpenChange={setFormulaOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={formulaOpen}
                      className="w-full justify-between"
                    >
                      {selectedFormula
                        ? `${selectedFormula.code} — ${selectedFormula.name}`
                        : "Select formula..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-full p-0 bg-popover z-[100]" 
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className="p-3 border-b">
                      <input
                        className="w-full p-2 text-sm border rounded-md bg-background"
                        placeholder="Search formulas..."
                        value={formulaSearch}
                        onChange={(e) => setFormulaSearch(e.target.value)}
                         autoComplete="off"
                         autoFocus
                      />
                    </div>
                    <div 
                      className="max-h-64 overflow-y-scroll overscroll-contain p-1"
                      style={{ overscrollBehavior: 'contain', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                      onWheel={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      tabIndex={0}
                    >
                      {/* Clear selection option */}
                      {selectedFormula && (
                        <div
                          className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer text-muted-foreground"
                          onClick={() => {
                            setSelectedFormula(null);
                            setFormulaOpen(false);
                            setFormulaSearch("");
                            setMaterialsCheck(null);
                          }}
                        >
                          <span className="text-sm">Clear selection</span>
                        </div>
                      )}
                      {filteredFormulas.length > 0 ? (
                        filteredFormulas.map((formula) => (
                          <div
                            key={formula.id}
                            className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                            onClick={() => {
                              setSelectedFormula(formula);
                              setFormulaOpen(false);
                              setFormulaSearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                selectedFormula?.id === formula.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{formula.code} — {formula.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {formula.default_batch_size_kg}kg batch size
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No formulas found matching "{formulaSearch}"
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              /* Manual Entry Fields */
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-dashed">
                {/* Customer Name - Dropdown or Manual */}
                <div className="space-y-2">
                  <Label>Customer Name <span className="text-muted-foreground text-sm">(optional)</span></Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Popover open={manualCustomerOpen} onOpenChange={setManualCustomerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {selectedManualCustomer
                              ? selectedManualCustomer.company_name
                              : manualCustomerName || "Select or type customer..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="w-full p-0 bg-popover z-[100]" 
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                          <div className="p-3 border-b">
                          <input
                            className="w-full p-2 text-sm border rounded-md bg-background"
                            placeholder="Search or type new customer..."
                            value={manualCustomerSearch}
                            onChange={(e) => {
                              setManualCustomerSearch(e.target.value);
                              // When typing, clear selected customer and set manual name
                              if (selectedManualCustomer) {
                                setSelectedManualCustomer(null);
                              }
                              setManualCustomerName(e.target.value);
                            }}
                            autoComplete="off"
                          />
                          </div>
                          <div 
                            className="max-h-64 overflow-y-scroll overscroll-contain p-1"
                            style={{ overscrollBehavior: 'contain', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                            onWheel={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            tabIndex={0}
                          >
                            {/* Clear selection option */}
                            {(selectedManualCustomer || manualCustomerName) && (
                              <div
                                className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer text-muted-foreground"
                                onClick={() => {
                                  setSelectedManualCustomer(null);
                                  setManualCustomerName("");
                                  setManualCustomerOpen(false);
                                  setManualCustomerSearch("");
                                }}
                              >
                                <span className="text-sm">Clear selection</span>
                              </div>
                            )}
                            {/* Use typed value as custom option */}
                            {manualCustomerSearch && !filteredCustomers.find(c => 
                              c.company_name.toLowerCase() === manualCustomerSearch.toLowerCase()
                            ) && (
                              <div
                                className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer bg-primary/5"
                                onClick={() => {
                                  setManualCustomerName(manualCustomerSearch);
                                  setSelectedManualCustomer(null);
                                  setManualCustomerOpen(false);
                                  setManualCustomerSearch("");
                                }}
                              >
                                <PenLine className="h-4 w-4 text-primary" />
                                <span className="text-sm">Use "{manualCustomerSearch}"</span>
                              </div>
                            )}
                            {filteredCustomers.map((customer) => (
                              <div
                                key={customer.id}
                                className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                                onClick={() => {
                                  setSelectedManualCustomer(customer);
                                  setManualCustomerName("");
                                  setManualCustomerOpen(false);
                                  setManualCustomerSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "h-4 w-4",
                                    selectedManualCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span>{customer.company_name}</span>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                {/* Product/Formula Name */}
                <div className="space-y-2">
                  <Label>Product / Formula Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={manualFormulaName}
                    onChange={(e) => setManualFormulaName(e.target.value)}
                    placeholder="Enter product or formula name"
                  />
                </div>

                {/* Warning about material check */}
                <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Material availability will not be checked for manual entries.</span>
                </div>
              </div>
            )}
          </div>

          {/* Batches Input */}
          <div className="space-y-2">
            <Label>Number of Batches</Label>
            <Input
              type="number"
              min="1"
              value={batches}
              onChange={(e) => setBatches(e.target.value)}
              placeholder="Enter number of batches"
            />
            {(() => {
              const b = parseInt(batches);
              const gpb = duplicateData?.gummies_per_batch || 43000;
              const bottleSize = duplicateData?.bottle_size;
              if (!b || b < 1 || !bottleSize) return null;
              const estBottles = Math.floor((b * gpb) / bottleSize);
              return (
                <p className="text-sm text-muted-foreground">
                  ≈ <span className="font-semibold text-foreground">{estBottles.toLocaleString()}</span> bottles
                  <span className="ml-1">({b} × {gpb.toLocaleString()} gummies ÷ {bottleSize} ct)</span>
                </p>
              );
            })()}
          </div>

          {/* Total Weight Display - only for dropdown mode with formula selected */}
          {entryMode === 'dropdown' && selectedFormula && (
            <div className="space-y-2">
              <Label>Total Batch Weight</Label>
              <div className="p-3 bg-muted rounded-md">
                <span className="text-lg font-semibold">{totalWeight.toLocaleString()} kg</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({batches || 0} × {selectedFormula.default_batch_size_kg}kg)
                </span>
              </div>
            </div>
          )}

          {/* Packaging Selection Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Packaging Selection</h3>
            </div>
            
            {/* Estimated Bottles */}
            <div className="space-y-2">
              <Label>Estimated Bottles <span className="text-muted-foreground text-sm">(optional)</span></Label>
              <Input
                type="number"
                min="0"
                value={estimatedBottles}
                onChange={(e) => setEstimatedBottles(e.target.value)}
                placeholder="Enter estimated bottles for this batch"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PackagingSelector
                label="Bottle Type"
                open={bottleOpen}
                setOpen={setBottleOpen}
                selected={selectedBottle}
                setSelected={setSelectedBottle}
                options={filteredBottles}
                search={bottleSearch}
                setSearch={setBottleSearch}
                displayKey="item_name"
                placeholder="Select bottle..."
              />

              <PackagingSelector
                label="Cap Type"
                open={capOpen}
                setOpen={setCapOpen}
                selected={selectedCap}
                setSelected={setSelectedCap}
                options={filteredCaps}
                search={capSearch}
                setSearch={setCapSearch}
                displayKey="item_name"
                placeholder="Select cap..."
              />

              <PackagingSelector
                label="Corrugated Box"
                open={corrugatedOpen}
                setOpen={setCorrugatedOpen}
                selected={selectedCorrugated}
                setSelected={setSelectedCorrugated}
                options={filteredCorrugated}
                search={corrugatedSearch}
                setSearch={setCorrugatedSearch}
                displayKey="item_name"
                placeholder="Select box..."
              />

              {/* Label Selector - slightly different structure */}
              <div className="space-y-2">
                <Label>Label <span className="text-muted-foreground text-sm">(optional)</span></Label>
                <Popover open={labelOpen} onOpenChange={setLabelOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedLabel ? (
                        <span className="flex items-center gap-2 truncate">
                          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLabel.customer_product}</span>
                          <span className="text-muted-foreground text-xs shrink-0">({selectedLabel.on_hand} on hand)</span>
                        </span>
                      ) : (
                        "Select label..."
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-full p-0 bg-popover z-[100]" 
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className="p-3 border-b">
                      <input
                        className="w-full p-2 text-sm border rounded-md bg-background"
                        placeholder="Search labels..."
                        value={labelSearch}
                        onChange={(e) => setLabelSearch(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                    <div 
                      className="max-h-64 overflow-y-scroll overscroll-contain p-1"
                      style={{ overscrollBehavior: 'contain', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                      onWheel={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      tabIndex={0}
                    >
                      {selectedLabel && (
                        <div
                          className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer text-muted-foreground"
                          onClick={() => {
                            setSelectedLabel(null);
                            setLabelOpen(false);
                            setLabelSearch("");
                          }}
                        >
                          <span className="text-sm">Clear selection</span>
                        </div>
                      )}
                      {filteredLabels.length > 0 ? (
                        filteredLabels.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                            onClick={() => {
                              setSelectedLabel(item);
                              setLabelOpen(false);
                              setLabelSearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                selectedLabel?.id === item.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{item.customer_product}</div>
                              <div className="text-sm text-muted-foreground">
                                {item.on_hand.toLocaleString()} on hand
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No labels found
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Materials Check - only for dropdown mode with formula selected */}
          {entryMode === 'dropdown' && selectedFormula && (
            <div className="space-y-2">
              <Label>Materials Availability</Label>
              <div className="border rounded-md p-4">
                {isChecking ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Checking materials...</p>
                  </div>
                ) : materialsCheck ? (
                  <div className="space-y-4">
                    {/* Overall Status */}
                    <div className="flex items-center gap-2">
                      {materialsCheck.materials_ok ? (
                        <>
                          <Check className="h-5 w-5 text-success" />
                          <Badge variant="default" className="bg-success text-success-foreground">
                            All materials available
                          </Badge>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          <Badge variant="destructive">Material shortages detected</Badge>
                        </>
                      )}
                    </div>

                    {/* All Ingredients List */}
                    {materialsCheck.all_ingredients && materialsCheck.all_ingredients.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Ingredient Breakdown:</h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {materialsCheck.all_ingredients.map((ingredient, index) => (
                            <div 
                              key={index} 
                              className={`p-3 rounded border ${
                                ingredient.is_sufficient 
                                  ? 'bg-success/5 border-success/20' 
                                  : 'bg-destructive/10 border-destructive/20'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="font-medium">{ingredient.ingredient_name}</div>
                                {ingredient.is_sufficient ? (
                                  <Check className="h-4 w-4 text-success" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                )}
                              </div>
                              <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Required:</span>
                                  <span className="font-medium">{ingredient.required_kg.toFixed(2)} kg</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Available:</span>
                                  <span className={ingredient.is_sufficient ? 'text-success font-medium' : 'text-destructive font-medium'}>
                                    {ingredient.available_kg.toFixed(2)} kg
                                  </span>
                                </div>
                                {!ingredient.is_sufficient && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Shortfall:</span>
                                    <span className="text-destructive font-medium">
                                      {(ingredient.required_kg - ingredient.available_kg).toFixed(2)} kg
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Shortages Summary (if no all_ingredients data) */}
                    {(!materialsCheck.all_ingredients || materialsCheck.all_ingredients.length === 0) && 
                     !materialsCheck.materials_ok && materialsCheck.shortages.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Shortages:</h4>
                        {materialsCheck.shortages.map((shortage, index) => (
                          <div key={index} className="bg-destructive/10 p-3 rounded border">
                            <div className="font-medium">{shortage.ingredient_name}</div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>Required: {shortage.required_kg.toFixed(2)} kg</div>
                              <div>Available: {shortage.available_kg.toFixed(2)} kg</div>
                              <div className="text-destructive font-medium">
                                Shortfall: {shortage.shortfall_kg.toFixed(2)} kg
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1"
            >
              {isSubmitting ? "Scheduling..." : "Add to Schedule"}
            </Button>
            <Button
              onClick={handleAddAnother}
              disabled={!canSubmit}
              variant="outline"
              className="flex-1"
            >
              Add Another Formula
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
