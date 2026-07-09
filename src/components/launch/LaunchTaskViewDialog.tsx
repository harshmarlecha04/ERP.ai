import { useState } from "react";
import { format, parseISO, isPast } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Calendar, AlertCircle, User, Tag, FolderKanban, Layers } from "lucide-react";
import {
  LaunchTask,
  LAUNCH_STATUSES,
  ChecklistItem,
  useLaunchProductLines,
  useLaunchProjects,
  useUpdateTask,
} from "@/hooks/launch/useLaunch";
import { useProfiles } from "@/hooks/useProfiles";
import { LaunchTaskDialog } from "./LaunchTaskDialog";
import { CommentsPanel, AttachmentsPanel } from "./TaskActivityPanels";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: LaunchTask | null;
}

const priorityStyle: Record<string, string> = {
  high: "border-red-300 text-red-600 bg-red-50 dark:bg-red-950/30",
  medium: "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  low: "border-slate-200 text-slate-500 bg-slate-50 dark:bg-slate-900/40",
};

export function LaunchTaskViewDialog({ open, onOpenChange, task }: Props) {
  const { data: lines = [] } = useLaunchProductLines();
  const { data: projects = [] } = useLaunchProjects();
  const { data: profiles = [] } = useProfiles();
  const update = useUpdateTask();
  const [editOpen, setEditOpen] = useState(false);

  if (!task) return null;

  const line = task.product_line_id ? lines.find((l) => l.id === task.product_line_id) : null;
  const project = task.project_id ? projects.find((p) => p.id === task.project_id) : null;
  const assignee = task.assignee_id
    ? (profiles.find((p: any) => p.id === task.assignee_id) as any)
    : null;
  const assigneeName = assignee?.display_name || assignee?.full_name || assignee?.email;
  const statusObj = LAUNCH_STATUSES.find((s) => s.value === task.status);
  const overdue = task.due_date && task.status !== "done" && isPast(parseISO(task.due_date));
  const checklist = (task.checklist || []) as ChecklistItem[];
  const tags = task.tags || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const checklistPct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;

  const toggleItem = (id: string) => {
    const next = checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
    update.mutate({ id: task.id, patch: { checklist: next } });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[1100px] w-[95vw] max-h-[90vh] p-0 overflow-hidden gap-0"
          onFocusOutside={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-start gap-3">
              {line && (
                <span
                  className="mt-2 h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: line.color }}
                />
              )}
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl font-semibold leading-tight">
                  {task.title}
                </DialogTitle>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{statusObj?.label}</Badge>
                  <Badge variant="secondary" className="font-normal">{task.phase}</Badge>
                  <Badge
                    variant="outline"
                    className={cn("font-normal capitalize", priorityStyle[task.priority])}
                  >
                    {task.priority}
                  </Badge>
                  {line && (
                    <span className="text-xs text-muted-foreground">{line.name}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button size="sm" onClick={() => onOpenChange(false)}>Close</Button>
              </div>
            </div>
          </div>

          {/* Body: two columns on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] max-h-[calc(90vh-72px)] overflow-hidden">
            {/* Left: main content */}
            <div className="min-w-0 overflow-y-auto px-6 py-5 space-y-6 border-b lg:border-b-0 lg:border-r">
              {task.description ? (
                <section className="space-y-2">
                  <SectionLabel>Description</SectionLabel>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {task.description}
                  </p>
                </section>
              ) : (
                <section className="space-y-2">
                  <SectionLabel>Description</SectionLabel>
                  <p className="text-sm text-muted-foreground italic">No description.</p>
                </section>
              )}

              {checklist.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <SectionLabel>Checklist</SectionLabel>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {doneCount}/{checklist.length} · {checklistPct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${checklistPct}%` }}
                    />
                  </div>
                  <div className="space-y-0.5 pt-1">
                    {checklist.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-muted/40 cursor-pointer"
                      >
                        <Checkbox checked={c.done} onCheckedChange={() => toggleItem(c.id)} />
                        <span className={cn(c.done && "line-through text-muted-foreground")}>
                          {c.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <Tabs defaultValue="comments">
                  <TabsList>
                    <TabsTrigger value="comments">Updates</TabsTrigger>
                    <TabsTrigger value="attachments">Attachments</TabsTrigger>
                  </TabsList>
                  <TabsContent value="comments" className="pt-4">
                    <CommentsPanel taskId={task.id} />
                  </TabsContent>
                  <TabsContent value="attachments" className="pt-4">
                    <AttachmentsPanel taskId={task.id} />
                  </TabsContent>
                </Tabs>
              </section>
            </div>

            {/* Right: meta sidebar */}
            <aside className="overflow-y-auto px-5 py-5 bg-muted/20 space-y-5">
              <MetaRow
                icon={<User className="h-3.5 w-3.5" />}
                label="Assignee"
                value={assigneeName || "Unassigned"}
              />
              <MetaRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Start date"
                value={task.start_date ? format(parseISO(task.start_date), "MMM d, yyyy") : "—"}
              />
              <MetaRow
                icon={overdue ? <AlertCircle className="h-3.5 w-3.5 text-red-600" /> : <Calendar className="h-3.5 w-3.5" />}
                label="Due date"
                value={task.due_date ? format(parseISO(task.due_date), "MMM d, yyyy") : "—"}
                valueClassName={overdue ? "text-red-600 font-medium" : ""}
              />
              <MetaRow
                icon={<FolderKanban className="h-3.5 w-3.5" />}
                label="Project"
                value={project?.name || "—"}
              />
              <MetaRow
                icon={<Layers className="h-3.5 w-3.5" />}
                label="Phase"
                value={task.phase}
              />

              <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" /> Tags
                </div>
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No tags</p>
                )}
              </div>
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      <LaunchTaskDialog open={editOpen} onOpenChange={setEditOpen} task={task} />
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className={cn("text-sm", valueClassName)}>{value}</div>
    </div>
  );
}
