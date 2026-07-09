// Natural-language reports edge function.
// Takes a user question, asks Claude to produce a constrained query plan
// against a whitelisted set of read-only tables, then executes it server-side
// with the user's auth (RLS enforced). Returns rows + a chart hint.
//
// Financial tables are only included in the schema if the caller has
// has_financial_access (RPC). Admin role bypasses via that RPC.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAnthropic, extractText, MODELS } from "../_shared/anthropic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Whitelist of safe, read-only tables and the columns the AI may reference.
// Keep tight. Adding tables requires reviewing RLS policies for that table.
const OPERATIONAL_SCHEMA: Record<string, string[]> = {
  order_headers: [
    "id", "order_number", "po_number", "status", "fulfillment_status",
    "customer_id", "due_date", "created_at",
    "total_bottles_ordered", "total_bottles_shipped",
  ],
  purchase_orders: [
    "id", "po_number", "status", "supplier_id", "order_date", "created_at",
  ],
  formulas: ["id", "name", "status", "customer_id", "created_at"],
  raw_materials: ["id", "code", "name", "supplier", "uom", "is_archived", "created_at"],
  production_schedules: ["id", "schedule_date", "status", "created_at"],
  production_schedule_items: [
    "id", "schedule_id", "formula_id", "formula_code", "batches",
    "current_stage", "bottles_packed", "estimated_bottles",
    "actual_gummies_produced", "manual_customer_name", "manual_formula_name",
    "created_at",
  ],
};

const FINANCIAL_SCHEMA: Record<string, string[]> = {
  formula_cost_estimates: ["id", "formula_id", "total_cost", "created_at"],
};

interface QueryPlan {
  table: string;
  select: string[];
  filters?: Array<{ column: string; op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "ilike" | "is"; value: any }>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  chart?: { type: "bar" | "line" | "pie" | "none"; x?: string; y?: string };
  title?: string;
  summary?: string;
}

const ALLOWED_OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "is"]);

function validatePlan(plan: any, schema: Record<string, string[]>): { ok: true; plan: QueryPlan } | { ok: false; error: string } {
  if (!plan || typeof plan !== "object") return { ok: false, error: "plan must be an object" };
  const { table, select, filters, order, limit, chart, title, summary } = plan;
  if (!table || typeof table !== "string" || !schema[table]) {
    return { ok: false, error: `table "${table}" is not allowed` };
  }
  const allowedCols = new Set(schema[table]);
  if (!Array.isArray(select) || select.length === 0 || !select.every((c: any) => typeof c === "string" && allowedCols.has(c))) {
    return { ok: false, error: "select must be a non-empty array of allowed columns" };
  }
  if (filters) {
    if (!Array.isArray(filters)) return { ok: false, error: "filters must be an array" };
    for (const f of filters) {
      if (!allowedCols.has(f.column)) return { ok: false, error: `filter column "${f.column}" not allowed` };
      if (!ALLOWED_OPS.has(f.op)) return { ok: false, error: `filter op "${f.op}" not allowed` };
    }
  }
  if (order && (typeof order.column !== "string" || !allowedCols.has(order.column))) {
    return { ok: false, error: "order column not allowed" };
  }
  const lim = typeof limit === "number" ? Math.min(Math.max(limit, 1), 500) : 100;
  const safeChart = chart && ["bar", "line", "pie", "none"].includes(chart.type) ? chart : { type: "none" };
  return {
    ok: true,
    plan: {
      table,
      select,
      filters: filters ?? [],
      order,
      limit: lim,
      chart: safeChart,
      title,
      summary,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt || prompt.length > 1000) {
      return new Response(JSON.stringify({ error: "prompt must be 1-1000 chars" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine financial access via RPC
    const { data: finOk } = await supabase.rpc("has_financial_access");
    const schema = finOk
      ? { ...OPERATIONAL_SCHEMA, ...FINANCIAL_SCHEMA }
      : OPERATIONAL_SCHEMA;

    const schemaDoc = Object.entries(schema)
      .map(([t, cols]) => `- ${t}(${cols.join(", ")})`)
      .join("\n");

    const sys = `You are a SQL query planner. Convert the user's question into a JSON QueryPlan.
Allowed tables and columns:
${schemaDoc}

Return ONLY JSON of shape:
{ "table": "<allowed_table>", "select": ["col1","col2"], "filters": [{"column":"c","op":"eq|neq|gt|gte|lt|lte|ilike|is","value":...}], "order": {"column":"c","ascending":false}, "limit": 100, "chart": {"type":"bar|line|pie|none","x":"col","y":"col"}, "title":"…", "summary":"…" }
Never invent columns or tables. Use ilike with % wildcards for text search. Default limit 100. If aggregation is needed, pick a single time/category column and return the raw rows for client-side grouping. If the question can't be answered with allowed schema, return {"error":"out of scope"}.
Output the raw JSON object only. Do not wrap it in markdown code fences or add any text before or after.`;

    let aiJson: any;
    try {
      // Prefill the assistant turn with "{" to force a bare JSON object.
      aiJson = await callAnthropic({
        model: MODELS.default,
        system: sys,
        maxTokens: 1024,
        messages: [
          { role: "user", content: prompt },
          { role: "assistant", content: "{" },
        ],
      });
    } catch (err: any) {
      const msg = err?.message ?? "";
      const status = msg.includes("429") ? 429 : 502;
      return new Response(JSON.stringify({ error: `AI gateway: ${msg.slice(0, 200)}` }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Re-attach the "{" prefill that we forced above.
    const content = "{" + extractText(aiJson);
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: "AI returned non-JSON" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (parsed.error) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const v = validatePlan(parsed, schema);
    if (!v.ok) {
      return new Response(JSON.stringify({ error: v.error, plan: parsed }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const p = v.plan;
    let q: any = supabase.from(p.table).select(p.select.join(","));
    for (const f of p.filters ?? []) {
      q = (q as any)[f.op](f.column, f.value);
    }
    if (p.order) q = q.order(p.order.column, { ascending: p.order.ascending ?? false });
    if (p.limit) q = q.limit(p.limit);

    const { data, error } = await q;
    if (error) {
      return new Response(JSON.stringify({ error: error.message, plan: p }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        plan: p,
        rows: data ?? [],
        rowCount: (data ?? []).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
