import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RDColorOption {
  id: string;
  name: string;
}

export const useRDColorOptions = () => {
  return useQuery({
    queryKey: ["rd-color-options"],
    queryFn: async (): Promise<RDColorOption[]> => {
      const { data, error } = await supabase
        .from("rd_color_options")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as RDColorOption[]) || [];
    },
  });
};

export const useAddRDColorOption = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Color name is required");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You must be signed in to add a color");
      const { data, error } = await supabase
        .from("rd_color_options")
        .insert({ name: trimmed, created_by: userId })
        .select("id, name")
        .single();
      if (error) throw error;
      return data as RDColorOption;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rd-color-options"] });
      toast({ title: "Color added" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to add color",
        description: err.message,
        variant: "destructive",
      });
    },
  });
};
