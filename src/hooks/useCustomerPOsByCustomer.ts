import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerPOFullOption {
  id: string;
  po_number: string | null;
  order_number: string | null;
  status: string | null;
  due_date: string | null;
  total_bottles_ordered: number | null;
  total_bottles_shipped: number | null;
  pdf_url: string | null;
  po_attachment_path: string | null;
  resolved_pdf_url: string | null;
  customer_id: string | null;
  customer_name: string | null;
  created_at: string;
  label: string;
}

/**
 * Fetch POs scoped to a specific customer (by id). Returns richer fields so
 * a picker UI can show due date, totals, status, and load the PDF inline.
 */
export const useCustomerPOsByCustomer = (customerId?: string | null) => {
  return useQuery({
    queryKey: ["customer-pos-by-customer", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_headers")
        .select(
          "id, po_number, order_number, status, due_date, total_bottles_ordered, total_bottles_shipped, pdf_url, po_attachment_path, customer_id, created_at, customers:customer_id(company_name)"
        )
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: any): CustomerPOFullOption => {
        const poRef = row.po_number || row.order_number || "(no PO#)";
        const cust = row.customers?.company_name || "";
        return {
          id: row.id,
          po_number: row.po_number,
          order_number: row.order_number,
          status: row.status,
          due_date: row.due_date,
          total_bottles_ordered: row.total_bottles_ordered,
          total_bottles_shipped: row.total_bottles_shipped,
          pdf_url: row.pdf_url,
          po_attachment_path: row.po_attachment_path,
          resolved_pdf_url: row.pdf_url || row.po_attachment_path || null,
          customer_id: row.customer_id,
          customer_name: cust,
          created_at: row.created_at,
          label: cust ? `${poRef} — ${cust}` : poRef,
        };
      });
    },
    staleTime: 60_000,
  });
};
