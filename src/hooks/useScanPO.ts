import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ScannedLine = {
  raw_formula_reference: string;
  raw_product_description: string;
  bottle_count: number;
  bottle_size: number | null;
  unit_price: number;
  line_total?: number;
  notes: string;
  formula_id?: string;
  matched_code?: string | null;
  matched_name?: string | null;
  match_score?: number;
  match_method?: string;
  bottle_hint?: string;
  cap_hint?: string;
  label_hint?: string;
  suggested_bottle_id?: string | null;
  suggested_bottle_score?: number;
  suggested_cap_id?: string | null;
  suggested_cap_score?: number;
  suggested_label_id?: string | null;
  suggested_label_score?: number;
  selected_bottle_id?: string | null;
  selected_cap_id?: string | null;
  selected_label_id?: string | null;
};

export type CustomerMatch = {
  customer_id: string | null;
  score: number;
  method: string | null;
  matched_name: string | null;
  raw_name: string;
};

export type ScanResponse = {
  scan_id?: string;
  extraction: {
    po_number: string;
    customer_reference: string;
    customer_name?: string;
    customer_address?: string;
    due_date: string;
    special_instructions: string;
    line_items: any[];
  };
  matched: ScannedLine[];
  unmatched: ScannedLine[];
  confidence: number;
  po_total?: number;
  customer_match?: CustomerMatch;
  error?: string;
};

export function useScanPO() {
  return useMutation({
    mutationFn: async ({
      orderId,
      pdfPath,
      customerId,
    }: {
      orderId?: string;
      pdfPath: string;
      customerId?: string | null;
    }): Promise<ScanResponse> => {
      const body: Record<string, unknown> = { pdf_path: pdfPath };
      if (orderId) body.order_id = orderId;
      if (customerId) body.customer_id = customerId;
      const { data, error } = await supabase.functions.invoke("ai-scan-po", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ScanResponse;
    },
  });
}
