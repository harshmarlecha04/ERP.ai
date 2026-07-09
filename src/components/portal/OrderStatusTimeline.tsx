import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Package,
  Factory,
  Boxes,
  Truck,
  Receipt,
  LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatET } from "@/utils/dateUtils";

interface Props {
  orderId: string;
  currentStatus?: string | null;
}

interface StageDef {
  key: string;
  label: string;
  icon: LucideIcon;
  matches: (status: string) => boolean;
}

// Map the 6-stage fulfillment pipeline to recognizable status keywords
const STAGES: StageDef[] = [
  { key: "intake", label: "Order received", icon: ClipboardList, matches: (s) => /received|intake|new|pending/i.test(s) },
  { key: "allocation", label: "Materials allocated", icon: Package, matches: (s) => /allocat|approved/i.test(s) },
  { key: "production", label: "In production", icon: Factory, matches: (s) => /production|in[\s_-]?progress|manufactur/i.test(s) },
  { key: "packaging", label: "Packaging", icon: Boxes, matches: (s) => /packag/i.test(s) },
  { key: "shipment", label: "Shipped", icon: Truck, matches: (s) => /ship|delivered/i.test(s) },
  { key: "invoicing", label: "Invoiced", icon: Receipt, matches: (s) => /invoic|closed|complete/i.test(s) },
];

interface HistoryRow {
  new_status: string | null;
  changed_at: string;
  notes?: string | null;
}

export function OrderStatusTimeline({ orderId, currentStatus }: Props) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("order_status_history")
        .select("new_status, changed_at, notes")
        .eq("order_id", orderId)
        .order("changed_at", { ascending: true });
      if (!cancelled) {
        setHistory((data ?? []) as HistoryRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Map each stage to its most recent matching history entry (if any)
  const stageEntries = STAGES.map((stage) => {
    const entry = [...history].reverse().find((h) => h.new_status && stage.matches(h.new_status));
    const isCurrent = currentStatus ? stage.matches(currentStatus) : false;
    return { ...stage, entry, isCurrent };
  });

  // A stage is "complete" if it has an entry OR an earlier stage in the list has an entry
  // (we consider it implicitly done once a later stage was reached).
  const lastReachedIdx = stageEntries.reduce((acc, s, i) => (s.entry ? i : acc), -1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Order timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-6">
            {stageEntries.map((s, i) => {
              const Icon = s.icon;
              const done = i <= lastReachedIdx;
              const isActive = s.isCurrent || (i === lastReachedIdx && !s.isCurrent);
              return (
                <li key={s.key} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background",
                      done ? "border-primary text-primary" : "border-border text-muted-foreground",
                      isActive && "ring-2 ring-primary/30"
                    )}
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
                  </span>
                  <div className="flex items-start gap-2">
                    <Icon className={cn("h-4 w-4 mt-0.5", done ? "text-foreground" : "text-muted-foreground")} />
                    <div className="flex-1">
                      <div className={cn("text-sm font-medium", !done && "text-muted-foreground")}>
                        {s.label}
                      </div>
                      {s.entry && (
                        <div className="text-xs text-muted-foreground">
                          {formatET(s.entry.changed_at, "MMM d, yyyy · h:mm a")}
                          {s.entry.notes ? ` — ${s.entry.notes}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
