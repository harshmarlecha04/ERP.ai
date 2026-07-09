import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useEffect } from "react";

export type LaunchPhase =
  | "Formulation"
  | "Manufacturing"
  | "Regulatory"
  | "Packaging"
  | "Marketing"
  | "Distribution";
export type LaunchStatus = "todo" | "in_progress" | "review" | "done";
export type LaunchPriority = "low" | "medium" | "high";
export type LaunchProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";

export const LAUNCH_PHASES: LaunchPhase[] = [
  "Formulation",
  "Manufacturing",
  "Regulatory",
  "Packaging",
  "Marketing",
  "Distribution",
];
export const LAUNCH_STATUSES: { value: LaunchStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "review", label: "Need Review" },
];
export const LAUNCH_PROJECT_STATUSES: { value: LaunchProjectStatus; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export interface LaunchProductLine {
  id: string;
  name: string;
  description: string | null;
  target_launch_date: string | null;
  color: string;
  created_at: string;
}

export interface LaunchProject {
  id: string;
  product_line_id: string | null;
  name: string;
  code: string | null;
  description: string | null;
  status: LaunchProjectStatus;
  priority: LaunchPriority;
  owner_id: string | null;
  start_date: string | null;
  target_date: string | null;
  color: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}


export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface LaunchTask {
  id: string;
  project_id: string | null;
  product_line_id: string | null;
  title: string;
  description: string | null;
  phase: LaunchPhase;
  status: LaunchStatus;
  priority: LaunchPriority;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  position: number;
  tags: string[];
  checklist: ChecklistItem[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaunchProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  added_at: string;
}

export interface LaunchTaskUpdate {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  kind: string;
  created_at: string;
}

export interface LaunchAttachment {
  id: string;
  task_id: string | null;
  project_id: string | null;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

const sb = supabase as any;

/* -------------------- PRODUCT LINES -------------------- */
export function useLaunchProductLines() {
  return useQuery({
    queryKey: ["launch", "product_lines"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("launch_product_lines")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as LaunchProductLine[];
    },
  });
}

/* -------------------- PROJECTS -------------------- */
export function useLaunchProjects(productLineId?: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["launch", "projects", productLineId],
    queryFn: async () => {
      let q = sb.from("launch_projects").select("*").order("created_at", { ascending: false });
      if (productLineId) q = q.eq("product_line_id", productLineId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LaunchProject[];
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel("launch_projects_watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "launch_projects" }, () =>
        qc.invalidateQueries({ queryKey: ["launch", "projects"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return q;
}

export function useLaunchProject(id: string | undefined) {
  return useQuery({
    queryKey: ["launch", "project", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sb.from("launch_projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as LaunchProject | null;
    },
  });
}

export function useCreateProject() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LaunchProject>) => {
      const { data, error } = await sb
        .from("launch_projects")
        .insert({ ...input, created_by: user!.id })
        .select("*")
        .single();
      if (error) throw error;
      return data as LaunchProject;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["launch", "projects"] });
      toast.success("Project created");
    },
    onError: (e: any) => toast.error(e.message || "Failed to create project"),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LaunchProject> }) => {
      const { data, error } = await sb
        .from("launch_projects")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as LaunchProject;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["launch", "projects"] });
      qc.invalidateQueries({ queryKey: ["launch", "project", v.id] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to update project"),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("launch_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["launch", "projects"] });
      toast.success("Project deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete project"),
  });
}

/* -------------------- TASKS -------------------- */
export interface TaskFilters {
  projectId?: string;
  productLineId?: string;
  phase?: LaunchPhase;
  assigneeId?: string;
  mine?: boolean;
  search?: string;
}

export function useLaunchTasks(filters: TaskFilters = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["launch", "tasks", filters, user?.id],
    queryFn: async () => {
      let q = sb.from("launch_tasks").select("*").order("position", { ascending: true });
      if (filters.projectId) q = q.eq("project_id", filters.projectId);
      if (filters.productLineId) q = q.eq("product_line_id", filters.productLineId);
      if (filters.phase) q = q.eq("phase", filters.phase);
      if (filters.mine && user?.id) q = q.eq("assignee_id", user.id);
      else if (filters.assigneeId) q = q.eq("assignee_id", filters.assigneeId);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data || []) as LaunchTask[];
      if (filters.search) {
        const s = filters.search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.title.toLowerCase().includes(s) ||
            (r.description || "").toLowerCase().includes(s)
        );
      }
      return rows;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("launch_tasks_watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "launch_tasks" }, () =>
        qc.invalidateQueries({ queryKey: ["launch", "tasks"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return query;
}

export function useCreateTask() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LaunchTask>) => {
      const { data, error } = await sb
        .from("launch_tasks")
        .insert({ ...input, created_by: user!.id })
        .select("*")
        .single();
      if (error) throw error;
      return data as LaunchTask;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["launch", "tasks"] });
      toast.success("Task created");
    },
    onError: (e: any) => toast.error(e.message || "Failed to create task"),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LaunchTask> }) => {
      const { data, error } = await sb
        .from("launch_tasks")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as LaunchTask;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["launch", "tasks"] }),
    onError: (e: any) => toast.error(e.message || "Failed to update task"),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("launch_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["launch", "tasks"] });
      toast.success("Task deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete task"),
  });
}

