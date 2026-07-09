import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface InvoiceLineInput {
  shipping_entry_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface CreateInvoiceInput {
  customer_id: string | null;
  customer_name: string | null;
  order_header_id?: string | null;
  issue_date: string;
  due_date?: string | null;
  notes?: string | null;
  tax?: number;
  lines: InvoiceLineInput[];
  shipping_entry_ids: string[];
}

export const useCustomerInvoicesList = () => {
  return useQuery({
    queryKey: ["customer-invoices-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_invoices" as any)
        .select("*, order_headers:order_header_id(po_number, order_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
};

export const useInvoiceLines = (invoiceId?: string) => {
  return useQuery({
    queryKey: ["customer-invoice-lines", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_invoice_lines" as any)
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
};

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const { data: numData, error: numErr } = await supabase.rpc("next_invoice_number" as any);
      if (numErr) throw numErr;
      const invoiceNumber = numData as unknown as string;

      const subtotal = input.lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
      const tax = input.tax ?? 0;
      const total = subtotal + tax;

      const { data: u } = await supabase.auth.getUser();

      const { data: inv, error: invErr } = await supabase
        .from("customer_invoices" as any)
        .insert({
          invoice_number: invoiceNumber,
          customer_id: input.customer_id,
          customer_name: input.customer_name,
          order_header_id: input.order_header_id ?? null,
          issue_date: input.issue_date,
          due_date: input.due_date ?? null,
          notes: input.notes ?? null,
          subtotal,
          tax,
          total,
          status: "draft",
          source: "shipping",
          created_by: u.user?.id ?? null,
        })
        .select()
        .single();
      if (invErr) throw invErr;

      const invoiceId = (inv as any).id as string;

      const lineRows = input.lines.map((l) => ({
        invoice_id: invoiceId,
        shipping_entry_id: l.shipping_entry_id ?? null,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: Number((l.quantity * l.unit_price).toFixed(2)),
      }));
      const { error: linesErr } = await supabase
        .from("customer_invoice_lines" as any)
        .insert(lineRows);
      if (linesErr) throw linesErr;

      if (input.shipping_entry_ids.length) {
        const { error: shipErr } = await supabase
          .from("shipping_entries" as any)
          .update({
            status: "invoiced",
            invoice_id: invoiceId,
            invoiced_at: new Date().toISOString(),
            invoiced_by: u.user?.id ?? null,
          })
          .in("id", input.shipping_entry_ids);
        if (shipErr) throw shipErr;
      }

      return inv as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-entries"] });
      qc.invalidateQueries({ queryKey: ["customer-invoices-list"] });
      toast({ title: "Invoice created" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to create invoice", description: e.message, variant: "destructive" }),
  });
};
