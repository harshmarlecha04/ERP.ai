// Edge function: claude-label-review
// Reviews a supplement label PDF using the supplement-label-review skill
// and produces a 1-page .docx report stored in the label-reviews bucket.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
} from "npm:docx@9.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL_THOROUGH = "claude-sonnet-4-5";
const MODEL_FAST = "claude-haiku-4-5";

// --- Load skill files (cached at cold start) ---
async function readSkill(rel: string): Promise<string> {
  const url = new URL(`./skill/${rel}`, import.meta.url);
  return await Deno.readTextFile(url);
}

// System prompt: small, stable — contains skill core + output contract.
const SYSTEM_PROMPT: string = await (async () => {
  const skill = await readSkill("SKILL.md").catch(() => "");
  const report = await readSkill("assets/report-structure.md").catch(() => "");
  return [
    "You are the supplement-label-review skill. Apply it exactly as written below.",
    "Review the attached dietary supplement label PDF against the four scoped CFR sections plus the language pass.",
    `\n\n===== SKILL.md =====\n\n${skill}`,
    `\n\n===== report-structure.md =====\n\n${report}`,
    "\n\n===== OUTPUT CONTRACT =====\n",
    "Return ONLY a single JSON object — no prose, no markdown fences. Shape:",
    `{
  "product": string,
  "brand": string,
  "reviewed_date": "YYYY-MM-DD",
  "headline": string,
  "ndi_screen": string,
  "base_check": string,
  "chat_summary_md": string,
  "findings": [
    { "id": "C1"|"M1"|"m1"|..., "severity": "Critical"|"Major"|"Minor",
      "element": string, "finding": string, "citation": string, "fix": string }
  ],
  "language": [ { "id": "L1"|..., "element": string, "issue": string, "fix": string } ]
}`,
    "chat_summary_md is the short markdown briefing for the user (counts + top 3-5 must-fix). Keep findings sorted Critical → Major → Minor; cap total rows so the report fits one US Letter page.",
  ].join("\n");
})();

