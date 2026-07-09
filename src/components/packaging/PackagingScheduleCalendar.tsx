import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PackagingScheduleItem as DBScheduleItem } from "@/hooks/usePackagingSchedule";

interface PackagingScheduleCalendarProps {
  scheduleData: DBScheduleItem[];
  onEditItem: (item: DBScheduleItem) => void;
  onReschedule: (itemId: string, newDate: string) => Promise<void>;
}

export function PackagingScheduleCalendar({ 
  scheduleData, 
  onEditItem, 
  onReschedule 
}: PackagingScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [draggedItem, setDraggedItem] = useState<DBScheduleItem | null>(null);
  const { toast } = useToast();

  // Get items for a specific date
  const getItemsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return scheduleData.filter(item => item.schedule_date === dateStr);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, item: DBScheduleItem) => {
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
      await onReschedule(draggedItem.id, newDateStr);
      toast({
        title: "Schedule updated",
        description: `Moved "${draggedItem.product_name}" to ${format(targetDate, 'PPP')}`
      });
    } catch (error: any) {
      toast({
        title: "Error rescheduling",
        description: error.message || "Failed to reschedule item",
        variant: "destructive"
      });
    } finally {
      setDraggedItem(null);
    }
  };

  // Get status color styling
  const getItemStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return "bg-success/20 text-success-foreground border border-success/40";
      case 'in_progress':
        return "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700";
      default: // pending
        return "bg-primary/10 text-primary border border-primary/30";
    }
  };

  // Render week day cell (vertical layout)
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
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, date)}
      >
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="text-sm text-muted-foreground">
              {format(date, 'EEE')}
            </div>
            <div className="text-lg font-medium">
              {format(date, 'd')}
            </div>
          </div>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {items.length} item{items.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              draggable={item.status !== 'completed'}
              onDragStart={(e) => handleDragStart(e, item)}
              onClick={() => onEditItem(item)}
              className={cn(
                "p-1.5 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity",
                item.status !== 'completed' && "cursor-move",
                getItemStyle(item.status)
              )}
            >
              <div className="font-medium truncate">{item.customer_name}</div>
              <div className="truncate opacity-80">{item.product_name}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{item.count} • {item.expected_bottles} btls</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render month day cell (compact layout)
  const renderMonthDay = (date: Date) => {
    const items = getItemsForDate(date);
    const isCurrentMonth = isSameMonth(date, currentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    const isPast = compareDate < today;
    const isToday = isSameDay(date, new Date());
    const hasScheduledItems = items.length > 0;

    const getDayBackground = () => {
      if (!isCurrentMonth) return "bg-muted/40 text-muted-foreground";
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
          "min-h-[100px] border border-border p-2",
          getDayBackground(),
          isToday && "ring-2 ring-amber-400 dark:ring-amber-500"
        )}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, date)}
      >
        <div className="text-sm font-medium mb-1">
          {format(date, 'd')}
        </div>
        <div className="space-y-1">
          {items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              draggable={item.status !== 'completed'}
              onDragStart={(e) => handleDragStart(e, item)}
              onClick={() => onEditItem(item)}
              className={cn(
                "p-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity truncate",
                item.status !== 'completed' && "cursor-move",
                getItemStyle(item.status)
              )}
            >
              <div className="font-medium truncate">{item.customer_name}</div>
              <div className="truncate opacity-80 text-[10px]">{item.product_name}</div>
            </div>
          ))}
          {items.length > 3 && (
            <div className="text-[10px] text-muted-foreground text-center">
              +{items.length - 3} more
            </div>
          )}
        </div>
      </div>
    );
  };

  // Calculate visible days based on view mode
  const getDaysForView = () => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
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
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5" />
            Packaging Schedule
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
        <div className="text-xl font-bold">
          {viewMode === 'week' 
            ? `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'MMM d, yyyy')}`
            : format(currentDate, 'MMMM yyyy')
          }
        </div>
        <div className="flex gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-primary/20 border border-primary/30"></div>
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700"></div>
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-success/20 border border-success/40"></div>
            <span>Completed</span>
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
  );
}
