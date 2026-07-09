import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Package, AlertTriangle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Fuse from "fuse.js";
import { format } from "date-fns";
import { formatET, todayET } from "@/utils/dateUtils";

interface PackagingOption {
  item_id: string;
  item_name: string;
  category: string;
  on_hand: number;
  bottles_per_unit?: number;
}

// Synthetic bottle options representing non-bottle output destinations.
// These are NOT real packaging_items rows; selecting one stores
// `bottle_label_override` instead of `selected_bottle_id`.
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
const labelToSyntheticId = (label: string | null | undefined): string | null => {
  if (label === 'Bulk') return SYNTHETIC_BULK_ID;
  if (label === 'Bright Stock') return SYNTHETIC_BRIGHT_STOCK_ID;
  return null;
};

interface LabelOption {
  id: string;
  customer_product: string;
  on_hand: number;
}

interface OrderOption {
  id: string;
  po_number: string;
  customer_name: string;
  due_date: string;
}

interface EditBatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  item: {
    id: string;
    formula_code: string;
    formula_name?: string;
    batches: number;
    formula_id: string;
    selected_bottle_id?: string | null;
    selected_cap_id?: string | null;
    selected_label_id?: string | null;
    selected_corrugated_id?: string | null;
    estimated_bottles?: number | null;
    order_header_id?: string | null;
    po_number?: string | null;
    customer_name?: string | null;
    notes?: string | null;
    bottle_label_override?: string | null;
  };
}

