import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Bell,
  Download,
  UserPlus,
  ListFilter,
  ArrowUpDown,
  MoreHorizontal,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  LAUNCH_STATUSES,
  LAUNCH_PHASES,
  LaunchStatus,
  LaunchTask,
  useLaunchProject,
  useLaunchProductLines,
  useLaunchTasks,
  useUpdateTask,
  useProjectMembers,
  useTaskActivityCounts,
} from "@/hooks/launch/useLaunch";
import { useProfiles } from "@/hooks/useProfiles";
import { LaunchTaskDialog } from "@/components/launch/LaunchTaskDialog";
import { LaunchTaskViewDialog } from "@/components/launch/LaunchTaskViewDialog";
import { LaunchProjectDialog } from "@/components/launch/LaunchProjectDialog";

import { ProjectBoardCard, STATUS_THEME } from "@/components/launch/ProjectBoardCard";
import { ProjectFilesTab } from "@/components/launch/ProjectFilesTab";
import { AddMemberDialog } from "@/components/launch/AddMemberDialog";
import { CharterTab } from "@/components/launch/charter/CharterTab";
import { cn } from "@/lib/utils";

type SortKey = "newest" | "oldest" | "due" | "priority";

export default function LaunchProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useLaunchProject(id);
  const { data: lines = [] } = useLaunchProductLines();
  const { data: tasks = [] } = useLaunchTasks({ projectId: id });
  const { data: profiles = [] } = useProfiles();
  const { data: members = [] } = useProjectMembers(id);
  const { data: counts = {} } = useTaskActivityCounts(tasks.map((t) => t.id));
  const update = useUpdateTask();

  const [taskOpen, setTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<LaunchTask | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<LaunchStatus>("todo");
  const [editProject, setEditProject] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTask, setViewTask] = useState<LaunchTask | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [phaseFilter, setPhaseFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);

  const profileMap = useMemo(
    () => new Map(profiles.map((p: any) => [p.id, p.display_name || p.full_name || p.email])),
    [profiles]
  );
  const line = project?.product_line_id ? lines.find((l) => l.id === project.product_line_id) : null;

  const memberProfiles = useMemo(() => {
    const ids = new Set<string>([...(project?.owner_id ? [project.owner_id] : []), ...members.map((m) => m.user_id)]);
    return Array.from(ids).map((id) => ({
      id,
      name: profileMap.get(id) || "Unknown",
    }));
  }, [members, profileMap, project?.owner_id]);

  const filtered = useMemo(() => {
    let list = tasks.slice();
    if (phaseFilter.length) list = list.filter((t) => phaseFilter.includes(t.phase));
    if (priorityFilter.length) list = list.filter((t) => priorityFilter.includes(t.priority));
    switch (sort) {
      case "newest":
        list.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case "oldest":
        list.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case "due":
        list.sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
        break;
      case "priority": {
        const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
        list.sort((a, b) => rank[a.priority] - rank[b.priority]);
        break;
      }
    }
    return list;
  }, [tasks, phaseFilter, priorityFilter, sort]);

  const grouped = useMemo(() => {
    const g: Record<LaunchStatus, LaunchTask[]> = { todo: [], in_progress: [], done: [], review: [] };
    filtered.forEach((t) => g[t.status].push(t));
    return g;
  }, [filtered]);

  const taskAssignees = (t: LaunchTask) =>
    t.assignee_id ? [{ id: t.assignee_id, name: profileMap.get(t.assignee_id) || "—" }] : [];

  const onDrop = (status: LaunchStatus) => {
    if (!draggingId) return;
    const t = tasks.find((x) => x.id === draggingId);
    if (t && t.status !== status) update.mutate({ id: draggingId, patch: { status } });
    setDraggingId(null);
  };

  const exportCsv = () => {
    const headers = ["Title", "Status", "Phase", "Priority", "Assignee", "Due", "Tags"];
    const esc = (s: any) => {
      const str = String(s ?? "");
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const rows = tasks.map((t) =>
      [
        t.title,
        t.status,
        t.phase,
        t.priority,
        t.assignee_id ? profileMap.get(t.assignee_id) : "",
        t.due_date || "",
        (t.tags || []).join("; "),
      ].map(esc).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name || "project"}-tasks.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!project) {
    return <div className="p-6 text-muted-foreground">Loading project…</div>;
  }

  return (
    <div className="flex h-full">


      <div className="flex-1 flex flex-col min-w-0">
        <Tabs defaultValue="board" className="flex-1 flex flex-col min-h-0">
          {/* Top bar with tabs + actions */}
          <div className="px-6 py-3 border-b flex items-center justify-between gap-4 bg-background">
            <div className="flex items-center gap-2">
              <Link to="/projects" className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 mr-2">
                <ArrowLeft className="h-3 w-3" /> All
              </Link>
              <TabsList className="bg-muted/40">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="charter">Charter</TabsTrigger>
                <TabsTrigger value="board">Board</TabsTrigger>
                <TabsTrigger value="list">List</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Bell className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export Data
              </Button>
            </div>
          </div>

          {/* Project header strip */}
          <div className="px-6 py-4 border-b flex items-center justify-between gap-4 bg-background">
            <div className="flex items-center gap-4 min-w-0">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold truncate">{project.name}</h1>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize text-[10px]">
                    {project.status.replace("_", " ")}
                  </Badge>
                  {line && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: line.color }} />
                      {line.name}
                    </span>
                  )}
                  {project.target_date && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Target {format(parseISO(project.target_date), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMembersOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/40 hover:bg-muted text-xs"
                >
                  <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Assign to project</span>
                  <div className="flex -space-x-2">
                    {memberProfiles.slice(0, 3).map((m) => (
                      <Avatar key={m.id} name={m.name} />
                    ))}
                    {memberProfiles.length > 3 && (
                      <span className="h-6 w-6 rounded-full bg-muted text-[10px] font-semibold flex items-center justify-center ring-2 ring-background">
                        {memberProfiles.length - 3}+
                      </span>
                    )}
                  </div>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" /> Sort By
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sort tasks</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {([
                    ["newest", "Newest first"],
                    ["oldest", "Oldest first"],
                    ["due", "Due date"],
                    ["priority", "Priority"],
                  ] as [SortKey, string][]).map(([k, label]) => (
                    <DropdownMenuItem key={k} onClick={() => setSort(k)}>
                      {sort === k ? "✓ " : ""}{label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <ListFilter className="h-3.5 w-3.5 mr-1.5" /> Filter
                    {(phaseFilter.length + priorityFilter.length) > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                        {phaseFilter.length + priorityFilter.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Phase</DropdownMenuLabel>
                  {LAUNCH_PHASES.map((p) => (
                    <DropdownMenuCheckboxItem
                      key={p}
                      checked={phaseFilter.includes(p)}
                      onCheckedChange={(c) =>
                        setPhaseFilter((arr) => (c ? [...arr, p] : arr.filter((x) => x !== p)))
                      }
                    >
                      {p}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Priority</DropdownMenuLabel>
                  {["high", "medium", "low"].map((p) => (
                    <DropdownMenuCheckboxItem
                      key={p}
                      checked={priorityFilter.includes(p)}
                      onCheckedChange={(c) =>
                        setPriorityFilter((arr) => (c ? [...arr, p] : arr.filter((x) => x !== p)))
                      }
                    >
                      <span className="capitalize">{p}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
                  {(phaseFilter.length || priorityFilter.length) > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { setPhaseFilter([]); setPriorityFilter([]); }}>
                        Clear filters
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button size="sm" variant="outline" onClick={() => setMembersOpen(true)}>
                <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add member
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditProject(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditTask(null);
                  setDefaultStatus("todo");
                  setTaskOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Task
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            <TabsContent value="overview" className="mt-0">
              <OverviewTab tasks={tasks} />
            </TabsContent>
            <TabsContent value="charter" className="mt-0 -m-6">
              <CharterTab
                projectId={project.id}
                projectName={project.name}
                projectOwnerId={project.owner_id}
                startDate={project.start_date}
                targetDate={project.target_date}
              />
            </TabsContent>
            <TabsContent value="board" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {LAUNCH_STATUSES.map((col) => {
                  const theme = STATUS_THEME[col.value];
                  const list = grouped[col.value];
                  return (
                    <div
                      key={col.value}
                      className="flex flex-col rounded-2xl border bg-card min-h-[400px]"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(col.value)}
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2 w-2 rounded-full", theme.progressDot)} />
                            <span className="font-semibold text-sm">{col.label}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {list.length} Card Task
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-md bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                            onClick={() => {
                              setEditTask(null);
                              setDefaultStatus(col.value);
                              setTaskOpen(true);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                        {list.map((t) => (
                          <ProjectBoardCard
                            key={t.id}
                            task={t}
                            assignees={taskAssignees(t)}
                            attachmentCount={counts[t.id]?.attachments || 0}
                            commentCount={counts[t.id]?.comments || 0}
                            onDragStart={() => setDraggingId(t.id)}
                            onClick={() => {
                              setViewTask(t);
                              setViewOpen(true);
                            }}
                          />
                        ))}
                        {list.length === 0 && (
                          <button
                            onClick={() => {
                              setEditTask(null);
                              setDefaultStatus(col.value);
                              setTaskOpen(true);
                            }}
                            className="w-full text-xs text-muted-foreground/70 hover:text-foreground py-6 rounded-xl border-2 border-dashed border-muted-foreground/15 hover:border-muted-foreground/30 transition"
                          >
                            + Add task
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="list" className="mt-0">
              <ListTab
                tasks={filtered}
                profileMap={profileMap}
                counts={counts}
                onClick={(t) => { setViewTask(t); setViewOpen(true); }}
              />
            </TabsContent>

            <TabsContent value="files" className="mt-0">
              <ProjectFilesTab projectId={project.id} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <LaunchTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        task={editTask}
        defaultStatus={defaultStatus}
        defaultProjectId={id}
      />
      <LaunchTaskViewDialog open={viewOpen} onOpenChange={setViewOpen} task={viewTask} />
      <LaunchProjectDialog open={editProject} onOpenChange={setEditProject} project={project} />
      <AddMemberDialog open={membersOpen} onOpenChange={setMembersOpen} projectId={project.id} />
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-background">
      {initials}
    </span>
  );
}

function OverviewTab({ tasks }: { tasks: LaunchTask[] }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const review = tasks.filter((t) => t.status === "review").length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const upcoming = tasks
    .filter((t) => t.due_date && t.status !== "done")
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="rounded-2xl border bg-card p-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Overall Progress</div>
        <div className="mt-2 text-4xl font-semibold">{percent}%</div>
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {done} of {total} task{total === 1 ? "" : "s"} complete
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-5 lg:col-span-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">By status</div>
        <div className="grid grid-cols-4 gap-3">
          <StatBox label="To Do" value={todo} color="bg-orange-500" />
          <StatBox label="In Progress" value={inProgress} color="bg-sky-500" />
          <StatBox label="Need Review" value={review} color="bg-violet-500" />
          <StatBox label="Done" value={done} color="bg-emerald-500" />
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-5 lg:col-span-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Upcoming due dates</div>
        {upcoming.length === 0 ? (
          <div className="text-sm text-muted-foreground">No upcoming due tasks.</div>
        ) : (
          <div className="divide-y">
            {upcoming.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate">{t.title}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {format(parseISO(t.due_date!), "MMM d, yyyy")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full", color)} /> {label}
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function ListTab({
  tasks,
  profileMap,
  counts,
  onClick,
}: {
  tasks: LaunchTask[];
  profileMap: Map<string, string>;
  counts: Record<string, { attachments: number; comments: number }>;
  onClick: (t: LaunchTask) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground border-2 border-dashed rounded-xl">
        No tasks match the current filters.
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-card overflow-hidden divide-y">
      <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/30">
        <div className="col-span-5">Task</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Assignee</div>
        <div className="col-span-2">Due</div>
        <div className="col-span-1 text-right">Activity</div>
      </div>
      {tasks.map((t) => {
        const theme = STATUS_THEME[t.status];
        const statusObj = LAUNCH_STATUSES.find((s) => s.value === t.status);
        return (
          <button
            key={t.id}
            onClick={() => onClick(t)}
            className="w-full text-left grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-muted/30"
          >
            <div className="col-span-5 min-w-0">
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">{t.phase}</Badge>
                {(t.tags || []).slice(0, 2).map((tag) => (
                  <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <span className={cn("inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md", theme.tag, theme.tagText)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", theme.progressDot)} />
                {statusObj?.label}
              </span>
            </div>
            <div className="col-span-2 text-xs text-muted-foreground truncate">
              {t.assignee_id ? profileMap.get(t.assignee_id) || "—" : "Unassigned"}
            </div>
            <div className="col-span-2 text-xs text-muted-foreground tabular-nums">
              {t.due_date ? format(parseISO(t.due_date), "MMM d") : "—"}
            </div>
            <div className="col-span-1 text-right text-[11px] text-muted-foreground">
              {(counts[t.id]?.comments || 0) + (counts[t.id]?.attachments || 0)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
