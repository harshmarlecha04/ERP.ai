import { useState, useMemo } from "react";
import { Plus, Download, LayoutGrid, List as ListIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useLaunchTasks,
  useLaunchProductLines,
  useUpdateTask,
  LaunchTask,
  TaskFilters,
  LAUNCH_STATUSES,
  LaunchStatus,
} from "@/hooks/launch/useLaunch";
import { useProfiles } from "@/hooks/useProfiles";
import { LaunchFilterBar } from "@/components/launch/LaunchFilterBar";
import { LaunchTaskDialog } from "@/components/launch/LaunchTaskDialog";
import { LaunchTaskViewDialog } from "@/components/launch/LaunchTaskViewDialog";
import { format, isPast, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { todayET } from "@/utils/dateUtils";

type ViewMode = "board" | "list";
type SortKey = keyof LaunchTask;

const statusAccent: Record<LaunchStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  review: "bg-violet-500",
  done: "bg-emerald-500",
};

const priorityStyle: Record<string, string> = {
  high: "border-red-300 text-red-600 bg-red-50 dark:bg-red-950/30",
  medium: "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  low: "border-slate-200 text-slate-500 bg-slate-50 dark:bg-slate-900/40",
};

export default function LaunchWork() {
  const [view, setView] = useState<ViewMode>("board");
  const [filters, setFilters] = useState<TaskFilters>({});
  const { data: tasks = [] } = useLaunchTasks(filters);
  const { data: lines = [] } = useLaunchProductLines();
  const { data: profiles = [] } = useProfiles();
  const update = useUpdateTask();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LaunchTask | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<LaunchStatus>("todo");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<LaunchTask | null>(null);

  const lineMap = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);
  const profileMap = useMemo(
    () => new Map(profiles.map((p: any) => [p.id, p.display_name || p.full_name || p.email])),
    [profiles]
  );

  const grouped = useMemo(() => {
    const g: Record<LaunchStatus, LaunchTask[]> = { todo: [], in_progress: [], review: [], done: [] };
    tasks.forEach((t) => g[t.status].push(t));
    return g;
  }, [tasks]);

  const openNew = (s: LaunchStatus = "todo") => {
    setEditing(null);
    setDefaultStatus(s);
    setDialogOpen(true);
  };

  const openView = (t: LaunchTask) => {
    setViewing(t);
    setViewOpen(true);
  };

  const handleDrop = (status: LaunchStatus) => {
    if (!draggingId) return;
    const t = tasks.find((x) => x.id === draggingId);
    if (t && t.status !== status) update.mutate({ id: draggingId, patch: { status } });
    setDraggingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tasks.length} task{tasks.length === 1 ? "" : "s"} · grouped by status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList className="h-9">
                <TabsTrigger value="board" className="text-xs gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5" /> Board
                </TabsTrigger>
                <TabsTrigger value="list" className="text-xs gap-1.5">
                  <ListIcon className="h-3.5 w-3.5" /> List
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" variant="outline" onClick={() => exportCsv(tasks, lineMap, profileMap)}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export
            </Button>
            <Button size="sm" onClick={() => openNew()}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New task
            </Button>
          </div>
        </div>
        <div className="px-6 pb-3">
          <LaunchFilterBar filters={filters} onChange={setFilters} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {view === "board" ? (
          <BoardView
            grouped={grouped}
            lineMap={lineMap}
            profileMap={profileMap}
            onCardClick={openView}
            onAdd={openNew}
            onDragStart={setDraggingId}
            onDrop={handleDrop}
          />
        ) : (
          <ListView
            tasks={tasks}
            lineMap={lineMap}
            profileMap={profileMap}
            onRowClick={openView}
          />
        )}
      </div>

      <LaunchTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        defaultStatus={defaultStatus}
      />
      <LaunchTaskViewDialog open={viewOpen} onOpenChange={setViewOpen} task={viewing} />
    </div>
  );
}

