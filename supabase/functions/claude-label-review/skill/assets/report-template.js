// =============================================================================
// REPORT TEMPLATE — Pharmvista Label CFR Compliance Review
// =============================================================================
//
// Reference implementation matching /assets/report-structure.md exactly.
// Produces a landscape US Letter .docx with:
//   - Crimson Pharmvista header bar
//   - Colored count chips (Critical red / Major amber / Minor gray)
//   - Inputs banner (green if user-confirmed, amber if defaulted)
//   - Findings table with colored severity badge cells + zebra stripes
//   - Math lines in Consolas monospace
//   - Language Review subtable
//   - Crimson "Headline:" + footer with semantic colors
//
// HOW TO USE THIS TEMPLATE FOR A NEW REVIEW:
//   1. Copy this file to /home/claude/build_report.js
//   2. Edit the `findings` array (line ~50) — one object per CFR finding
//   3. Edit the `langItems` array — one object per language item
//   4. Edit the metadata constants in the document body (Product, Brand,
//      Reviewed date, Reviewer, Type, Scope, Inputs banner)
//   5. Update the count chips ("1", "9", "2") and nutrition math tally
//   6. Run: `node build_report.js`
//   7. Validate: `python3 /mnt/skills/public/docx/scripts/office/validate.py <output>`
//   8. Convert + check page count: soffice + pdfinfo
//
// FINDING OBJECT SHAPE:
//   { id: "C1" | "M1" | "m1",   // C# Critical, M# Major, m# Minor
//     sev: "Critical" | "Major" | "Minor",
//     el: "Short element label",
//     find: "One-sentence statement of the issue",
//     cite: "21 CFR ...",
//     fix: ["Line 1 (prose or math)", "Line 2", ...]   // multi-line array
//   }
//
// MATH LINE DETECTION: Lines containing =, ÷, ×, →, or starting with •
// or leading-whitespace+digit auto-render in Consolas. Indent math lines
// with leading spaces to trigger monospace formatting.
//
// HARD CONSTRAINTS (per SKILL.md):
//   - Ask the user for gummy weight, base, reviewer, type BEFORE building
//   - Pharmvista default if user waives: 3.0 g per gummy
//   - Every numerical fix must show formula + inputs + result + rounding
//   - When values are inconsistent, present BOTH scenarios — don't pick a winner
//   - Run serving size verification FIRST in the math pass
// =============================================================================

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, BorderStyle, WidthType, ShadingType,
        PageOrientation, HeightRule } = require('docx');
const fs = require('fs');

// =============================================================================
// SKILL VERSION — bump this when the skill is updated; appears in the crimson
// title bar of every report so users can verify which version produced the output
// =============================================================================
const SKILL_VERSION = "v2.1";

// ============ COLOR PALETTE ============
const C = {
  crimson:   "B91C1C",  // brand bar
  critical:  "DC2626",  // critical badge
  major:     "D97706",  // major badge
  minor:     "6B7280",  // minor badge
  pass:      "059669",  // pass green
  headerDark:"1F2937",  // table header / strong text
  zebra:     "F9FAFB",  // alternating row
  borderLt:  "D1D5DB",  // light gray borders
  textGray:  "6B7280",  // muted text (citations, footer)
  white:     "FFFFFF",
  black:     "1F2937"
};

// ============ BORDERS ============
const lightBorder = { style: BorderStyle.SINGLE, size: 3, color: C.borderLt };
const cellBorders = { top: lightBorder, bottom: lightBorder, left: lightBorder, right: lightBorder };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const cellMargins = { top: 80, bottom: 80, left: 100, right: 100 };
const tightMargins = { top: 50, bottom: 50, left: 100, right: 100 };

// ============ CELL HELPERS ============
const txt = (text, opts = {}) => new TextRun({
  text,
  size: opts.size || 16,
  bold: opts.bold || false,
  italics: opts.italics || false,
  color: opts.color || C.black,
  font: opts.font || "Calibri"
});

const para = (children, opts = {}) => new Paragraph({
  children: Array.isArray(children) ? children : [children],
  alignment: opts.alignment,
  spacing: opts.spacing || { after: 0 }
});

const cell = (content, width, opts = {}) => {
  const children = Array.isArray(content) ? content : [content];
  return new TableCell({
    borders: opts.noBorders ? noBorders : cellBorders,
    width: { size: width, type: WidthType.DXA },
    margins: opts.margins || tightMargins,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    verticalAlign: opts.vAlign || "center",
    children
  });
};

