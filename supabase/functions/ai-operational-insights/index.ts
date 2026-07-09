import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import {
  callAnthropic,
  extractText,
  extractToolInput,
  toAnthropicTool,
  MODELS,
} from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Mode = "insights" | "summary";

async function gatherSnapshot(supabase: any) {
  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);

  const [lots, thresholds, openOrders, openPOs, prodItems, openTasks] =
    await Promise.all([
      supabase
        .from("raw_material_lots")
        .select("raw_material_id, quantity, qty_reserved_kg, expires_on, raw_materials(name)")
        .limit(1000),
      supabase.from("inventory_thresholds").select("raw_material_id, min_quantity_kg, alert_enabled"),
      supabase
        .from("order_headers")
        .select("id, order_number, due_date, status, priority, fulfillment_status, total_bottles_ordered, total_bottles_shipped, customers(name)")
        .not("status", "in", "(closed,cancelled,completed)")
        .order("due_date", { ascending: true })
        .limit(50),
      supabase
        .from("purchase_orders")
        .select("id, po_number, expected_date, status, total_amount, suppliers(name)")
        .not("status", "in", "(received,cancelled)")
        .order("expected_date", { ascending: true })
        .limit(50),
      supabase
        .from("production_schedule_items")
        .select("id, formula_code, batches, materials_ok, current_stage, manual_formula_name, production_schedules(scheduled_date)")
        .limit(100),
      supabase
        .from("tasks")
        .select("id, title, priority, due_date, status")
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(50),
    ]);

  // Aggregate lot quantities by raw material
  const stockByMat: Record<string, { name: string; available: number; expiring: number }> = {};
  for (const l of lots.data || []) {
    const id = l.raw_material_id;
    if (!stockByMat[id]) stockByMat[id] = { name: l.raw_materials?.name || id, available: 0, expiring: 0 };
    const avail = Number(l.quantity || 0) - Number(l.qty_reserved_kg || 0);
    stockByMat[id].available += avail;
    if (l.expires_on && l.expires_on <= in7) stockByMat[id].expiring += Number(l.quantity || 0);
  }

  const lowStock: any[] = [];
  for (const t of thresholds.data || []) {
    if (!t.alert_enabled) continue;
    const s = stockByMat[t.raw_material_id];
    if (s && s.available < Number(t.min_quantity_kg || 0)) {
      lowStock.push({ material: s.name, available_kg: +s.available.toFixed(2), min_kg: Number(t.min_quantity_kg) });
    }
  }

  const overdueOrders = (openOrders.data || []).filter(
    (o: any) => o.due_date && o.due_date < todayIso
  );
  const overduePOs = (openPOs.data || []).filter(
    (p: any) => p.expected_date && p.expected_date < todayIso
  );

  const expiringSoon = Object.values(stockByMat)
    .filter((s) => s.expiring > 0)
    .map((s) => ({ material: s.name, expiring_kg: +s.expiring.toFixed(2) }));

  const productionShortages = (prodItems.data || []).filter(
    (p: any) => p.materials_ok === false
  );

  return {
    generated_at: new Date().toISOString(),
    counts: {
      open_orders: (openOrders.data || []).length,
      overdue_orders: overdueOrders.length,
      open_pos: (openPOs.data || []).length,
      overdue_pos: overduePOs.length,
      open_tasks: (openTasks.data || []).length,
      low_stock_materials: lowStock.length,
      expiring_lots: expiringSoon.length,
      production_with_shortages: productionShortages.length,
    },
    low_stock: lowStock.slice(0, 20),
    expiring_soon: expiringSoon.slice(0, 20),
    overdue_orders: overdueOrders.slice(0, 10).map((o: any) => ({
      order: o.order_number,
      customer: o.customers?.name,
      due: o.due_date,
      status: o.status,
      priority: o.priority,
    })),
    overdue_pos: overduePOs.slice(0, 10).map((p: any) => ({
      po: p.po_number,
      supplier: p.suppliers?.name,
      expected: p.expected_date,
      status: p.status,
    })),
    production_shortages: productionShortages.slice(0, 10).map((p: any) => ({
      formula: p.formula_code || p.manual_formula_name,
      batches: p.batches,
      stage: p.current_stage,
    })),
    open_high_priority_tasks: (openTasks.data || [])
      .filter((t: any) => t.priority === "high" || t.priority === "urgent")
      .slice(0, 10),
  };
}

const INSIGHTS_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "One-sentence overall status" },
    risk_level: { type: "string", enum: ["green", "yellow", "red"] },
    insights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["info", "warning", "critical"] },
          category: {
            type: "string",
            enum: ["inventory", "production", "orders", "purchasing", "quality", "tasks"],
          },
          detail: { type: "string" },
          recommendation: { type: "string" },
        },
        required: ["title", "severity", "category", "detail", "recommendation"],
        additionalProperties: false,
      },
    },
  },
  required: ["headline", "risk_level", "insights"],
  additionalProperties: false,
};

async function callAI(mode: Mode, snapshot: any) {
  const isSummary = mode === "summary";
  // Both modes use the default text model; the insights mode adds a tool.
  const model = MODELS.default;

  const system = isSummary
    ? "You are the COO of a nutraceutical gummy manufacturing plant. Write a sharp executive daily summary (markdown) covering: today's risks, what to chase, decisions needed, and a one-line outlook. Be specific, cite numbers, no fluff."
    : "You are an operations copilot for a gummy manufacturing plant. Convert the operational snapshot into prioritized, actionable insights. Focus on what could break production or revenue today. Cite real numbers from the data.";

  const userText =
    (isSummary ? "Snapshot for daily executive briefing:\n" : "Operational snapshot:\n") +
    JSON.stringify(snapshot, null, 2);

  if (isSummary) {
    const data = await callAnthropic({
      model,
      system,
      maxTokens: 2048,
      messages: [{ role: "user", content: userText }],
    });
    return { summary: extractText(data) };
  }

  const data = await callAnthropic({
    model,
    system,
    maxTokens: 4096,
    messages: [{ role: "user", content: userText }],
    tools: [
      toAnthropicTool({
        type: "function",
        function: {
          name: "emit_insights",
          description: "Return prioritized operational insights",
          parameters: INSIGHTS_SCHEMA,
        },
      }),
    ],
    forceTool: "emit_insights",
  });

  const args = extractToolInput(data);
  return args ?? { headline: "No insights", risk_level: "green", insights: [] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Role check: only admin or production_manager may pull the operational snapshot
    const { data: roles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .in("role", ["admin", "production_manager"]);
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mode = "insights" } = (await req.json().catch(() => ({}))) as { mode?: Mode };

    const snapshot = await gatherSnapshot(supabase);
    const ai = await callAI(mode, snapshot);

    return new Response(
      JSON.stringify({ snapshot, ...ai }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("ai-operational-insights error:", e);
    const msg = e?.message || "Unknown error";
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
