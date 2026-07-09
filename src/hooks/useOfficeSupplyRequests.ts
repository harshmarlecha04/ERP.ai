import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OfficeSupplyRequest {
  id: string;
  item_id?: string;
  item_name: string;
  quantity_requested: number;
  unit_of_measure?: string;
  requested_by: string;
  requester_name: string;
  requester_email: string;
  reason?: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "approved" | "fulfilled" | "rejected";
  approved_by?: string;
  approved_at?: string;
  fulfilled_by?: string;
  fulfilled_at?: string;
  rejection_reason?: string;
  notes?: string;
  buy_link?: string;
  created_at: string;
  updated_at: string;
}

export const useOfficeSupplyRequests = () => {
  return useQuery({
    queryKey: ["office-supply-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_supply_requests")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as OfficeSupplyRequest[];
    },
  });
};

export const useCreateRequest = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: {
      item_id?: string;
      item_name: string;
      quantity_requested: number;
      reason?: string;
      priority: "low" | "medium" | "high" | "urgent";
      unit_of_measure?: string;
      buy_link?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", user?.id)
        .single();

      const { data, error } = await supabase
        .from("office_supply_requests")
        .insert([{
          ...request,
          requested_by: user?.id,
          requester_name: profile?.display_name || "Unknown",
          requester_email: profile?.email || user?.email || "No email",
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-supply-requests"] });
      toast({
        title: "Success",
        description: "Request submitted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to submit request: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateRequestStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      rejection_reason,
      notes,
    }: {
      id: string;
      status: "approved" | "fulfilled" | "rejected";
      rejection_reason?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updates: any = { status, notes };

      if (status === "approved") {
        updates.approved_by = user?.id;
        updates.approved_at = new Date().toISOString();
      } else if (status === "fulfilled") {
        updates.fulfilled_by = user?.id;
        updates.fulfilled_at = new Date().toISOString();
      } else if (status === "rejected") {
        updates.rejection_reason = rejection_reason;
      }

      const { data, error } = await supabase
        .from("office_supply_requests")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-supply-requests"] });
      toast({
        title: "Success",
        description: "Request status updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update request: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateRequest = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      item_name,
      quantity_requested,
      unit_of_measure,
      reason,
    }: {
      id: string;
      item_name: string;
      quantity_requested: number;
      unit_of_measure?: string;
      reason?: string;
    }) => {
      const { data, error } = await supabase
        .from("office_supply_requests")
        .update({
          item_name,
          quantity_requested,
          unit_of_measure,
          reason,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-supply-requests"] });
      toast({
        title: "Success",
        description: "Request updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update request: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteRequest = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("office_supply_requests")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-supply-requests"] });
      toast({
        title: "Success",
        description: "Request deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete request: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};
