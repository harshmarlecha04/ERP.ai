import { format } from "date-fns";
import { Calendar, Package, Truck, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TimelinePhase {
  label: string;
  date: string;
  status: "completed" | "in_progress" | "pending";
  icon: React.ReactNode;
  details?: string;
}

interface ProductionTimelineProps {
  orderCreated: Date;
  productionStart: Date;
  productionEnd: Date;
  packagingReady: Date;
  targetShipDate: Date;
  currentStatus: string;
  batchBreakdown?: Array<{ date: Date; batches: number; bottles: number }>;
}

export function ProductionTimeline({
  orderCreated,
  productionStart,
  productionEnd,
  packagingReady,
  targetShipDate,
  currentStatus,
  batchBreakdown = [],
}: ProductionTimelineProps) {
  const getPhaseStatus = (phase: string): "completed" | "in_progress" | "pending" => {
    const statusOrder = ["pending", "scheduled", "in_production", "packaging", "ready_to_ship", "completed"];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const phaseIndex = statusOrder.indexOf(phase);
    
    if (phaseIndex < currentIndex) return "completed";
    if (phaseIndex === currentIndex) return "in_progress";
    return "pending";
  };

  const phases: TimelinePhase[] = [
    {
      label: "Order Created",
      date: format(orderCreated, "MMM dd, yyyy"),
      status: "completed",
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
    {
      label: "Production Phase",
      date: `${format(productionStart, "MMM dd")} - ${format(productionEnd, "MMM dd, yyyy")}`,
      status: getPhaseStatus("in_production"),
      icon: <Calendar className="h-5 w-5" />,
      details: batchBreakdown.length > 0 
        ? `${batchBreakdown.length} production days, ${batchBreakdown.reduce((sum, b) => sum + b.batches, 0)} batches`
        : undefined,
    },
    {
      label: "Packaging Ready",
      date: format(packagingReady, "MMM dd, yyyy"),
      status: getPhaseStatus("packaging"),
      icon: <Package className="h-5 w-5" />,
    },
    {
      label: "Ready to Ship",
      date: format(targetShipDate, "MMM dd, yyyy"),
      status: getPhaseStatus("ready_to_ship"),
      icon: <Truck className="h-5 w-5" />,
    },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {phases.map((phase, index) => (
            <div key={index} className="relative">
              {index < phases.length - 1 && (
                <div
                  className={cn(
                    "absolute left-[15px] top-10 w-0.5 h-14",
                    phase.status === "completed" ? "bg-success" : "bg-border"
                  )}
                />
              )}
              
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                    phase.status === "completed" && "border-success bg-success text-success-foreground",
                    phase.status === "in_progress" && "border-primary bg-primary text-primary-foreground animate-pulse",
                    phase.status === "pending" && "border-border bg-background text-muted-foreground"
                  )}
                >
                  {phase.icon}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{phase.label}</p>
                    <Badge
                      variant={
                        phase.status === "completed" ? "default" :
                        phase.status === "in_progress" ? "secondary" :
                        "outline"
                      }
                    >
                      {phase.status === "completed" ? "Completed" :
                       phase.status === "in_progress" ? "In Progress" :
                       "Pending"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{phase.date}</span>
                  </div>

                  {phase.details && (
                    <p className="text-sm text-muted-foreground">{phase.details}</p>
                  )}

                  {phase.label === "Production Phase" && batchBreakdown.length > 0 && (
                    <div className="mt-3 space-y-2 rounded-md border bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Daily Breakdown</p>
                      {batchBreakdown.map((day, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{format(day.date, "EEE, MMM dd")}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {day.batches} batches
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ~{day.bottles.toLocaleString()} bottles
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