// ============ FINDINGS DATA ============
const findings = [
  { id: "C1", sev: "Critical", el: "Calories ↔ Total Carb inconsistency",
    find: "Calories (30) and Total Carbohydrate (12 g) cannot both be correct. Calorie equation: (Carb × 4) + (Protein × 4) + (Fat × 9) = Calories. With 12 g carb, 0 g protein, 0 g fat → 12 × 4 = 48 cal, not 30. One or both values are wrong.",
    cite: "21 CFR 101.9(c)(1) and (c)(6)",
    fix: [
      "Pull the batch sheet and pick the scenario that matches actual formula:",
      "• If Total Carb 12 g is correct → Calories = 12 × 4 = 48 → round to 50.",
      "• If Calories 30 is correct → Total Carb = 30 ÷ 4 = 7.5 g → round to 8 g.",
      "Update both values so: Calories = (Total Carb × 4)."
    ] },

  { id: "M1", sev: "Major", el: "Serving size physically impossible",
    find: "3 gummies × 3.0 g = 9.0 g serving weight, but Total Carb alone declares 12 g. Cannot exceed serving weight. This compounds with C1.",
    cite: "21 CFR 101.9(b) and (c)(6)",
    fix: [
      "At user-confirmed 3.0 g/gummy: serving = 9.0 g.",
      "Total Carb must be ≤ 9.0 g (realistically ≤ 7 g, since water + actives also occupy mass).",
      "If Total Carb is genuinely 12 g, gummies would need to be ≥ 4 g each — re-verify against batch sheet."
    ] },

  { id: "M2", sev: "Major", el: "Sodium row order",
    find: "Sodium is listed after Added Sugars. It must come before Total Carbohydrate.",
    cite: "21 CFR 101.36(b)(2)(i)",
    fix: ["Move the Sodium row up so it sits directly under Calories, above Total Carbohydrate. No math — purely a row reorder."] },

  { id: "M3", sev: "Major", el: "Sodium value",
    find: "Sodium says 0 mg, but trisodium citrate is in the formula and contains sodium. 0 mg is impossible.",
    cite: "21 CFR 101.9(c)(4)",
    fix: [
      "Trisodium citrate = 26.7% sodium by weight. Typical pectin gummy uses 0.5–1.5% TSC.",
      "Example at 1% TSC, 3 × 3.0 g = 9.0 g serving:",
      "  Sodium = 9000 × 0.01 × 0.267 = 24 mg → round to 25 mg.",
      "Get exact TSC % from batch sheet, repeat the math, round to nearest 5 mg."
    ] },

  { id: "M4", sev: "Major", el: "Zinc declaration",
    find: "\"Zinc Citrate 7.5 mg **\" is wrong two ways: Zinc has a DV (11 mg) so ** is invalid, and the panel must show elemental Zn — not the citrate compound weight.",
    cite: "21 CFR 101.36(b)(2)(i)–(iii)",
    fix: [
      "Elemental Zn = compound × 0.31:",
      "  7.5 × 0.31 = 2.3 mg elemental Zn.",
      "%DV = 2.3 ÷ 11 × 100 = 20.9% → round to 20% (nearest 5%).",
      "Restate row as: \"Zinc (as zinc citrate) 2 mg, 20%\"."
    ] },

  { id: "M5", sev: "Major", el: "Botanical plant parts missing",
    find: "Every botanical active must list the part of the plant. Missing for 8 ingredients: Blood Orange, Garcinia, Resveratrol, Raspberry Ketone, Inulin, Turmeric, Berberine, Green Tea.",
    cite: "21 CFR 101.36(b)(2)(iii)",
    fix: [
      "Add plant part to each. No math — text edits only:",
      "Blood Orange (fruit), Garcinia Cambogia (rind), Resveratrol (Japanese knotweed root),",
      "Raspberry Ketone (fruit), Inulin (chicory root), Turmeric (rhizome),",
      "Berberine HCl (root + name source plant), Green Tea (leaf)."
    ] },

  { id: "M6", sev: "Major", el: "Mineral order",
    find: "Zinc Citrate is at the bottom of the actives list. Vitamins and minerals must appear above botanicals and other dietary ingredients.",
    cite: "21 CFR 101.36(b)(2)(i)(A)",
    fix: ["Move the Zinc row to the top of the actives section, above Blood Orange Extract. No math — purely a row reorder."] },

  { id: "M7", sev: "Major", el: "Rounding — 3 values",
    find: "Three values use invalid rounding: \"<1.5 g Added Sugars\" must be in 1 g increments; \"1.5 g Dietary Fiber\" must be in 1 g increments; \"<3% DV\" must round to nearest 2% under 10%.",
    cite: "21 CFR 101.9(c)(6) / (d)(7)(ii)",
    fix: [
      "Apply rounding rules:",
      "• Added Sugars: see M8 → 3 g.",
      "• Dietary Fiber: 1.5 g → 2 g (nearest 1 g, half-up).",
      "• Added Sugars %DV: 3 ÷ 50 × 100 = 6%."
    ] },

  { id: "M8", sev: "Major", el: "Added Sugars value",
    find: "Total Sugars says 3 g but Added Sugars says <1.5 g — impossible. Organic cane sugar in Other Ingredients delivers ~1 g per gummy. With 3 gummies/serving, cane sugar alone = ~3 g. All of it is added sugar.",
    cite: "21 CFR 101.9(c)(6)(iii)",
    fix: [
      "Pharmvista cane sugar rule:",
      "  Min added sugar = 1 g × 3 gummies = 3 g (before tapioca syrup).",
      "Restate Added Sugars to 3 g (or higher per batch sheet).",
      "%DV = 3 ÷ 50 × 100 = 6%."
    ] },

  { id: "M9", sev: "Major", el: "NDI status",
    find: "Raspberry Ketone (99%) and Resveratrol (98%) at these purities are almost always synthetic. Synthetic versions may require NDI notification.",
    cite: "21 CFR Part 190",
    fix: ["Request source documentation from the supplier (natural vs. synthetic) for both. If synthetic, confirm NDI notification has been filed with FDA."] },

  { id: "m1", sev: "Minor", el: "Footnote symbol",
    find: "Label uses \"**\" for \"Daily Value not established.\" Convention is \"†\".",
    cite: "21 CFR 101.36(b)(3)(iii)",
    fix: ["Replace \"**\" with \"†\" throughout the panel and footnote."] },

  { id: "m2", sev: "Minor", el: "Standardization verification",
    find: "Four standardization claims need master spec verification: Garcinia (95% HCA), Resveratrol (98%), Raspberry Ketone (99%), Turmeric (4:1).",
    cite: "21 CFR 111.70(d)",
    fix: ["Pull CoAs for each raw material and confirm claimed standardization matches the master spec before printing."] }
];

