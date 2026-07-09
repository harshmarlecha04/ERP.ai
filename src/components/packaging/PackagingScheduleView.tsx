import React, { useState, useMemo, useEffect } from "react";
import { parseDateString, formatET, todayET } from "@/utils/dateUtils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, ArrowUpDown, Search, Filter, AlertTriangle, CalendarIcon, Check, ChevronsUpDown, X, Loader2, Trash2, Pencil, GripVertical, Eye, EyeOff, ChevronDown, List, CheckCircle2 } from "lucide-react";
import { PackagingScheduleCalendar } from "./PackagingScheduleCalendar";
import { CustomerPOSelect } from "./CustomerPOSelect";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { usePackagingBalances } from "@/hooks/usePackagingInventory";
import { useLabelInventory } from "@/hooks/useLabelInventory";
import { usePackagingSchedule, useCreatePackagingSchedule, useDeletePackagingSchedule, useUpdatePackagingSchedule, PackagingScheduleItem as DBScheduleItem } from "@/hooks/usePackagingSchedule";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useToast } from "@/hooks/use-toast";
import { useCustomers } from "@/hooks/useCustomers";
import { useFormulas } from "@/hooks/useFormulas";
import { SearchCombobox } from "./CustomerProductCombobox";

interface ProductEntry {
  id: string;
  customerName: string;
  productName: string;
  bottleItemId: string;
  capItemId: string;
  count: string;
  customCount: string;
  labelCustomerProduct: string;
  expectedBottles: string;
  notes: string;
  lotNumber: string;
  orderHeaderId: string | null;
  labelSearchOpen: boolean;
  labelSearchTerm: string;
  capSearchOpen: boolean;
  capSearchTerm: string;
}

const COUNT_OPTIONS = ["60ct", "70ct", "90ct", "120ct", "custom"] as const;

const createEmptyEntry = (): ProductEntry => ({
  id: crypto.randomUUID(),
  customerName: "",
  productName: "",
  bottleItemId: "",
  capItemId: "",
  count: "",
  customCount: "",
  labelCustomerProduct: "",
  expectedBottles: "",
  notes: "",
  lotNumber: "",
  orderHeaderId: null,
  labelSearchOpen: false,
  labelSearchTerm: "",
  capSearchOpen: false,
  capSearchTerm: "",
});

type SortField = keyof DBScheduleItem;
type SortDirection = "asc" | "desc";

