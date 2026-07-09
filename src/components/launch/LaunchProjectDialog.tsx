import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  LaunchProject,
  LAUNCH_PROJECT_STATUSES,
  useLaunchProductLines,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "@/hooks/launch/useLaunch";
import { useProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project?: LaunchProject | null;
}

export function LaunchProjectDialog({ open, onOpenChange, project }: Props) {
  const { user } = useAuth();
  const { data: lines = [] } = useLaunchProductLines();
  const { data: profiles = [] } = useProfiles();
  const create = useCreateProject();
  const update = useUpdateProject();
  const remove = useDeleteProject();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [productLineId, setProductLineId] = useState("");
  const [status, setStatus] = useState<LaunchProject["status"]>("planning");
  const [priority, setPriority] = useState<LaunchProject["priority"]>("medium");
  const [ownerId, setOwnerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");

  useEffect(() => {
    if (open) {
      setName(project?.name || "");
      setCode(project?.code || "");
      setDescription(project?.description || "");
      setProductLineId(project?.product_line_id || "");
      setStatus(project?.status || "planning");
      setPriority(project?.priority || "medium");
      setOwnerId(project?.owner_id || user?.id || "");
      setStartDate(project?.start_date || "");
      setTargetDate(project?.target_date || "");
    }
  }, [open, project]);


  const handleSave = async () => {
    if (!name.trim()) return toast.error("Name required");
    const payload: Partial<LaunchProject> = {
      name: name.trim(),
      code: code.trim() || null,
      description: description.trim() || null,
      product_line_id: productLineId || null,
      status,
      priority,
      owner_id: ownerId || null,
      start_date: startDate || null,
      target_date: targetDate || null,
    };
    if (project) await update.mutateAsync({ id: project.id, patch: payload });
    else await create.mutateAsync(payload);
    onOpenChange(false);
  };


  const handleDelete = async () => {
    if (!project) return;
    if (!confirm("Delete this project and all its tasks?")) return;
    await remove.mutateAsync(project.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" onFocusOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{project ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gummies Q3 Launch" />
            </div>
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. GUM-Q3" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Product Line</Label>
              <Select value={productLineId || "none"} onValueChange={(v) => setProductLineId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select line" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {lines.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={ownerId || "unassigned"} onValueChange={(v) => setOwnerId(v === "unassigned" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LAUNCH_PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Target date</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {project && (
            <Button variant="destructive" onClick={handleDelete} className="mr-auto">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>{project ? "Save" : "Create project"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
