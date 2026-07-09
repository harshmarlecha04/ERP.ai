import React, { useState, useEffect, useMemo } from "react";
import { format, startOfDay, subDays, addDays } from "date-fns";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Package, Eye, Edit, Trash2, ArrowUpDown, GripVertical, EyeOff, Calculator, FileText, CheckSquare, Square, X, StickyNote } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useScrollMemory } from "@/hooks/useScrollMemory";
import { ProductionItemDetail } from "./ProductionItemDetail";
import { DeleteConfirmationModal } from "../inventory/DeleteConfirmationModal";
import { EditBatchesModal } from "./EditBatchesModal";
import { BottleRequirementsModal } from "./BottleRequirementsModal";
import { ProductionScheduleCostViewerModal } from "./ProductionScheduleCostViewerModal";
import { POPDFViewerModal } from "@/components/orders/POPDFViewerModal";
import { BulkRescheduleModal } from "./BulkRescheduleModal";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { formatET } from "@/utils/dateUtils";

interface NoteEntry {
  id: string;
  text: string;
  created_at: string;
  created_by: string | null;
}

interface ProductionScheduleItem {
  id: string;
  schedule_id: string;
  formula_id: string;
  formula_code: string;
  batches: number;
  total_required_kg: number;
  materials_ok: boolean;
  shortages_json: any[];
  created_at: string;
  schedule_date: string;
  display_order?: number; // For same-date reordering
  formula_name?: string;
  recipe_json?: any[]; // Stored for on-demand TCP calculation
  tcp?: number; // Total Cost of Production (calculated on demand)
  order_id?: string | null;
  order_status?: string | null;
  materials_reserved: boolean;
  po_number?: string | null;
  customer_name?: string | null;
  pdf_url?: string | null;
  // Packaging selection fields
  selected_bottle_id?: string | null;
  bottle_label_override?: string | null;
  selected_cap_id?: string | null;
  selected_label_id?: string | null;
  selected_corrugated_id?: string | null;
  estimated_bottles?: number | null;
  bottle_name?: string | null; // Bottle name from packaging_item
  // Order header link (for editing)
  order_header_id?: string | null;
  // Manual entry fields
  manual_customer_name?: string | null;
  manual_formula_name?: string | null;
  notes?: string | null;
  notes_log?: any;
}

// Resolve the bottle label, preferring an explicit override (Bulk / Bright Stock)
// over the linked packaging item's full name.
const resolveBottleLabel = (item: { bottle_label_override?: string | null; bottle_name?: string | null }): string => {
  return item.bottle_label_override || item.bottle_name || '—';
};

interface ProductionListProps {
  onScheduleUpdate: () => void;
}

type SortOption = 'newest-first' | 'oldest-first';

// Sortable Row Component
function SortableRow({ 
  item, 
  children, 
  disabled, 
  isPast 
}: { 
  item: ProductionScheduleItem; 
  children: React.ReactNode; 
  disabled: boolean;
  isPast?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });

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
        isDragging && 'relative z-50',
        isPast && 'bg-green-50 dark:bg-green-950/30'
      )}
    >
      <TableCell className="w-[40px] p-0">
        <div
          {...attributes}
          {...listeners}
          className={cn(
            "flex items-center justify-center h-full cursor-grab active:cursor-grabbing p-2",
            disabled && "cursor-not-allowed opacity-30"
          )}
          title={disabled ? "Cannot move - materials are reserved" : "Drag to reorder"}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </TableCell>
      {children}
    </TableRow>
  );
}