// Module-level reusable packaging selector (must NOT be defined inside the
// modal component, or React remounts the Popover on every parent render and
// instantly resets its open state).
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
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between min-w-0 overflow-hidden"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{selected[displayKey]}</span>
              <span className="text-muted-foreground text-xs shrink-0">({selected.on_hand} on hand)</span>
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
          className="max-h-64 overflow-y-scroll overscroll-contain p-1"
          style={{ overscrollBehavior: 'contain', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          onWheel={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          tabIndex={0}
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
            options.map((optionItem) => (
              <div
                key={optionItem.item_id || optionItem.id}
                className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                onClick={() => {
                  setSelected(optionItem);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    (selected?.item_id || selected?.id) === (optionItem.item_id || optionItem.id) ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{optionItem[displayKey]}</div>
                  {!isSyntheticBottleId(optionItem.item_id) && (
                    <div className="text-sm text-muted-foreground">
                      {(optionItem.on_hand ?? 0).toLocaleString()} on hand
                      {optionItem.bottles_per_unit && optionItem.bottles_per_unit > 1 && ` • ${optionItem.bottles_per_unit} bottles/unit`}
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

export function EditBatchesModal({
  isOpen,
  onClose,
  onUpdate,
  item,
}: EditBatchesModalProps) {
  const [batches, setBatches] = useState(Number(item.batches) || 1);
  const [notes, setNotes] = useState(item.notes || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  // Packaging options
  const [bottles, setBottles] = useState<PackagingOption[]>([]);
  const [caps, setCaps] = useState<PackagingOption[]>([]);
  const [corrugated, setCorrugated] = useState<PackagingOption[]>([]);
  const [labels, setLabels] = useState<LabelOption[]>([]);

  // Selected values
  const [selectedBottle, setSelectedBottle] = useState<PackagingOption | null>(null);
  const [selectedCap, setSelectedCap] = useState<PackagingOption | null>(null);
  const [selectedCorrugated, setSelectedCorrugated] = useState<PackagingOption | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<LabelOption | null>(null);
  const [estimatedBottles, setEstimatedBottles] = useState<string>("");

  // PO Number state
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderOption | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");

  // Dropdown open states
  const [bottleOpen, setBottleOpen] = useState(false);
  const [capOpen, setCapOpen] = useState(false);
  const [corrugatedOpen, setCorrugatedOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);

  // Search states
  const [bottleSearch, setBottleSearch] = useState("");
  const [capSearch, setCapSearch] = useState("");
  const [corrugatedSearch, setCorrugatedSearch] = useState("");
  const [labelSearch, setLabelSearch] = useState("");

  // Load packaging options and pre-populate selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setBatches(Number(item.batches) || 1);
      setNotes(item.notes || "");
      setEstimatedBottles(item.estimated_bottles?.toString() || "");
      loadPackagingOptions();
      loadOrders();
    }
  }, [isOpen, item]);
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
      // Prepend synthetic Bulk / Bright Stock options to the bottle list
      const bottlesList: PackagingOption[] = [
        ...SYNTHETIC_BOTTLE_OPTIONS,
        ...packaging.filter(p => p.category === 'BOTTLES'),
      ];
      const capsList = packaging.filter(p => p.category === 'CAPS');
      const corrugatedList = packaging.filter(p => p.category === 'CORRUGATED');

      setBottles(bottlesList);
      setCaps(capsList);
      setCorrugated(corrugatedList);

      // Pre-select current bottle, preferring an explicit override
      const overrideSyntheticId = labelToSyntheticId(item.bottle_label_override);
      if (overrideSyntheticId) {
        setSelectedBottle(bottlesList.find(b => b.item_id === overrideSyntheticId) || null);
      } else if (item.selected_bottle_id) {
        const currentBottle = bottlesList.find(b => b.item_id === item.selected_bottle_id);
        setSelectedBottle(currentBottle || null);
      } else {
        setSelectedBottle(null);
      }

      if (item.selected_cap_id) {
        const currentCap = capsList.find(c => c.item_id === item.selected_cap_id);
        setSelectedCap(currentCap || null);
      } else {
        setSelectedCap(null);
      }

      if (item.selected_corrugated_id) {
        const currentCorrugated = corrugatedList.find(c => c.item_id === item.selected_corrugated_id);
        setSelectedCorrugated(currentCorrugated || null);
      } else {
        setSelectedCorrugated(null);
      }

      // Load labels
      const { data: labelData, error: labelError } = await supabase
        .from('label_inventory')
        .select('id, customer_product, on_hand')
        .order('customer_product');

      if (labelError) throw labelError;
      const labelsList = labelData || [];
      setLabels(labelsList);

      // Pre-select current label
      if (item.selected_label_id) {
        const currentLabel = labelsList.find(l => l.id === item.selected_label_id);
        setSelectedLabel(currentLabel || null);
      } else {
        setSelectedLabel(null);
      }
    } catch (error: any) {
      console.error('Error loading packaging options:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('order_headers')
        .select(`
          id,
          po_number,
          due_date,
          customers(company_name)
        `)
        .not('status', 'in', '("completed","shipped","cancelled")')
        .order('due_date', { ascending: true });

      if (error) throw error;

      const orderOptions: OrderOption[] = (data || []).map((order: any) => ({
        id: order.id,
        po_number: order.po_number || '',
        customer_name: order.customers?.company_name || 'Unknown Customer',
        due_date: order.due_date
      }));

      setOrders(orderOptions);

      // Pre-select current order if exists
      if (item.order_header_id) {
        const currentOrder = orderOptions.find(o => o.id === item.order_header_id);
        setSelectedOrder(currentOrder || null);
      } else {
        setSelectedOrder(null);
      }
    } catch (error: any) {
      console.error('Error loading orders:', error);
    }
  };

  // Fuzzy search for orders
  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return orders;
    const fuse = new Fuse(orders, { keys: ['po_number', 'customer_name'], threshold: 0.3 });
    return fuse.search(orderSearch).map(r => r.item);
  }, [orders, orderSearch]);

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

  const handleUpdate = async () => {
    if (batches <= 0) {
      toast({
        title: "Invalid input",
        description: "Number of batches must be greater than 0",
        variant: "destructive"
      });
      return;
    }

    setIsUpdating(true);
    try {
      // Check materials availability with new batch count
      const { data: materialCheck, error: checkError } = await supabase.rpc(
        'fn_check_materials',
        {
          p_formula_id: item.formula_id,
          p_batches: batches,
          p_schedule_date: todayET()
        }
      );

      if (checkError) {
        console.error('Material check error:', checkError);
      }

      const materialCheckData = materialCheck as any;

      // Calculate total required kg based on formula's default batch size
      const { data: formulaData, error: formulaError } = await supabase.rpc('get_accessible_formulas');
      
      if (formulaError) throw formulaError;

      const formula = formulaData?.find((f: any) => f.id === item.formula_id);
      let totalRequiredKg: number = 0;

      if (formula?.default_batch_size_kg) {
        totalRequiredKg = Number(formula.default_batch_size_kg) * batches;
      } else {
        if (formula?.recipe_json && Array.isArray(formula.recipe_json)) {
          for (const ingredient of formula.recipe_json) {
            const weightKg = parseFloat(String((ingredient as any).weightKg) || '0');
            totalRequiredKg += weightKg * batches;
          }
        }
      }

      // Resolve synthetic Bulk / Bright Stock selections to a stored override
      // and clear the real bottle FK so inventory deduction skips it.
      const syntheticLabel = selectedBottle ? syntheticIdToLabel(selectedBottle.item_id) : null;
      const bottleFkValue = syntheticLabel ? null : (selectedBottle?.item_id || null);

      // Update the production schedule item with all fields
      const { error: updateError } = await supabase
        .from('production_schedule_items')
        .update({
          batches: batches,
          total_required_kg: Number(totalRequiredKg),
          materials_ok: materialCheckData?.materials_ok || false,
          shortages_json: materialCheckData?.shortages || [],
          selected_bottle_id: bottleFkValue,
          bottle_label_override: syntheticLabel,
          selected_cap_id: selectedCap?.item_id || null,
          selected_label_id: selectedLabel?.id || null,
          selected_corrugated_id: selectedCorrugated?.item_id || null,
          estimated_bottles: estimatedBottles ? parseInt(estimatedBottles) : null,
          order_header_id: selectedOrder?.id || null,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (updateError) throw updateError;

      toast({
        title: "Batch updated",
        description: `Successfully updated batch settings`
      });

      onUpdate();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error updating batch",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(32rem,calc(100vw-2rem))] max-w-none min-w-0 max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Edit Batch</DialogTitle>
          <DialogDescription>
            Update batch settings for {item.formula_code}
            {item.formula_name && ` - ${item.formula_name}`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4 min-w-0">
          {/* PO Number Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              PO Number <span className="text-muted-foreground text-sm">(optional)</span>
            </Label>
            <Popover open={orderOpen} onOpenChange={setOrderOpen}>
              <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between min-w-0 overflow-hidden"
                      disabled={isUpdating}
                    >
                      {selectedOrder ? (
                        <span className="flex-1 min-w-0 truncate text-left">
                          {selectedOrder.po_number} • {selectedOrder.customer_name}
                        </span>
                      ) : (
                        <span className="flex-1 min-w-0 truncate text-left">Select PO number...</span>
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
                            "h-4 w-4 shrink-0",
                            selectedOrder?.id === order.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {order.po_number} • {order.customer_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Due: {formatET(order.due_date, 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No orders found
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Warning when no PO selected */}
            {!selectedOrder && (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>PO number not selected — batch will not be linked to an order</span>
              </div>
            )}
          </div>

          {/* Number of Batches */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="batches" className="text-right">
              Batches
            </Label>
            <Input
              id="batches"
              type="number"
              min="1"
              value={batches}
              onChange={(e) => setBatches(parseInt(e.target.value) || 1)}
              className="col-span-3"
              disabled={isUpdating}
            />
          </div>

          {/* Packaging Selection Section */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2 text-sm">
              <Package className="h-4 w-4" />
              Packaging Selection
            </h4>

            {/* Estimated Bottles */}
            <div className="space-y-2">
              <Label htmlFor="estimatedBottles">
                Estimated Bottles <span className="text-muted-foreground text-sm">(optional)</span>
              </Label>
              <Input
                id="estimatedBottles"
                type="number"
                min="0"
                placeholder="Enter estimated bottle count"
                value={estimatedBottles}
                onChange={(e) => setEstimatedBottles(e.target.value)}
                disabled={isUpdating}
              />
            </div>

            {/* Bottle Type */}
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
              placeholder="Select bottle type..."
            />

            {/* Cap Type */}
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
              placeholder="Select cap type..."
            />

            {/* Label */}
            <PackagingSelector
              label="Label"
              open={labelOpen}
              setOpen={setLabelOpen}
              selected={selectedLabel}
              setSelected={setSelectedLabel}
              options={filteredLabels}
              search={labelSearch}
              setSearch={setLabelSearch}
              displayKey="customer_product"
              placeholder="Select label..."
            />

            {/* Corrugated Box */}
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
              placeholder="Select corrugated box..."
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="batch-notes">
              Notes <span className="text-muted-foreground text-sm">(optional)</span>
            </Label>
            <Textarea
              id="batch-notes"
              placeholder="Add notes or comments about this batch..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isUpdating}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? "Updating..." : "Update Batch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
