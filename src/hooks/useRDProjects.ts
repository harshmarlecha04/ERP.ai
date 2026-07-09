import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RDProjectVersion {
  id: string;
  rd_project_id: string;
  version_number: string;
  gummies_count: number | null;
  scheduled_date: string | null;
  flavor: string;
  color: string;
  mold_size: string | null;

  notes: string | null;
  status: 'scheduled' | 'qa_received' | 'pending_approval' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  qa_received_by: string | null;
  qa_received_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  actives?: RDVersionActive[];
}

export interface RDVersionActive {
  id: string;
  version_id: string;
  active_name: string;
  mg_per_gummy: number;
  sort_order: number;
}

export interface RDProject {
  id: string;
  project_number: string;
  customer_id: string | null;
  customer_name: string;
  status: string;
  formula_reference_link: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  converted_to_formula_id: string | null;
  converted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  current_version_id: string | null;
  version_count: number;
  current_version?: RDProjectVersion;
}

export interface RDProjectActive {
  id: string;
  rd_project_id: string;
  active_name: string;
  mg_per_gummy: number;
  sort_order: number;
  created_at: string;
}

export interface RDProjectBatch {
  id: string;
  rd_project_id: string;
  batch_number: string;
  batch_date: string;
  quantity_produced: string | null;
  sent_to: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
}

