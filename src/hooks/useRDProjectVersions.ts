import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RDProjectVersion, RDVersionActive } from "./useRDProjects";

export const useRDProjectVersions = (projectId: string | null) => {
  return useQuery({
    queryKey: ["rd-project-versions", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("rd_project_versions")
        .select(`
          *,
          actives:rd_version_actives(*),
          inactives:rd_version_inactives(*)
        `)
        .eq("rd_project_id", projectId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      (data || []).forEach((v: any) => {
        if (Array.isArray(v.inactives)) {
          v.inactives.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        }
      });
      return data;
    },
    enabled: !!projectId,
  });
};

export const useCreateVersion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      rd_project_id: string;
      flavor: string;
      color: string;
      mold_size?: string;
      actives: Array<{ active_name: string; mg_per_gummy: number; overage_pct?: number }>;
      inactives?: string[];
      notes?: string;
      gummies_count?: number;
      scheduled_date?: string;
      base_template_id?: string | null;
      piece_weight_g?: number | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Get current version count
      const { data: project } = await supabase
        .from("rd_projects")
        .select("version_count")
        .eq("id", data.rd_project_id)
        .single();

      const nextVersionNumber = `v${(project?.version_count || 0) + 1}`;
      const overageList = (data.actives || [])
        .map((a) => ({ name: a.active_name, overage_pct: a.overage_pct || 0 }))
        .filter((o) => o.overage_pct > 0);

      // Create new version
      const { data: version, error: versionError } = await supabase
        .from("rd_project_versions")
        .insert({
          rd_project_id: data.rd_project_id,
          version_number: nextVersionNumber,
          flavor: data.flavor,
          color: data.color,
          mold_size: data.mold_size,

          gummies_count: data.gummies_count,
          scheduled_date: data.scheduled_date,
          notes: data.notes,
          status: "scheduled",
          created_by: user?.id,
          base_template_id: data.base_template_id ?? null,
          piece_weight_g: data.piece_weight_g ?? null,
          active_overage_percent: overageList.length ? overageList : null,
        } as any)
        .select()
        .single();

      if (versionError) throw versionError;

      // Create actives
      if (data.actives && data.actives.length > 0) {
        const activesData = data.actives.map((active, index) => ({
          version_id: version.id,
          active_name: active.active_name,
          mg_per_gummy: active.mg_per_gummy,
          sort_order: index,
        }));

        const { error: activesError } = await supabase
          .from("rd_version_actives")
          .insert(activesData);

        if (activesError) throw activesError;
      }

      // Create inactives
      const cleanInactives = (data.inactives || []).map(s => s.trim()).filter(Boolean);
      if (cleanInactives.length > 0) {
        const inactivesData = cleanInactives.map((name, index) => ({
          version_id: version.id,
          name,
          sort_order: index,
        }));
        const { error: inErr } = await supabase
          .from("rd_version_inactives")
          .insert(inactivesData);
        if (inErr) throw inErr;
      }

      // Update project version count
      const { error: updateError } = await supabase
        .from("rd_projects")
        .update({
          version_count: (project?.version_count || 0) + 1,
        })
        .eq("id", data.rd_project_id);

      if (updateError) throw updateError;

      return version;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", variables.rd_project_id] });
      queryClient.invalidateQueries({ queryKey: ["rd-project-versions", variables.rd_project_id] });
      toast.success("New version created successfully");
    },
    onError: (error: any) => {
      console.error("Error creating version:", error);
      toast.error(error.message || "Failed to create version");
    },
  });
};

