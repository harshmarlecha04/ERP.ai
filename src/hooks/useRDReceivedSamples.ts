import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RDReceivedSample {
  id: string;
  rd_project_id: string;
  rd_version_id: string | null;
  received_date: string | null;
  made_on_date: string | null;
  product_name: string | null;
  mold_size: string | null;
  lot_number: string | null;
  flavor: string | null;
  color: string | null;
  customer_id: string | null;
  customer_name: string | null;
  on_hand: boolean;
  quantity_on_hand: number | null;
  received_by: string | null;
  received_by_name: string | null;
  received_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}


export type RDReceivedSampleInput = Omit<
  RDReceivedSample,
  | "id"
  | "created_at"
  | "updated_at"
  | "received_by"
  | "received_by_name"
  | "received_at"
  | "created_by"
>;

export const useRDReceivedSamples = (projectId: string | null) => {
  return useQuery({
    queryKey: ["rd-received-samples", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rd_received_samples")
        .select("*")
        .eq("rd_project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RDReceivedSample[];
    },
  });
};

export const useRDReceivedSamplesCounts = (projectIds: string[]) => {
  return useQuery({
    queryKey: ["rd-received-samples-counts", projectIds.sort().join(",")],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rd_received_samples")
        .select("rd_project_id, received_at")
        .in("rd_project_id", projectIds);
      if (error) throw error;
      const counts: Record<string, { total: number; received: number }> = {};
      (data || []).forEach((row: any) => {
        const id = row.rd_project_id as string;
        if (!counts[id]) counts[id] = { total: 0, received: 0 };
        counts[id].total += 1;
        if (row.received_at) counts[id].received += 1;
      });
      return counts;
    },
  });
};

export const useCreateRDReceivedSample = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RDReceivedSampleInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("rd_received_samples")
        .insert({ ...input, created_by: userData.user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as RDReceivedSample;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["rd-received-samples", row.rd_project_id] });
      qc.invalidateQueries({ queryKey: ["rd-received-samples-counts"] });
      toast.success("Sample logged");
    },
    onError: (e: any) => toast.error(e.message || "Failed to log sample"),
  });
};

export const useUpdateRDReceivedSample = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<RDReceivedSample> & { id: string }) => {
      const { data, error } = await supabase
        .from("rd_received_samples")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as RDReceivedSample;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["rd-received-samples", row.rd_project_id] });
      qc.invalidateQueries({ queryKey: ["rd-received-samples-counts"] });
      toast.success("Sample updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update sample"),
  });
};

export const useDeleteRDReceivedSample = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rd_project_id }: { id: string; rd_project_id: string }) => {
      const { error } = await supabase.from("rd_received_samples").delete().eq("id", id);
      if (error) throw error;
      return { id, rd_project_id };
    },
    onSuccess: ({ rd_project_id }) => {
      qc.invalidateQueries({ queryKey: ["rd-received-samples", rd_project_id] });
      qc.invalidateQueries({ queryKey: ["rd-received-samples-counts"] });
      toast.success("Sample deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete sample"),
  });
};

export const useMarkRDSampleReceived = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      let displayName: string | null =
        (userData.user?.user_metadata as any)?.full_name ||
        (userData.user?.user_metadata as any)?.display_name ||
        null;

      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, display_name, email")
          .eq("id", userId)
          .maybeSingle();
        displayName =
          (profile as any)?.full_name ||
          (profile as any)?.display_name ||
          (profile as any)?.email ||
          displayName ||
          userData.user?.email ||
          "Unknown user";
      }

      const { data, error } = await supabase
        .from("rd_received_samples")
        .update({
          received_by: userId,
          received_by_name: displayName,
          received_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as RDReceivedSample;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["rd-received-samples", row.rd_project_id] });
      qc.invalidateQueries({ queryKey: ["rd-received-samples-counts"] });
      toast.success("Marked as received");
    },
    onError: (e: any) => toast.error(e.message || "Failed to mark as received"),
  });
};
