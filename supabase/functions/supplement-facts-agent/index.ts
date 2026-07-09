// Supplement Facts Agent
// - action "load_version": fetches an R&D version + project + actives.
// - action "chat": conversational agent that asks user for missing/ambiguous fields.
// - action "generate": builds the panel + .docx, uploads to storage, returns signed URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import {
  buildSupplementFactsPanel,
  detectUnitMismatches,
  type ActiveIngredient,
  type ProductInput,
  type Unit,
} from "../_shared/supplement-facts-logic.ts";
import { renderSupplementFactsDocx } from "../_shared/supplement-facts-docx.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { callAnthropic, MODELS, splitSystem, extractText } from "../_shared/anthropic.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const AGENT_SYSTEM_PROMPT = `You are the Pharmvista Supplement Facts Assistant. You help users generate an FDA-style Supplement Facts panel for a gummy supplement from R&D version data.

You will be given (in the first user message) a JSON payload with:
- version: the R&D project version (project name, customer, batchGummyCount = total gummies per batch/bottle — NOT the serving size)
- actives: an array of active ingredients from that version, each with mgPerGummy (mg in ONE gummy)
- unitMismatches: any active ingredients whose provided unit does not match the FDA Daily Value unit

IMPORTANT:
- batchGummyCount is the number of gummies produced in a batch/bottle (e.g. 111). It is NOT the serving size.
- Serving size is how many gummies the consumer takes per serving (typically 2 or 3). Default to 2 unless the user says otherwise.
- The Supplement Facts panel amount per serving for each active = mgPerGummy × servingSizeGummies.

Your job:
1. Your FIRST assistant reply MUST use this exact structure (markdown, no extra preamble, no "Hello!"):

   Pre-filled from **<productName>** for **<customerName>**:

   **Actives (per gummy)**
   - <name> — <mgPerGummy> mg
   - ...

   **Default serving size:** 2 gummies

   **Standard Other Ingredients:** <defaultOtherIngredients from CONTEXT, no surrounding quotes>

   Please confirm or update in one reply — put each answer on its own numbered line:
   1. Product name (or "keep")
   2. Serving size in gummies (or "keep" for 2)
   3. Unit corrections (e.g. "Vitamin D -> mcg", or "none")
   4. Other Ingredients (comma-separated list, or "standard")
   5. Directions (or "standard")

2. Do NOT ask questions one at a time. Wait for the user's consolidated reply.
3. When the user has answered (even partially — treat missing/blank items as "keep"/"standard"), respond with EXACTLY this JSON object on its own line prefixed by "READY:". For each active, amountPerServing MUST equal mgPerGummy × servingSizeGummies. If the user picked "standard"/"keep" for Other Ingredients, set \`otherIngredients\` to the exact \`defaultOtherIngredients\` string from CONTEXT (do NOT use null):
   READY:{"productName":"...","customerName":"...","servingSizeGummies":N,"activeIngredients":[{"name":"...","amountPerServing":N,"unit":"mg|mcg|IU|g"}],"otherIngredients":"...","directions":null,"macros":null}
   Use null only when accepting system defaults for a field that has no CONTEXT-provided default.
4. Never invent numeric values the user did not confirm. Only ask a follow-up if a specific answer is genuinely ambiguous.
5. Keep replies concise and professional.`;


async function callClaude(messages: any[]): Promise<string> {
  const { system, messages: msgs } = splitSystem(messages);
  const resp = await callAnthropic({
    model: MODELS.default,
    system,
    messages: msgs,
  });
  return extractText(resp);
}

async function loadVersionContext(supabase: any, versionId: string) {
  const { data: version, error: vErr } = await supabase
    .from("rd_project_versions")
    .select("*")
    .eq("id", versionId)
    .single();
  if (vErr) throw new Error(`Version not found: ${vErr.message}`);

  const { data: project } = await supabase
    .from("rd_projects")
    .select("*")
    .eq("id", version.rd_project_id)
    .maybeSingle();

  const { data: actives } = await supabase
    .from("rd_version_actives")
    .select("*")
    .eq("version_id", versionId);

  const { data: inactivesRows } = await supabase
    .from("rd_version_inactives")
    .select("*")
    .eq("version_id", versionId)
    .order("sort_order", { ascending: true });
  const inactives = (inactivesRows || []).map((r: any) => r.name as string);

  const DEFAULT_SERVING = 2;
  const batchGummyCount = Number(version.gummies_count) || 0;
  const servingSize = DEFAULT_SERVING;
  const activesRaw = (actives || []).map((a: any) => ({
    name: a.active_name,
    mgPerGummy: Number(a.mg_per_gummy) || 0,
    unit: "mg" as Unit,
  }));
  const activeIngredients: ActiveIngredient[] = activesRaw.map((a) => ({
    name: a.name,
    amountPerServing: a.mgPerGummy * servingSize,
    unit: a.unit,
  }));

  const defaultOtherIngredients = buildDefaultOtherIngredients(inactives);

  const unitMismatches = detectUnitMismatches(activeIngredients);

  return {
    version,
    project,
    servingSize,
    batchGummyCount,
    activesRaw,
    activeIngredients,
    inactives,
    defaultOtherIngredients,
    unitMismatches,
    productName: project?.project_name || version.version_number || "Gummy Supplement",
    customerName: project?.customer_name || null,
  };
}

