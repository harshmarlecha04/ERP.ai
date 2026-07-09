// Edge function: parses an uploaded lab COA / test results file (PDF or image)
// using Claude (Anthropic) and returns a structured JSON of test results.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  callAnthropic,
  extractToolInput,
  fileToContentBlock,
  toAnthropicTool,
  MODELS,
} from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a precise lab-report parser for Pharmvista's manufacturing QA team.
You will be shown the contents of a Certificate of Analysis or lab test result document.
Extract the test results into the structured JSON schema provided. If a value is not present in the document, return null for it. Do not invent values. Preserve original units (e.g. "<0.1 PPM", "<10 CFU/g", "Complies", "Absent", "4000 mcg/2 gummies").`;

const TOOL = {
  type: "function",
  function: {
    name: "extract_coa_results",
    description:
      "Extract Certificate of Analysis test results from the document.",
    parameters: {
      type: "object",
      properties: {
        batch_lot: { type: ["string", "null"] },
        manufacturing_date: { type: ["string", "null"], description: "ISO YYYY-MM-DD if found" },
        expiration_date: { type: ["string", "null"], description: "ISO YYYY-MM-DD if found" },
        active_ingredient_assay: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              specification: { type: ["string", "null"] },
              result: { type: ["string", "null"] },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
        attributes: {
          type: "object",
          properties: {
            color: { type: ["string", "null"] },
            shape: { type: ["string", "null"] },
            consistency: { type: ["string", "null"] },
            flavor: { type: ["string", "null"] },
            foreign_particles: { type: ["string", "null"] },
            average_weight: { type: ["string", "null"] },
          },
        },
        heavy_metals: {
          type: "object",
          properties: {
            lead: { type: ["string", "null"] },
            arsenic: { type: ["string", "null"] },
            mercury: { type: ["string", "null"] },
            cadmium: { type: ["string", "null"] },
          },
        },
        microbiological: {
          type: "object",
          properties: {
            total_aerobic_microbial_count: { type: ["string", "null"] },
            total_coliforms: { type: ["string", "null"] },
            total_yeast_mold: { type: ["string", "null"] },
            e_coli: { type: ["string", "null"] },
            salmonella: { type: ["string", "null"] },
            staphylococcus_aureus: { type: ["string", "null"] },
          },
        },
      },
      required: ["active_ingredient_assay", "attributes", "heavy_metals", "microbiological"],
      additionalProperties: false,
    },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await sb.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileBase64, mimeType } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: "fileBase64 and mimeType required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let aiJson: any;
    try {
      aiJson = await callAnthropic({
        model: MODELS.vision,
        system: SYSTEM_PROMPT,
        maxTokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the COA test results from this document.",
              },
              fileToContentBlock(fileBase64, mimeType),
            ],
          },
        ],
        tools: [toAnthropicTool(TOOL)],
        forceTool: "extract_coa_results",
      });
    } catch (e: any) {
      const msg = e?.message ?? "";
      console.error("AI provider error:", msg);
      if (msg.includes("429")) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(JSON.stringify({ error: "AI provider failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = extractToolInput(aiJson);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "No structured output from model" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ data: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-coa-test-results error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
