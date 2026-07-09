import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, Truck } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PurchaseOrderCalendarDetail } from "./PurchaseOrderCalendarDetail";
import { DayPurchaseOrdersModal } from "./DayPurchaseOrdersModal";
import type { PurchaseOrder } from "@/hooks/usePurchaseOrders";

interface PurchaseOrderCalendarProps {
  purchaseOrders: PurchaseOrder[];
  onReschedule: (orderId: string, newDate: string) => Promise<void>;
  onMarkAsReceived: (orderId: string) => Promise<void>;
  onEdit: (order: PurchaseOrder) => void;
  onReceiveIntoInventory: (order: PurchaseOrder) => void;
}

export function PurchaseOrderCalendar({
  purchaseOrders,
  onReschedule,
  onMarkAsReceived,
  onEdit,
  onReceiveIntoInventory
}: PurchaseOrderCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [draggedOrder, setDraggedOrder] = useState<PurchaseOrder | null>(null);
  const [showAllPOsModal, setShowAllPOsModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { toast } = useToast();

  const getOrdersForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const filteredOrders = purchaseOrders.filter(order => {
      if (!order.expected_delivery) return false;
      
      // Handle the date string directly as if it's already in local time
      // This avoids timezone conversion issues
      const orderDateStr = order.expected_delivery.split('T')[0]; // Get just the date part
      
      const matches = orderDateStr === dateStr;
      
      // Debug logging for Sept 29, 2025
      if (dateStr === '2025-09-29') {
        console.log(`🔍 Checking Sept 29:`, {
          dateStr,
          totalOrders: purchaseOrders.length,
          orderDetails: purchaseOrders.map(o => ({
            po_number: o.po_number,
            expected_delivery: o.expected_delivery,
            orderDateStr: o.expected_delivery?.split('T')[0],
            matches: o.expected_delivery?.split('T')[0] === dateStr
          }))
        });
      }
      
      return matches;
    });
    
    return filteredOrders;
  };

  const handleDragStart = (e: React.DragEvent, order: PurchaseOrder) => {
    if (order.status === 'received') return; // Don't allow dragging received orders
    setDraggedOrder(order);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    
    if (!draggedOrder) return;

    const newDateStr = format(targetDate, 'yyyy-MM-dd');
    
    // Get current date string directly without timezone conversion
    const currentDateStr = draggedOrder.expected_delivery ? 
      draggedOrder.expected_delivery.split('T')[0] : '';

    if (newDateStr === currentDateStr) {
      setDraggedOrder(null);
      return;
    }

    try {
      await onReschedule(draggedOrder.id, newDateStr);
      toast({
        title: "Delivery rescheduled",
        description: `${draggedOrder.po_number} moved to ${format(targetDate, 'PPP')}`
      });
    } catch (error: any) {
      toast({
        title: "Error rescheduling",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDraggedOrder(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ordered':
        return 'bg-blue-500 text-white';
      case 'received':
        return 'bg-emerald-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const renderWeekDay = (date: Date) => {
    const orders = getOrdersForDate(date);
    const isToday = isSameDay(date, new Date());
    const hasOrders = orders.length > 0;
    const maxDisplay = 4; // Show max 4 POs in week view
    const displayedOrders = orders.slice(0, maxDisplay);
    const hiddenCount = orders.length - maxDisplay;

    const handleShowAll = () => {
      setSelectedDate(date);
      setShowAllPOsModal(true);
    };

    return (
      <div
        key={date.toISOString()}
        className={cn(
          "min-h-[120px] border border-border p-3",
          hasOrders 
            ? "bg-primary/5 border-primary/20" 
            : "bg-muted/30",
          isToday && "ring-2 ring-primary"
        )}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, date)}
      >
        <div className="flex justify-between items-center mb-3">
          <div className="font-medium">
            <div className="text-sm text-muted-foreground">
              {format(date, 'EEE')}
            </div>
            <div className="text-lg">
              {format(date, 'd')}
            </div>
          </div>
        </div>
        
        <div className="space-y-1">
          {displayedOrders.map((order) => (
            <TooltipProvider key={order.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    draggable={order.status !== 'received'}
                    onDragStart={(e) => handleDragStart(e, order)}
                    onClick={() => setSelectedOrder(order)}
                    className={cn(
                      "p-2 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity",
                      getStatusColor(order.status),
                      order.status !== 'received' && "cursor-move"
                    )}
                  >
                    <div className="font-medium">{order.po_number}</div>
                    <div className="opacity-90">{order.vendor_name}</div>
                    <div className="opacity-90">{order.items && order.items.length > 0 ? `${order.items[0].quantity} ${order.items[0].uom || 'kg'}` : 'No quantity'}</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <div className="font-medium">PO: {order.po_number}</div>
                    <div>Vendor: {order.vendor_name}</div>
                    <div>Ingredient: {order.items && order.items.length > 0 ? order.items[0].ingredient_name : 'No ingredients'}</div>
                    <div>Qty: {order.items && order.items.length > 0 ? `${order.items[0].quantity} ${order.items[0].uom || 'kg'}` : 'No quantity'}</div>
                    <div>Status: {order.status}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          
          {hiddenCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs py-1 h-6"
              onClick={handleShowAll}
            >
              +{hiddenCount} more
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderMonthDay = (date: Date) => {
    const orders = getOrdersForDate(date);
    const isCurrentMonth = isSameMonth(date, currentDate);
    const isToday = isSameDay(date, new Date());
    const hasOrders = orders.length > 0;
    const maxDisplay = 3; // Show max 3 POs in month view
    const displayedOrders = orders.slice(0, maxDisplay);
    const hiddenCount = orders.length - maxDisplay;

    const handleShowAll = () => {
      setSelectedDate(date);
      setShowAllPOsModal(true);
    };

    return (
      <div
        key={date.toISOString()}
        className={cn(
          "min-h-[100px] border border-border p-2",
          hasOrders 
            ? "bg-primary/5 border-primary/20" 
            : "bg-muted/30",
          !isCurrentMonth && "bg-muted/40 text-muted-foreground",
          isToday && "ring-2 ring-primary"
        )}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, date)}
      >
        <div className="text-sm font-medium mb-2">
          {format(date, 'd')}
        </div>
        <div className="space-y-1">
          {displayedOrders.map((order) => (
            <TooltipProvider key={order.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    draggable={order.status !== 'received'}
                    onDragStart={(e) => handleDragStart(e, order)}
                    onClick={() => setSelectedOrder(order)}
                    className={cn(
                      "p-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity",
                      getStatusColor(order.status),
                      order.status !== 'received' && "cursor-move"
                    )}
                  >
                    <div className="font-medium truncate">
                      {order.items && order.items.length > 0 
                        ? order.items[0].ingredient_name 
                        : 'No ingredients'}
                      {order.items && order.items.length > 1 && ` +${order.items.length - 1} more`}
                    </div>
                    <div className="opacity-90 truncate">{order.vendor_name}</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <div className="font-medium">PO: {order.po_number}</div>
                    <div>Vendor: {order.vendor_name}</div>
                    <div>Ingredients: {order.items && order.items.length > 0 ? order.items.map(item => item.ingredient_name).join(', ') : 'No ingredients'}</div>
                    <div>Total Items: {order.items ? order.items.length : 0}</div>
                    <div>Status: {order.status}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          
          {hiddenCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs py-1 h-5"
              onClick={handleShowAll}
            >
              +{hiddenCount}
            </Button>
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
              Delivery Calendar
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
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Ordered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded"></div>
              <span>Received</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'week' ? (
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

      {selectedOrder && (
        <PurchaseOrderCalendarDetail
          order={selectedOrder}
          open={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onMarkAsReceived={onMarkAsReceived}
          onEdit={onEdit}
          onReceiveIntoInventory={onReceiveIntoInventory}
        />
      )}

      <DayPurchaseOrdersModal
        open={showAllPOsModal}
        onClose={() => {
          setShowAllPOsModal(false);
          setSelectedDate(null);
        }}
        date={selectedDate}
        orders={selectedDate ? getOrdersForDate(selectedDate) : []}
        onMarkAsReceived={onMarkAsReceived}
        onEdit={onEdit}
        onReceiveIntoInventory={onReceiveIntoInventory}
        onOrderClick={setSelectedOrder}
      />
    </>
  );
}