const langItems = [
  { id: "L1", el: "GMP certification text",
    issue: "\"MANUFACTURED IN A GMP CERTIFIED FACIL TI Y\" — misspelled.",
    fix: "Correct to \"FACILITY\"." },
  { id: "L2", el: "Berberine ingredient name",
    issue: "\"Berberine HCI\" uses uppercase I; should be lowercase L (HCl).",
    fix: "Change to \"Berberine HCl Extract\"." },
  { id: "L3", el: "Trisodium citrate spelling",
    issue: "Conventional spelling is \"Trisodium Citrate\" (one word).",
    fix: "Combine into \"Trisodium Citrate\"." }
];

// ============ LANDSCAPE GEOMETRY ============
// Page width 15840 - 2*720 margins = 14400 DXA
const TOTAL_WIDTH = 14400;
const cols = {
  id: 460,
  sev: 920,
  el: 1700,
  find: 4000,
  cite: 1620,
  fix: 5700
};

// ============ HEADER BAR (crimson) ============
const headerBar = new Table({
  width: { size: TOTAL_WIDTH, type: WidthType.DXA },
  columnWidths: [TOTAL_WIDTH],
  rows: [new TableRow({
    children: [cell(
      para([txt("LABEL CFR COMPLIANCE REVIEW  ", { bold: true, color: C.white, size: 28 }),
            txt("·  Pharmvista QA  ", { color: C.white, size: 20, italics: true }),
            txt("·  Skill " + SKILL_VERSION, { color: C.white, size: 18, italics: true })]),
      TOTAL_WIDTH,
      { fill: C.crimson, noBorders: true, margins: { top: 180, bottom: 180, left: 240, right: 240 } }
    )]
  })]
});