// CFR references: large, stable — sent as a cached user-message block.
const REFERENCES_BLOCK: string = await (async () => {
  const files = [
    ["references/cfr-101-36-supplement-facts.md", "cfr-101-36-supplement-facts.md"],
    ["references/cfr-101-93-claims.md", "cfr-101-93-claims.md"],
    ["references/cfr-111-label-touchpoints.md", "cfr-111-label-touchpoints.md"],
    ["references/cfr-190-ndi-screening.md", "cfr-190-ndi-screening.md"],
    ["references/language-review.md", "language-review.md"],
  ];
  const parts: string[] = ["===== CFR REFERENCES (load on demand) ====="];
  for (const [path, name] of files) {
    const body = await readSkill(path).catch(() => "");
    if (body) parts.push(`\n\n--- ${name} ---\n\n${body}`);
  }
  return parts.join("\n");
})();


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "ANTHROPIC_API_KEY is not configured" }, 500);

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const labelPath: string | undefined = body?.label_path;
    const labelFileName: string | undefined = body?.label_file_name;
    const mode: "fast" | "thorough" = body?.mode === "fast" ? "fast" : "thorough";
    const model = mode === "fast" ? MODEL_FAST : MODEL_THOROUGH;
    const ALLOWED_WEIGHTS = [2.5, 3, 3.5, 4] as const;
    const gummyWeightRaw = Number(body?.gummy_weight_g);
    if (!ALLOWED_WEIGHTS.includes(gummyWeightRaw as typeof ALLOWED_WEIGHTS[number])) {
      return json({ error: "gummy_weight_g must be one of 2.5, 3, 3.5, or 4" }, 400);
    }
    const gummyWeight = gummyWeightRaw;

    const reviewerName = String(body?.reviewer_name ?? "").trim().slice(0, 120) || "Pharmvista QA";


    if (!labelPath || typeof labelPath !== "string") {
      return json({ error: "label_path is required" }, 400);
    }
    if (!labelPath.startsWith(`${userId}/`)) {
      return json({ error: "label_path is not in your folder" }, 403);
    }

    const admin = createClient(supabaseUrl, supabaseService);

    const { data: row, error: insertErr } = await admin
      .from("label_reviews")
      .insert({
        user_id: userId,
        label_file_name: labelFileName ?? labelPath.split("/").pop() ?? "label.pdf",
        label_file_path: labelPath,
        status: "pending",
        gummy_weight_g: gummyWeight,
        reviewer_name: reviewerName,
      })
      .select()
      .single();
    if (insertErr || !row) {
      return json({ error: `Failed to create review row: ${insertErr?.message}` }, 500);
    }

    try {
      const { data: pdfBlob, error: dlErr } = await admin.storage
        .from("label-reviews")
        .download(labelPath);
      if (dlErr || !pdfBlob) throw new Error(`PDF download failed: ${dlErr?.message}`);

      const pdfBuffer = new Uint8Array(await pdfBlob.arrayBuffer());
      const pdfBase64 = base64Encode(pdfBuffer);

      const claudeRes = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          system: [
            { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          ],
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: REFERENCES_BLOCK,
                  cache_control: { type: "ephemeral" },
                },
                {
                  type: "document",
                  source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
                },
                {
                  type: "text",
                  text: `PRODUCT CONTEXT (user-confirmed — do NOT re-ask):\n- Average gummy piece weight: ${gummyWeight} g\n- Reviewer name: ${reviewerName}\n\nProceed directly to the five CFR passes, the Step 3.5 pre-report checklist, and the JSON output contract defined in SKILL.md. Use the reviewer name in the report metadata. Return ONLY the JSON object described in the output contract.`,
                },
              ],
            },
          ],
        }),
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        throw new Error(`Claude API ${claudeRes.status}: ${errText}`);
      }

      const claudeData = await claudeRes.json();
      const rawText: string = (claudeData?.content ?? [])
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim();

      if (!rawText) throw new Error("Claude returned an empty response");

      const parsed = parseJsonLoose(rawText);
      const review = normalizeReview(parsed, rawText, labelFileName);

      // Build .docx
      const docBytes = await buildDocx(review);
      const reportPath = `${userId}/reports/${row.id}.docx`;
      const { error: upErr } = await admin.storage
        .from("label-reviews")
        .upload(reportPath, new Blob([docBytes as BlobPart], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }), {
          upsert: true,
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      if (upErr) throw new Error(`Report upload failed: ${upErr.message}`);

      await admin
        .from("label_reviews")
        .update({
          status: "completed",
          summary: review.chat_summary_md,
          report_file_path: reportPath,
        })
        .eq("id", row.id);

      const { data: signed } = await admin.storage
        .from("label-reviews")
        .createSignedUrl(reportPath, 3600);

      return json({
        id: row.id,
        status: "completed",
        summary: review.chat_summary_md,
        report_file_path: reportPath,
        download_url: signed?.signedUrl ?? null,
      });
    } catch (err: any) {
      console.error("[claude-label-review] inner error:", err?.stack ?? err?.message ?? err);
      await admin
        .from("label_reviews")
        .update({ status: "failed", error: String(err?.message ?? err) })
        .eq("id", row.id);
      return json({ error: String(err?.message ?? err) }, 500);
    }
  } catch (err: any) {
    console.error("[claude-label-review] outer error:", err?.stack ?? err?.message ?? err);
    return json({ error: String(err?.message ?? err) }, 500);
  }
});

// --- helpers ---

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function parseJsonLoose(text: string): any {
  try { return JSON.parse(text); } catch { /* fallthrough */ }
  // Strip ```json fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch { /* fallthrough */ }
  }
  // Find first { ... last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fallthrough */ }
  }
  return null;
}

interface Finding {
  id: string; severity: "Critical" | "Major" | "Minor";
  element: string; finding: string; citation: string; fix: string;
}
interface LangItem { id: string; element: string; issue: string; fix: string; }
interface Review {
  product: string; brand: string; reviewed_date: string;
  headline: string; ndi_screen: string; base_check: string;
  chat_summary_md: string;
  findings: Finding[]; language: LangItem[];
}