export const PackagingScheduleView: React.FC = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCustomerName, setFilterCustomerName] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("schedule_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DBScheduleItem | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  
  // Edit form state
  const [editScheduleDate, setEditScheduleDate] = useState<Date | undefined>(undefined);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editProductName, setEditProductName] = useState("");
  const [editBottleItemId, setEditBottleItemId] = useState("");
  const [editCapItemId, setEditCapItemId] = useState("");
  const [editCount, setEditCount] = useState("");
  const [editCustomCount, setEditCustomCount] = useState("");
  const [editLabelCustomerProduct, setEditLabelCustomerProduct] = useState("");
  const [editExpectedBottles, setEditExpectedBottles] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLotNumber, setEditLotNumber] = useState("");
  const [editOrderHeaderId, setEditOrderHeaderId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<"pending" | "in_progress" | "completed">("pending");
  const [editLabelSearchOpen, setEditLabelSearchOpen] = useState(false);
  const [editLabelSearchTerm, setEditLabelSearchTerm] = useState("");
  const [editCapSearchOpen, setEditCapSearchOpen] = useState(false);
  const [editCapSearchTerm, setEditCapSearchTerm] = useState("");
  
  // Form state for multi-product entry
  const [newScheduleDate, setNewScheduleDate] = useState<Date | undefined>(undefined);
  const [productEntries, setProductEntries] = useState<ProductEntry[]>([createEmptyEntry()]);
  
  // Database hooks
  const { data: scheduleData = [], isLoading } = usePackagingSchedule();
  const { mutateAsync: createSchedule, isPending: isCreating } = useCreatePackagingSchedule();
  const { mutate: deleteSchedule } = useDeletePackagingSchedule();
  const { mutate: updateSchedule, mutateAsync: updateScheduleAsync, isPending: isUpdating } = useUpdatePackagingSchedule();
  
  // Fetch inventory data
  const { data: packagingBalances } = usePackagingBalances({});
  const { data: labelInventory } = useLabelInventory();
  const { customers } = useCustomers();
  const { formulas } = useFormulas();

  const customerItems = useMemo(
    () =>
      customers.map((c: any) => ({
        id: c.id,
        name: c.company_name,
        subtitle: c.company_code || undefined,
      })),
    [customers]
  );

  const buildProductItems = (selectedCustomerName: string) => {
    const matchedCustomer = customers.find(
      (c) => c.company_name.toLowerCase() === selectedCustomerName.trim().toLowerCase()
    );
    const filtered = matchedCustomer
      ? formulas.filter(
          (f: any) => !f.customer_id || f.customer_id === matchedCustomer.id
        )
      : formulas;
    return filtered.map((f: any) => {
      const owner = f.customer_id
        ? customers.find((c) => c.id === f.customer_id)?.company_name || "Customer"
        : "Internal";
      const parts = [f.code, owner].filter(Boolean);
      return {
        id: f.id,
        name: f.name,
        subtitle: parts.join(" · "),
      };
    });
  };

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  
  // Get bottle sizes from inventory
  const bottleOptions = useMemo(() => {
    if (!packagingBalances) return [];
    return packagingBalances
      .filter((item) => item.category === "BOTTLES")
      .map((item) => ({
        id: item.item_id,
        name: item.item_name,
        onHand: item.on_hand || 0,
        bottlesPerUnit: item.bottles_per_unit || 1,
      }));
  }, [packagingBalances]);

  // Get caps from inventory
  const capOptions = useMemo(() => {
    if (!packagingBalances) return [];
    return packagingBalances
      .filter((item) => item.category === "CAPS")
      .map((item) => ({
        id: item.item_id,
        name: item.item_name,
        onHand: item.on_hand || 0,
      }));
  }, [packagingBalances]);
  
  // Get labels from inventory with search filtering
  const labelOptions = useMemo(() => {
    if (!labelInventory) return [];
    const uniqueLabels = new Map<string, { id: string; name: string; onHand: number }>();
    labelInventory.forEach((item) => {
      if (!uniqueLabels.has(item.customer_product)) {
        uniqueLabels.set(item.customer_product, {
          id: item.customer_product,
          name: item.customer_product,
          onHand: item.on_hand || 0,
        });
      } else {
        const existing = uniqueLabels.get(item.customer_product)!;
        existing.onHand += item.on_hand || 0;
      }
    });
    return Array.from(uniqueLabels.values());
  }, [labelInventory]);

  // Get unique values for filters
  const uniqueCustomerNames = useMemo(
    () => [...new Set(scheduleData.map((item) => item.customer_name))],
    [scheduleData]
  );

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let result = [...scheduleData];

    // Apply search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.customer_name.toLowerCase().includes(lowerSearch) ||
          item.product_name.toLowerCase().includes(lowerSearch) ||
          (item.notes || "").toLowerCase().includes(lowerSearch)
      );
    }

    // Apply column filters
    if (filterCustomerName !== "all") {
      result = result.filter((item) => item.customer_name === filterCustomerName);
    }
    if (filterStatus !== "all") {
      result = result.filter((item) => item.status === filterStatus);
    }

    // Apply sorting
    result.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue || "").toLowerCase();
      const bStr = String(bValue || "").toLowerCase();
      return sortDirection === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    return result;
  }, [scheduleData, searchTerm, filterCustomerName, filterStatus, sortField, sortDirection]);

  // Split into active and completed items — List view hides past-date rows
  // (Calendar keeps the full range so month navigation still works).
  const { activeItems, completedItems, completedTodayCount, todayStr } = useMemo(() => {
    const todayStr = todayET();
    const inRange = filteredAndSortedData.filter(item => item.schedule_date >= todayStr);
    const active = inRange.filter(item => item.status !== 'completed');
    const completed = inRange.filter(item => item.status === 'completed');
    const completedTodayCount = completed.filter(item => item.schedule_date === todayStr).length;
    return { activeItems: active, completedItems: completed, completedTodayCount, todayStr };
  }, [filteredAndSortedData]);

  // Auto-expand Completed section when it contains today's rows
  useEffect(() => {
    if (completedTodayCount > 0) setShowCompleted(true);
  }, [completedTodayCount]);


  // Drag and drop handler for date swapping
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedItem = activeItems.find(item => item.id === active.id);
    const targetItem = activeItems.find(item => item.id === over.id);
    
    if (!draggedItem || !targetItem) return;

    // Swap their schedule_dates
    const draggedDate = draggedItem.schedule_date;
    const targetDate = targetItem.schedule_date;

    try {
      // Update both items with swapped dates
      await Promise.all([
        updateScheduleAsync({ id: draggedItem.id, schedule_date: targetDate }),
        updateScheduleAsync({ id: targetItem.id, schedule_date: draggedDate })
      ]);
      
      toast({
        title: "Schedule swapped",
        description: `Swapped dates between "${draggedItem.product_name}" and "${targetItem.product_name}"`
      });
    } catch (error) {
      toast({
        title: "Error swapping",
        description: "Failed to swap schedule dates",
        variant: "destructive"
      });
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const resetForm = () => {
    setNewScheduleDate(undefined);
    setProductEntries([createEmptyEntry()]);
  };

  // Helper functions for product entries
  const addProductEntry = () => {
    setProductEntries((prev) => [...prev, createEmptyEntry()]);
  };

  const removeProductEntry = (id: string) => {
    if (productEntries.length > 1) {
      setProductEntries((prev) => prev.filter((entry) => entry.id !== id));
    }
  };

  const updateProductEntry = (id: string, field: keyof ProductEntry, value: string | boolean | null) => {
    setProductEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  // Validate a single entry
  const isEntryValid = (entry: ProductEntry): boolean => {
    const effectiveCount = entry.count === "custom" ? entry.customCount : entry.count;
    const isCountValid = entry.count !== "" && (entry.count !== "custom" || entry.customCount.trim() !== "");
    return (
      entry.customerName.trim() !== "" &&
      entry.productName.trim() !== "" &&
      entry.bottleItemId !== "" &&
      entry.capItemId !== "" &&
      isCountValid &&
      entry.labelCustomerProduct !== "" &&
      (parseInt(entry.expectedBottles) || 0) > 0
    );
  };

  // Check if all entries are valid
  const validEntryCount = productEntries.filter(isEntryValid).length;
  const allEntriesValid = validEntryCount === productEntries.length && productEntries.length > 0;
  const canSubmit = newScheduleDate && allEntriesValid;

  const handleAddItems = async () => {
    if (!canSubmit) return;

    // Format date using local date components to prevent timezone offset issues
    const dateStr = newScheduleDate
      ? `${newScheduleDate.getFullYear()}-${String(newScheduleDate.getMonth() + 1).padStart(2, '0')}-${String(newScheduleDate.getDate()).padStart(2, '0')}`
      : '';

    const newItems = productEntries
      .filter(isEntryValid)
      .map((entry) => {
        const finalCount = entry.count === "custom" ? entry.customCount.trim() : entry.count;

        return {
          schedule_date: dateStr,
          customer_name: entry.customerName.trim(),
          product_name: entry.productName.trim(),
          bottle_item_id: entry.bottleItemId || null,
          cap_item_id: entry.capItemId || null,
          label_customer_product: entry.labelCustomerProduct || null,
          count: finalCount,
          expected_bottles: parseInt(entry.expectedBottles) || 0,
          notes: entry.notes.trim() || null,
          lot_number: entry.lotNumber.trim() || null,
          order_header_id: entry.orderHeaderId,
        };
      });

    try {
      await createSchedule(newItems);
      resetForm();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Failed to create schedule entries:", error);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterCustomerName("all");
    setFilterStatus("all");
  };

  // parseDateString is now imported from @/utils/dateUtils

  // Edit handlers
  const handleEditClick = (item: DBScheduleItem) => {
    setEditingItem(item);
    setEditScheduleDate(parseDateString(item.schedule_date));
    setEditCustomerName(item.customer_name);
    setEditProductName(item.product_name);
    setEditBottleItemId(item.bottle_item_id || "");
    setEditCapItemId(item.cap_item_id || "");
    setEditCount(COUNT_OPTIONS.includes(item.count as any) ? item.count : "custom");
    setEditCustomCount(COUNT_OPTIONS.includes(item.count as any) ? "" : item.count);
    setEditLabelCustomerProduct(item.label_customer_product || "");
    setEditExpectedBottles(String(item.expected_bottles));
    setEditNotes(item.notes || "");
    setEditLotNumber(item.lot_number || "");
    setEditOrderHeaderId(item.order_header_id || null);
    setEditStatus(item.status);
    setIsEditDialogOpen(true);
  };

  const resetEditForm = () => {
    setEditingItem(null);
    setEditScheduleDate(undefined);
    setEditCustomerName("");
    setEditProductName("");
    setEditBottleItemId("");
    setEditCapItemId("");
    setEditCount("");
    setEditCustomCount("");
    setEditLabelCustomerProduct("");
    setEditExpectedBottles("");
    setEditNotes("");
    setEditLotNumber("");
    setEditOrderHeaderId(null);
    setEditStatus("pending");
    setEditLabelSearchOpen(false);
    setEditLabelSearchTerm("");
    setEditCapSearchOpen(false);
    setEditCapSearchTerm("");
  };

  const isEditFormValid = () => {
    const effectiveCount = editCount === "custom" ? editCustomCount : editCount;
    const isCountValid = editCount !== "" && (editCount !== "custom" || editCustomCount.trim() !== "");
    return (
      editScheduleDate &&
      editCustomerName.trim() !== "" &&
      editProductName.trim() !== "" &&
      editBottleItemId !== "" &&
      editCapItemId !== "" &&
      isCountValid &&
      editLabelCustomerProduct !== "" &&
      (parseInt(editExpectedBottles) || 0) > 0 &&
      !!editOrderHeaderId
    );
  };

  const handleUpdateItem = () => {
    if (!editingItem || !isEditFormValid() || !editScheduleDate) return;

    const dateStr = `${editScheduleDate.getFullYear()}-${String(editScheduleDate.getMonth() + 1).padStart(2, '0')}-${String(editScheduleDate.getDate()).padStart(2, '0')}`;
    const finalCount = editCount === "custom" ? editCustomCount.trim() : editCount;

    updateSchedule({
      id: editingItem.id,
      schedule_date: dateStr,
      customer_name: editCustomerName.trim(),
      product_name: editProductName.trim(),
      bottle_item_id: editBottleItemId || null,
      cap_item_id: editCapItemId || null,
      label_customer_product: editLabelCustomerProduct || null,
      count: finalCount,
      expected_bottles: parseInt(editExpectedBottles) || 0,
      notes: editNotes.trim() || null,
      lot_number: editLotNumber.trim() || null,
      order_header_id: editOrderHeaderId,
      status: editStatus,
    }, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
        resetEditForm();
      },
    });
  };

  // Get filtered labels for edit dialog
  const getEditFilteredLabels = () => {
    if (!editLabelSearchTerm) return labelOptions;
    return labelOptions.filter((label) =>
      label.name.toLowerCase().includes(editLabelSearchTerm.toLowerCase())
    );
  };

  // Get filtered caps for edit dialog
  const getEditFilteredCaps = () => {
    if (!editCapSearchTerm) return capOptions;
    return capOptions.filter((cap) =>
      cap.name.toLowerCase().includes(editCapSearchTerm.toLowerCase())
    );
  };

  const SortableHeader = ({
    field,
    children,
    className = "",
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={cn("cursor-pointer hover:bg-muted/50 transition-colors select-none", className)}
      onClick={() => handleSort(field)}
    >
      <div className={cn("flex items-center gap-1", className.includes("text-center") && "justify-center")}>
        {children}
        <ArrowUpDown
          className={cn(
            "h-4 w-4 transition-opacity",
            sortField === field ? "opacity-100" : "opacity-40"
          )}
        />
      </div>
    </TableHead>
  );

  // Sortable row component for drag and drop
  const SortableRow = ({ 
    item, 
    children,
    rowIndex
  }: { 
    item: DBScheduleItem; 
    children: React.ReactNode;
    rowIndex: number;
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
      id: item.id
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <TableRow
        ref={setNodeRef}
        style={style}
        className={cn(
          rowIndex % 2 === 0 ? "bg-background" : "bg-muted/30",
          "hover:bg-muted/50 transition-colors",
          isDragging && "relative z-50 shadow-lg"
        )}
      >
        <TableCell className="w-[40px] p-0">
          <div
            {...attributes}
            {...listeners}
            className="flex items-center justify-center h-full cursor-grab active:cursor-grabbing p-2"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </TableCell>
        {children}
      </TableRow>
    );
  };

  const renderNotes = (notes: string | null) => {
    if (!notes) return <span className="text-muted-foreground">—</span>;

    const isWarning = notes.toLowerCase().includes("warning") || notes.toLowerCase().includes("only");

    if (isWarning) {
      return (
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-destructive font-medium">{notes}</span>
        </div>
      );
    }

    return <Badge variant="secondary" className="font-normal">{notes}</Badge>;
  };

  // Filter labels for a specific entry
  const getFilteredLabels = (entry: ProductEntry) => {
    if (!entry.labelSearchTerm) return labelOptions;
    return labelOptions.filter((label) =>
      label.name.toLowerCase().includes(entry.labelSearchTerm.toLowerCase())
    );
  };

  // Filter caps for a specific entry
  const getFilteredCaps = (entry: ProductEntry) => {
    if (!entry.capSearchTerm) return capOptions;
    return capOptions.filter((cap) =>
      cap.name.toLowerCase().includes(entry.capSearchTerm.toLowerCase())
    );
  };

  // Render a single product entry form
  const renderProductEntry = (entry: ProductEntry, index: number) => {
    const selectedBottle = bottleOptions.find((b) => b.id === entry.bottleItemId);
    const isBrightStock = entry.labelCustomerProduct === "BRIGHT_STOCK";
    const selectedLabel = labelOptions.find((l) => l.id === entry.labelCustomerProduct);
    const selectedCap = capOptions.find((c) => c.id === entry.capItemId);
    const filteredLabels = getFilteredLabels(entry);
    const filteredCaps = getFilteredCaps(entry);

    return (
      <div key={entry.id} className="border rounded-lg p-4 space-y-4 bg-muted/20">
        {/* Entry Header */}
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Product {index + 1}</h4>
          {productEntries.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => removeProductEntry(entry.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Customer Name & Product Name */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Customer Name *</Label>
            <SearchCombobox
              value={entry.customerName}
              onChange={(name) => updateProductEntry(entry.id, "customerName", name)}
              items={customerItems}
              placeholder="Select customer..."
              searchPlaceholder="Search customers..."
              emptyText="No customers found. Type to add a custom name."
            />
          </div>
          <div className="space-y-2">
            <Label>Product Name *</Label>
            <SearchCombobox
              value={entry.productName}
              onChange={(name) => updateProductEntry(entry.id, "productName", name)}
              items={buildProductItems(entry.customerName)}
              placeholder="Select product..."
              searchPlaceholder="Search products..."
              emptyText="No products found. Type to add a custom name."
            />
          </div>
        </div>

        {/* Bottle Size & Cap */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Bottle Size *</Label>
            <Select
              value={entry.bottleItemId}
              onValueChange={(value) => updateProductEntry(entry.id, "bottleItemId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select bottle size" />
              </SelectTrigger>
              <SelectContent>
                {bottleOptions.map((bottle) => (
                  <SelectItem key={bottle.id} value={bottle.id}>
                    {bottle.name} ({bottle.onHand.toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBottle && (
              <p className="text-xs text-muted-foreground">
                On Hand: {selectedBottle.onHand.toLocaleString()}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Cap *</Label>
            <Popover
              open={entry.capSearchOpen}
              onOpenChange={(open) => updateProductEntry(entry.id, "capSearchOpen", open)}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={entry.capSearchOpen}
                  className="w-full justify-between"
                >
                  {selectedCap ? (
                    <span className="truncate">{selectedCap.name}</span>
                  ) : (
                    "Select cap..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                      placeholder="Search caps..."
                      value={entry.capSearchTerm}
                      onChange={(e) => updateProductEntry(entry.id, "capSearchTerm", e.target.value)}
                    />
                  </div>
                  <CommandList>
                    <CommandEmpty>No caps found.</CommandEmpty>
                    <CommandGroup className="max-h-[200px] overflow-auto">
                      {filteredCaps.map((cap) => (
                        <CommandItem
                          key={cap.id}
                          value={cap.id}
                          onSelect={() => {
                            updateProductEntry(entry.id, "capItemId", cap.id);
                            updateProductEntry(entry.id, "capSearchOpen", false);
                            updateProductEntry(entry.id, "capSearchTerm", "");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              entry.capItemId === cap.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{cap.name}</span>
                            <span className="text-xs text-muted-foreground">
                              Available: {cap.onHand.toLocaleString()}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Count & Expected Bottles */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Count *</Label>
            <Select
              value={entry.count}
              onValueChange={(value) => {
                updateProductEntry(entry.id, "count", value);
                if (value !== "custom") {
                  updateProductEntry(entry.id, "customCount", "");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select count" />
              </SelectTrigger>
              <SelectContent>
                {COUNT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "custom" ? "Custom" : option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {entry.count === "custom" && (
              <Input
                value={entry.customCount}
                onChange={(e) => updateProductEntry(entry.id, "customCount", e.target.value)}
                placeholder="e.g., 72ct, 95ct"
                className="mt-2"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>Expected Bottles *</Label>
            <Input
              type="number"
              value={entry.expectedBottles}
              onChange={(e) => updateProductEntry(entry.id, "expectedBottles", e.target.value)}
              placeholder="e.g., 1200"
            />
          </div>
        </div>

        {/* Labels & Notes */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Labels *</Label>
            <Popover
              open={entry.labelSearchOpen}
              onOpenChange={(open) => updateProductEntry(entry.id, "labelSearchOpen", open)}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={entry.labelSearchOpen}
                  className="w-full justify-between"
                >
                  {isBrightStock ? (
                    <span className="truncate">Bright Stock — No Label</span>
                  ) : selectedLabel ? (
                    <span className="truncate">{selectedLabel.name}</span>
                  ) : (
                    "Search labels..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                      placeholder="Search labels..."
                      value={entry.labelSearchTerm}
                      onChange={(e) => updateProductEntry(entry.id, "labelSearchTerm", e.target.value)}
                    />
                  </div>
                  <CommandList>
                    <CommandEmpty>No labels found.</CommandEmpty>
                    <CommandGroup className="max-h-[200px] overflow-auto">
                      <CommandItem
                        key="__bright_stock__"
                        value="__bright_stock__"
                        onSelect={() => {
                          updateProductEntry(entry.id, "labelCustomerProduct", "BRIGHT_STOCK");
                          updateProductEntry(entry.id, "labelSearchOpen", false);
                          updateProductEntry(entry.id, "labelSearchTerm", "");
                        }}
                        className="border-b"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isBrightStock ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">Bright Stock — No Label</span>
                          <span className="text-xs text-muted-foreground">
                            Pack without labels
                          </span>
                        </div>
                      </CommandItem>
                      {filteredLabels.map((label) => (
                        <CommandItem
                          key={label.id}
                          value={label.id}
                          onSelect={() => {
                            updateProductEntry(entry.id, "labelCustomerProduct", label.id);
                            updateProductEntry(entry.id, "labelSearchOpen", false);
                            updateProductEntry(entry.id, "labelSearchTerm", "");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              entry.labelCustomerProduct === label.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{label.name}</span>
                            <span className="text-xs text-muted-foreground">
                              Available: {label.onHand.toLocaleString()}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {!isBrightStock && selectedLabel && (
              <p className="text-xs text-muted-foreground">
                Available: {selectedLabel.onHand.toLocaleString()}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Lot Number</Label>
            <Input
              value={entry.lotNumber}
              onChange={(e) => updateProductEntry(entry.id, "lotNumber", e.target.value)}
              placeholder="e.g., LOT-2026-001"
            />
          </div>
          <div className="space-y-2">
            <Label>Customer PO</Label>
            {(() => {
              const matched = customers.find(
                (c) => c.company_name.toLowerCase() === entry.customerName.trim().toLowerCase()
              );
              return (
                <CustomerPOSelect
                  value={entry.orderHeaderId}
                  onChange={(id) => updateProductEntry(entry.id, "orderHeaderId", id as any)}
                  customerId={matched?.id ?? null}
                  customerName={matched?.company_name ?? entry.customerName}
                />
              );
            })()}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Input
              value={entry.notes}
              onChange={(e) => updateProductEntry(entry.id, "notes", e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
        </div>
      </div>
    );
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products, customers, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterCustomerName} onValueChange={setFilterCustomerName}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {uniqueCustomerNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            {(filterCustomerName !== "all" || filterStatus !== "all" || searchTerm) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-r-none gap-2"
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="rounded-l-none gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              Calendar
            </Button>
          </div>

          {/* Add button */}
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Packaging Schedule Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Schedule Date - Shared for all entries */}
                <div className="space-y-2 pb-4 border-b">
                  <Label>Schedule Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newScheduleDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newScheduleDate ? format(newScheduleDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newScheduleDate}
                        onSelect={setNewScheduleDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Product Entries */}
                <div className="space-y-4">
                  {productEntries.map((entry, index) => renderProductEntry(entry, index))}
                </div>

                {/* Add Another Product Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={addProductEntry}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Product
                </Button>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddItems}
                  disabled={!canSubmit || isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    `Add ${productEntries.length} ${productEntries.length === 1 ? "Entry" : "Entries"}`
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Entry Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) resetEditForm();
          }}>
            <DialogContent className="[--dialog-max-width:36rem] max-h-[min(calc(100vh-4rem),calc(100dvh-4rem))] flex flex-col overflow-hidden">
              <DialogHeader className="shrink-0">
                <DialogTitle>Edit Packaging Schedule Entry</DialogTitle>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 px-1">
                {/* Schedule Date */}
                <div className="space-y-2">
                  <Label>Schedule Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !editScheduleDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editScheduleDate ? format(editScheduleDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editScheduleDate}
                        onSelect={setEditScheduleDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Customer & Product */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer Name *</Label>
                    <SearchCombobox
                      value={editCustomerName}
                      onChange={setEditCustomerName}
                      items={customerItems}
                      placeholder="Select customer..."
                      searchPlaceholder="Search customers..."
                      emptyText="No customers found. Type to add a custom name."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Product Name *</Label>
                    <SearchCombobox
                      value={editProductName}
                      onChange={setEditProductName}
                      items={buildProductItems(editCustomerName)}
                      placeholder="Select product..."
                      searchPlaceholder="Search products..."
                      emptyText="No products found. Type to add a custom name."
                    />
                  </div>
                </div>

                {/* Bottle Size & Cap */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bottle Size *</Label>
                    <Select value={editBottleItemId} onValueChange={setEditBottleItemId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bottle size" />
                      </SelectTrigger>
                      <SelectContent>
                        {bottleOptions.map((bottle) => (
                          <SelectItem key={bottle.id} value={bottle.id}>
                            {bottle.name} ({bottle.onHand.toLocaleString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cap *</Label>
                    <Popover open={editCapSearchOpen} onOpenChange={setEditCapSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={editCapSearchOpen}
                          className="w-full justify-between"
                        >
                          {editCapItemId ? capOptions.find((c) => c.id === editCapItemId)?.name : "Select cap..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                              placeholder="Search caps..."
                              value={editCapSearchTerm}
                              onChange={(e) => setEditCapSearchTerm(e.target.value)}
                            />
                          </div>
                          <CommandList>
                            <CommandEmpty>No caps found.</CommandEmpty>
                            <CommandGroup className="max-h-[200px] overflow-auto">
                              {getEditFilteredCaps().map((cap) => (
                                <CommandItem
                                  key={cap.id}
                                  value={cap.id}
                                  onSelect={() => {
                                    setEditCapItemId(cap.id);
                                    setEditCapSearchOpen(false);
                                    setEditCapSearchTerm("");
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", editCapItemId === cap.id ? "opacity-100" : "opacity-0")} />
                                  <div className="flex flex-col">
                                    <span>{cap.name}</span>
                                    <span className="text-xs text-muted-foreground">Available: {cap.onHand.toLocaleString()}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Count & Expected Bottles */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Count *</Label>
                    <Select value={editCount} onValueChange={(value) => {
                      setEditCount(value);
                      if (value !== "custom") setEditCustomCount("");
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select count" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNT_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editCount === "custom" && (
                      <Input
                        value={editCustomCount}
                        onChange={(e) => setEditCustomCount(e.target.value)}
                        placeholder="e.g., 50ct"
                        className="mt-2"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Expected Bottles *</Label>
                    <Input
                      type="number"
                      value={editExpectedBottles}
                      onChange={(e) => setEditExpectedBottles(e.target.value)}
                      placeholder="e.g., 5000"
                    />
                  </div>
                </div>

                {/* Label */}
                <div className="space-y-2">
                  <Label>Label *</Label>
                  <Popover open={editLabelSearchOpen} onOpenChange={setEditLabelSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={editLabelSearchOpen}
                        className="w-full justify-between"
                      >
                        {editLabelCustomerProduct === "BRIGHT_STOCK"
                          ? "Bright Stock — No Label"
                          : editLabelCustomerProduct 
                          ? labelOptions.find((l) => l.id === editLabelCustomerProduct)?.name || editLabelCustomerProduct
                          : "Select label..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <input
                            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                            placeholder="Search labels..."
                            value={editLabelSearchTerm}
                            onChange={(e) => setEditLabelSearchTerm(e.target.value)}
                          />
                        </div>
                        <CommandList>
                          <CommandEmpty>No labels found.</CommandEmpty>
                          <CommandGroup className="max-h-[200px] overflow-auto">
                            <CommandItem
                              key="__bright_stock__"
                              value="__bright_stock__"
                              onSelect={() => {
                                setEditLabelCustomerProduct("BRIGHT_STOCK");
                                setEditLabelSearchOpen(false);
                                setEditLabelSearchTerm("");
                              }}
                              className="border-b"
                            >
                              <Check className={cn("mr-2 h-4 w-4", editLabelCustomerProduct === "BRIGHT_STOCK" ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-medium">Bright Stock — No Label</span>
                                <span className="text-xs text-muted-foreground">Pack without labels</span>
                              </div>
                            </CommandItem>
                            {getEditFilteredLabels().map((label) => (
                              <CommandItem
                                key={label.id}
                                value={label.id}
                                onSelect={() => {
                                  setEditLabelCustomerProduct(label.id);
                                  setEditLabelSearchOpen(false);
                                  setEditLabelSearchTerm("");
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", editLabelCustomerProduct === label.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span>{label.name}</span>
                                  <span className="text-xs text-muted-foreground">On Hand: {label.onHand.toLocaleString()}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={(value) => setEditStatus(value as typeof editStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Lot Number */}
                <div className="space-y-2">
                  <Label>Lot Number</Label>
                  <Input
                    value={editLotNumber}
                    onChange={(e) => setEditLotNumber(e.target.value)}
                    placeholder="e.g., LOT-2026-001"
                  />
                </div>

                {/* Customer PO */}
                <div className="space-y-2">
                  <Label>Customer PO</Label>
                  {(() => {
                    const matched = customers.find(
                      (c) => c.company_name.toLowerCase() === editCustomerName.trim().toLowerCase()
                    );
                    return (
                      <CustomerPOSelect
                        value={editOrderHeaderId}
                        onChange={setEditOrderHeaderId}
                        customerId={matched?.id ?? null}
                        customerName={matched?.company_name ?? editCustomerName}
                      />
                    );
                  })()}
                </div>


                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-4 border-t shrink-0">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateItem} disabled={!isEditFormValid() || isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Conditional View: List or Calendar */}
      {viewMode === 'list' ? (
        <>
          {completedTodayCount > 0 && (
            <div className="flex items-center gap-2 text-sm bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 rounded-md px-3 py-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {completedTodayCount} completed {completedTodayCount === 1 ? 'entry' : 'entries'} for today — see the Completed section below.
              </span>
            </div>
          )}
          {/* Active Entries Table with Drag & Drop */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={activeItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40px]"></TableHead>
                  <SortableHeader field="schedule_date">Schedule Date</SortableHeader>
                  <SortableHeader field="customer_name">Customer Name</SortableHeader>
                  <SortableHeader field="product_name">Product Name</SortableHeader>
                  <SortableHeader field="count">Count</SortableHeader>
                  <SortableHeader field="expected_bottles" className="text-center">Expected Bottles</SortableHeader>
                  <SortableHeader field="status">Status</SortableHeader>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No active schedule entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  activeItems.map((item, index) => (
                    <SortableRow key={item.id} item={item} rowIndex={index}>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {formatET(item.schedule_date, "MMM d, yyyy")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.customer_name}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.count}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {item.expected_bottles.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={cn(
                            item.status === 'in_progress' && 'bg-amber-500/20 text-amber-600 border-amber-500/30'
                          )}
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {renderNotes(item.notes)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => handleEditClick(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteSchedule(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </SortableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SortableContext>
      </DndContext>

      {/* Completed Entries Collapsible Section */}
      {completedItems.length > 0 && (
        <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 w-full justify-start hover:bg-muted/50"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showCompleted && "rotate-180")} />
              {showCompleted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showCompleted ? "Hide" : "Show"} Completed ({completedTodayCount > 0 ? `${completedTodayCount} today, ` : ''}{completedItems.length} total)
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border rounded-lg mt-2">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Schedule Date</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead className="text-center">Expected Bottles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedItems.map((item, index) => (
                    <TableRow
                      key={item.id}
                      className={cn(
                        index % 2 === 0 ? "bg-background" : "bg-muted/30",
                        "opacity-70"
                      )}
                    >
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {formatET(item.schedule_date, "MMM d, yyyy")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.customer_name}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.count}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {item.expected_bottles.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="default"
                          className="bg-emerald-600 text-white"
                        >
                          completed
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {renderNotes(item.notes)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteSchedule(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
        </>
      ) : (
        <PackagingScheduleCalendar
          scheduleData={filteredAndSortedData}
          onEditItem={handleEditClick}
          onReschedule={async (itemId, newDate) => {
            await updateScheduleAsync({ id: itemId, schedule_date: newDate });
          }}
        />
      )}

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {activeItems.length} active{completedItems.length > 0 && `, ${completedItems.length} completed`} of {scheduleData.length} entries
        </span>
        <span>
          Total Expected Bottles: {filteredAndSortedData.reduce((sum, item) => sum + item.expected_bottles, 0).toLocaleString()}
        </span>
      </div>
    </div>
  );
};
