import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatET } from "@/utils/dateUtils";

interface CapacityData {
  schedule_date: string;
  total_batches: number;
  available_capacity: number;
  schedule_items: Array<{
    id: string;
    formula_code: string;
    batches: number;
    materials_ok: boolean;
    current_stage: string;
  }>;
}

export function CapacityCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [capacityData, setCapacityData] = useState<CapacityData[]>([]);
  const [selectedDay, setSelectedDay] = useState<CapacityData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCapacityData();
  }, [currentMonth]);

  const loadCapacityData = async () => {
    setIsLoading(true);
    try {
      const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      const { data, error } = await supabase.rpc("get_production_capacity", {
        p_start_date: start,
        p_end_date: end,
      });

      if (error) throw error;
      setCapacityData((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading capacity",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCapacityForDate = (date: Date): CapacityData | undefined => {
    return capacityData.find((d) =>
      isSameDay(new Date(d.schedule_date), date)
    );
  };

  const getCapacityColor = (batches: number): string => {
    if (batches === 0) return "bg-background";
    if (batches <= 8) return "bg-success/20 hover:bg-success/30";
    if (batches <= 11) return "bg-warning/20 hover:bg-warning/30";
    return "bg-destructive/20 hover:bg-destructive/30";
  };

  const getCapacityLabel = (batches: number, available: number): string => {
    if (batches === 0) return "Available";
    if (available > 4) return "Good";
    if (available > 0) return "Limited";
    return "Full";
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Production Capacity Calendar</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[120px] text-center font-medium">
                {format(currentMonth, "MMMM yyyy")}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mb-4 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-success/20"></div>
                  <span className="text-xs text-muted-foreground">0-8 batches (Good)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-warning/20"></div>
                  <span className="text-xs text-muted-foreground">9-11 batches (Limited)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-destructive/20"></div>
                  <span className="text-xs text-muted-foreground">12+ batches (Full)</span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                    {day}
                  </div>
                ))}

                {daysInMonth.map((day) => {
                  const capacity = getCapacityForDate(day);
                  const isWeekendDay = isWeekend(day);
                  const totalBatches = capacity?.total_batches || 0;
                  const available = capacity?.available_capacity || 12;

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => !isWeekendDay && capacity && setSelectedDay(capacity)}
                      disabled={isWeekendDay}
                      className={cn(
                        "relative p-2 rounded-lg border transition-colors min-h-[80px] text-left",
                        isWeekendDay
                          ? "bg-muted/30 cursor-not-allowed opacity-50"
                          : getCapacityColor(totalBatches),
                        "hover:shadow-sm disabled:hover:shadow-none"
                      )}
                    >
                      <div className="text-sm font-medium mb-1">{format(day, "d")}</div>
                      {!isWeekendDay && (
                        <div className="space-y-1">
                          {totalBatches > 0 ? (
                            <>
                              <Badge
                                variant={
                                  available > 4 ? "default" :
                                  available > 0 ? "secondary" :
                                  "destructive"
                                }
                                className="text-xs"
                              >
                                {totalBatches}/12
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {getCapacityLabel(totalBatches, available)}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">Available</p>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="[--dialog-max-width:42rem]">
          <DialogHeader>
            <DialogTitle>
              {selectedDay && formatET(selectedDay.schedule_date, "EEEE, MMMM dd, yyyy")}
            </DialogTitle>
          </DialogHeader>

          {selectedDay && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div>
                  <p className="text-sm text-muted-foreground">Capacity Used</p>
                  <p className="text-2xl font-bold">
                    {selectedDay.total_batches} / 12 batches
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold">{selectedDay.available_capacity}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Scheduled Production</h4>
                <div className="space-y-2">
                  {selectedDay.schedule_items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{item.formula_code}</Badge>
                        <span className="font-medium">{item.batches} batches</span>
                        {!item.materials_ok && (
                          <AlertCircle className="h-4 w-4 text-warning" />
                        )}
                      </div>
                      <Badge variant={item.current_stage === "completed" ? "default" : "secondary"}>
                        {item.current_stage}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