/* ---------------- Board ---------------- */
function BoardView({
  grouped,
  lineMap,
  profileMap,
  onCardClick,
  onAdd,
  onDragStart,
  onDrop,
}: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {LAUNCH_STATUSES.map((col) => (
        <div
          key={col.value}
          className="flex flex-col rounded-xl border bg-muted/20 min-h-[360px]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(col.value)}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", statusAccent[col.value as LaunchStatus])} />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {grouped[col.value].length}
              </span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => onAdd(col.value)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex-1 p-2 space-y-2 overflow-y-auto">
            {grouped[col.value].map((t: LaunchTask) => (
              <BoardCard
                key={t.id}
                task={t}
                line={t.product_line_id ? lineMap.get(t.product_line_id) : null}
                assignee={t.assignee_id ? profileMap.get(t.assignee_id) : null}
                onClick={() => onCardClick(t)}
                onDragStart={() => onDragStart(t.id)}
              />
            ))}
            {grouped[col.value].length === 0 && (
              <button
                onClick={() => onAdd(col.value)}
                className="w-full text-xs text-muted-foreground/70 hover:text-foreground py-3 rounded-md border-2 border-dashed border-muted-foreground/15 hover:border-muted-foreground/30 transition"
              >
                + Add task
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function BoardCard({ task, line, assignee, onClick, onDragStart }: any) {
  const overdue = task.due_date && task.status !== "done" && isPast(parseISO(task.due_date));
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="p-3 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all bg-card group"
    >
      <div className="flex items-start gap-2">
        {line && (
          <span
            className="mt-1 h-2 w-2 rounded-full shrink-0"
            style={{ background: line.color }}
            title={line.name}
          />
        )}
        <div className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.title}</div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge variant="secondary" className="text-[10px] font-normal h-5 px-1.5">
          {task.phase}
        </Badge>
        {task.priority !== "low" && (
          <Badge
            variant="outline"
            className={cn("text-[10px] font-normal h-5 px-1.5 capitalize", priorityStyle[task.priority])}
          >
            {task.priority}
          </Badge>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5 truncate">
          {assignee ? (
            <>
              <Avatar name={assignee} />
              <span className="truncate">{assignee}</span>
            </>
          ) : (
            <span className="text-muted-foreground/60">Unassigned</span>
          )}
        </span>
        {task.due_date && (
          <span
            className={cn(
              "flex items-center gap-1 tabular-nums",
              overdue && "text-red-600 font-medium"
            )}
          >
            {overdue && <AlertCircle className="h-3 w-3" />}
            {format(parseISO(task.due_date), "MMM d")}
          </span>
        )}
      </div>
    </Card>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[9px] font-semibold flex items-center justify-center shrink-0">
      {initials}
    </span>
  );
}

/* ---------------- List ---------------- */
function ListView({ tasks, lineMap, profileMap, onRowClick }: any) {
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const copy = [...tasks];
    copy.sort((a: any, b: any) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [tasks, sortKey, sortDir]);

  const toggle = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const H = ({ k, label }: { k: SortKey; label: string }) => (
    <TableHead
      onClick={() => toggle(k)}
      className="cursor-pointer select-none text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
    >
      {label}{sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </TableHead>
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-1 p-0"></TableHead>
            <H k="title" label="Task" />
            <H k="product_line_id" label="Line" />
            <H k="phase" label="Phase" />
            <H k="assignee_id" label="Assignee" />
            <H k="status" label="Status" />
            <H k="priority" label="Priority" />
            <H k="due_date" label="Due" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((t: LaunchTask) => {
            const line = t.product_line_id ? lineMap.get(t.product_line_id) : null;
            const assignee = t.assignee_id ? profileMap.get(t.assignee_id) : null;
            const overdue = t.due_date && t.status !== "done" && isPast(parseISO(t.due_date));
            const statusObj = LAUNCH_STATUSES.find((s) => s.value === t.status);
            return (
              <TableRow key={t.id} onClick={() => onRowClick(t)} className="cursor-pointer">
                <TableCell className="p-0">
                  <div className={cn("w-1 h-10", statusAccent[t.status])} />
                </TableCell>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell>
                  {line && (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: line.color }} />
                      {line.name}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">{t.phase}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {assignee ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={assignee} /> {assignee}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/70">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">{statusObj?.label}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("font-normal capitalize", priorityStyle[t.priority])}>
                    {t.priority}
                  </Badge>
                </TableCell>
                <TableCell
                  className={cn("text-sm tabular-nums", overdue && "text-red-600 font-medium")}
                >
                  {t.due_date ? format(parseISO(t.due_date), "MMM d, yyyy") : "—"}
                </TableCell>
              </TableRow>
            );
          })}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                No tasks match the current filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/* ---------------- CSV ---------------- */
function exportCsv(tasks: LaunchTask[], lineMap: Map<string, any>, profileMap: Map<string, any>) {
  const headers = ["Title", "Line", "Phase", "Assignee", "Status", "Priority", "Start", "Due"];
  const esc = (s: any) => {
    const str = String(s ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const rows = tasks.map((t) =>
    [
      t.title,
      t.product_line_id ? lineMap.get(t.product_line_id)?.name : "",
      t.phase,
      t.assignee_id ? profileMap.get(t.assignee_id) : "",
      t.status,
      t.priority,
      t.start_date || "",
      t.due_date || "",
    ].map(esc).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `project-tasks-${todayET()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
