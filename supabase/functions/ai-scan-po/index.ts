import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import {
  callAnthropic,
  extractToolInput,
  toAnthropicTool,
  MODELS,
} from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_BOTTLE_SIZES = [60, 70, 90, 120];

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    po_number: { type: "string", description: "Customer PO number on the document, or empty string if absent" },
    customer_reference: { type: "string", description: "Any other reference like SO/Quote, else empty" },
    customer_name: { type: "string", description: "The bill-to / sold-to / customer company name printed on the PO. Empty string if not present." },
    customer_address: { type: "string", description: "Single-line bill-to/sold-to address (street, city, state) used as a tiebreaker. Empty string if absent." },
    due_date: { type: "string", description: "Requested ship/delivery/due date as YYYY-MM-DD, or empty string if absent" },
    special_instructions: { type: "string", description: "Free-text instructions, else empty" },
    line_items: {
      type: "array",
      description: "One entry per product/SKU on the PO",
      items: {
        type: "object",
        properties: {
          raw_formula_reference: { type: "string", description: "Formula code, SKU, or product code as it appears on the PO" },
          raw_product_description: { type: "string", description: "Full product name/description on the PO" },
          bottle_count: { type: "integer", description: "Total number of bottles ordered for this line" },
          bottle_size: {
            type: "integer",
            description: "Bottles per container in count. Snap to one of: 60, 70, 90, 120. Use 0 if unclear.",
          },
          unit_price: { type: "number", description: "Per-bottle unit price if present, else 0" },
          notes: { type: "string", description: "Any line-level notes, else empty" },
          bottle_hint: { type: "string", description: "Bottle description/material/color hint as printed (e.g. 'White HDPE 150cc'). Empty if absent." },
          cap_hint: { type: "string", description: "Cap description hint as printed (e.g. 'Black 45-400 CRC'). Empty if absent." },
          label_hint: { type: "string", description: "Label description hint as printed (e.g. 'MV-001 Multivitamin 60ct'). Empty if absent." },
        },
        required: [
          "raw_formula_reference",
          "raw_product_description",
          "bottle_count",
          "bottle_size",
          "unit_price",
          "notes",
          "bottle_hint",
          "cap_hint",
          "label_hint",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["po_number", "customer_reference", "customer_name", "customer_address", "due_date", "special_instructions", "line_items"],
  additionalProperties: false,
};

function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  setA.forEach((t) => setB.has(t) && inter++);
  return inter / new Set([...a, ...b]).size;
}

type Formula = {
  id: string;
  code: string | null;
  name: string | null;
  product_code_line: string | null;
  customer_id: string | null;
};

type Customer = {
  id: string;
  company_name: string | null;
  company_code: string | null;
};

function matchCustomer(rawName: string, rawAddress: string, customers: Customer[]) {
  const nameLower = (rawName || "").trim().toLowerCase();
  if (!nameLower && !rawAddress) return null;

  // 1. Exact case-insensitive name
  if (nameLower) {
    const exact = customers.find((c) => (c.company_name || "").trim().toLowerCase() === nameLower);
    if (exact) {
      return { customer_id: exact.id, customer_match_score: 1, customer_match_method: "exact_name", customer_match_label: exact.company_name };
    }
    // 2. Contains
    const contains = customers.find((c) => {
      const cn = (c.company_name || "").trim().toLowerCase();
      if (!cn) return false;
      return nameLower.includes(cn) || cn.includes(nameLower);
    });
    if (contains) {
      return { customer_id: contains.id, customer_match_score: 0.85, customer_match_method: "contains", customer_match_label: contains.company_name };
    }
  }

  // 3. Token Jaccard on name + address
  const queryTokens = [...tokenize(rawName), ...tokenize(rawAddress)];
  if (!queryTokens.length) return null;
  let best: { c: Customer; score: number } | null = null;
  for (const c of customers) {
    const cTokens = tokenize(c.company_name || "");
    const score = jaccard(queryTokens, cTokens);
    if (!best || score > best.score) best = { c, score };
  }
  if (best && best.score >= 0.5) {
    return {
      customer_id: best.c.id,
      customer_match_score: +best.score.toFixed(2),
      customer_match_method: "fuzzy_name",
      customer_match_label: best.c.company_name,
    };
  }
  return null;
}

function matchFormula(
  rawRef: string,
  rawDesc: string,
  formulas: Formula[],
  customerId: string | null
): { formula_id: string; match_score: number; match_method: string; matched_code: string | null; matched_name: string | null } | null {
  const refLower = (rawRef || "").trim().toLowerCase();

  const customerScoped = customerId ? formulas.filter((f) => f.customer_id === customerId) : [];
  const candidates = [customerScoped, formulas];

  for (const pool of candidates) {
    if (!pool.length) continue;

    if (refLower) {
      const hit = pool.find((f) => (f.code || "").toLowerCase() === refLower);
      if (hit) return { formula_id: hit.id, match_score: 1, match_method: "exact_code", matched_code: hit.code, matched_name: hit.name };
    }
    if (refLower) {
      const hit = pool.find((f) => (f.product_code_line || "").toLowerCase() === refLower);
      if (hit) return { formula_id: hit.id, match_score: 1, match_method: "exact_product_code", matched_code: hit.code, matched_name: hit.name };
    }
    if (refLower) {
      const hit = pool.find(
        (f) =>
          (f.code && refLower.includes(f.code.toLowerCase())) ||
          (f.code && f.code.toLowerCase().includes(refLower))
      );
      if (hit) return { formula_id: hit.id, match_score: 0.85, match_method: "partial_code", matched_code: hit.code, matched_name: hit.name };
    }

    const queryTokens = [...tokenize(rawRef), ...tokenize(rawDesc)];
    if (queryTokens.length) {
      let best: { f: Formula; score: number } | null = null;
      for (const f of pool) {
        const nameTokens = tokenize(f.name || "");
        const score = jaccard(queryTokens, nameTokens);
        if (!best || score > best.score) best = { f, score };
      }
      if (best && best.score >= 0.6) {
        return {
          formula_id: best.f.id,
          match_score: +best.score.toFixed(2),
          match_method: "fuzzy_name",
          matched_code: best.f.code,
          matched_name: best.f.name,
        };
      }
    }
  }

  return null;
}

type Packaging = { item_id: string; item_name: string; description?: string | null; bottle_size?: number | null };

function matchPackaging(
  hint: string,
  rawDesc: string,
  bottleSize: number | null,
  pool: Packaging[]
): { id: string; score: number } | null {
  const queryTokens = [...tokenize(hint), ...tokenize(rawDesc)];
  if (!queryTokens.length) return null;
  let best: { id: string; score: number } | null = null;
  for (const p of pool) {
    const t = [...tokenize(p.item_name), ...tokenize(p.description || "")];
    let s = jaccard(queryTokens, t);
    if (bottleSize && p.bottle_size && p.bottle_size === bottleSize) s += 0.1;
    if (!best || s > best.score) best = { id: p.item_id, score: +s.toFixed(2) };
  }
  if (best && best.score >= 0.3) return best;
  return null;
}

function matchLabel(
  hint: string,
  rawDesc: string,
  pool: Array<{ id: string; customer_product: string; product_name: string | null }>
): { id: string; score: number } | null {
  const queryTokens = [...tokenize(hint), ...tokenize(rawDesc)];
  if (!queryTokens.length) return null;
  let best: { id: string; score: number } | null = null;
  for (const p of pool) {
    const t = [...tokenize(p.customer_product), ...tokenize(p.product_name || "")];
    const s = jaccard(queryTokens, t);
    if (!best || s > best.score) best = { id: p.id, score: +s.toFixed(2) };
  }
  if (best && best.score >= 0.3) return best;
  return null;
}

async function fetchPdfBase64(supabase: any, pdfPath: string): Promise<string> {
  let path = pdfPath;
  if (path.includes("/order-pdfs/")) {
    path = decodeURIComponent(path.split("/order-pdfs/").pop()!);
  }
  const { data, error } = await supabase.storage.from("order-pdfs").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error(`Failed to sign PDF URL: ${error?.message}`);
  const resp = await fetch(data.signedUrl);
  if (!resp.ok) throw new Error(`Failed to download PDF: ${resp.status}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function callAI(pdfBase64: string, formulaCatalog: Formula[]) {
  const catalogHint = formulaCatalog
    .slice(0, 200)
    .map((f) => `${f.code || "—"} | ${f.name || ""}${f.product_code_line ? " | " + f.product_code_line : ""}`)
    .join("\n");

  const system = `You extract structured purchase order data from PDF documents for a nutraceutical gummy manufacturing plant.

Rules:
- Bottle sizes MUST be one of: 60, 70, 90, 120 (snap to closest if PDF says 60ct/60-count/etc). Use 0 only if truly unclear.
- bottle_count is the TOTAL number of bottles ordered for that line (not cases).
- raw_formula_reference should be the SKU / formula code / product code as printed.
- Always pull the bill-to / sold-to / customer company name into customer_name (NOT the manufacturer/vendor "Pharma Vista").
- For each line, also capture any printed packaging description into bottle_hint (bottle material/color/size), cap_hint (cap description), and label_hint (label description). Empty string when not present.
- If a field is missing on the PO, return empty string "" (or 0 for numbers).

Known formula catalog (code | name | product_code) for context, but always extract from the PDF first:
${catalogHint || "(no formulas)"}`;

  const body = {
    model: MODELS.vision,
    system,
    max_tokens: 4096,
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "Extract the PO header (including the customer company), all line items, and any packaging hints from this purchase order PDF." },
          // Anthropic reads PDFs natively via a `document` block.
          {
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: pdfBase64,
            },
          },
        ],
      },
    ],
    tools: [
      toAnthropicTool({
        type: "function",
        function: {
          name: "emit_po_extraction",
          description: "Return the structured PO extraction",
          parameters: EXTRACTION_SCHEMA,
        },
      }),
    ],
    forceTool: "emit_po_extraction",
  };

  const data = await callAnthropic(body);
  const args = extractToolInput(data);
  if (!args) throw new Error("AI returned no tool call");
  return args;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    // Role check: only admin or production_manager may scan POs
    const { data: roles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "production_manager"]);
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id, pdf_path, customer_id: bodyCustomerId } = await req.json();
    if (!pdf_path) {
      return new Response(JSON.stringify({ error: "pdf_path is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let customerScopeId: string | null = bodyCustomerId || null;
    if (order_id) {
      const { data: order } = await adminClient
        .from("order_headers")
        .select("id, customer_id")
        .eq("id", order_id)
        .maybeSingle();
      if (!order) {
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      customerScopeId = order.customer_id;
    }

    // Load reference data in parallel
    const [formulasRes, customersRes, bottlesRes, capsRes] = await Promise.all([
      adminClient.from("formulas").select("id, code, name, product_code_line, customer_id").eq("is_deleted", false),
      adminClient.from("customers").select("id, company_name, company_code"),
      adminClient.from("v_packaging_balances").select("item_id, item_name, description, category").eq("category", "BOTTLES"),
      adminClient.from("v_packaging_balances").select("item_id, item_name, description, category").eq("category", "CAPS"),
    ]);

    const formulas = (formulasRes.data || []) as Formula[];
    const customers = (customersRes.data || []) as Customer[];
    const bottlePool = (bottlesRes.data || []) as Packaging[];
    const capPool = (capsRes.data || []) as Packaging[];

    const pdfBase64 = await fetchPdfBase64(adminClient, pdf_path);
    const extraction = await callAI(pdfBase64, formulas);

    // Customer match
    const customerMatch = matchCustomer(extraction.customer_name || "", extraction.customer_address || "", customers);
    const detectedCustomerId = customerMatch?.customer_id || null;
    const effectiveCustomerId = customerScopeId || detectedCustomerId;

    // Load labels scoped to effective customer (if known)
    let labelPool: Array<{ id: string; customer_product: string; product_name: string | null }> = [];
    if (effectiveCustomerId) {
      const { data: labels } = await adminClient
        .from("label_inventory")
        .select("id, customer_product, product_name, customer_id")
        .eq("customer_id", effectiveCustomerId);
      labelPool = (labels || []) as any;
    }

    const matched: any[] = [];
    const unmatched: any[] = [];

    for (const item of extraction.line_items || []) {
      let bottleSize = Number(item.bottle_size) || 0;
      if (!ALLOWED_BOTTLE_SIZES.includes(bottleSize)) {
        if (bottleSize > 0) {
          bottleSize = ALLOWED_BOTTLE_SIZES.reduce((prev, curr) =>
            Math.abs(curr - bottleSize) < Math.abs(prev - bottleSize) ? curr : prev
          );
        } else {
          bottleSize = 0;
        }
      }

      const match = matchFormula(
        item.raw_formula_reference || "",
        item.raw_product_description || "",
        formulas,
        effectiveCustomerId
      );

      const bottleSuggest = matchPackaging(item.bottle_hint || "", item.raw_product_description || "", bottleSize || null, bottlePool);
      const capSuggest = matchPackaging(item.cap_hint || "", item.raw_product_description || "", bottleSize || null, capPool);
      const labelSuggest = matchLabel(item.label_hint || "", item.raw_product_description || "", labelPool);

      const lineTotal = (Number(item.bottle_count) || 0) * (Number(item.unit_price) || 0);
      const enriched = {
        ...item,
        bottle_size: bottleSize || null,
        line_total: lineTotal,
        suggested_bottle_id: bottleSuggest?.id || null,
        suggested_bottle_score: bottleSuggest?.score || 0,
        suggested_cap_id: capSuggest?.id || null,
        suggested_cap_score: capSuggest?.score || 0,
        suggested_label_id: labelSuggest?.id || null,
        suggested_label_score: labelSuggest?.score || 0,
        ...(match || {}),
      };

      if (match) matched.push(enriched);
      else unmatched.push(enriched);
    }

    const confidence =
      matched.length + unmatched.length === 0 ? 0 : matched.length / (matched.length + unmatched.length);

    const poTotal = [...matched, ...unmatched].reduce((sum, l) => sum + (Number(l.line_total) || 0), 0);

    let scanId: string | undefined;
    if (order_id) {
      const { data: scan, error: insertError } = await adminClient
        .from("po_scan_results")
        .insert({
          order_id,
          pdf_path,
          raw_extraction: extraction,
          matched,
          unmatched,
          confidence,
          model_used: MODELS.vision,
          created_by: userId,
        })
        .select()
        .single();
      if (insertError) console.error("Failed to persist scan:", insertError);
      scanId = scan?.id;
    }

    return new Response(
      JSON.stringify({
        scan_id: scanId,
        extraction,
        matched,
        unmatched,
        confidence,
        po_total: poTotal,
        customer_match: customerMatch
          ? {
              customer_id: customerMatch.customer_id,
              score: customerMatch.customer_match_score,
              method: customerMatch.customer_match_method,
              matched_name: customerMatch.customer_match_label,
              raw_name: extraction.customer_name || "",
            }
          : { customer_id: null, score: 0, method: null, matched_name: null, raw_name: extraction.customer_name || "" },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("ai-scan-po error:", e);
    const msg = e?.message || "Unknown error";
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