export function ProductionList({ onScheduleUpdate }: ProductionListProps) {
  const [scheduleItems, setScheduleItems] = useState<ProductionScheduleItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ProductionScheduleItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ProductionScheduleItem | null>(null);
  const [editBatchesModalOpen, setEditBatchesModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<ProductionScheduleItem | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('newest-first');
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editingBatchValue, setEditingBatchValue] = useState<number>(0);
  const [calculatedTCPs, setCalculatedTCPs] = useState<Record<string, number>>({});
  const [showOlderSchedules, setShowOlderSchedules] = useState(false);
  const [calculatingTCPs, setCalculatingTCPs] = useState<Record<string, boolean>>({});
  const [bottleModalOpen, setBottleModalOpen] = useState(false);
  const [costViewerOpen, setCostViewerOpen] = useState(false);
  const [itemForCostView, setItemForCostView] = useState<ProductionScheduleItem | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedPOForPdf, setSelectedPOForPdf] = useState<ProductionScheduleItem | null>(null);
  
  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkRescheduleOpen, setBulkRescheduleOpen] = useState(false);
  const [bulkRescheduleLoading, setBulkRescheduleLoading] = useState(false);
  
  // Notes panel state
  const [openNotesRowId, setOpenNotesRowId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [rowNotesCache, setRowNotesCache] = useState<Record<string, NoteEntry[]>>({});
  
  const { toast } = useToast();

  // Scroll memory hook
  const { saveScrollPosition, restoreScrollPosition } = useScrollMemory({
    restoreDelay: 150
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadScheduleItems();
  }, [sortOption]); // Re-load when sort option changes

  const calculateTCP = async (recipeJson: any[], batches: number): Promise<number> => {
    if (!recipeJson || !Array.isArray(recipeJson)) return 0;
    
    let totalCost = 0;
    
    // Get all raw materials first for smart matching
    const { data: allMaterials } = await supabase
      .from('raw_materials')
      .select('id, name, supplier')
      .eq('is_archived', false);

    console.log('TCP Calculation - Processing', recipeJson.length, 'ingredients for', batches, 'batches');

    for (const ingredient of recipeJson) {
      // Skip empty ingredients
      if (!ingredient.materialName || !ingredient.name) continue;
      
      // Extract material name and supplier from ingredient name (e.g., "Red Color (Colorcon)")
      const ingredientName = ingredient.materialName;
      let materialName = ingredientName;
      let supplierName = null;
      
      // Check if ingredient name contains supplier in parentheses
      const supplierMatch = ingredientName.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (supplierMatch) {
        materialName = supplierMatch[1].trim();
        supplierName = supplierMatch[2].trim();
      }

      console.log('TCP - Processing ingredient:', {
        original: ingredientName,
        materialName,
        supplierName
      });

      // Smart material matching - same logic as ProductionItemDetail
      let material = null;

      // First try: exact match with name and supplier
      if (supplierName) {
        material = allMaterials?.find(m => 
          m.name.toLowerCase() === materialName.toLowerCase() &&
          m.supplier?.toLowerCase() === supplierName.toLowerCase()
        );
        
        if (material) {
          console.log('TCP - Found exact name+supplier match:', material);
        }
      }

      // Fallback: match by name only, but prioritize non-zero cost materials
      if (!material) {
        // Get all materials with matching name
        const nameMatches = allMaterials?.filter(m => 
          m.name.toLowerCase() === materialName.toLowerCase()
        ) || [];

        if (nameMatches.length > 0) {
          // For each material, get cost information to prioritize
          const materialsWithCosts = await Promise.all(
            nameMatches.map(async (mat) => {
              const { data: lotData } = await supabase
                .from('raw_material_lots')
                .select('cost, quantity')
                .eq('raw_material_id', mat.id)
                .gt('quantity', 0)
                .order('created_at', { ascending: false });

              const latestCost = lotData && lotData.length > 0 ? lotData[0].cost || 0 : 0;
              return { ...mat, latestCost };
            })
          );

          // Sort by cost (non-zero costs first, then by highest cost)
          materialsWithCosts.sort((a, b) => {
            if (a.latestCost === 0 && b.latestCost > 0) return 1;
            if (b.latestCost === 0 && a.latestCost > 0) return -1;
            return b.latestCost - a.latestCost;
          });

          material = materialsWithCosts[0];
          console.log('TCP - Selected best match with cost priority:', material);
        }
      }

      if (!material) {
        console.log('TCP - Raw material not found for:', ingredientName);
        continue;
      }
      
      // Get latest lot cost (not weighted average) - same as ProductionItemDetail
      const { data: lots, error: lotsError } = await supabase
        .from('raw_material_lots')
        .select('cost, quantity')
        .eq('raw_material_id', material.id)
        .gt('quantity', 0)
        .order('created_at', { ascending: false });

      if (!lotsError && lots && lots.length > 0) {
        // Use latest lot cost instead of weighted average
        const latestCost = lots[0].cost || 0;
        const qtyPerBatch = parseFloat(ingredient.weightKg) || 0;
        const ingredientTotalCost = qtyPerBatch * batches * latestCost;
        
        console.log('TCP - Ingredient cost calculation:', {
          ingredient: ingredientName,
          qtyPerBatch,
          batches,
          latestCost,
          totalCost: ingredientTotalCost
        });
        
        totalCost += ingredientTotalCost;
      } else {
        console.log('TCP - No lots found for material:', material.name);
      }
    }

    console.log('TCP - Final total cost:', totalCost);
    return totalCost;
  };

  const loadScheduleItems = async (shouldRestoreScroll = false) => {
    setLoading(true);
    try {
      // Step 1: Fetch production schedule items with order data
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('production_schedule_items')
        .select(`
          *,
          production_schedules!left(schedule_date),
          order_headers(id, po_number, status, pdf_url, customers(company_name)),
          order_production_batches(
            line_item_id,
            order_line_items(
              order_id,
              order_headers(id, order_number, status)
            )
          ),
          packaging_item!fk_production_schedule_items_bottle(item_name)
        `)
        .order('created_at', { ascending: false });

      if (scheduleError) throw scheduleError;

      // Step 2: Fetch accessible formulas via RPC
      const { data: formulasData, error: formulasError } = await supabase.rpc('get_accessible_formulas');
      if (formulasError) throw formulasError;

      // Step 3: Match formulas to schedule items and prepare data (TCP calculated on demand)
      const itemsWithTCP = await Promise.all(
        (scheduleData || []).map(async (item: any) => {
          const matchedFormula = formulasData?.find((f: any) => f.id === item.formula_id);
          // Store recipe_json for later TCP calculation
          const recipeJson = Array.isArray(matchedFormula?.recipe_json) 
            ? matchedFormula.recipe_json 
            : [];
          
          // Calculate correct total weight: use default_batch_size_kg * batches
          const correctTotalWeight = matchedFormula?.default_batch_size_kg 
            ? Number(matchedFormula.default_batch_size_kg) * item.batches
            : item.total_required_kg; // fallback to existing value
          
          // Direct order link via order_header_id (new method)
          const directOrder = item.order_headers;
          
          // Fallback to old method via order_production_batches
          const orderBatch = Array.isArray(item.order_production_batches) && item.order_production_batches.length > 0 
            ? item.order_production_batches[0] 
            : null;
          const lineItem = orderBatch?.order_line_items;
          const legacyOrder = lineItem?.order_headers;
          
          // Prefer direct link over legacy
          const orderId = directOrder?.id || legacyOrder?.id || null;
          const orderStatus = directOrder?.status || legacyOrder?.status || null;
          const poNumber = directOrder?.po_number || null;
          const customerName = directOrder?.customers?.company_name || null;
          const pdfUrl = directOrder?.pdf_url || null;
          
          return {
            ...item,
            schedule_date: item.production_schedules?.schedule_date || null,
            formula_code: matchedFormula?.code || item.formula_code,
            formula_name: matchedFormula?.name || item.manual_formula_name || 'Unknown Formula',
            recipe_json: recipeJson, // Store recipe for later TCP calculation
            tcp: undefined, // Will be calculated on demand
            total_required_kg: correctTotalWeight,
            order_id: orderId,
            order_status: orderStatus,
            materials_reserved: orderStatus === 'materials_reserved',
            po_number: poNumber,
            customer_name: customerName,
            pdf_url: pdfUrl,
            order_header_id: item.order_header_id || null,
            manual_customer_name: item.manual_customer_name || null,
            manual_formula_name: item.manual_formula_name || null,
            bottle_name: item.packaging_item?.item_name || null,
            bottle_label_override: item.bottle_label_override || null
          };
        })
      );

      // Sort items: today first, then future dates ascending, then past dates descending
      // Within same date, sort by display_order
      const sortedItems = [...itemsWithTCP].sort((a, b) => {
        const today = startOfDay(new Date());
        
        const dateA = a.schedule_date ? startOfDay(new Date(a.schedule_date + 'T00:00:00')) : new Date(0);
        const dateB = b.schedule_date ? startOfDay(new Date(b.schedule_date + 'T00:00:00')) : new Date(0);
        
        const isAToday = dateA.getTime() === today.getTime();
        const isBToday = dateB.getTime() === today.getTime();
        const isAFuture = dateA.getTime() > today.getTime();
        const isBFuture = dateB.getTime() > today.getTime();
        const isAPast = dateA.getTime() < today.getTime();
        const isBPast = dateB.getTime() < today.getTime();
        
        // Same date? Sort by display_order
        if (a.schedule_date === b.schedule_date) {
          return (a.display_order || 0) - (b.display_order || 0);
        }
        
        // Today comes first
        if (isAToday && !isBToday) return -1;
        if (isBToday && !isAToday) return 1;
        
        // Future dates come before past dates
        if (isAFuture && isBPast) return -1;
        if (isAPast && isBFuture) return 1;
        
        // Both future: sort ascending (nearest first)
        if (isAFuture && isBFuture) {
          return dateA.getTime() - dateB.getTime();
        }
        
        // Both past: sort descending (most recent first)
        if (isAPast && isBPast) {
          return dateB.getTime() - dateA.getTime();
        }
        
        return 0;
      });

      setScheduleItems(sortedItems);
      
      // Restore scroll if requested
      if (shouldRestoreScroll) {
        restoreScrollPosition();
      }
    } catch (error: any) {
      toast({
        title: "Error loading schedule",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from('production_schedule_items')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;

      toast({
        title: "Item deleted",
        description: "Production schedule item has been deleted successfully."
      });

      await loadScheduleItems(true);
      onScheduleUpdate();
      setDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error: any) {
      toast({
        title: "Error deleting item",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleViewItem = (item: ProductionScheduleItem) => {
    saveScrollPosition();
    setSelectedItem(item);
  };

  const handleEditItem = (item: ProductionScheduleItem) => {
    saveScrollPosition();
    setItemToEdit(item);
    setEditBatchesModalOpen(true);
  };

  const handleDeleteClick = (item: ProductionScheduleItem) => {
    saveScrollPosition();
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleViewCosts = (item: ProductionScheduleItem) => {
    setItemForCostView(item);
    setCostViewerOpen(true);
  };

  const toggleNotesPanel = (itemId: string) => {
    if (openNotesRowId === itemId) {
      setOpenNotesRowId(null);
      setNoteText("");
    } else {
      setOpenNotesRowId(itemId);
      setNoteText("");
      // Initialize cache from loaded data if not already cached
      const item = scheduleItems.find(i => i.id === itemId);
      if (item && !rowNotesCache[itemId]) {
        const existingNotes = Array.isArray(item.notes_log) ? item.notes_log as NoteEntry[] : [];
        setRowNotesCache(prev => ({ ...prev, [itemId]: existingNotes }));
      }
    }
  };

  const handleSaveNote = async (itemId: string) => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    if (trimmed.length > 2000) {
      toast({ title: "Note too long", description: "Maximum 2000 characters", variant: "destructive" });
      return;
    }

    setSavingNote(true);
    try {
      // Fetch current notes_log from DB
      const { data: current, error: fetchError } = await supabase
        .from('production_schedule_items')
        .select('notes_log')
        .eq('id', itemId)
        .single();
      if (fetchError) throw fetchError;

      const existing: NoteEntry[] = Array.isArray(current?.notes_log) ? (current.notes_log as unknown as NoteEntry[]) : [];
      const newNote: NoteEntry = {
        id: crypto.randomUUID(),
        text: trimmed,
        created_at: new Date().toISOString(),
        created_by: null
      };
      const updated = [...existing, newNote];

      const { error: updateError } = await supabase
        .from('production_schedule_items')
        .update({ notes_log: updated as any })
        .eq('id', itemId);
      if (updateError) throw updateError;

      setRowNotesCache(prev => ({ ...prev, [itemId]: updated }));
      setNoteText("");
      toast({ title: "Note saved" });
    } catch (error: any) {
      toast({ title: "Error saving note", description: error.message, variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  const getNotesForRow = (itemId: string): NoteEntry[] => {
    if (rowNotesCache[itemId]) return rowNotesCache[itemId];
    const item = scheduleItems.find(i => i.id === itemId);
    return Array.isArray(item?.notes_log) ? item.notes_log as NoteEntry[] : [];
  };

  const handleBatchIncrement = async (item: ProductionScheduleItem, increment: number) => {
    const newBatches = Math.max(1, item.batches + increment);
    await updateBatches(item, newBatches);
  };

  const calculateSingleItemTCP = async (item: ProductionScheduleItem) => {
    // Check if already calculated
    if (calculatedTCPs[item.id] !== undefined) return;
    
    setCalculatingTCPs(prev => ({ ...prev, [item.id]: true }));
    
    try {
      // Get the formula recipe if not already in item
      let recipeJson = (item as any).recipe_json;
      
      if (!recipeJson) {
        const { data: formula } = await supabase
          .from('formulas')
          .select('recipe_json')
          .eq('id', item.formula_id)
          .single();
        
        recipeJson = Array.isArray(formula?.recipe_json) ? formula.recipe_json : [];
      }
      
      const tcp = await calculateTCP(recipeJson, item.batches);
      setCalculatedTCPs(prev => ({ ...prev, [item.id]: tcp }));
    } catch (error) {
      console.error('Error calculating TCP:', error);
      toast({
        title: "Error calculating TCP",
        description: "Failed to calculate Total Cost of Production",
        variant: "destructive"
      });
    } finally {
      setCalculatingTCPs(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const updateBatches = async (item: ProductionScheduleItem, newBatches: number) => {
    if (newBatches < 1) {
      toast({
        title: "Invalid value",
        description: "Batches must be at least 1",
        variant: "destructive"
      });
      return;
    }

    try {
      // Get the formula to calculate new total weight
      const { data: formula } = await supabase
        .from('formulas')
        .select('default_batch_size_kg')
        .eq('id', item.formula_id)
        .single();

      const newTotalWeight = formula?.default_batch_size_kg 
        ? Number(formula.default_batch_size_kg) * newBatches
        : item.total_required_kg;

      const { error } = await supabase
        .from('production_schedule_items')
        .update({ 
          batches: newBatches,
          total_required_kg: newTotalWeight
        })
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: "Batches updated",
        description: `Updated to ${newBatches} batches`
      });

      loadScheduleItems();
      onScheduleUpdate();
      setEditingBatchId(null);
    } catch (error: any) {
      toast({
        title: "Error updating batches",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = scheduleItems.findIndex(item => item.id === active.id);
    const newIndex = scheduleItems.findIndex(item => item.id === over.id);

    const movedItem = scheduleItems[oldIndex];
    const targetItem = scheduleItems[newIndex];
    const targetDate = targetItem.schedule_date;

    if (!targetDate) {
      toast({
        title: "Cannot reschedule",
        description: "Target item has no schedule date",
        variant: "destructive"
      });
      return;
    }

    // Same date? Reorder within date group
    if (movedItem.schedule_date === targetDate) {
      // Get all items for this date, sorted by current display_order
      const dateItems = scheduleItems
        .filter(item => item.schedule_date === movedItem.schedule_date)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      
      const dateOldIndex = dateItems.findIndex(item => item.id === active.id);
      const dateNewIndex = dateItems.findIndex(item => item.id === over.id);
      
      if (dateOldIndex === dateNewIndex) return;
      
      const reorderedDateItems = arrayMove(dateItems, dateOldIndex, dateNewIndex);
      
      // Optimistically update local state
      const updatedItems = scheduleItems.map(item => {
        const reorderedIndex = reorderedDateItems.findIndex(ri => ri.id === item.id);
        if (reorderedIndex !== -1) {
          return { ...item, display_order: reorderedIndex + 1 };
        }
        return item;
      });
      setScheduleItems(updatedItems);

      // Batch update display_order in database
      try {
        const updates = reorderedDateItems.map((item, index) => 
          supabase
            .from('production_schedule_items')
            .update({ display_order: index + 1 })
            .eq('id', item.id)
        );
        
        await Promise.all(updates);
        
        toast({
          title: "Order updated",
          description: `Reordered items for ${formatET(targetDate, 'PPP')}`
        });
        
        loadScheduleItems();
      } catch (error: any) {
        loadScheduleItems(); // Revert on error
        toast({
          title: "Error reordering",
          description: error.message,
          variant: "destructive"
        });
      }
      return;
    }

    // Different date? Use existing reschedule logic
    const reorderedItems = arrayMove(scheduleItems, oldIndex, newIndex);
    setScheduleItems(reorderedItems);

    try {
      const { data, error } = await supabase.rpc('fn_move_item_and_recheck', {
        p_schedule_item_id: movedItem.id,
        p_new_date: targetDate
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.ok) {
        loadScheduleItems();
        toast({
          title: "Cannot reschedule",
          description: result?.message || "Material shortages prevent moving to this date",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Schedule updated",
        description: `Moved ${movedItem.formula_code} to ${formatET(targetDate, 'PPP')}`
      });

      loadScheduleItems();
      onScheduleUpdate();
    } catch (error: any) {
      loadScheduleItems();
      toast({
        title: "Error rescheduling",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Bulk reschedule handler
  const handleBulkReschedule = async (dayShift: number) => {
    const itemsToUpdate = scheduleItems.filter(item => selectedItems.has(item.id));
    
    if (itemsToUpdate.length === 0) return;
    
    setBulkRescheduleLoading(true);
    
    try {
      let successCount = 0;
      const failedItems: string[] = [];

      for (const item of itemsToUpdate) {
        if (!item.schedule_date) {
          successCount++;
          continue;
        }

        const currentDate = new Date(item.schedule_date + 'T00:00:00');
        const newDate = addDays(currentDate, dayShift);
        const newDateStr = format(newDate, 'yyyy-MM-dd');

        const { error } = await supabase.rpc('fn_move_item_and_recheck', {
          p_schedule_item_id: item.id,
          p_new_date: newDateStr
        });

        if (error) {
          failedItems.push(item.formula_name || item.id);
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Schedule updated",
          description: `Moved ${successCount} of ${itemsToUpdate.length} item${itemsToUpdate.length !== 1 ? 's' : ''} by ${dayShift} day${Math.abs(dayShift) !== 1 ? 's' : ''}`
        });
      }

      if (failedItems.length > 0) {
        toast({
          title: `Failed to move ${failedItems.length} item(s)`,
          description: failedItems.slice(0, 5).join(', ') + (failedItems.length > 5 ? '...' : ''),
          variant: "destructive"
        });
      }

      setSelectedItems(new Set());
      setSelectionMode(false);
      setBulkRescheduleOpen(false);
      loadScheduleItems();
      onScheduleUpdate();
    } catch (error: any) {
      toast({
        title: "Error rescheduling",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setBulkRescheduleLoading(false);
    }
  };

  // Selection helpers
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === visibleItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(visibleItems.map(item => item.id)));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedItems(new Set());
  };

  // Date classification helpers - must be before any early returns
  const today = useMemo(() => startOfDay(new Date()), []);
  
  const classifyItem = (item: ProductionScheduleItem): 'current-future' | 'past' => {
    if (!item.schedule_date) return 'current-future';
    const scheduleDate = startOfDay(new Date(item.schedule_date + 'T00:00:00'));
    
    if (scheduleDate.getTime() >= today.getTime()) return 'current-future';
    return 'past';
  };
  
  const isPastDate = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    const scheduleDate = startOfDay(new Date(dateStr + 'T00:00:00'));
    return scheduleDate.getTime() < today.getTime();
  };
  
  // Filter visible items based on date and toggle state - only show today and future by default
  const { visibleItems, olderCount } = useMemo(() => {
    const older = scheduleItems.filter(item => classifyItem(item) === 'past');
    const visible = scheduleItems.filter(item => {
      const classification = classifyItem(item);
      if (classification === 'past') return showOlderSchedules;
      return true;
    });
    return { visibleItems: visible, olderCount: older.length };
  }, [scheduleItems, showOlderSchedules, today]);

  // Count unique production days scheduled (today and future only)
  const scheduledDaysCount = useMemo(() => {
    const futureDates = new Set<string>();
    scheduleItems.forEach(item => {
      if (item.schedule_date) {
        const scheduleDate = startOfDay(new Date(item.schedule_date + 'T00:00:00'));
        if (scheduleDate.getTime() >= today.getTime()) {
          futureDates.add(item.schedule_date);
        }
      }
    });
    return futureDates.size;
  }, [scheduleItems, today]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading schedule...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Production Schedule List
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {scheduledDaysCount} production {scheduledDaysCount === 1 ? 'day' : 'days'} scheduled
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBottleModalOpen(true)}
                className="gap-2"
              >
                <Package className="h-4 w-4" />
                Bottles
              </Button>
              {olderCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOlderSchedules(!showOlderSchedules)}
                  className="gap-2"
                >
                  {showOlderSchedules ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Hide Older ({olderCount})
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Show Older ({olderCount})
                    </>
                  )}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    Sort: {sortOption === 'newest-first' ? 'Newest First' : 'Oldest First'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setSortOption('newest-first')}
                    className={sortOption === 'newest-first' ? 'bg-muted' : ''}
                  >
                    Scheduled Date Latest to Old (Default)
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setSortOption('oldest-first')}
                    className={sortOption === 'oldest-first' ? 'bg-muted' : ''}
                  >
                    Scheduled Date Old to Latest
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant={selectionMode ? "default" : "outline"}
                size="sm"
                onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                className="gap-2"
              >
                {selectionMode ? (
                  <>
                    <X className="h-4 w-4" />
                    Cancel
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4" />
                    Select
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visibleItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No scheduled batches found</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectionMode && (
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedItems.size === visibleItems.length && visibleItems.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                      )}
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="text-center">Product Code</TableHead>
                      <TableHead className="text-center">PO Number</TableHead>
                      <TableHead className="text-center">Product Name</TableHead>
                      <TableHead className="text-center">Bottle</TableHead>
                      <TableHead className="text-center">Schedule Date</TableHead>
                      <TableHead className="text-center">Day</TableHead>
                      <TableHead className="text-center">Number of Batches</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={visibleItems.map(item => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {visibleItems.map((item) => (
                        <React.Fragment key={item.id}>
                        <SortableRow
                          item={item}
                          disabled={item.materials_reserved || selectionMode}
                          isPast={isPastDate(item.schedule_date)}
                        >
                          {selectionMode && (
                            <TableCell className="w-[40px]">
                              <Checkbox
                                checked={selectedItems.has(item.id)}
                                onCheckedChange={() => toggleItemSelection(item.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium text-center">
                            <div>
                              {item.formula_code || (item.manual_customer_name ? `(${item.manual_customer_name})` : '—')}
                              {item.customer_name && (
                                <span className="text-xs text-muted-foreground block">{item.customer_name}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.po_number ? (
                              <div className="flex flex-col items-center">
                                <button
                                  onClick={() => {
                                    setSelectedPOForPdf(item);
                                    setPdfModalOpen(true);
                                  }}
                                  className="font-medium text-primary hover:underline cursor-pointer flex items-center gap-1"
                                  title={item.pdf_url ? "View PO PDF" : "Upload PO PDF"}
                                >
                                  {item.po_number}
                                  <FileText className={cn("h-3 w-3", item.pdf_url ? "text-green-600" : "text-muted-foreground")} />
                                </button>
                                {item.customer_name && (
                                  <span className="text-xs text-muted-foreground block">{item.customer_name}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div>
                              {item.formula_name}
                              {item.manual_customer_name && !item.formula_code && (
                                <span className="text-xs text-muted-foreground block">Manual Entry</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {resolveBottleLabel(item)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {item.schedule_date 
                                ? formatET(item.schedule_date, 'MMM dd, yyyy')
                                : 'Not scheduled'}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.schedule_date 
                              ? formatET(item.schedule_date, 'EEE')
                              : '—'}
                          </TableCell>
                          <TableCell className="text-center">×{item.batches}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditItem(item)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewItem(item)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant={openNotesRowId === item.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => toggleNotesPanel(item.id)}
                                className="relative"
                              >
                                <StickyNote className="h-4 w-4" />
                                {getNotesForRow(item.id).length > 0 && openNotesRowId !== item.id && (
                                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteClick(item)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </SortableRow>
                        {openNotesRowId === item.id && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={selectionMode ? 11 : 10} className="p-4">
                              <div className="max-w-2xl mx-auto space-y-3">
                                <div className="space-y-2">
                                  <Textarea
                                    placeholder="Add a note..."
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value.slice(0, 2000))}
                                    className="min-h-[60px] resize-none"
                                  />
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">{noteText.length}/2000</span>
                                    <Button
                                      size="sm"
                                      onClick={() => handleSaveNote(item.id)}
                                      disabled={savingNote || !noteText.trim()}
                                    >
                                      {savingNote ? "Saving..." : "Save Note"}
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {getNotesForRow(item.id).length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">No notes yet.</p>
                                  ) : (
                                    [...getNotesForRow(item.id)]
                                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                      .map((note) => (
                                        <div key={note.id} className="text-sm border-l-2 border-muted-foreground/30 pl-3 py-1">
                                          <span className="text-xs text-muted-foreground">
                                            {formatET(note.created_at, "MMM dd, yyyy h:mm a")}
                                          </span>
                                          <p className="mt-0.5 whitespace-pre-wrap break-words">{note.text}</p>
                                        </div>
                                      ))
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        </React.Fragment>
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </div>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {selectedItem && (
        <ProductionItemDetail
          item={selectedItem}
          open={!!selectedItem}
          onOpenChange={() => setSelectedItem(null)}
          onUpdate={() => {
            loadScheduleItems(true);
            onScheduleUpdate();
          }}
        />
      )}

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDeleteItem}
        title="Delete Production Schedule Item"
        description={`Are you sure you want to delete this production schedule item for ${itemToDelete?.formula_code}? This action cannot be undone.`}
      />

      {itemToEdit && (
        <EditBatchesModal
          isOpen={editBatchesModalOpen}
          onClose={() => {
            setEditBatchesModalOpen(false);
            setItemToEdit(null);
          }}
          onUpdate={() => {
            loadScheduleItems(true);
            onScheduleUpdate();
            setEditBatchesModalOpen(false);
            setItemToEdit(null);
          }}
          item={itemToEdit}
        />
      )}

      <BottleRequirementsModal
        open={bottleModalOpen}
        onOpenChange={setBottleModalOpen}
      />

      {itemForCostView && (
        <ProductionScheduleCostViewerModal
          isOpen={costViewerOpen}
          onClose={() => {
            setCostViewerOpen(false);
            setItemForCostView(null);
          }}
          formulaId={itemForCostView.formula_id}
          formulaCode={itemForCostView.formula_code}
          formulaName={itemForCostView.formula_name || 'Unknown Formula'}
          scheduledBatches={itemForCostView.batches}
        />
      )}

      {/* PO PDF Viewer Modal */}
      <POPDFViewerModal
        isOpen={pdfModalOpen}
        onClose={() => {
          setPdfModalOpen(false);
          setSelectedPOForPdf(null);
        }}
        orderId={selectedPOForPdf?.order_header_id || null}
        poNumber={selectedPOForPdf?.po_number || null}
        pdfUrl={selectedPOForPdf?.pdf_url || null}
        onPdfChange={() => loadScheduleItems(true)}
      />

      {/* Bulk Reschedule Modal */}
      <BulkRescheduleModal
        isOpen={bulkRescheduleOpen}
        onClose={() => setBulkRescheduleOpen(false)}
        onConfirm={handleBulkReschedule}
        selectedItems={scheduleItems.filter(item => selectedItems.has(item.id))}
        isLoading={bulkRescheduleLoading}
      />

      {/* Floating action bar when items are selected */}
      {selectionMode && selectedItems.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">
            {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
          </span>
          <Button
            size="sm"
            onClick={() => setBulkRescheduleOpen(true)}
          >
            Reschedule Selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={exitSelectionMode}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      )}
    </>
  );
}