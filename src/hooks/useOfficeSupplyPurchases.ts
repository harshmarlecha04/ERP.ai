import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OfficeSupplyPurchase {
  id: string;
  item_id: string;
  purchase_date: string;
  quantity: number;
  unit_cost: number;
  shipping_cost: number;
  tax: number;
  total_cost: number;
  supplier?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export const useOfficeSupplyPurchases = (itemId?: string) => {
  return useQuery({
    queryKey: ["office-supply-purchases", itemId],
    queryFn: async () => {
      let query = supabase
        .from("office_supply_purchases")
        .select("*")
        .order("purchase_date", { ascending: false });
      
      if (itemId) {
        query = query.eq("item_id", itemId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as OfficeSupplyPurchase[];
    },
  });
};

export const useCreatePurchase = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (purchase: Omit<OfficeSupplyPurchase, "id" | "created_at" | "updated_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("office_supply_purchases")
        .insert([{ ...purchase, created_by: user?.id }])
        .select()
        .single();

      if (error) throw error;

      // Update the item's quantity_on_hand by adding the new purchase quantity
      const { data: currentItem } = await supabase
        .from("office_supplies")
        .select("quantity_on_hand")
        .eq("id", purchase.item_id)
        .single();

      if (currentItem) {
        await supabase
          .from("office_supplies")
          .update({ 
            quantity_on_hand: currentItem.quantity_on_hand + purchase.quantity
          })
          .eq("id", purchase.item_id);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["office-supply-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["office-supplies"] });
      queryClient.invalidateQueries({ queryKey: ["office-supply-stats"] });
      toast({
        title: "Success",
        description: "Purchase recorded successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to record purchase: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useUpdatePurchase = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OfficeSupplyPurchase> & { id: string }) => {
      const { data, error } = await supabase
        .from("office_supply_purchases")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-supply-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["office-supplies"] });
      toast({
        title: "Success",
        description: "Purchase updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update purchase: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useDeletePurchase = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, item_id, quantity }: { id: string; item_id: string; quantity: number }) => {
      const { error } = await supabase
        .from("office_supply_purchases")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Update the item's quantity_on_hand by subtracting the deleted purchase quantity
      const { data: currentItem } = await supabase
        .from("office_supplies")
        .select("quantity_on_hand")
        .eq("id", item_id)
        .single();

      if (currentItem) {
        await supabase
          .from("office_supplies")
          .update({ 
            quantity_on_hand: Math.max(0, currentItem.quantity_on_hand - quantity)
          })
          .eq("id", item_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-supply-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["office-supplies"] });
      toast({
        title: "Success",
        description: "Purchase deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete purchase: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};