export interface RDBatchFeedback {
  id: string;
  rd_batch_id: string;
  feedback_text: string;
  feedback_source: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useRDProjects = () => {
  return useQuery({
    queryKey: ["rd-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rd_projects")
        .select(`
          *,
          current_version:rd_project_versions!current_version_id(
            *,
            actives:rd_version_actives(*),
            inactives:rd_version_inactives(*)
          ),
          versions:rd_project_versions!rd_project_id(
            *,
            actives:rd_version_actives(*),
            inactives:rd_version_inactives(*)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useRDProject = (id: string | null) => {
  return useQuery({
    queryKey: ["rd-project", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("rd_projects")
        .select(`
          *,
          current_version:rd_project_versions!current_version_id(
            *,
            actives:rd_version_actives(*),
            inactives:rd_version_inactives(*)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useRDProjectVersions = (projectId: string | null) => {
  return useQuery({
    queryKey: ["rd-project-versions", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data: versions, error } = await supabase
        .from("rd_project_versions")
        .select(`
          *,
          actives:rd_version_actives(*),
          inactives:rd_version_inactives(*)
        `)
        .eq("rd_project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return versions;
    },
    enabled: !!projectId,
  });
};

export const useRDProjectBatches = (projectId: string | null) => {
  return useQuery({
    queryKey: ["rd-project-batches", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("rd_project_batches")
        .select("*")
        .eq("rd_project_id", projectId)
        .order("batch_number", { ascending: false });

      if (error) throw error;
      return data as RDProjectBatch[];
    },
    enabled: !!projectId,
  });
};

export const useRDBatchFeedback = (batchId: string | null) => {
  return useQuery({
    queryKey: ["rd-batch-feedback", batchId],
    queryFn: async () => {
      if (!batchId) return [];

      const { data, error } = await supabase
        .from("rd_batch_feedback")
        .select("*")
        .eq("rd_batch_id", batchId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as RDBatchFeedback[];
    },
    enabled: !!batchId,
  });
};

const generateProjectNumber = async (): Promise<string> => {
  const { data, error } = await supabase
    .from("rd_projects")
    .select("project_number")
    .like("project_number", "RD-%")
    .order("project_number", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) {
    return "RD-001";
  }

  const lastNumber = data[0].project_number;
  const match = lastNumber.match(/RD-(\d+)/);
  const nextNumber = match ? parseInt(match[1]) + 1 : 1;
  return `RD-${String(nextNumber).padStart(3, "0")}`;
};

const generateBatchNumber = async (projectId: string): Promise<string> => {
  const { data, error } = await supabase
    .from("rd_project_batches")
    .select("batch_number")
    .eq("rd_project_id", projectId)
    .like("batch_number", "B-%")
    .order("batch_number", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) {
    return "B-001";
  }

  const lastNumber = data[0].batch_number;
  const match = lastNumber.match(/B-(\d+)/);
  const nextNumber = match ? parseInt(match[1]) + 1 : 1;
  return `B-${String(nextNumber).padStart(3, "0")}`;
};

export const useCreateRDProject = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      customer_id: string | null;
      customer_name: string;
      project_name: string;
      flavor: string;
      color: string;
      mold_size?: string | null;
      notes?: string;
      formula_reference_link?: string | null;
      gummies_count?: number | null;
      scheduled_date?: string | null;
      actives: Array<{ active_name: string; mg_per_gummy: number; overage_pct?: number }>;
      inactives?: string[];
      base_template_id?: string | null;
      piece_weight_g?: number | null;
    }) => {

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const projectNumber = await generateProjectNumber();

      // Create project - types may be outdated, using any for insert
        const { data: project, error: projectError } = await supabase
          .from("rd_projects")
          .insert({
            project_number: projectNumber,
            customer_id: data.customer_id,
            customer_name: data.customer_name,
            project_name: data.project_name,
            flavor: data.flavor,
            color: data.color,
            mold_size: data.mold_size,
            formula_reference_link: data.formula_reference_link,
            created_by: user.id,
          } as any)
          .select()
          .single();

      if (projectError) throw projectError;

      const overageList = (data.actives || [])
        .map((a) => ({ name: a.active_name, overage_pct: a.overage_pct || 0 }))
        .filter((o) => o.overage_pct > 0);

      // Create v1 version
      const { data: version, error: versionError } = await supabase
        .from("rd_project_versions")
        .insert({
          rd_project_id: project.id,
          version_number: "v1",
          flavor: data.flavor,
          color: data.color,
          mold_size: data.mold_size,
          gummies_count: data.gummies_count,
          scheduled_date: data.scheduled_date,
          notes: data.notes,
          created_by: user.id,
          base_template_id: data.base_template_id ?? null,
          piece_weight_g: data.piece_weight_g ?? null,
          active_overage_percent: overageList.length ? overageList : null,
        } as any)
        .select()
        .single();


      if (versionError) throw versionError;

      // Create actives for version
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

      // Inactives for v1
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

      // Update project with version info
      const { error: updateError } = await supabase
        .from("rd_projects")
        .update({
          current_version_id: version.id,
          version_count: 1,
        })
        .eq("id", project.id);

      if (updateError) throw updateError;

      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      toast({
        title: "Success",
        description: "R&D Project created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create R&D project: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateRDProject = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      project_number: string;
      customer_id: string | null;
      customer_name: string;
      project_name?: string;
      formula_reference_link?: string;
    }) => {
      const updateData: any = {
        project_number: data.project_number,
        customer_id: data.customer_id,
        customer_name: data.customer_name,
      };

      if (data.project_name !== undefined) {
        updateData.project_name = data.project_name;
      }

      if (data.formula_reference_link !== undefined) {
        updateData.formula_reference_link = data.formula_reference_link;
      }

      const { data: project, error: projectError } = await supabase
        .from("rd_projects")
        .update(updateData)
        .eq("id", data.id)
        .select()
        .single();

      if (projectError) throw projectError;
      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project"] });
      toast({
        title: "Success",
        description: "R&D Project updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update R&D project: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteRDProject = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rd_projects")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      toast({
        title: "Success",
        description: "R&D Project deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete R&D project: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useDuplicateRDProject = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Load source project
      const { data: source, error: srcErr } = await supabase
        .from("rd_projects")
        .select("*")
        .eq("id", sourceId)
        .single();
      if (srcErr) throw srcErr;

      // Load source current version + actives + inactives
      let sourceVersion: any = null;
      let sourceActives: any[] = [];
      let sourceInactives: any[] = [];
      if ((source as any).current_version_id) {
        const { data: ver, error: verErr } = await supabase
          .from("rd_project_versions")
          .select("*, actives:rd_version_actives(*), inactives:rd_version_inactives(*)")
          .eq("id", (source as any).current_version_id)
          .single();
        if (verErr) throw verErr;
        sourceVersion = ver;
        sourceActives = (ver as any)?.actives || [];
        sourceInactives = (ver as any)?.inactives || [];
      }

      const newProjectNumber = await generateProjectNumber();

      const insertPayload: any = {
        project_number: newProjectNumber,
        customer_id: (source as any).customer_id,
        customer_name: (source as any).customer_name,
        project_name: (source as any).project_name
          ? `${(source as any).project_name} (Copy)`
          : null,
        flavor: (source as any).flavor,
        color: (source as any).color,
        mold_size: (source as any).mold_size ?? null,
        formula_reference_link: (source as any).formula_reference_link,
        status: "pending_approval",
        created_by: user.id,
      };

      const { data: project, error: projectError } = await supabase
        .from("rd_projects")
        .insert(insertPayload)
        .select()
        .single();
      if (projectError) throw projectError;

      // Create v1 cloned from source current version (or minimal default)
      const versionPayload: any = {
        rd_project_id: project.id,
        version_number: "v1",
        flavor: sourceVersion?.flavor ?? (source as any).flavor ?? "",
        color: sourceVersion?.color ?? (source as any).color ?? "",
        mold_size: sourceVersion?.mold_size ?? (source as any).mold_size ?? null,
        gummies_count: sourceVersion?.gummies_count ?? null,
        scheduled_date: sourceVersion?.scheduled_date ?? null,
        notes: sourceVersion?.notes ?? null,
        created_by: user.id,
      };


      const { data: version, error: versionError } = await supabase
        .from("rd_project_versions")
        .insert(versionPayload)
        .select()
        .single();
      if (versionError) throw versionError;

      if (sourceActives.length > 0) {
        const activesData = sourceActives.map((a: any, index: number) => ({
          version_id: version.id,
          active_name: a.active_name,
          mg_per_gummy: a.mg_per_gummy,
          sort_order: a.sort_order ?? index,
        }));
        const { error: activesError } = await supabase
          .from("rd_version_actives")
          .insert(activesData);
        if (activesError) throw activesError;
      }

      if (sourceInactives.length > 0) {
        const inactivesData = sourceInactives.map((i: any, idx: number) => ({
          version_id: version.id,
          name: i.name,
          sort_order: i.sort_order ?? idx,
        }));
        const { error: inErr } = await supabase
          .from("rd_version_inactives")
          .insert(inactivesData);
        if (inErr) throw inErr;
      }

      const { error: updateError } = await supabase
        .from("rd_projects")
        .update({
          current_version_id: version.id,
          version_count: 1,
        })
        .eq("id", project.id);
      if (updateError) throw updateError;

      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      toast({
        title: "Success",
        description: "R&D Project duplicated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to duplicate R&D project: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useApproveRDProject = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("rd_projects")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", id] });
      toast({
        title: "Success",
        description: "R&D Project approved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to approve R&D project: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useRejectRDProject = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("rd_projects")
        .update({
          status: "rejected",
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", id] });
      toast({
        title: "Success",
        description: "R&D Project rejected",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to reject R&D project: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useConvertToProduction = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.rpc("convert_rd_to_production", {
        p_rd_project_id: projectId,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: (formulaId, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["formulas"] });
      toast({
        title: "Success",
        description: "R&D Project converted to production formula",
      });
      return formulaId;
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to convert to production: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useCreateBatch = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      rd_project_id: string;
      batch_date: string;
      quantity_produced?: string;
      sent_to?: string;
      status?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const batchNumber = await generateBatchNumber(data.rd_project_id);

      const { data: batch, error } = await supabase
        .from("rd_project_batches")
        .insert([{
          ...data,
          batch_number: batchNumber,
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return batch;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rd-project-batches", variables.rd_project_id] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", variables.rd_project_id] });
      toast({
        title: "Success",
        description: "Batch created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create batch: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateBatch = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      rd_project_id: string;
      batch_date: string;
      quantity_produced?: string;
      sent_to?: string;
      status?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("rd_project_batches")
        .update({
          batch_date: data.batch_date,
          quantity_produced: data.quantity_produced,
          sent_to: data.sent_to,
          status: data.status,
          notes: data.notes,
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rd-project-batches", variables.rd_project_id] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", variables.rd_project_id] });
      toast({
        title: "Success",
        description: "Batch updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update batch: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteBatch = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from("rd_project_batches")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["rd-project-batches", projectId] });
      queryClient.invalidateQueries({ queryKey: ["rd-project", projectId] });
      toast({
        title: "Success",
        description: "Batch deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete batch: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useAddFeedback = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      rd_batch_id: string;
      feedback_text: string;
      feedback_source?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: feedback, error } = await supabase
        .from("rd_batch_feedback")
        .insert([{
          ...data,
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return feedback;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rd-batch-feedback", variables.rd_batch_id] });
      toast({
        title: "Success",
        description: "Feedback added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add feedback: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateFeedback = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      rd_batch_id: string;
      feedback_text: string;
      feedback_source?: string;
    }) => {
      const { error } = await supabase
        .from("rd_batch_feedback")
        .update({
          feedback_text: data.feedback_text,
          feedback_source: data.feedback_source,
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rd-batch-feedback", variables.rd_batch_id] });
      toast({
        title: "Success",
        description: "Feedback updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update feedback: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteFeedback = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, batchId }: { id: string; batchId: string }) => {
      const { error } = await supabase
        .from("rd_batch_feedback")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { batchId }) => {
      queryClient.invalidateQueries({ queryKey: ["rd-batch-feedback", batchId] });
      toast({
        title: "Success",
        description: "Feedback deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete feedback: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useRescheduleRDVersion = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ versionId, scheduledDate }: { versionId: string; scheduledDate: string | null }) => {
      const { error } = await supabase
        .from("rd_project_versions")
        .update({ scheduled_date: scheduledDate })
        .eq("id", versionId);
      if (error) throw error;
      return { versionId, scheduledDate };
    },
    onSuccess: ({ scheduledDate }) => {
      queryClient.invalidateQueries({ queryKey: ["rd-projects"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project"] });
      queryClient.invalidateQueries({ queryKey: ["rd-project-versions"] });
      toast({
        title: scheduledDate ? "Rescheduled" : "Schedule cleared",
        description: scheduledDate ? `Moved to ${scheduledDate}` : "Scheduled date removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error rescheduling",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
