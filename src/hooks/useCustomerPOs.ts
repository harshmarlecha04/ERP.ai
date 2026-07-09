import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerPOOption {
  id: string;
  po_number: string | null;
  order_number: string | null;
  status: string | null;
  customer_id: string | null;
  customer_name: string | null;
  label: string;
}

/**
 * Lightweight list of recent customer POs for dropdowns
 * (used when linking packaging entries / schedules to an order).
 */
export const useCustomerPOs = (opts?: { limit?: number }) => {
  const limit = opts?.limit ?? 200;

  return useQuery({
    queryKey: ["customer-pos-dropdown", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_headers")
        .select("id, po_number, order_number, status, customer_id, customers:customer_id(company_name)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data ?? []).map((row: any): CustomerPOOption => {
        const poRef = row.po_number || row.order_number || "(no PO#)";
        const cust = row.customers?.company_name || "";
        return {
          id: row.id,
          po_number: row.po_number,
          order_number: row.order_number,
          status: row.status,
          customer_id: row.customer_id,
          customer_name: cust,
          label: cust ? `${poRef} — ${cust}` : poRef,
        };
      });
    },
    staleTime: 60_000,
  });
};
