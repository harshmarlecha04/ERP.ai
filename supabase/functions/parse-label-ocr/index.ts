// Edge function: parse a raw-material label photo via Claude (Anthropic vision),
// then fuzzy-match the parsed name/supplier against raw_materials.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a receiving-clerk assistant for a nutraceutical manufacturer.
You will be shown a photo of a raw-material container label from a supplier.
Extract the fields into the structured JSON schema provided.

Rules:
- If a value is not clearly visible, return null. Do NOT guess.
- Normalize dates to ISO YYYY-MM-DD. If only month/year is shown (e.g. "EXP 09/2027"), use the last day of that month.
- The raw material name is the ingredient / product name (e.g. "Ascorbic Acid", "Fish Oil 18/12", "Gelatin 250 Bloom"). Do not confuse it with the supplier's company name.
- Supplier name is the manufacturer / distributor company printed on the label.
- Lot number often appears near labels like "Lot", "Batch", "B/N", "L#".
- Quantity + UOM is the net weight/volume of the container (e.g. "25 kg", "50 lb").
- confidence is your overall confidence (0..1) that the extracted fields are correct.`;

const TOOL = {
  type: "function",
  function: {
    name: "extract_label",
    description: "Extract raw-material label fields from the image.",
    parameters: {
      type: "object",
      properties: {
        raw_material_name: { type: ["string", "null"] },
        supplier_name: { type: ["string", "null"] },
        lot_number: { type: ["string", "null"] },
        manufacture_date: { type: ["string", "null"] },
        expiry_date: { type: ["string", "null"] },
        quantity: { type: ["string", "null"] },
        uom: { type: ["string", "null"] },
        confidence: { type: "number" },
      },
      required: ["confidence"],
      additionalProperties: false,
    },
  },
} as const;

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokenScore(a: string, b: string): number {
  const ta = new Set(normalize(a).split(" ").filter((t) => t.length > 1));
  const tb = new Set(normalize(b).split(" ").filter((t) => t.length > 1));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  ta.forEach((t) => { if (tb.has(t)) hit += 1; });
  return hit / Math.max(ta.size, tb.size);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await sb.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileBase64, mimeType } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "fileBase64 and mimeType required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let aiJson: any;
    try {
      aiJson = await callAnthropic({
        model: MODELS.vision,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the label fields from this photo." },
              fileToContentBlock(fileBase64, mimeType),
            ],
          },
        ],
        tools: [toAnthropicTool(TOOL)],
        forceTool: "extract_label",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("AI error:", msg);
      if (msg.includes(" 429")) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI call failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = extractToolInput(aiJson);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "No structured output from model" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fuzzy-match against raw_materials
    let matches: Array<{
      id: string; code: string; name: string; supplier: string | null; uom: string; score: number;
    }> = [];
    if (parsed.raw_material_name) {
      const { data: mats } = await sb
        .from("raw_materials")
        .select("id, code, name, supplier, uom")
        .limit(1000);
      if (mats) {
        const scored = mats.map((m: any) => {
          const nameScore = tokenScore(parsed.raw_material_name || "", m.name || "");
          const supScore = parsed.supplier_name
            ? tokenScore(parsed.supplier_name, m.supplier || "") * 0.35
            : 0;
          return { ...m, score: Math.min(1, nameScore + supScore) };
        });
        matches = scored
          .filter((m: any) => m.score > 0.2)
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 5);
      }
    }

    return new Response(JSON.stringify({ parsed, matches }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-label-ocr error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