function buildDefaultOtherIngredients(inactives: string[]): string {
  const lower = inactives.map((n) => n.toLowerCase());
  const hasAny = (kw: string) => lower.some((n) => n.includes(kw));

  const sweetenerBase = hasAny("maltitol") ? "maltitol syrup" : "organic tapioca syrup";
  const sugar = hasAny("imo") || hasAny("isomalto") ? "IMO powder" : "organic cane sugar";

  const extractDescriptor = (name: string, kw: "flavor" | "color"): string => {
    return name
      .replace(/natural/gi, "")
      .replace(new RegExp(kw, "gi"), "")
      .replace(/[()]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  };
  const flavorDescriptors = inactives
    .filter((n) => /flavor/i.test(n))
    .map((n) => extractDescriptor(n, "flavor"))
    .filter(Boolean);
  const colorDescriptors = inactives
    .filter((n) => /color/i.test(n))
    .map((n) => extractDescriptor(n, "color"))
    .filter(Boolean);

  const flavorPart = flavorDescriptors.length
    ? `natural ${flavorDescriptors.join(" & ")} flavor`
    : "natural flavor";
  const colorPart = colorDescriptors.length
    ? `natural ${colorDescriptors.join(" & ")} color`
    : "natural color";

  return `${sweetenerBase}, ${sugar}, purified water, seaweed extract, pectin, trisodium citrate, citric acid, ${flavorPart} and ${colorPart}.`;
}

async function generateAndUpload(supabase: any, userId: string, input: ProductInput, versionId?: string, projectId?: string) {
  const panel = buildSupplementFactsPanel(input);
  const bytes = await renderSupplementFactsDocx(panel);

  const timestamp = Date.now();
  const safeName = input.productName.replace(/[^a-z0-9-_]/gi, "_").slice(0, 40);
  const path = `${userId}/${versionId || "manual"}/${safeName}_${timestamp}.docx`;

  const { error: upErr } = await supabase.storage
    .from("supplement-facts")
    .upload(path, bytes, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  // Insert generation record
  const { data: gen, error: insErr } = await supabase
    .from("supplement_facts_generations")
    .insert({
      rd_version_id: versionId ?? null,
      rd_project_id: projectId ?? null,
      product_name: input.productName,
      customer_name: input.customerName ?? null,
      panel_json: panel,
      docx_storage_path: path,
      generated_by: userId,
    })
    .select()
    .single();
  if (insErr) console.error("Failed to insert generation:", insErr.message);

  const { data: signed, error: sigErr } = await supabase.storage
    .from("supplement-facts")
    .createSignedUrl(path, 3600);
  if (sigErr) throw new Error(`Signed URL failed: ${sigErr.message}`);

  return { panel, path, signedUrl: signed.signedUrl, generationId: gen?.id ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const action = body.action as "load_version" | "chat" | "generate";

    if (action === "load_version") {
      const ctx = await loadVersionContext(service, body.versionId);
      return new Response(JSON.stringify(ctx), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "chat") {
      const { context, messages } = body as { context: any; messages: { role: string; content: string }[] };
      // Seed with system + context.
      const seeded = [
        { role: "system", content: AGENT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `CONTEXT:\n${JSON.stringify({
            version: context.version ? { project_name: context.productName, version_number: context.version.version_number, batchGummyCount: context.batchGummyCount } : null,
            customer: context.customerName,
            defaultServingSizeGummies: context.servingSize,
            actives: context.activesRaw ?? context.activeIngredients,
            unitMismatches: context.unitMismatches,
            inactives: context.inactives ?? [],
            defaultOtherIngredients: context.defaultOtherIngredients ?? null,
          }, null, 2)}\n\nBegin the conversation.`,
        },
        ...messages,
      ];
      const reply = await callClaude(seeded);

      let ready: ProductInput | null = null;
      const match = reply.match(/READY:(\{[\s\S]*\})/);
      if (match) {
        try {
          ready = JSON.parse(match[1]);
        } catch (e) {
          console.error("Failed to parse READY JSON:", e);
        }
      }

      return new Response(JSON.stringify({ reply, ready }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "generate") {
      const { input, versionId, projectId } = body as { input: ProductInput; versionId?: string; projectId?: string };
      const result = await generateAndUpload(service, user.id, input, versionId, projectId);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "regenerate") {
      // Skip AI loop: render DOCX from an already-built (and possibly user-edited) panel.
      const { panel, productName, customerName, versionId, projectId, generationId } = body as {
        panel: any;
        productName: string;
        customerName?: string | null;
        versionId?: string;
        projectId?: string;
        generationId?: string | null;
      };
      const { renderSupplementFactsDocx } = await import("../_shared/supplement-facts-docx.ts");
      const bytes = await renderSupplementFactsDocx(panel);
      const timestamp = Date.now();
      const safeName = String(productName || "panel").replace(/[^a-z0-9-_]/gi, "_").slice(0, 40);
      const path = `${user.id}/${versionId || "manual"}/${safeName}_${timestamp}.docx`;
      const { error: upErr } = await service.storage.from("supplement-facts").upload(path, bytes, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

      if (generationId) {
        await service.from("supplement_facts_generations")
          .update({ panel_json: panel, docx_storage_path: path, product_name: productName, customer_name: customerName ?? null })
          .eq("id", generationId);
      } else {
        await service.from("supplement_facts_generations").insert({
          rd_version_id: versionId ?? null,
          rd_project_id: projectId ?? null,
          product_name: productName,
          customer_name: customerName ?? null,
          panel_json: panel,
          docx_storage_path: path,
          generated_by: user.id,
        });
      }

      const { data: signed, error: sigErr } = await service.storage
        .from("supplement-facts")
        .createSignedUrl(path, 3600);
      if (sigErr) throw new Error(`Signed URL failed: ${sigErr.message}`);

      return new Response(JSON.stringify({ panel, path, signedUrl: signed.signedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("supplement-facts-agent error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
