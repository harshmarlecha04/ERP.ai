import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EntityHit {
  kind: "order" | "po" | "formula" | "customer";
  id: string;
  label: string;
  subtitle?: string;
  path: string;
}

const DEBOUNCE_MS = 200;

export function useEntitySearch(query: string) {
  const [results, setResults] = useState<EntityHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const like = `%${q}%`;
        const [orders, pos, formulas, customers] = await Promise.all([
          supabase
            .from("order_headers")
            .select("id, order_number, po_number, status")
            .or(`order_number.ilike.${like},po_number.ilike.${like}`)
            .limit(5),
          supabase
            .from("purchase_orders")
            .select("id, po_number, status")
            .ilike("po_number", like)
            .limit(5),
          supabase
            .from("formulas")
            .select("id, name, status")
            .ilike("name", like)
            .limit(5),
          supabase
            .from("customers")
            .select("id, company_name")
            .ilike("company_name", like)
            .limit(5),
        ]);

        const hits: EntityHit[] = [];

        (orders.data ?? []).forEach((o: any) => {
          hits.push({
            kind: "order",
            id: o.id,
            label: o.order_number || o.po_number || "Order",
            subtitle: o.status ? `Order · ${o.status}` : "Customer Order",
            path: `/orders/${o.id}`,
          });
        });
        (pos.data ?? []).forEach((p: any) => {
          hits.push({
            kind: "po",
            id: p.id,
            label: p.po_number || "PO",
            subtitle: p.status ? `PO · ${p.status}` : "Purchase Order",
            path: `/purchase-orders`,
          });
        });
        (formulas.data ?? []).forEach((f: any) => {
          hits.push({
            kind: "formula",
            id: f.id,
            label: f.name,
            subtitle: f.status ? `Formula · ${f.status}` : "Formula",
            path: `/formula/view/${f.id}`,
          });
        });
        (customers.data ?? []).forEach((c: any) => {
          hits.push({
            kind: "customer",
            id: c.id,
            label: c.company_name,
            subtitle: "Customer",
            path: `/customers/${c.id}`,
          });
        });

        setResults(hits);
      } catch (e) {
        console.error("Entity search failed", e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query]);

  return { results, loading };
}
