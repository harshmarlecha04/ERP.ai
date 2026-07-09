import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Calendar, Clock, CheckCircle2, AlertCircle, Loader2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, parseISO, startOfWeek, addDays } from "date-fns";

interface ScheduleItem {
  id: string;
  product: string;
  batches: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'delayed';
}

interface WeeklyScheduleWidgetProps {
  schedule: Record<string, ScheduleItem[]>;
  loading?: boolean;
}

export function WeeklyScheduleWidget({ schedule, loading = false }: WeeklyScheduleWidgetProps) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
  // Get actual dates for this week
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const weekDates = days.map((_, index) => addDays(weekStart, index));

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-success/10 text-success border-success/20',
          icon: CheckCircle2,
          label: 'Done'
        };
      case 'in-progress':
        return {
          bg: 'bg-primary/10 text-primary border-primary/20',
          icon: Loader2,
          label: 'Active'
        };
      case 'delayed':
        return {
          bg: 'bg-destructive/10 text-destructive border-destructive/20',
          icon: AlertCircle,
          label: 'Delayed'
        };
      default:
        return {
          bg: 'bg-secondary text-secondary-foreground border-border',
          icon: Clock,
          label: 'Scheduled'
        };
    }
  };

  const getDayItemCount = (day: string) => {
    return schedule[day]?.length || 0;
  };

  const getTotalBatches = () => {
    return Object.values(schedule).flat().reduce((sum, item) => sum + item.batches, 0);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle>This Week's Schedule</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="min-w-[180px] space-y-3">
                <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                <div className="h-20 bg-muted animate-pulse rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">This Week's Schedule</CardTitle>
              <p className="text-sm text-muted-foreground">Production overview • Mon-Fri</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold">{getTotalBatches()}</p>
              <p className="text-xs text-muted-foreground">Total Batches</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="flex divide-x">
            {days.map((day, index) => {
              const date = weekDates[index];
              const isTodayDate = isToday(date);
              const items = schedule[day] || [];
              
              return (
                <div 
                  key={day} 
                  className={cn(
                    "min-w-[200px] flex-1 p-4",
                    isTodayDate && "bg-primary/5"
                  )}
                >
                  {/* Day Header */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "font-semibold text-sm",
                        isTodayDate && "text-primary"
                      )}>
                        {day}
                      </span>
                      {isTodayDate && (
                        <Badge variant="default" className="text-xs py-0 px-1.5">
                          Today
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(date, 'MMM d')}
                    </span>
                  </div>
                  
                  {/* Items */}
                  <div className="space-y-2">
                    {items.length > 0 ? (
                      items.map((item) => {
                        const statusConfig = getStatusConfig(item.status);
                        const StatusIcon = statusConfig.icon;
                        
                        return (
                          <div 
                            key={item.id}
                            className={cn(
                              "p-3 rounded-lg border transition-all hover:shadow-sm",
                              statusConfig.bg
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate" title={item.product}>
                                  {item.product}
                                </p>
                                <p className="text-xs opacity-75 mt-0.5">
                                  {item.batches} {item.batches === 1 ? 'batch' : 'batches'}
                                </p>
                              </div>
                              <StatusIcon className={cn(
                                "h-4 w-4 shrink-0",
                                item.status === 'in-progress' && "animate-spin"
                              )} />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 rounded-lg border-2 border-dashed border-muted text-center">
                        <p className="text-xs text-muted-foreground">No items</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Footer count */}
                  {getDayItemCount(day) > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">
                        {getDayItemCount(day)} {getDayItemCount(day) === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
