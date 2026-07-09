import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OfficeSupply {
  id: string;
  item_name: string;
  category: string;
  description?: string;
  quantity_on_hand: number;
  unit_of_measure: string;
  supplier?: string;
  min_quantity?: number;
  notes?: string;
  buy_link?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export const useOfficeSupplies = () => {
  return useQuery({
    queryKey: ["office-supplies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_supplies")
        .select("*")
        .order("item_name");
      
      if (error) throw error;
      return data as OfficeSupply[];
    },
  });
};

export const useCreateOfficeSupply = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (supply: Omit<OfficeSupply, "id" | "created_at" | "updated_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("office_supplies")
        .insert([{ ...supply, created_by: user?.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-supplies"] });
      queryClient.invalidateQueries({ queryKey: ["office-supply-stats"] });
      toast({
        title: "Success",
        description: "Office supply item added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add item: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateOfficeSupply = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OfficeSupply> & { id: string }) => {
      const { data, error } = await supabase
        .from("office_supplies")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-supplies"] });
      queryClient.invalidateQueries({ queryKey: ["office-supply-stats"] });
      toast({
        title: "Success",
        description: "Office supply item updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update item: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteOfficeSupply = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("office_supplies")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-supplies"] });
      toast({
        title: "Success",
        description: "Office supply item deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete item: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export interface OfficeSupplyStats {
  item_id: string;
  total_purchased: number;
}

export const useOfficeSupplyStats = () => {
  return useQuery({
    queryKey: ["office-supply-stats"],
    queryFn: async () => {
      // Query transactions table for purchases and adjustments
      const { data: transactions, error: txError } = await supabase
        .from("office_supply_transactions")
        .select("item_id, quantity, transaction_type")
        .in("transaction_type", ["purchase", "adjustment"]);
      
      if (txError) throw txError;

      // Also query purchases table for detailed purchase records
      const { data: purchases, error: purchaseError } = await supabase
        .from("office_supply_purchases")
        .select("item_id, quantity");
      
      if (purchaseError) throw purchaseError;

      // Aggregate all purchases by item_id
      const statsMap = new Map<string, number>();
      
      // Add from transactions
      transactions?.forEach(tx => {
        if (tx.quantity > 0) { // Only count positive quantities as purchases
          const current = statsMap.get(tx.item_id) || 0;
          statsMap.set(tx.item_id, current + tx.quantity);
        }
      });
      
      // Add from purchases table
      purchases?.forEach(purchase => {
        const current = statsMap.get(purchase.item_id) || 0;
        statsMap.set(purchase.item_id, current + purchase.quantity);
      });

      const stats: OfficeSupplyStats[] = Array.from(statsMap.entries()).map(([item_id, total_purchased]) => ({
        item_id,
        total_purchased,
      }));

      return stats;
    },
  });
};
