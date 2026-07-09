import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RDFlavorOption {
  id: string;
  name: string;
}

export const useRDFlavorOptions = () => {
  return useQuery({
    queryKey: ["rd-flavor-options"],
    queryFn: async (): Promise<RDFlavorOption[]> => {
      const { data, error } = await supabase
        .from("rd_flavor_options")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as RDFlavorOption[]) || [];
    },
  });
};

export const useAddRDFlavorOption = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Flavor name is required");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You must be signed in to add a flavor");
      const { data, error } = await supabase
        .from("rd_flavor_options")
        .insert({ name: trimmed, created_by: userId })
        .select("id, name")
        .single();
      if (error) throw error;
      return data as RDFlavorOption;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rd-flavor-options"] });
      toast({ title: "Flavor added" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to add flavor",
        description: err.message,
        variant: "destructive",
      });
    },
  });
};
