import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const sb = supabase as any;

/* ========== Types ========== */
export type MilestoneStatus = "pending" | "ready_for_signoff" | "done" | "at_risk";
export type RiskStatus = "open" | "mitigating" | "closed" | "accepted";
export type Health = "on_track" | "at_risk" | "off_track";
export type RACI = "R" | "A" | "C" | "I";

export interface LaunchCharter {
  id: string;
  project_id: string;
  executive_sponsor_id: string | null;
  project_owner_id: string | null;
  business_case: string | null;
  objectives: string | null;
  in_scope: string | null;
  out_of_scope: string | null;
  success_criteria: string | null;
  budget_amount: number | null;
  budget_currency: string;
  assumptions: string | null;
  constraints: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaunchStakeholder {
  id: string;
  project_id: string;
  user_id: string | null;
  external_name: string | null;
  external_email: string | null;
  workstream: string;
  raci: RACI;
  notes: string | null;
  created_at: string;
}

export interface LaunchRisk {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  likelihood: number; // 1-3
  impact: number; // 1-3
  status: RiskStatus;
  owner_id: string | null;
  mitigation: string | null;
  contingency: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaunchMilestoneFull {
  id: string;
  project_id: string | null;
  product_line_id: string | null;
  name: string;
  description: string | null;
  date: string;
  status: MilestoneStatus;
  owner_id: string | null;
  completed_at: string | null;
  signed_off_by: string | null;
  signed_off_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface LaunchStatusSnapshot {
  id: string;
  project_id: string;
  health: Health;
  percent_complete: number;
  accomplishments: string | null;
  next_steps: string | null;
  blockers: string | null;
  open_risks_count: number;
  milestones_done: number;
  milestones_total: number;
  captured_by: string | null;
  captured_at: string;
}

/* ========== CHARTER ========== */
export function useCharter(projectId: string | undefined) {
  return useQuery({
    queryKey: ["launch", "charter", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("launch_charters")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data as LaunchCharter | null;
    },
  });
}

export function useUpsertCharter() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<LaunchCharter> & { project_id: string }) => {
      const { data: existing } = await sb
        .from("launch_charters")
        .select("id")
        .eq("project_id", patch.project_id)
        .maybeSingle();
      if (existing?.id) {
        const { data, error } = await sb
          .from("launch_charters")
          .update(patch)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await sb
        .from("launch_charters")
        .insert({ ...patch, created_by: user?.id })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["launch", "charter", v.project_id] });
      toast.success("Charter saved");
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });
}

/* ========== STAKEHOLDERS (RACI) ========== */
export function useStakeholders(projectId: string | undefined) {
  return useQuery({
    queryKey: ["launch", "stakeholders", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("launch_stakeholders")
        .select("*")
        .eq("project_id", projectId)
        .order("workstream")
        .order("raci");
      if (error) throw error;
      return (data || []) as LaunchStakeholder[];
    },
  });
}

export function useAddStakeholder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Omit<LaunchStakeholder, "id" | "created_at">) => {
      const { data, error } = await sb.from("launch_stakeholders").insert(s).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["launch", "stakeholders", v.project_id] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to add stakeholder"),
  });
}

export function useDeleteStakeholder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await sb.from("launch_stakeholders").delete().eq("id", id);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: (r) => qc.invalidateQueries({ queryKey: ["launch", "stakeholders", r.projectId] }),
  });
}

/* ========== RISKS ========== */
export function useRisks(projectId: string | undefined) {
  return useQuery({
    queryKey: ["launch", "risks", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("launch_risks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LaunchRisk[];
    },
  });
}

export function useUpsertRisk() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (r: Partial<LaunchRisk> & { project_id: string }) => {
      if (r.id) {
        const { id, ...rest } = r;
        const { data, error } = await sb
          .from("launch_risks")
          .update(rest)
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await sb
        .from("launch_risks")
        .insert({ ...r, created_by: user?.id })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["launch", "risks", v.project_id] }),
    onError: (e: any) => toast.error(e.message || "Failed to save risk"),
  });
}

export function useDeleteRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await sb.from("launch_risks").delete().eq("id", id);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: (r) => qc.invalidateQueries({ queryKey: ["launch", "risks", r.projectId] }),
  });
}

/* ========== MILESTONES (full) ========== */
export function useMilestonesFull(projectId: string | undefined) {
  return useQuery({
    queryKey: ["launch", "milestones_full", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("launch_milestones")
        .select("*")
        .eq("project_id", projectId)
        .order("date");
      if (error) throw error;
      return (data || []) as LaunchMilestoneFull[];
    },
  });
}

export function useUpsertMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<LaunchMilestoneFull> & { project_id: string; name: string; date: string }) => {
      if (m.id) {
        const { id, ...rest } = m;
        const { data, error } = await sb
          .from("launch_milestones")
          .update(rest)
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await sb
        .from("launch_milestones")
        .insert(m)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["launch", "milestones_full", v.project_id] }),
    onError: (e: any) => toast.error(e.message || "Failed to save milestone"),
  });
}

export function useSignoffMilestone() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { data, error } = await sb
        .from("launch_milestones")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          signed_off_by: user?.id,
          signed_off_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return { data, projectId };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["launch", "milestones_full", r.projectId] });
      toast.success("Milestone signed off");
    },
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await sb.from("launch_milestones").delete().eq("id", id);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: (r) => qc.invalidateQueries({ queryKey: ["launch", "milestones_full", r.projectId] }),
  });
}

/* ========== STATUS SNAPSHOTS ========== */
export function useSnapshots(projectId: string | undefined) {
  return useQuery({
    queryKey: ["launch", "snapshots", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("launch_status_snapshots")
        .select("*")
        .eq("project_id", projectId)
        .order("captured_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LaunchStatusSnapshot[];
    },
  });
}

export function useCaptureSnapshot() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (s: Omit<LaunchStatusSnapshot, "id" | "captured_at" | "captured_by">) => {
      const { data, error } = await sb
        .from("launch_status_snapshots")
        .insert({ ...s, captured_by: user?.id })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["launch", "snapshots", v.project_id] });
      toast.success("Status snapshot captured");
    },
    onError: (e: any) => toast.error(e.message || "Failed to capture"),
  });
}
