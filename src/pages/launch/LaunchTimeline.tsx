import { useMemo, useState } from "react";
import {
  addDays,
  differenceInDays,
  format,
  startOfWeek,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useLaunchTasks,
  useLaunchProductLines,
  useLaunchMilestones,
  LaunchTask,
  TaskFilters,
} from "@/hooks/launch/useLaunch";
import { LaunchFilterBar } from "@/components/launch/LaunchFilterBar";
import { LaunchTaskDialog } from "@/components/launch/LaunchTaskDialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAY_WIDTH = 32;
const ROW_HEIGHT = 36;

export default function LaunchTimeline() {
  const [filters, setFilters] = useState<TaskFilters>({});
  const [groupBy, setGroupBy] = useState<"line" | "phase">("line");
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [days, setDays] = useState(56);
  const { data: tasks = [] } = useLaunchTasks(filters);
  const { data: lines = [] } = useLaunchProductLines();
  const { data: milestones = [] } = useLaunchMilestones();
  const [editing, setEditing] = useState<LaunchTask | null>(null);
  const [open, setOpen] = useState(false);

  const dayArr = useMemo(() => Array.from({ length: days }, (_, i) => addDays(anchor, i)), [anchor, days]);
  const end = addDays(anchor, days - 1);
  const lineMap = new Map(lines.map((l) => [l.id, l]));

  const groups = useMemo(() => {
    if (groupBy === "line") {
      return lines.map((l) => ({
        key: l.id,
        label: l.name,
        color: l.color,
        tasks: tasks.filter((t) => t.product_line_id === l.id && t.start_date && t.due_date),
      }));
    }
    const phases = ["Formulation", "Manufacturing", "Regulatory", "Packaging", "Marketing", "Distribution"];
    return phases.map((p) => ({
      key: p,
      label: p,
      color: "#64748B",
      tasks: tasks.filter((t) => t.phase === p && t.start_date && t.due_date),
    }));
  }, [tasks, lines, groupBy]);

  const today = new Date();
  const todayOffset = differenceInDays(today, anchor);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Project Timeline</h1>
          <p className="text-sm text-muted-foreground">Gantt view of all scheduled tasks.</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
            <TabsList>
              <TabsTrigger value="line">By line</TabsTrigger>
              <TabsTrigger value="phase">By phase</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="icon" variant="outline" onClick={() => setAnchor(addDays(anchor, -14))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
          <Button size="icon" variant="outline" onClick={() => setAnchor(addDays(anchor, 14))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <LaunchFilterBar filters={filters} onChange={setFilters} />

      <Card className="overflow-x-auto">
        <div style={{ width: 200 + days * DAY_WIDTH }}>
          {/* header */}
          <div className="flex border-b sticky top-0 bg-background z-10">
            <div className="w-[200px] shrink-0 p-2 font-semibold text-sm">Group</div>
            <div className="flex">
              {dayArr.map((d, i) => {
                const isMonStart = d.getDate() <= 7 || i === 0;
                return (
                  <div
                    key={i}
                    style={{ width: DAY_WIDTH }}
                    className="text-[10px] text-center border-l py-1 text-muted-foreground"
                  >
                    {isMonStart && <div className="font-semibold text-foreground">{format(d, "MMM")}</div>}
                    {format(d, "d")}
                  </div>
                );
              })}
            </div>
          </div>

          {/* rows */}
          {groups.map((g) => (
            <div key={g.key} className="border-b">
              <div className="flex items-center bg-muted/30">
                <div
                  className="w-[200px] shrink-0 p-2 text-sm font-medium flex items-center gap-2"
                  style={{ borderLeft: `4px solid ${g.color}` }}
                >
                  {g.label}
                  <span className="text-xs text-muted-foreground">({g.tasks.length})</span>
                </div>
                <div className="flex-1" />
              </div>
              <div className="relative">
                {/* today line */}
                {todayOffset >= 0 && todayOffset < days && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary z-10"
                    style={{ left: 200 + todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
                  />
                )}
                {g.tasks.length === 0 && (
                  <div
                    style={{ height: ROW_HEIGHT }}
                    className="text-xs text-muted-foreground pl-[210px] flex items-center"
                  >
                    No scheduled tasks
                  </div>
                )}
                {g.tasks.map((t, i) => {
                  const s = parseISO(t.start_date!);
                  const e = parseISO(t.due_date!);
                  const startOff = Math.max(0, differenceInDays(s, anchor));
                  const endOff = Math.min(days - 1, differenceInDays(e, anchor));
                  if (endOff < 0 || startOff >= days) return null;
                  const width = (endOff - startOff + 1) * DAY_WIDTH;
                  const line = t.product_line_id ? lineMap.get(t.product_line_id) : null;
                  const bg = line?.color || "#2F6DF6";
                  return (
                    <div
                      key={t.id}
                      className="relative"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div className="w-[200px] shrink-0" />
                      <div
                        onClick={() => {
                          setEditing(t);
                          setOpen(true);
                        }}
                        title={`${t.title} (${t.start_date} → ${t.due_date})`}
                        className="absolute top-1 h-6 rounded text-[11px] text-white px-2 flex items-center cursor-pointer hover:opacity-90 truncate shadow-sm"
                        style={{
                          left: 200 + startOff * DAY_WIDTH + 2,
                          width: width - 4,
                          backgroundColor: bg,
                          opacity: t.status === "done" ? 0.55 : 1,
                        }}
                      >
                        {t.title}
                      </div>
                    </div>
                  );
                })}

                {/* milestones for this line */}
                {groupBy === "line" &&
                  milestones
                    .filter((m: any) => m.product_line_id === g.key)
                    .map((m: any) => {
                      const d = parseISO(m.date);
                      if (!isWithinInterval(d, { start: anchor, end })) return null;
                      const off = differenceInDays(d, anchor);
                      return (
                        <div
                          key={m.id}
                          className="absolute -top-2 text-amber-500"
                          style={{ left: 200 + off * DAY_WIDTH + DAY_WIDTH / 2 - 6 }}
                          title={`${m.name} (${m.date})`}
                        >
                          ◆
                        </div>
                      );
                    })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <LaunchTaskDialog open={open} onOpenChange={setOpen} task={editing} />
    </div>
  );
}
