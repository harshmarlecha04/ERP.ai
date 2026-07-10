import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

// Types
export interface PackagingItem {
  id: string;
  category: 'BOTTLES' | 'CAPS' | 'POUCHES' | 'CORRUGATED';
  item_name: string;
  description?: string;
  sku?: string;
  uom: string;
  location?: string;
  min_level: number;
  bottles_per_unit: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  customer_id: string | null;
}

export interface PackagingMovement {
  id: string;
  item_id: string;
  move_date: string;
  move_type: 'RECEIPT' | 'USAGE' | 'ADJUSTMENT' | 'RETURN';
  qty: number;
  packable_bottles?: number;
  po?: string;
  vendor?: string;
  location?: string;
  notes?: string;
  created_at: string;
}

export interface PackagingBalance {
  item_id: string;
  category: string;
  item_name: string;
  description?: string;
  sku?: string;
  uom: string;
  location?: string;
  min_level: number;
  bottles_per_unit: number;
  notes?: string;
  on_hand: number;
  packable_bottles: number;
  created_at: string;
  updated_at: string;
}

export interface PackagingHistory {
  id: string;
  item_id: string;
  category: string;
  item_name: string;
  move_date: string;
  move_type: string;
  qty: number;
  po?: string;
  vendor?: string;
  location?: string;
  notes?: string;
  created_at: string;
}

export interface PackagingFilters {
  category?: string[];
  item_name?: string;
  location?: string;
  date_from?: string;
  date_to?: string;
  vendor?: string;
  po?: string;
  move_type?: string;
}

// Hooks
export const usePackagingBalances = (filters: PackagingFilters = {}) => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ["packaging-balances", filters],
    queryFn: async () => {
      let query = supabase.from("v_packaging_balances").select("*");

      if (filters.category && filters.category.length > 0) {
        query = query.in("category", filters.category);
      }

      if (filters.item_name) {
        query = query.ilike("item_name", `%${filters.item_name}%`);
      }

      if (filters.location) {
        query = query.ilike("location", `%${filters.location}%`);
      }

      const { data, error } = await query.order("category").order("item_name");

      if (error) throw error;
      return data as PackagingBalance[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`packaging-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'packaging_item'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["packaging-balances"] });
          queryClient.invalidateQueries({ queryKey: ["packaging-summary"] });
          queryClient.invalidateQueries({ queryKey: ["packaging-items"] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'packaging_movement'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["packaging-balances"] });
          queryClient.invalidateQueries({ queryKey: ["packaging-summary"] });
          queryClient.invalidateQueries({ queryKey: ["packaging-history"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
};

export const usePackagingHistory = (filters: PackagingFilters = {}) => {
  return useQuery({
    queryKey: ["packaging-history", filters],
    queryFn: async () => {
      let query = supabase.from("v_packaging_history").select("*");

      if (filters.category && filters.category.length > 0) {
        query = query.in("category", filters.category);
      }

      if (filters.item_name) {
        query = query.ilike("item_name", `%${filters.item_name}%`);
      }

      if (filters.date_from) {
        query = query.gte("move_date", filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte("move_date", filters.date_to);
      }

      if (filters.vendor) {
        query = query.ilike("vendor", `%${filters.vendor}%`);
      }

      if (filters.po) {
        query = query.ilike("po", `%${filters.po}%`);
      }

      if (filters.move_type) {
        query = query.eq("move_type", filters.move_type);
      }

      if (filters.location) {
        query = query.ilike("location", `%${filters.location}%`);
      }

      const { data, error } = await query.order("move_date", { ascending: false });

      if (error) throw error;
      return data as PackagingHistory[];
    },
  });
};

export const usePackagingItems = () => {
  return useQuery({
    queryKey: ["packaging-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packaging_item")
        .select("*")
        .order("category")
        .order("item_name");

      if (error) throw error;
      return data as PackagingItem[];
    },
  });
};

export const usePackagingItemDetail = (itemId: string) => {
  return useQuery({
    queryKey: ["packaging-item-detail", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packaging_item")
        .select("*")
        .eq("id", itemId)
        .single();

      if (error) throw error;
      return data as PackagingItem;
    },
    enabled: !!itemId,
  });
};

export const useCreatePackagingItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: Omit<PackagingItem, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("packaging_item")
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packaging-items"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-balances"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-summary"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-stats"] });
      toast({
        title: "Success",
        description: "Packaging item created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create packaging item.",
      });
    },
  });
};

export const useUpdatePackagingItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PackagingItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("packaging_item")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packaging-items"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-balances"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-item-detail"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-summary"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-stats"] });
      toast({
        title: "Success",
        description: "Packaging item updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update packaging item.",
      });
    },
  });
};

export const useCreatePackagingMovement = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (movement: Omit<PackagingMovement, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("packaging_movement")
        .insert(movement)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packaging-balances"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-history"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-summary"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-stats"] });
      toast({
        title: "Success",
        description: "Movement recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to record movement.",
      });
    },
  });
};

export const useDeletePackagingItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("packaging_item")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packaging-items"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-balances"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-summary"] });
      queryClient.invalidateQueries({ queryKey: ["packaging-stats"] });
      toast({
        title: "Success",
        description: "Packaging item deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete packaging item.",
      });
    },
  });
};

export const usePackagingSummary = (filters: PackagingFilters = {}) => {
  return useQuery({
    queryKey: ["packaging-summary", filters],
    queryFn: async () => {
      const { data: balances } = await supabase.from("v_packaging_balances").select("*");
      
      if (!balances) return { totalSkus: 0, totalOnHand: 0, lowStockCount: 0 };

      let filteredBalances = balances;
      
      if (filters.category && filters.category.length > 0) {
        filteredBalances = filteredBalances.filter(item => 
          filters.category!.includes(item.category)
        );
      }

      if (filters.item_name) {
        filteredBalances = filteredBalances.filter(item => 
          item.item_name.toLowerCase().includes(filters.item_name!.toLowerCase())
        );
      }

      if (filters.location) {
        filteredBalances = filteredBalances.filter(item => 
          item.location?.toLowerCase().includes(filters.location!.toLowerCase())
        );
      }

      const totalSkus = filteredBalances.length;
      const totalOnHand = filteredBalances.reduce((sum, item) => sum + (item.on_hand || 0), 0);
      const lowStockCount = filteredBalances.filter(item => 
        (item.on_hand || 0) < (item.min_level || 0)
      ).length;

      return { totalSkus, totalOnHand, lowStockCount };
    },
  });
};

export const usePackagingStats = (category?: string) => {
  return useQuery({
    queryKey: ["packaging-stats", category],
    queryFn: async () => {
      let query = supabase.from("v_packaging_balances").select("*");
      
      if (category) {
        query = query.eq("category", category);
      }

      const { data: balances } = await query;
      
      if (!balances) return { totalSkus: 0, totalOnHand: 0, lowStockCount: 0 };

      const totalSkus = balances.length;
      const totalOnHand = balances.reduce((sum, item) => sum + (item.on_hand || 0), 0);
      const lowStockCount = balances.filter(item => 
        (item.on_hand || 0) < (item.min_level || 0)
      ).length;

      return { totalSkus, totalOnHand, lowStockCount };
    },
  });
};