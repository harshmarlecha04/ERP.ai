import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LaunchTask,
  LAUNCH_PHASES,
  LAUNCH_STATUSES,
  ChecklistItem,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useLaunchProductLines,
  useLaunchProjects,
} from "@/hooks/launch/useLaunch";
import { useProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/hooks/useAuth";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CommentsPanel, AttachmentsPanel } from "./TaskActivityPanels";
import { TaskChecklistEditor } from "./TaskChecklistEditor";
import { TaskTagsEditor } from "./TaskTagsEditor";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: LaunchTask | null;
  defaultStatus?: LaunchTask["status"];
  defaultProjectId?: string;
}

export function LaunchTaskDialog({ open, onOpenChange, task, defaultStatus, defaultProjectId }: Props) {
  const { user } = useAuth();
  const { data: lines = [] } = useLaunchProductLines();
  const { data: projects = [] } = useLaunchProjects();
  const { data: profiles = [] } = useProfiles();
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [productLineId, setProductLineId] = useState<string>("");
  const [phase, setPhase] = useState<LaunchTask["phase"]>("Formulation");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [status, setStatus] = useState<LaunchTask["status"]>("todo");
  const [priority, setPriority] = useState<LaunchTask["priority"]>("medium");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  // After creating a new task, store its id so Comments/Attachments tabs unlock.
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "comments" | "attachments">("details");

  const activeTaskId = task?.id || createdTaskId;

  useEffect(() => {
    if (open) {
      setTitle(task?.title || "");
      setDescription(task?.description || "");
      setProjectId(task?.project_id || defaultProjectId || "");
      setProductLineId(task?.product_line_id || "");
      setPhase(task?.phase || "Formulation");
      setAssigneeId(task?.assignee_id || user?.id || "");
      setStatus(task?.status || defaultStatus || "todo");
      setPriority(task?.priority || "medium");
      setStartDate(task?.start_date || "");
      setDueDate(task?.due_date || "");
      setTags(task?.tags || []);
      setChecklist((task?.checklist as ChecklistItem[]) || []);
      setCreatedTaskId(null);
      setTab("details");
    }
  }, [open, task, defaultProjectId]);

  useEffect(() => {
    if (!projectId) return;
    const p = projects.find((x) => x.id === projectId);
    if (p?.product_line_id && !productLineId) setProductLineId(p.product_line_id);
  }, [projectId, projects]);

  const buildPayload = (): Partial<LaunchTask> => ({
    title: title.trim(),
    description: description.trim() || null,
    project_id: projectId || null,
    product_line_id: productLineId || null,
    phase,
    assignee_id: assigneeId || null,
    status,
    priority,
    start_date: startDate || null,
    due_date: dueDate || null,
    tags,
    checklist,
  });

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Title required");
    if (task) {
      await update.mutateAsync({ id: task.id, patch: buildPayload() });
      onOpenChange(false);
    } else if (createdTaskId) {
      // editing the just-created task
      await update.mutateAsync({ id: createdTaskId, patch: buildPayload() });
      toast.success("Saved");
    } else {
      const created = await create.mutateAsync(buildPayload());
      setCreatedTaskId(created.id);
      setTab("comments");
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm("Delete this task?")) return;
    await remove.mutateAsync(task.id);
    onOpenChange(false);
  };

  const isNewMode = !task && !createdTaskId;
  const primaryLabel = task ? "Save" : createdTaskId ? "Save changes" : "Create & add details";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {task ? "Edit Task" : createdTaskId ? "Task created — add details" : "New Task"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments" disabled={!activeTaskId}>
              Updates
            </TabsTrigger>
            <TabsTrigger value="attachments" disabled={!activeTaskId}>
              Attachments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Project</Label>
                <Select
                  value={projectId || "none"}
                  onValueChange={(v) => setProjectId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Product Line</Label>
                <Select value={productLineId || "none"} onValueChange={(v) => setProductLineId(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select line" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {lines.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Phase</Label>
                <Select value={phase} onValueChange={(v) => setPhase(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAUNCH_PHASES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <Select
                  value={assigneeId || "unassigned"}
                  onValueChange={(v) => setAssigneeId(v === "unassigned" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {profiles.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.display_name || p.full_name || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAUNCH_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t">
              <Label>Tags</Label>
              <TaskTagsEditor tags={tags} onChange={setTags} />
            </div>

            <div className="space-y-1.5 pt-2 border-t">
              <Label>Checklist</Label>
              <TaskChecklistEditor items={checklist} onChange={setChecklist} />
            </div>
          </TabsContent>

          {activeTaskId && (
            <TabsContent value="comments" className="pt-4">
              <CommentsPanel taskId={activeTaskId} />
            </TabsContent>
          )}

          {activeTaskId && (
            <TabsContent value="attachments" className="pt-4">
              <AttachmentsPanel taskId={activeTaskId} />
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="gap-2">
          {task && (
            <Button variant="destructive" onClick={handleDelete} className="mr-auto">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {createdTaskId ? "Done" : "Cancel"}
          </Button>
          {tab === "details" && (
            <Button onClick={handleSave}>{primaryLabel}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