// ============ FINDINGS TABLE ============
const fHeader = new TableRow({
  tableHeader: true,
  children: [
    cell(para(txt("#", { bold: true, color: C.white, size: 16 })),     cols.id,   { fill: C.headerDark }),
    cell(para(txt("Severity", { bold: true, color: C.white, size: 16 })),  cols.sev,  { fill: C.headerDark }),
    cell(para(txt("Element", { bold: true, color: C.white, size: 16 })),   cols.el,   { fill: C.headerDark }),
    cell(para(txt("Finding", { bold: true, color: C.white, size: 16 })),   cols.find, { fill: C.headerDark }),
    cell(para(txt("Citation", { bold: true, color: C.white, size: 16 })),  cols.cite, { fill: C.headerDark }),
    cell(para(txt("Recommended Fix (with math)", { bold: true, color: C.white, size: 16 })), cols.fix, { fill: C.headerDark })
  ]
});

const sevColor = (s) => s === "Critical" ? C.critical : s === "Major" ? C.major : C.minor;

// Math line detection: if a line starts with whitespace+digit, contains "=", or starts with "•"/digit-formula, treat as monospace
const isMathLine = (line) => {
  return /[=÷×]|^\s*•|^\s+\d|→/.test(line);
};

const fixParas = (fixLines) => fixLines.map(line => {
  const mono = isMathLine(line);
  return new Paragraph({
    children: [txt(line, { size: 14, font: mono ? "Consolas" : "Calibri", color: C.black })],
    spacing: { after: 20, line: 220 }
  });
});

const fRows = findings.map((f, idx) => {
  const zebra = idx % 2 === 1 ? C.zebra : C.white;
  return new TableRow({
    cantSplit: true,
    children: [
      cell(para(txt(f.id, { bold: true, size: 14 })), cols.id, { fill: zebra }),
      // Severity badge
      cell(
        para(txt(f.sev, { bold: true, color: C.white, size: 14 }), { alignment: AlignmentType.CENTER }),
        cols.sev,
        { fill: sevColor(f.sev) }
      ),
      cell(para(txt(f.el, { bold: true, size: 14 })), cols.el, { fill: zebra }),
      cell(para(txt(f.find, { size: 14 })), cols.find, { fill: zebra }),
      cell(para(txt(f.cite, { size: 13, color: C.textGray })), cols.cite, { fill: zebra }),
      cell(fixParas(f.fix), cols.fix, { fill: zebra })
    ]
  });
});

const findingsTable = new Table({
  width: { size: TOTAL_WIDTH, type: WidthType.DXA },
  columnWidths: [cols.id, cols.sev, cols.el, cols.find, cols.cite, cols.fix],
  rows: [fHeader, ...fRows]
});

// ============ LANGUAGE TABLE ============
const langCols = { id: 460, el: 2000, issue: 5970, fix: 5970 };

const lHeader = new TableRow({
  tableHeader: true,
  children: [
    cell(para(txt("#", { bold: true, color: C.white, size: 16 })),      langCols.id,    { fill: C.headerDark }),
    cell(para(txt("Element", { bold: true, color: C.white, size: 16 })),    langCols.el,    { fill: C.headerDark }),
    cell(para(txt("Issue", { bold: true, color: C.white, size: 16 })),      langCols.issue, { fill: C.headerDark }),
    cell(para(txt("Recommended Fix", { bold: true, color: C.white, size: 16 })), langCols.fix, { fill: C.headerDark })
  ]
});

const lRows = langItems.map((l, idx) => {
  const zebra = idx % 2 === 1 ? C.zebra : C.white;
  return new TableRow({
    cantSplit: true,
    children: [
      cell(para(txt(l.id, { bold: true, size: 14 })), langCols.id, { fill: zebra }),
      cell(para(txt(l.el, { bold: true, size: 14 })), langCols.el, { fill: zebra }),
      cell(para(txt(l.issue, { size: 14 })), langCols.issue, { fill: zebra }),
      cell(para(txt(l.fix, { size: 14 })), langCols.fix, { fill: zebra })
    ]
  });
});

const langTable = new Table({
  width: { size: TOTAL_WIDTH, type: WidthType.DXA },
  columnWidths: [langCols.id, langCols.el, langCols.issue, langCols.fix],
  rows: [lHeader, ...lRows]
});

// ============ COUNT CHIPS (header summary) ============
const chipCell = (label, count, color, width) => cell(
  para([
    txt(count + " ", { bold: true, color: C.white, size: 18 }),
    txt(label, { color: C.white, size: 14 })
  ], { alignment: AlignmentType.CENTER }),
  width,
  { fill: color, margins: { top: 80, bottom: 80, left: 60, right: 60 } }
);