/* -------------------- TASK UPDATES (timeline) -------------------- */
export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ["launch", "updates", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("launch_task_updates")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as LaunchTaskUpdate[];
    },
  });
}

export function useAddComment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, body, kind = "comment" }: { taskId: string; body: string; kind?: string }) => {
      const { data, error } = await sb
        .from("launch_task_updates")
        .insert({ task_id: taskId, body, kind, author_id: user!.id })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["launch", "updates", v.taskId] }),
    onError: (e: any) => toast.error(e.message || "Failed to add update"),
  });
}

/* -------------------- ATTACHMENTS -------------------- */
export function useTaskAttachments(taskId: string | null) {
  return useQuery({
    queryKey: ["launch", "attachments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("launch_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LaunchAttachment[];
    },
  });
}

export function useUploadAttachment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      const path = `${taskId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("launch-attachments")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data, error } = await sb
        .from("launch_attachments")
        .insert({
          task_id: taskId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: path,
          uploaded_by: user!.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["launch", "attachments", v.taskId] });
      toast.success("File uploaded");
    },
    onError: (e: any) => toast.error(e.message || "Upload failed"),
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (att: LaunchAttachment) => {
      await supabase.storage.from("launch-attachments").remove([att.storage_path]);
      const { error } = await sb.from("launch_attachments").delete().eq("id", att.id);
      if (error) throw error;
      return att;
    },
    onSuccess: (att) => qc.invalidateQueries({ queryKey: ["launch", "attachments", att.task_id] }),
  });
}

export async function getAttachmentSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("launch-attachments")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/* -------------------- MILESTONES -------------------- */
export function useLaunchMilestones(projectId?: string) {
  return useQuery({
    queryKey: ["launch", "milestones", projectId],
    queryFn: async () => {
      let q = sb.from("launch_milestones").select("*").order("date");
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

/* -------------------- PROJECT MEMBERS -------------------- */
export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ["launch", "project_members", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("launch_project_members")
        .select("*")
        .eq("project_id", projectId);
      if (error) throw error;
      return (data || []) as LaunchProjectMember[];
    },
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, userId, role = "member" }: { projectId: string; userId: string; role?: string }) => {
      const { data, error } = await sb
        .from("launch_project_members")
        .insert({ project_id: projectId, user_id: userId, role })
        .select("*")
        .single();
      if (error) throw error;
      return data as LaunchProjectMember;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["launch", "project_members", v.projectId] });
      toast.success("Member added");
    },
    onError: (e: any) => toast.error(e.message || "Failed to add member"),
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await sb.from("launch_project_members").delete().eq("id", id);
      if (error) throw error;
      return { id, projectId };
    },
    onSuccess: (r) => qc.invalidateQueries({ queryKey: ["launch", "project_members", r.projectId] }),
    onError: (e: any) => toast.error(e.message || "Failed to remove member"),
  });
}

/* -------------------- TASK ACTIVITY COUNTS -------------------- */
export function useTaskActivityCounts(taskIds: string[]) {
  return useQuery({
    queryKey: ["launch", "task_counts", taskIds.slice().sort().join(",")],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const [attRes, comRes] = await Promise.all([
        sb.from("launch_attachments").select("task_id").in("task_id", taskIds),
        sb.from("launch_task_updates").select("task_id").in("task_id", taskIds),
      ]);
      if (attRes.error) throw attRes.error;
      if (comRes.error) throw comRes.error;
      const counts: Record<string, { attachments: number; comments: number }> = {};
      taskIds.forEach((id) => (counts[id] = { attachments: 0, comments: 0 }));
      (attRes.data || []).forEach((r: any) => {
        if (counts[r.task_id]) counts[r.task_id].attachments += 1;
      });
      (comRes.data || []).forEach((r: any) => {
        if (counts[r.task_id]) counts[r.task_id].comments += 1;
      });
      return counts;
    },
  });
}