export const useUpdateVersion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      rd_project_id: string;
      flavor: string;
      color: string;
      mold_size?: string;
      actives: Array<{ active_name: string; mg_per_gummy: number; overage_pct?: number }>;
      inactives?: string[];
      notes?: string;
      gummies_count?: number;
      scheduled_date?: string;
      base_template_id?: string | null;
      piece_weight_g?: number | null;
    }) => {
      const overageList = (data.actives || [])
        .map((a) => ({ name: a.active_name, overage_pct: a.overage_pct || 0 }))
        .filter((o) => o.overage_pct > 0);
      // Update version
      const { data: version, error: versionError } = await supabase
        .from("rd_project_versions")
        .update({
          flavor: data.flavor,
          color: data.color,
          mold_size: data.mold_size,
          gummies_count: data.gummies_count,
          scheduled_date: data.scheduled_date,
          notes: data.notes,
          base_template_id: data.base_template_id ?? null,
          piece_weight_g: data.piece_weight_g ?? null,
          active_overage_percent: overageList.length ? overageList : null,
        } as any)

        .eq("id", data.id)
        .select()
        .single();

      if (versionError) throw versionError;

      // Delete existing actives
      const { error: deleteError } = await supabase
        .from("rd_version_actives")
        .delete()
        .eq("version_id", data.id);

      if (deleteError) throw deleteError;

      // Create new actives
      if (data.actives && data.actives.length > 0) {
        const activesData = data.actives.map((active, index) => ({
          version_id: data.id,
          active_name: active.active_name,
          mg_per_gummy: active.mg_per_gummy,
          sort_order: index,
        }));

        const { error: activesError } = await supabase
          .from("rd_version_actives")
          .insert(activesData);

        if (activesError) throw activesError;
      }

      // Replace inactives
      const { error: inDelErr } = await supabase
        .from("rd_version_inactives")
        .delete()
        .eq("version_id", data.id);
      if (inDelErr) throw inDelErr;

      const cleanInactives = (data.inactives || []).map(s => s.trim()).filter(Boolean);
      if (cleanInactives.length > 0) {
        const inactivesData = cleanInactives.map((name, index) => ({
          version_id: data.id,
          name,
          sort_order: index,
        }));
        const { error: inErr } = await supabase
          .from("rd_version_inactives")
          .insert(inactivesData);
        if (inErr) throw inErr;
      }

      return version;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", variables.rd_project_id] });
      queryClient.invalidateQueries({ queryKey: ["rd-project-versions", variables.rd_project_id] });
      toast.success("Version updated successfully");
    },
    onError: (error: any) => {
      console.error("Error updating version:", error);
      toast.error(error.message || "Failed to update version");
    },
  });
};

export const useDeleteVersion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; rd_project_id: string }) => {
      const { error } = await supabase
        .from("rd_project_versions")
        .delete()
        .eq("id", data.id);

      if (error) throw error;

      // Decrement version count
      const { data: project } = await supabase
        .from("rd_projects")
        .select("version_count")
        .eq("id", data.rd_project_id)
        .single();

      const { error: updateError } = await supabase
        .from("rd_projects")
        .update({
          version_count: Math.max(0, (project?.version_count || 1) - 1),
        })
        .eq("id", data.rd_project_id);

      if (updateError) throw updateError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", variables.rd_project_id] });
      queryClient.invalidateQueries({ queryKey: ["rd-project-versions", variables.rd_project_id] });
      toast.success("Version deleted successfully");
    },
    onError: (error: any) => {
      console.error("Error deleting version:", error);
      toast.error(error.message || "Failed to delete version");
    },
  });
};

export const useApproveVersion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; rd_project_id: string; setAsCurrent?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: version, error } = await supabase
        .from("rd_project_versions")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;

      // Optionally set as current version
      if (data.setAsCurrent) {
        const { error: updateError } = await supabase
          .from("rd_projects")
          .update({
            current_version_id: data.id,
          })
          .eq("id", data.rd_project_id);

        if (updateError) throw updateError;
      }

      return version;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", variables.rd_project_id] });
      queryClient.invalidateQueries({ queryKey: ["rd-project-versions", variables.rd_project_id] });
      toast.success("Version approved successfully");
    },
    onError: (error: any) => {
      console.error("Error approving version:", error);
      toast.error(error.message || "Failed to approve version");
    },
  });
};

export const useRejectVersion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; rd_project_id: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: version, error } = await supabase
        .from("rd_project_versions")
        .update({
          status: "rejected",
          rejected_by: user?.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: data.reason,
        })
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;
      return version;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", variables.rd_project_id] });
      queryClient.invalidateQueries({ queryKey: ["rd-project-versions", variables.rd_project_id] });
      toast.success("Version rejected");
    },
    onError: (error: any) => {
      console.error("Error rejecting version:", error);
      toast.error(error.message || "Failed to reject version");
    },
  });
};

export const useMarkVersionQAReceived = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; rd_project_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: version, error } = await supabase
        .from("rd_project_versions")
        .update({
          status: "qa_received",
          qa_received_by: user?.id ?? null,
          qa_received_at: new Date().toISOString(),
        } as any)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw error;
      return version;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", variables.rd_project_id] });
      queryClient.invalidateQueries({ queryKey: ["rd-project-versions", variables.rd_project_id] });
      toast.success("Marked as QA Received");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
    },
  });
};

export const useRevertVersionToScheduled = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; rd_project_id: string }) => {
      const { data: version, error } = await supabase
        .from("rd_project_versions")
        .update({
          status: "scheduled",
          qa_received_by: null,
          qa_received_at: null,
        } as any)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw error;
      return version;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", variables.rd_project_id] });
      queryClient.invalidateQueries({ queryKey: ["rd-project-versions", variables.rd_project_id] });
      toast.success("Reverted to Scheduled");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
    },
  });
};
