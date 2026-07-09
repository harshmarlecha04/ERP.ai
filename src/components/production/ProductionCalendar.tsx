import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Lock } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProductionItemDetail } from "./ProductionItemDetail";
import { ProductionEventContextMenu } from "./ProductionEventContextMenu";
import { ScheduleNewBatchModal } from "./ScheduleNewBatchModal";

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
  formula_name?: string;
  manual_formula_name?: string | null;
  order_id?: string | null;
  order_status?: string | null;
  materials_reserved: boolean;
  po_number?: string | null;
  customer_name?: string | null;
}

interface ProductionCalendarProps {
  onScheduleUpdate: () => void;
}

export function ProductionCalendar({ onScheduleUpdate }: ProductionCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [scheduleItems, setScheduleItems] = useState<ProductionScheduleItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ProductionScheduleItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<ProductionScheduleItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadScheduleItems();
  }, [currentDate, viewMode]);

  const loadScheduleItems = async () => {
    setLoading(true);
    try {
      let rangeStart, rangeEnd;
      
      if (viewMode === 'week') {
        rangeStart = format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
        rangeEnd = format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      } else {
        // Get the actual visible range (6 weeks that may span 2-3 months)
        // This ensures cross-month drag-and-drop works correctly
        const monthStart = startOfMonth(currentDate);
        
        // Calculate the grid boundaries (same logic as getDaysForView)
        const startDayOffset = monthStart.getDay(); // 0-6 (Sunday-Saturday)
        const gridStart = new Date(monthStart);
        gridStart.setDate(gridStart.getDate() - startDayOffset);
        
        const gridEnd = new Date(gridStart);
        gridEnd.setDate(gridEnd.getDate() + 41); // 42 cells total (0-41)
        
        rangeStart = format(gridStart, 'yyyy-MM-dd');
        rangeEnd = format(gridEnd, 'yyyy-MM-dd');
      }

      // Step 1: Fetch production schedule items with order data (including direct order_header_id link)
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('production_schedule_items')
        .select(`
          *,
          production_schedules!inner(schedule_date),
          order_headers(id, po_number, status, customers(company_name)),
          order_production_batches(
            line_item_id,
            order_line_items(
              order_id,
              order_headers(id, order_number, status)
            )
          )
        `)
        .gte('production_schedules.schedule_date', rangeStart)
        .lte('production_schedules.schedule_date', rangeEnd)
        .order('created_at', { ascending: true });

      if (scheduleError) throw scheduleError;

      // Step 2: Fetch accessible formulas via RPC
      const { data: formulasData, error: formulasError } = await supabase.rpc('get_accessible_formulas');
      if (formulasError) throw formulasError;

      // Step 3: Match formulas to schedule items and add reservation status
      const items: ProductionScheduleItem[] = (scheduleData || []).map((item: any) => {
        const matchedFormula = formulasData?.find((f: any) => f.id === item.formula_id);
        
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
        
        return {
          ...item,
          schedule_date: item.production_schedules?.schedule_date || null,
          formula_code: matchedFormula?.code || item.formula_code,
          formula_name: matchedFormula?.name || item.manual_formula_name || 'Unknown Formula',
          order_id: orderId,
          order_status: orderStatus,
          materials_reserved: orderStatus === 'materials_reserved',
          po_number: poNumber,
          customer_name: customerName
        };
      });

      setScheduleItems(items);
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

  const handleDragStart = (e: React.DragEvent, item: ProductionScheduleItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    
    if (!draggedItem) return;

    const newDateStr = format(targetDate, 'yyyy-MM-dd');
    const currentDateStr = draggedItem.schedule_date;

    if (newDateStr === currentDateStr) {
      setDraggedItem(null);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('fn_move_item_and_recheck', {
        p_schedule_item_id: draggedItem.id,
        p_new_date: newDateStr
      });

      if (error) throw error;

      const result = data as any;
      if (result?.ok) {
        toast({
          title: "Schedule updated",
          description: result?.message || `Moved ${draggedItem.formula_code} to ${format(targetDate, 'PPP')}`
        });
        loadScheduleItems();
        onScheduleUpdate();
      } else {
        toast({
          title: "Cannot reschedule",
          description: result?.message || "Material shortages prevent moving to this date",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error rescheduling",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDraggedItem(null);
    }
  };

  const handleDuplicateItem = (item: ProductionScheduleItem) => {
    setDuplicateData({
      formula_id: item.formula_id,
      formula_code: item.formula_code,
      formula_name: item.formula_name || item.manual_formula_name || 'Unknown Formula',
      batches: item.batches,
      default_batch_size_kg: item.total_required_kg / item.batches // Calculate original batch size
    });
    setDuplicateModalOpen(true);
  };

  const handleDeleteItem = async (item: ProductionScheduleItem) => {
    const confirmed = window.confirm(`Are you sure you want to delete ${item.formula_code} (${item.batches} batches)?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('production_schedule_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: "Item deleted",
        description: `${item.formula_code} has been removed from the schedule`
      });
      
      loadScheduleItems();
      onScheduleUpdate();
    } catch (error: any) {
      toast({
        title: "Error deleting item",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getItemsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return scheduleItems.filter(item => item.schedule_date === dateStr);
  };

  const getReservationStatus = (item: ProductionScheduleItem) => {
    const hasOrder = !!item.order_id;
    const isReserved = item.materials_reserved;
    const materialsOk = item.materials_ok;
    
    return {
      hasOrder,
      isReserved,
      materialsOk,
      statusKey: `${hasOrder}-${isReserved}-${materialsOk}`
    };
  };

  const renderWeekDay = (date: Date) => {
    const items = getItemsForDate(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    const isPast = compareDate < today;
    const isToday = isSameDay(date, new Date());
    const isSunday = date.getDay() === 0;
    const hasScheduledItems = items.length > 0;

    const getDayBackground = () => {
      if (isSunday) return "bg-muted/50 text-muted-foreground";
      if (isToday) return hasScheduledItems 
        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700" 
        : "bg-amber-50/50 dark:bg-amber-950/20";
      if (isPast) return hasScheduledItems 
        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" 
        : "bg-muted/40";
      // Future
      return hasScheduledItems 
        ? "bg-primary/5 border-primary/20" 
        : "bg-muted/30 text-muted-foreground";
    };

    return (
      <div
        key={date.toISOString()}
        className={cn(
          "min-h-[120px] border border-border p-3",
          getDayBackground(),
          isToday && "ring-2 ring-amber-400 dark:ring-amber-500"
        )}
        onDragOver={isSunday ? undefined : handleDragOver}
        onDrop={isSunday ? undefined : (e) => handleDrop(e, date)}
      >
        <div className="flex justify-between items-center mb-3">
          <div className={cn(
            "font-medium",
            isSunday && "opacity-60"
          )}>
            <div className="text-sm text-muted-foreground">
              {format(date, 'EEE')}
            </div>
            <div className="text-lg">
              {format(date, 'd')}
            </div>
          </div>
          {isSunday && (
            <span className="text-sm text-muted-foreground italic">(No Production)</span>
          )}
        </div>
        
        <div className="space-y-1">
          {!isSunday && items.map((item) => {
            const status = getReservationStatus(item);
            return (
              <TooltipProvider key={item.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <ProductionEventContextMenu
                        onDuplicate={() => handleDuplicateItem(item)}
                        onDelete={() => handleDeleteItem(item)}
                      >
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, item)}
                          onClick={() => setSelectedItem(item)}
                          className={cn(
                            "p-1 rounded text-xs cursor-move hover:opacity-80 transition-opacity",
                            status.isReserved && status.materialsOk
                              ? "bg-success text-success-foreground border border-success"
                              : !status.materialsOk
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-primary/10 text-primary border border-primary/30"
                          )}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="font-medium line-clamp-1 flex-1">{item.formula_name}</div>
                            {status.isReserved && <Lock className="h-3 w-3 shrink-0 mt-0.5" />}
                          </div>
                          <div className="text-[10px] opacity-75 line-clamp-1">{item.formula_code}</div>
                          <div className="opacity-90">×{item.batches}</div>

                        </div>
                      </ProductionEventContextMenu>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-medium">{item.formula_name}</div>
                      <div className="text-muted-foreground">Formula: {item.formula_code}</div>
                      {item.po_number && (
                        <div className="text-primary font-medium mt-1">
                          PO: {item.po_number}
                          {item.customer_name && <span className="text-muted-foreground font-normal"> • {item.customer_name}</span>}
                        </div>
                      )}
                      {status.hasOrder && status.isReserved && (
                        <div className="text-xs font-medium mt-1 text-success">
                          ✓ Materials Reserved
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
          {isSunday && (
            <div className="text-xs text-muted-foreground italic text-center py-4">
              No production scheduled
            </div>
          )}
        </div>
      </div>
    );
  };
  const renderMonthDay = (date: Date) => {
    const items = getItemsForDate(date);
    const isCurrentMonth = isSameMonth(date, currentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    const isPast = compareDate < today;
    const isToday = isSameDay(date, new Date());
    const isSunday = date.getDay() === 0;
    const hasScheduledItems = items.length > 0;

    const getDayBackground = () => {
      if (!isCurrentMonth) return "bg-muted/40 text-muted-foreground";
      if (isSunday) return "bg-muted/50 text-muted-foreground";
      if (isToday) return hasScheduledItems 
        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700" 
        : "bg-amber-50/50 dark:bg-amber-950/20";
      if (isPast) return hasScheduledItems 
        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" 
        : "bg-muted/40";
      // Future
      return hasScheduledItems 
        ? "bg-primary/5 border-primary/20" 
        : "bg-muted/30 text-muted-foreground";
    };

    return (
      <div
        key={date.toISOString()}
        className={cn(
          "min-h-[120px] border border-border p-2",
          getDayBackground(),
          isToday && "ring-2 ring-amber-400 dark:ring-amber-500"
        )}
        onDragOver={isSunday ? undefined : handleDragOver}
        onDrop={isSunday ? undefined : (e) => handleDrop(e, date)}
      >
        <div className={cn(
          "text-sm font-medium mb-2",
          isSunday && "opacity-60"
        )}>
          {format(date, 'd')}
          {isSunday && <span className="text-xs ml-1">(No Production)</span>}
        </div>
        <div className="space-y-1">
          {!isSunday && items.map((item) => {
            const status = getReservationStatus(item);
            return (
              <TooltipProvider key={item.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <ProductionEventContextMenu
                        onDuplicate={() => handleDuplicateItem(item)}
                        onDelete={() => handleDeleteItem(item)}
                      >
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, item)}
                          onClick={() => setSelectedItem(item)}
                          className={cn(
                            "p-1 rounded text-xs cursor-move hover:opacity-80 transition-opacity",
                            status.isReserved && status.materialsOk
                              ? "bg-success text-success-foreground border border-success"
                              : !status.materialsOk
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-primary/10 text-primary border border-primary/30"
                          )}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="font-medium line-clamp-1 flex-1">{item.formula_name}</div>
                            {status.isReserved && <Lock className="h-3 w-3 shrink-0 mt-0.5" />}
                          </div>
                          <div className="text-[10px] opacity-75 line-clamp-1">{item.formula_code}</div>
                          <div className="opacity-90">×{item.batches}</div>

                        </div>
                      </ProductionEventContextMenu>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-medium">{item.formula_name}</div>
                      <div className="text-muted-foreground">Formula: {item.formula_code}</div>
                      {item.po_number && (
                        <div className="text-primary font-medium mt-1">
                          PO: {item.po_number}
                          {item.customer_name && <span className="text-muted-foreground font-normal"> • {item.customer_name}</span>}
                        </div>
                      )}
                      {status.hasOrder && status.isReserved && (
                        <div className="text-xs font-medium mt-1 text-success">
                          ✓ Materials Reserved
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
          {isSunday && (
            <div className="text-xs text-muted-foreground italic text-center py-4">
              No production scheduled
            </div>
          )}
        </div>
      </div>
    );
  };

  const getDaysForView = () => {
    if (viewMode === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 })
      });
    } else {
      const days = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      });

      // Pad with days from previous/next month to fill grid
      const startDay = startOfMonth(currentDate).getDay();
      const paddedDays = [];
      
      for (let i = startDay - 1; i >= 0; i--) {
        const prevDay = new Date(startOfMonth(currentDate));
        prevDay.setDate(prevDay.getDate() - (i + 1));
        paddedDays.push(prevDay);
      }
      
      paddedDays.push(...days);
      
      const remainingCells = 42 - paddedDays.length; // 6 rows × 7 days
      for (let i = 1; i <= remainingCells; i++) {
        const nextDay = new Date(endOfMonth(currentDate));
        nextDay.setDate(nextDay.getDate() + i);
        paddedDays.push(nextDay);
      }
      
      return paddedDays;
    }
  };

  const paddedDays = getDaysForView();

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Production Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('month')}
                  className="rounded-r-none"
                >
                  Month
                </Button>
                <Button
                  variant={viewMode === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                  className="rounded-l-none"
                >
                  Week
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(
                    viewMode === 'week' 
                      ? subWeeks(currentDate, 1) 
                      : subMonths(currentDate, 1)
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(
                    viewMode === 'week' 
                      ? addWeeks(currentDate, 1) 
                      : addMonths(currentDate, 1)
                  )}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="text-2xl font-bold">
            {viewMode === 'week' 
              ? `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'MMM d, yyyy')}`
              : format(currentDate, 'MMMM yyyy')
            }
          </div>
          <div className="flex gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-success rounded flex items-center justify-center">
                <Lock className="h-2 w-2 text-white" />
              </div>
              <span>Materials Reserved</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-400 rounded border-2 border-amber-600 border-dashed"></div>
              <span>Scheduled (Not Reserved)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-destructive rounded"></div>
              <span>Material Shortages</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary/20 rounded"></div>
              <span>No Order Linked</span>
            </div>
          </div>
          <div className="flex gap-4 text-sm flex-wrap border-t pt-2 mt-2">
            <span className="text-muted-foreground font-medium">Day Status:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 dark:bg-green-950/40 rounded border border-green-300 dark:border-green-700"></div>
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-100 dark:bg-amber-950/40 rounded ring-2 ring-amber-400"></div>
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-primary/10 rounded border border-primary/30"></div>
              <span>Upcoming</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading schedule...</p>
            </div>
          ) : viewMode === 'week' ? (
            <div className="grid grid-cols-1 gap-px bg-border rounded-md overflow-hidden">
              {paddedDays.map(renderWeekDay)}
            </div>
          ) : (
            <div>
              {/* Calendar Header */}
              <div className="grid grid-cols-7 gap-px mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="p-2 text-center font-medium text-sm text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
                {paddedDays.map(renderMonthDay)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedItem && (
        <ProductionItemDetail
          item={selectedItem}
          open={!!selectedItem}
          onOpenChange={() => setSelectedItem(null)}
          onUpdate={() => {
            loadScheduleItems();
            onScheduleUpdate();
          }}
        />
      )}

      <ScheduleNewBatchModal
        open={duplicateModalOpen}
        onOpenChange={setDuplicateModalOpen}
        onSuccess={() => {
          loadScheduleItems();
          onScheduleUpdate();
          setDuplicateData(null);
        }}
        duplicateData={duplicateData}
      />
    </>
  );
}