function normalizeReview(parsed: any, raw: string, fallbackName?: string): Review {
  const today = new Date().toISOString().slice(0, 10);
  if (!parsed || typeof parsed !== "object") {
    // Fallback: stuff raw text into a single-row review so the user still gets a .docx
    return {
      product: fallbackName ?? "Unknown",
      brand: "—",
      reviewed_date: today,
      headline: "Could not parse structured output — raw notes attached.",
      ndi_screen: "—",
      base_check: "—",
      chat_summary_md: raw.slice(0, 4000),
      findings: [{
        id: "m1", severity: "Minor", element: "Review notes",
        finding: raw.slice(0, 800), citation: "—", fix: "See full notes in chat.",
      }],
      language: [],
    };
  }
  const sevOrder = { Critical: 0, Major: 1, Minor: 2 } as const;
  const findings: Finding[] = Array.isArray(parsed.findings) ? parsed.findings
    .map((f: any, i: number) => ({
      id: String(f.id ?? `F${i + 1}`),
      severity: (["Critical", "Major", "Minor"].includes(f.severity) ? f.severity : "Minor") as Finding["severity"],
      element: String(f.element ?? ""),
      finding: String(f.finding ?? ""),
      citation: String(f.citation ?? ""),
      fix: String(f.fix ?? ""),
    }))
    .sort((a: Finding, b: Finding) => sevOrder[a.severity] - sevOrder[b.severity])
    : [];
  const language: LangItem[] = Array.isArray(parsed.language) ? parsed.language
    .map((l: any, i: number) => ({
      id: String(l.id ?? `L${i + 1}`),
      element: String(l.element ?? ""),
      issue: String(l.issue ?? ""),
      fix: String(l.fix ?? ""),
    })) : [];
  return {
    product: String(parsed.product ?? fallbackName ?? "Unknown"),
    brand: String(parsed.brand ?? "—"),
    reviewed_date: String(parsed.reviewed_date ?? today),
    headline: String(parsed.headline ?? ""),
    ndi_screen: String(parsed.ndi_screen ?? "—"),
    base_check: String(parsed.base_check ?? "—"),
    chat_summary_md: String(parsed.chat_summary_md ?? raw.slice(0, 4000)),
    findings,
    language,
  };
}

// --- .docx generation — matches skill/assets/report-structure.md ---
const SKILL_VERSION = "v2.1";

