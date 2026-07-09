import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CorrugatedShipper {
  id: string;
  name: string;
  quantity: number;
  bottles_per_box: number;
  total_bottles: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateShipperData {
  name: string;
  quantity: number;
  bottles_per_box: number;
  total_bottles: number;
}

export const useCorrugatedShippers = () => {
  return useQuery({
    queryKey: ["corrugated_shippers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corrugated_shippers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CorrugatedShipper[];
    },
  });
};

export const useCreateCorrugatedShipper = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateShipperData) => {
      const { data: result, error } = await supabase
        .from("corrugated_shippers")
        .insert({
          name: data.name,
          quantity: data.quantity,
          bottles_per_box: data.bottles_per_box,
          total_bottles: data.total_bottles,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corrugated_shippers"] });
      toast({
        title: "Success",
        description: "Shipper added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add shipper: " + error.message,
        variant: "destructive",
      });
    },
  });
};

export interface UpdateShipperData {
  id: string;
  name: string;
  quantity: number;
  bottles_per_box: number;
  total_bottles: number;
}

export const useUpdateCorrugatedShipper = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateShipperData) => {
      const { data: result, error } = await supabase
        .from("corrugated_shippers")
        .update({
          name: data.name,
          quantity: data.quantity,
          bottles_per_box: data.bottles_per_box,
          total_bottles: data.total_bottles,
        })
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corrugated_shippers"] });
      toast({
        title: "Success",
        description: "Shipper updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update shipper: " + error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteCorrugatedShipper = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("corrugated_shippers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corrugated_shippers"] });
      toast({
        title: "Success",
        description: "Shipper deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete shipper: " + error.message,
        variant: "destructive",
      });
    },
  });
};