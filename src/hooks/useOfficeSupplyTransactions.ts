import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OfficeSupplyTransaction {
  id: string;
  item_id: string;
  transaction_type: "purchase" | "usage" | "adjustment";
  quantity: number;
  cost?: number;
  performed_by: string;
  notes?: string;
  created_at: string;
}

export const useOfficeSupplyTransactions = (itemId?: string) => {
  return useQuery({
    queryKey: ["office-supply-transactions", itemId],
    queryFn: async () => {
      let query = supabase
        .from("office_supply_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (itemId) {
        query = query.eq("item_id", itemId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as OfficeSupplyTransaction[];
    },
  });
};

export const useCreateTransaction = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transaction: Omit<OfficeSupplyTransaction, "id" | "created_at" | "performed_by">) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("office_supply_transactions")
        .insert([{ ...transaction, performed_by: user?.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-supply-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["office-supplies"] });
      queryClient.invalidateQueries({ queryKey: ["office-supply-stats"] });
      toast({
        title: "Success",
        description: "Transaction recorded successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to record transaction: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useCreateAdjustmentTransaction = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      item_id,
      current_quantity,
      new_quantity,
      adjustment_amount,
      notes,
    }: {
      item_id: string;
      current_quantity: number;
      new_quantity: number;
      adjustment_amount: number;
      notes: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Create transaction record
      const { error: transactionError } = await supabase
        .from("office_supply_transactions")
        .insert([{
          item_id,
          transaction_type: "adjustment",
          quantity: adjustment_amount,
          performed_by: user.id,
          notes,
        }]);

      if (transactionError) throw transactionError;

      // Update quantity
      const { error: updateError } = await supabase
        .from("office_supplies")
        .update({ quantity_on_hand: new_quantity })
        .eq("id", item_id);

      if (updateError) throw updateError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-supply-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["office-supplies"] });
      queryClient.invalidateQueries({ queryKey: ["office-supply-stats"] });
      toast({
        title: "Quantity Adjusted",
        description: "Inventory quantity has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to adjust quantity: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};
