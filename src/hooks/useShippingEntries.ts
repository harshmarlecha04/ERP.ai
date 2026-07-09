import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ShippingEntry {
  id: string;
  packaging_completion_id: string | null;
  schedule_id: string | null;
  order_header_id: string | null;
  order_line_item_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  product_name: string | null;
  bottle_count: number | null;
  bottle_size: string | null;
  lot_number: string | null;
  completed_date: string | null;
  status: "pending" | "ready_to_ship" | "invoiced";
  ready_to_ship_at: string | null;
  invoice_id: string | null;
  invoiced_at: string | null;
  notes: string | null;
  created_at: string;
  order_headers?: { po_number: string | null; order_number: string | null } | null;
}

export const useShippingEntries = (status?: ShippingEntry["status"] | "all") => {
  return useQuery({
    queryKey: ["shipping-entries", status ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("shipping_entries" as any)
        .select("*, order_headers(po_number, order_number)")
        .order("completed_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) as ShippingEntry[];
    },
  });
};

export const useMarkReadyToShip = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("shipping_entries" as any)
        .update({
          status: "ready_to_ship",
          ready_to_ship_at: new Date().toISOString(),
          ready_to_ship_by: u.user?.id ?? null,
        })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-entries"] });
      toast({ title: "Marked ready to ship" });
    },
    onError: (e: any) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });
};

export const useRevertShippingStatus = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("shipping_entries" as any)
        .update({ status: "pending", ready_to_ship_at: null, ready_to_ship_by: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-entries"] });
      toast({ title: "Moved back to pending" });
    },
  });
};

export const useAttachShippingPO = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, order_header_id }: { id: string; order_header_id: string | null }) => {
      const { error } = await supabase
        .from("shipping_entries" as any)
        .update({ order_header_id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-entries"] });
      toast({ title: "PO updated" });
    },
    onError: (e: any) =>
      toast({ title: "PO update failed", description: e.message, variant: "destructive" }),
  });
};
