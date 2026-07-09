// Customer-portal PO scanner: accepts PDF/DOCX/XLSX uploads, extracts header + line
// items via Claude (Anthropic), and returns the structured result for the portal to pre-fill
// the New PO form. Mirrors ai-scan-po but scoped to the caller's own customer_id.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import mammoth from "npm:mammoth@1.8.0";
import ExcelJS from "npm:exceljs@4.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { callAnthropic, MODELS, toAnthropicTool, extractToolInput, fileToContentBlock } from "../_shared/anthropic.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_BOTTLE_SIZES = [60, 70, 90, 120];
const MAX_BYTES = 20 * 1024 * 1024;

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    po_number: { type: "string", description: "Customer PO number, '' if absent" },
    due_date: { type: "string", description: "Requested ship/delivery date YYYY-MM-DD, '' if absent" },
    special_instructions: { type: "string", description: "Free-text instructions, '' if absent" },
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Full product name/description as printed" },
          bottle_count: { type: "integer", description: "Total bottles ordered for this line" },
          bottle_size: { type: "integer", description: "Bottles per container: snap to 60, 70, 90, or 120. 0 if unclear." },
          unit_price: { type: "number", description: "Per-bottle unit price, 0 if absent" },
          notes: { type: "string", description: "Line-level notes, '' if absent" },
          bottle_container_hint: { type: "string", description: "Bottle container description as printed (e.g. '250 cc White'), '' if absent" },
        },
        required: ["product_name", "bottle_count", "bottle_size", "unit_price", "notes", "bottle_container_hint"],
        additionalProperties: false,
      },
    },
  },
  required: ["po_number", "due_date", "special_instructions", "line_items"],
  additionalProperties: false,
};

function toBase64(buf: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function extractTextFromDocx(buf: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: buf as any });
  return result.value || "";
}

async function extractTextFromXlsx(buf: Uint8Array): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const parts: string[] = [];
  wb.eachSheet((sheet) => {
    parts.push(`### Sheet: ${sheet.name}`);
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value;
        if (v == null) return;
        if (typeof v === "object" && "text" in (v as any)) cells.push(String((v as any).text));
        else if (typeof v === "object" && "result" in (v as any)) cells.push(String((v as any).result));
        else cells.push(String(v));
      });
      if (cells.length) parts.push(cells.join("\t"));
    });
    parts.push("");
  });
  return parts.join("\n");
}

async function callAI(userContent: any[]): Promise<any> {
  const system = `You extract structured purchase order data from customer documents for a nutraceutical gummy manufacturer.

Rules:
- Bottle sizes MUST snap to 60, 70, 90, or 120 (e.g. "60ct" -> 60). Use 0 only if truly unclear.
- bottle_count is the TOTAL number of bottles ordered for that line (not cases).
- product_name = full product name/description as printed on the PO.
- bottle_container_hint = bottle container/material/color description as printed (e.g. "250 cc White").
- Missing fields: return "" for strings, 0 for numbers.`;

  // Convert OpenAI-style content parts to Anthropic content blocks.
  const content = userContent.map((part: any) => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (part.type === "image_url") {
      const url: string = part.image_url?.url ?? "";
      const m = url.match(/^data:([^;]+);base64,(.*)$/s);
      if (m) return fileToContentBlock(m[2], m[1]);
    }
    return { type: "text", text: JSON.stringify(part) };
  });

  const resp = await callAnthropic({
    model: MODELS.vision,
    system,
    messages: [{ role: "user", content }],
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
  });

  const args = extractToolInput(resp);
  if (!args) throw new Error("AI returned no tool call");
  return args;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Caller must be a customer portal user — resolve their customer_id
    const { data: cu } = await adminClient
      .from("customer_users")
      .select("customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!cu?.customer_id) {
      return new Response(JSON.stringify({ error: "Only customer-portal users can scan POs here." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const customerId = cu.customer_id as string;

    // Read multipart upload
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Missing 'file' field." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (file.size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "File exceeds 20 MB limit." }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lowerName = file.name.toLowerCase();
    let kind: "pdf" | "docx" | "xlsx" | null = null;
    if (lowerName.endsWith(".pdf")) kind = "pdf";
    else if (lowerName.endsWith(".docx")) kind = "docx";
    else if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) kind = "xlsx";
    else if (lowerName.endsWith(".doc")) {
      return new Response(
        JSON.stringify({ error: "Legacy .doc files aren't supported. Please save the file as .docx or PDF." }),
        { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported file type. Upload a PDF, DOCX, or Excel file." }),
        { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const buf = new Uint8Array(await file.arrayBuffer());

    // Upload original to private order-pdfs bucket
    const ext = kind === "pdf" ? "pdf" : kind === "docx" ? "docx" : "xlsx";
    const objectPath = `portal-scans/${customerId}/${crypto.randomUUID()}.${ext}`;
    const contentType =
      kind === "pdf" ? "application/pdf"
      : kind === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const { error: upErr } = await adminClient.storage
      .from("order-pdfs")
      .upload(objectPath, buf, { contentType, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    // Build AI input
    let userContent: any[];
    if (kind === "pdf") {
      const b64 = toBase64(buf);
      userContent = [
        { type: "text", text: "Extract the PO header and all line items from this purchase order PDF." },
        { type: "image_url", image_url: { url: `data:application/pdf;base64,${b64}` } },
      ];
    } else {
      const text = kind === "docx" ? await extractTextFromDocx(buf) : await extractTextFromXlsx(buf);
      const trimmed = (text || "").slice(0, 60_000);
      if (!trimmed.trim()) throw new Error("Could not extract any text from the uploaded file.");
      userContent = [
        {
          type: "text",
          text:
            `Extract the PO header and all line items from the following ${kind === "docx" ? "Word document" : "spreadsheet"} contents. Treat tabs and newlines as table structure.\n\n` +
            trimmed,
        },
      ];
    }

    const extraction = await callAI(userContent);

    // Snap bottle_size to allowed values
    for (const it of extraction.line_items || []) {
      const n = Number(it.bottle_size) || 0;
      if (ALLOWED_BOTTLE_SIZES.includes(n)) continue;
      if (n > 0) {
        it.bottle_size = ALLOWED_BOTTLE_SIZES.reduce((p, c) =>
          Math.abs(c - n) < Math.abs(p - n) ? c : p,
        );
      } else {
        it.bottle_size = 0;
      }
    }

    return new Response(
      JSON.stringify({ pdf_path: objectPath, file_name: file.name, extraction }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("scan-portal-po error:", e);
    const msg = e?.message || "Unknown error";
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