async function buildDocx(r: Review): Promise<Uint8Array> {
  const counts = countSev(r.findings);

  // Color palette (Pharmvista-aligned)
  const C = {
    crimson: "B91C1C",
    critical: "DC2626",
    major: "D97706",
    minor: "6B7280",
    pass: "059669",
    headerDark: "1F2937",
    zebra: "F9FAFB",
    borderLt: "D1D5DB",
    textGray: "6B7280",
    white: "FFFFFF",
    black: "1F2937",
  } as const;

  const lightBorder = { style: BorderStyle.SINGLE, size: 3, color: C.borderLt };
  const cellBorders = { top: lightBorder, bottom: lightBorder, left: lightBorder, right: lightBorder };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
  const tightMargins = { top: 50, bottom: 50, left: 100, right: 100 };

  type TxtOpts = { size?: number; bold?: boolean; italics?: boolean; color?: string; font?: string };
  const txt = (text: string, opts: TxtOpts = {}) => new TextRun({
    text,
    size: opts.size ?? 16,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? C.black,
    font: opts.font ?? "Calibri",
  });

  type ParaOpts = { alignment?: any; spacing?: any };
  const para = (children: TextRun | TextRun[], opts: ParaOpts = {}) => new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: opts.alignment,
    spacing: opts.spacing ?? { after: 0 },
  });

  type CellOpts = { fill?: string; noBorders?: boolean; margins?: any; vAlign?: any };
  const cell = (content: Paragraph | Paragraph[], width: number, opts: CellOpts = {}) => new TableCell({
    borders: opts.noBorders ? noBorders : cellBorders,
    width: { size: width, type: WidthType.DXA },
    margins: opts.margins ?? tightMargins,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    verticalAlign: opts.vAlign ?? ("center" as any),
    children: Array.isArray(content) ? content : [content],
  });

  // Landscape geometry: 15840 - 2*720 = 14400
  const TOTAL_WIDTH = 14400;
  const cols = { id: 460, sev: 920, el: 1700, find: 4000, cite: 1620, fix: 5700 };

  // Crimson title bar with Skill v2.1 stamp
  const headerBar = new Table({
    width: { size: TOTAL_WIDTH, type: WidthType.DXA },
    columnWidths: [TOTAL_WIDTH],
    rows: [new TableRow({
      children: [cell(
        para([
          txt("LABEL CFR COMPLIANCE REVIEW  ", { bold: true, color: C.white, size: 28 }),
          txt("·  Pharmvista QA  ", { color: C.white, size: 20, italics: true }),
          txt("·  Skill " + SKILL_VERSION, { color: C.white, size: 18, italics: true }),
        ]),
        TOTAL_WIDTH,
        { fill: C.crimson, noBorders: true, margins: { top: 180, bottom: 180, left: 240, right: 240 } },
      )],
    })],
  });

  // Severity badge color
  const sevColor = (s: Finding["severity"]) =>
    s === "Critical" ? C.critical : s === "Major" ? C.major : C.minor;

  // Math line detection -> Consolas
  const isMathLine = (line: string) => /[=÷×]|^\s*•|^\s+\d|→/.test(line);
  const fixParas = (raw: string) => {
    const lines = (raw || "—").split(/\r?\n/);
    return lines.map((line) => new Paragraph({
      children: [txt(line, { size: 14, font: isMathLine(line) ? "Consolas" : "Calibri", color: C.black })],
      spacing: { after: 20, line: 220 },
    }));
  };

  // Findings table
  const fHeader = new TableRow({
    tableHeader: true,
    children: [
      cell(para(txt("#", { bold: true, color: C.white, size: 16 })), cols.id, { fill: C.headerDark }),
      cell(para(txt("Severity", { bold: true, color: C.white, size: 16 })), cols.sev, { fill: C.headerDark }),
      cell(para(txt("Element", { bold: true, color: C.white, size: 16 })), cols.el, { fill: C.headerDark }),
      cell(para(txt("Finding", { bold: true, color: C.white, size: 16 })), cols.find, { fill: C.headerDark }),
      cell(para(txt("Citation", { bold: true, color: C.white, size: 16 })), cols.cite, { fill: C.headerDark }),
      cell(para(txt("Recommended Fix (with math)", { bold: true, color: C.white, size: 16 })), cols.fix, { fill: C.headerDark }),
    ],
  });

  const findingsRows = (r.findings.length ? r.findings : [{
    id: "—", severity: "Minor" as const, element: "—",
    finding: "No CFR findings.", citation: "—", fix: "—",
  } as Finding]).map((f, idx) => {
    const zebra = idx % 2 === 1 ? C.zebra : C.white;
    return new TableRow({
      cantSplit: true,
      children: [
        cell(para(txt(f.id, { bold: true, size: 14 })), cols.id, { fill: zebra }),
        cell(
          para(txt(f.severity, { bold: true, color: C.white, size: 14 }), { alignment: AlignmentType.CENTER }),
          cols.sev,
          { fill: sevColor(f.severity) },
        ),
        cell(para(txt(f.element || "—", { bold: true, size: 14 })), cols.el, { fill: zebra }),
        cell(para(txt(f.finding || "—", { size: 14 })), cols.find, { fill: zebra }),
        cell(para(txt(f.citation || "—", { size: 13, color: C.textGray })), cols.cite, { fill: zebra }),
        cell(fixParas(f.fix), cols.fix, { fill: zebra }),
      ],
    });
  });

  const findingsTable = new Table({
    width: { size: TOTAL_WIDTH, type: WidthType.DXA },
    columnWidths: [cols.id, cols.sev, cols.el, cols.find, cols.cite, cols.fix],
    rows: [fHeader, ...findingsRows],
  });

  // Language table
  const langCols = { id: 460, el: 2000, issue: 5970, fix: 5970 };
  const lHeader = new TableRow({
    tableHeader: true,
    children: [
      cell(para(txt("#", { bold: true, color: C.white, size: 16 })), langCols.id, { fill: C.headerDark }),
      cell(para(txt("Element", { bold: true, color: C.white, size: 16 })), langCols.el, { fill: C.headerDark }),
      cell(para(txt("Issue", { bold: true, color: C.white, size: 16 })), langCols.issue, { fill: C.headerDark }),
      cell(para(txt("Recommended Fix", { bold: true, color: C.white, size: 16 })), langCols.fix, { fill: C.headerDark }),
    ],
  });
  const lRows = r.language.map((l, idx) => {
    const zebra = idx % 2 === 1 ? C.zebra : C.white;
    return new TableRow({
      cantSplit: true,
      children: [
        cell(para(txt(l.id, { bold: true, size: 14 })), langCols.id, { fill: zebra }),
        cell(para(txt(l.element || "—", { bold: true, size: 14 })), langCols.el, { fill: zebra }),
        cell(para(txt(l.issue || "—", { size: 14 })), langCols.issue, { fill: zebra }),
        cell(para(txt(l.fix || "—", { size: 14 })), langCols.fix, { fill: zebra }),
      ],
    });
  });
  const langTable = new Table({
    width: { size: TOTAL_WIDTH, type: WidthType.DXA },
    columnWidths: [langCols.id, langCols.el, langCols.issue, langCols.fix],
    rows: [lHeader, ...lRows],
  });

  // Count chips
  const chipCell = (label: string, count: number, color: string, width: number) => cell(
    para([
      txt(count + " ", { bold: true, color: C.white, size: 18 }),
      txt(label, { color: C.white, size: 14 }),
    ], { alignment: AlignmentType.CENTER }),
    width,
    { fill: color, margins: { top: 80, bottom: 80, left: 60, right: 60 } },
  );

  const chipsTable = new Table({
    width: { size: TOTAL_WIDTH, type: WidthType.DXA },
    columnWidths: [2200, 2200, 2200, 7800],
    rows: [new TableRow({
      children: [
        chipCell("CRITICAL", counts.Critical, C.critical, 2200),
        chipCell("MAJOR", counts.Major, C.major, 2200),
        chipCell("MINOR", counts.Minor, C.minor, 2200),
        cell(
          para([
            txt("Nutrition math: ", { bold: true, size: 16 }),
            txt(`${counts.Critical + counts.Major + counts.Minor} findings total    `, { size: 16 }),
            txt(`Base check: ${r.base_check || "—"}`, { bold: true, color: C.pass, size: 16 }),
          ], { alignment: AlignmentType.CENTER }),
          7800,
          { margins: { top: 80, bottom: 80, left: 100, right: 100 } },
        ),
      ],
    })],
  });

  const langSection: (Paragraph | Table)[] = r.language.length > 0 ? [
    para(txt(""), { spacing: { before: 200, after: 80 } }),
    para([
      txt("LANGUAGE REVIEW  ", { bold: true, size: 18, color: C.crimson }),
      txt("— informational only; not part of the CFR findings", { italics: true, color: C.textGray, size: 14 }),
    ], { spacing: { after: 60 } }),
    langTable,
  ] : [];

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: "landscape" as any },
          margin: { top: 720, right: 720, bottom: 540, left: 720 },
        },
      },
      children: [
        headerBar,
        para(txt(""), { spacing: { after: 80 } }),

        // Metadata
        para([
          txt("Product: ", { bold: true, size: 18 }),
          txt(`${r.product}    `, { size: 18 }),
          txt("Brand: ", { bold: true, size: 18 }),
          txt(`${r.brand}    `, { size: 18 }),
          txt("Reviewed: ", { bold: true, size: 18 }),
          txt(`${r.reviewed_date}    `, { size: 18 }),
          txt("Reviewer: ", { bold: true, size: 18 }),
          txt("Pharmvista QA", { size: 18 }),
        ], { spacing: { after: 60 } }),

        // Scope
        para([
          txt("Scope: ", { bold: true, size: 18 }),
          txt("21 CFR 101.36  ·  101.9(c)/(g) math  ·  101.93  ·  101.105  ·  101.17  ·  Part 111 (incl. §111.70)  ·  Part 190", { size: 18 }),
        ], { spacing: { after: 100 } }),

        // Count chips
        chipsTable,
        para(txt(""), { spacing: { after: 60 } }),

        // Inputs banner
        para([
          txt("Inputs: ", { bold: true, italics: true, color: C.pass, size: 16 }),
          txt("Gummy weight 3.0 g (default)  ·  reviewer Pharmvista QA.", { italics: true, color: C.textGray, size: 16 }),
        ], { spacing: { after: 200 } }),

        // CFR FINDINGS section + count chip in heading
        para([
          txt("CFR FINDINGS  ", { bold: true, size: 18, color: C.crimson }),
          txt(`(${r.findings.length})`, { bold: true, size: 16, color: C.textGray }),
        ], { spacing: { after: 60 } }),

        findingsTable,

        ...langSection,

        // Headline
        para(txt(""), { spacing: { before: 180 } }),
        para([
          txt("Headline: ", { bold: true, italics: true, size: 17, color: C.crimson }),
          txt(r.headline || "—", { italics: true, size: 17 }),
        ], { spacing: { after: 60 } }),

        // Footer
        para([
          txt("Base check: ", { bold: true, color: C.pass, size: 14 }),
          txt(`${r.base_check || "—"}    `, { size: 14, color: C.textGray }),
          txt("NDI screen: ", { bold: true, color: C.major, size: 14 }),
          txt(r.ndi_screen || "—", { size: 14, color: C.textGray }),
        ], { spacing: { after: 40 } }),
        para(txt(
          "Scope: 21 CFR 101.36 · 101.9(c)/(g) · 101.93 · 101.105 · 101.17 · Part 111 · Part 190.  Not an FDA endorsement.",
          { size: 13, color: C.textGray, italics: true },
        )),
      ],
    }],
  });

  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

function countSev(findings: Finding[]) {
  return findings.reduce((acc, f) => {
    acc[f.severity]++;
    return acc;
  }, { Critical: 0, Major: 0, Minor: 0 } as Record<Finding["severity"], number>);
}