const chipsTable = new Table({
  width: { size: TOTAL_WIDTH, type: WidthType.DXA },
  columnWidths: [2200, 2200, 2200, 7800],
  rows: [new TableRow({
    children: [
      chipCell("CRITICAL", "1", C.critical, 2200),
      chipCell("MAJOR", "9", C.major, 2200),
      chipCell("MINOR", "2", C.minor, 2200),
      cell(
        para([
          txt("Nutrition math: ", { bold: true, size: 16 }),
          txt("2 LIKELY OK  ·  2 FLAG  ·  5 ERROR    ", { size: 16 }),
          txt("Base check: PASS", { bold: true, color: C.pass, size: 16 })
        ], { alignment: AlignmentType.CENTER }),
        7800,
        { margins: { top: 80, bottom: 80, left: 100, right: 100 } }
      )
    ]
  })]
});

// ============ DOCUMENT ============
const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE },
        margin: { top: 720, right: 720, bottom: 540, left: 720 }
      }
    },
    children: [
      // Crimson title bar
      headerBar,
      para(txt(""), { spacing: { after: 80 } }),

      // Metadata block
      para([
        txt("Product: ", { bold: true, size: 18 }),
        txt("Lunakai PRO GLP-1 Support (90 Gummies)    ", { size: 18 }),
        txt("Brand: ", { bold: true, size: 18 }),
        txt("Lunakai    ", { size: 18 }),
        txt("Reviewed: ", { bold: true, size: 18 }),
        txt("2026-05-22    ", { size: 18 }),
        txt("Reviewer: ", { bold: true, size: 18 }),
        txt("Gotham · Pharmvista QA", { size: 18 })
      ], { spacing: { after: 60 } }),

      para([
        txt("Scope: ", { bold: true, size: 18 }),
        txt("21 CFR 101.36  ·  101.9(c)/(g) math  ·  101.93  ·  101.105  ·  101.17  ·  Part 111 (incl. §111.70)  ·  Part 190", { size: 18 })
      ], { spacing: { after: 100 } }),

      // Count chips
      chipsTable,
      para(txt(""), { spacing: { after: 60 } }),

      // Assumptions banner
      para([
        txt("Inputs: ", { bold: true, italics: true, color: C.pass, size: 16 }),
        txt("Gummy weight 3.0 g (user-confirmed)  ·  reviewer Gotham · Pharmvista QA.", { italics: true, color: C.textGray, size: 16 })
      ], { spacing: { after: 200 } }),

      // CFR Findings section label + divider
      para(txt("CFR FINDINGS", { bold: true, size: 18, color: C.crimson }), { spacing: { after: 60 } }),

      findingsTable,

      // Section divider for Language Review
      para(txt(""), { spacing: { before: 200, after: 80 } }),
      para([
        txt("LANGUAGE REVIEW  ", { bold: true, size: 18, color: C.crimson }),
        txt("— informational only; not part of the CFR findings", { italics: true, color: C.textGray, size: 14 })
      ], { spacing: { after: 60 } }),

      langTable,

      // Headline + footer
      para(txt(""), { spacing: { before: 180 } }),
      para([
        txt("Headline: ", { bold: true, italics: true, size: 17, color: C.crimson }),
        txt("Panel needs a full rebuild from the batch sheet. C1 (Calories ↔ Total Carb) and M1 (serving weight physically impossible) compound — neither can be fixed in isolation. Reconcile the formula first, then fix everything else.", { italics: true, size: 17 })
      ], { spacing: { after: 60 } }),
      para([
        txt("Base check: ", { bold: true, color: C.pass, size: 14 }),
        txt("PASS (all 8 gummy excipients present in Other Ingredients).    ", { size: 14, color: C.textGray }),
        txt("NDI screen: ", { bold: true, color: C.major, size: 14 }),
        txt("Verify Raspberry Ketone (99%) and Resveratrol (98%) — likely synthetic.", { size: 14, color: C.textGray })
      ], { spacing: { after: 40 } }),
      para(txt("Scope: 21 CFR 101.36 · 101.9(c)/(g) · 101.93 · 101.105 · 101.17 · Part 111 · Part 190.  Not an FDA endorsement.",
              { size: 13, color: C.textGray, italics: true }))
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = "/mnt/user-data/outputs/lunakai-pro-glp1-label-review-2026-05-22.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("Wrote:", outPath);
});
