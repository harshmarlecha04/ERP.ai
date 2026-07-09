# Report Structure — .docx Deliverable

**Soft target: 1 page portrait. 2 pages landscape acceptable when every numerical fix shows worked-out math.** Math in the Recommended Fix column makes cells multi-line and grows the table — landscape is the natural shape for math-rich reports. Drop the lowest-impact Minors before sacrificing math. Math is the deliverable; never silently shorten it to hit one page.

## Filename

`/mnt/user-data/outputs/<product-slug>-label-review-<YYYY-MM-DD>.docx`

Use a kebab-case slug for the product name. Example: `lunakai-pro-glp1-label-review-2026-05-22.docx`.

## Reference implementation

A working build script that produces the report exactly as specified below lives at:

```
/mnt/skills/user/supplement-label-review/assets/report-template.js
```

For new reviews, copy the template to `/home/claude/build_report.js`, swap the `findings` and `langItems` arrays plus the metadata constants at the top, and run it. Do not rewrite from scratch each time.

---

## Page geometry (landscape — default for math-rich reports)

- Page size: US Letter, landscape (15840 × 12240 DXA)
- Margins: top 720, right 720, bottom 540, left 720 (DXA; 1440 DXA = 1 inch)
- Total content width: 14400 DXA
- Font: Calibri throughout (universal availability). Math lines in Recommended Fix use Consolas.

## Color palette (Pharmvista-aligned, hex)

| Token | Hex | Use |
|---|---|---|
| crimson    | `B91C1C` | Brand bar, section labels, headline "Headline:" prefix |
| critical   | `DC2626` | Critical severity badge background + count chip |
| major      | `D97706` | Major severity badge background + count chip |
| minor      | `6B7280` | Minor severity badge background + count chip |
| pass       | `059669` | "Base check: PASS", user-confirmed inputs banner |
| headerDark | `1F2937` | Table header row background, strong text |
| zebra      | `F9FAFB` | Alternating body row stripe |
| borderLt   | `D1D5DB` | All cell borders |
| textGray   | `6B7280` | Citations, footer, italic disclaimers |
| white      | `FFFFFF` | Text on dark backgrounds |
| black      | `1F2937` | Default body text |

## Block-by-block layout

### Block 1 — Crimson title bar (full-width 1-row table)

- Single TableRow, single TableCell, full content width (14400 DXA)
- No borders
- Fill: crimson `B91C1C`
- Margins: top 180, bottom 180, left 240, right 240
- Content (three TextRuns on one line):
  - `"LABEL CFR COMPLIANCE REVIEW  "` — white bold 28pt half (14pt actual)
  - `"·  Pharmvista QA  "` — white italic 20pt half (10pt actual)
  - `"·  Skill " + SKILL_VERSION` — white italic 18pt half (9pt actual)
- **Version stamp is required.** The `SKILL_VERSION` constant lives at the top of `report-template.js`; bump it whenever the skill changes. This marker is how users verify which skill version produced the report. If the title bar does not show a version stamp, the environment is using a pre-v2.0 (uninstrumented) build.
- **Do not** use HeightRule.EXACT — let the row size to content; fixed heights clip the title at the top

### Block 2 — Metadata row (single Paragraph)

Inline labels (bold) and values, separated by "    " (4 spaces). Size 18pt half = 9pt.

```
Product: <name>    Brand: <brand>    Reviewed: <YYYY-MM-DD>    Reviewer: <name>
```

**Do NOT include a "Type:" field.** As of v2.1, review type is not asked and not displayed; the report always uses a professional/client-facing tone.

### Block 3 — Scope row (single Paragraph)

```
Scope: 21 CFR 101.36  ·  101.9(c)/(g) math  ·  101.93  ·  101.105  ·  101.17  ·  Part 111 (incl. §111.70)  ·  Part 190
```

### Block 4 — Count chips bar (4-column 1-row table)

Column widths: `[2200, 2200, 2200, 7800]`. Three colored chips (Critical/Major/Minor) plus one wide cell on the right.

Each chip cell:
- Fill: critical/major/minor color per chip
- Margins: top 80, bottom 80, left 60, right 60
- Content: `"<count> "` in white bold 18pt, then `"<LABEL>"` in white 14pt, center-aligned

Right cell content:
- `"Nutrition math: "` bold 16pt
- `"N LIKELY OK  ·  N FLAG  ·  N ERROR    "` 16pt
- `"Base check: PASS"` bold 16pt in pass green

### Block 5 — Inputs / Assumptions banner (single Paragraph)

- **Green prefix** `"Inputs: "` bold italic if all inputs are user-confirmed
- **Amber prefix** `"⚠ Defaults applied (not user-confirmed): "` bold italic if any default was used
- Followed by italic gray text listing only: **gummy weight** and **reviewer**
- **Do NOT include base type or review type** as of v2.1 — base is inferred from the label's "Other Ingredients" line; review tone is always professional/client-facing
- If defaults were used, append: "Confirm or override before issuing externally."

Example (user-confirmed): `Inputs: Gummy weight 3.0 g (user-confirmed)  ·  reviewer Gotham · Pharmvista QA.`
Example (defaulted): `⚠ Defaults applied (not user-confirmed): Gummy weight 3.0 g  ·  reviewer Pharmvista QA. Confirm or override before issuing externally.`

### Block 6 — "CFR FINDINGS" section label

Single Paragraph, crimson bold 18pt half-points (9pt).

### Block 7 — Findings table

Column widths (DXA, sum to 14400):

| Column | Width | Notes |
|---|---|---|
| #          | 460  | Row ID (C1, M1, m1) |
| Severity   | 920  | Colored badge cell |
| Element    | 1700 | Short label, bold |
| Finding    | 4000 | One-sentence statement of the issue |
| Citation   | 1620 | CFR reference, muted gray text |
| Recommended Fix | 5700 | Multi-line allowed; math in Consolas |

Header row:
- Fill: `headerDark`
- Text: white bold 16pt half (8pt) for all columns
- `tableHeader: true` so it repeats on page break

Body rows:
- `cantSplit: true` on every row — prevents rows breaking across pages
- Zebra: `idx % 2 === 1` → fill `zebra`, else `white`
- All cells size 14pt half (7pt)
- Severity cell:
  - Fill: critical/major/minor per severity
  - Text: severity name in white bold, center-aligned
- Citation cell: size 13pt half (6.5pt), color `textGray`
- Fix cell: multi-line, each line is its own Paragraph. Math lines use Consolas font; prose lines use Calibri. Detection regex: `/[=÷×→]|^\s*•|^\s+\d/`. Math line spacing: `{ after: 20, line: 220 }`.

### Block 8 — "LANGUAGE REVIEW" section label

Crimson bold 18pt half, followed by italic gray subtitle `" — informational only; not part of the CFR findings"` 14pt half.

### Block 9 — Language table

Column widths (DXA, sum to 14400):

| Column | Width |
|---|---|
| #       | 460  |
| Element | 2000 |
| Issue   | 5970 |
| Fix     | 5970 |

Same header/zebra/cantSplit treatment as findings table. No severity badges in this table — language items are informational only.

### Block 10 — Headline (single Paragraph)

- `"Headline: "` in crimson bold italic 17pt half
- Followed by the one-sentence summary in black italic 17pt half

### Block 11 — Footer (2 Paragraphs)

Paragraph 1:
- `"Base check: "` bold pass-green 14pt half + `"PASS (all 8 gummy excipients present in Other Ingredients).    "` gray 14pt half
- `"NDI screen: "` bold major-amber 14pt half + summary in gray 14pt half

Paragraph 2:
- `"Scope: 21 CFR 101.36 · 101.9(c)/(g) · 101.93 · 101.105 · 101.17 · Part 111 · Part 190.  Not an FDA endorsement."` gray italic 13pt half

---

## Recommended Fix column — math formatting rules

When a Recommended Fix involves a calculation:

1. Each step on its own line
2. Lead with the formula in words ("Elemental Zn = compound × elemental fraction:")
3. Show the worked example with actual numbers ("7.5 × 0.31 = 2.3 mg elemental Zn.")
4. Show the rounding step ("→ round to 20% (nearest 5%).")
5. End with the action ("Restate row as: \"Zinc (as zinc citrate) 2 mg, 20%\".")

When the math is internally inconsistent (e.g., Calories vs Total Carb), present BOTH scenarios as bulleted alternatives:

```
Pull the batch sheet and pick the scenario that matches actual formula:
• If Total Carb 12 g is correct → Calories = 12 × 4 = 48 → round to 50.
• If Calories 30 is correct → Total Carb = 30 ÷ 4 = 7.5 g → round to 8 g.
Update both values so: Calories = (Total Carb × 4).
```

Math lines (anything containing `=`, `÷`, `×`, `→`, or starting with `•` or whitespace+digit) render in Consolas; prose lines render in Calibri. Both at the same point size.

---

## Brevity rules

- Each "Finding" cell is **one sentence** stating the issue. Don't editorialize.
- "Recommended Fix" can be multi-line for math content, but each prose line is also one sentence.
- Use abbreviations where unambiguous (%DV, NDI, S/F = structure/function).
- No appendix, no executive summary, no section-by-section review.

---

## Inline chat summary (separate from the .docx)

The chat summary may be longer and includes:
- Overall counts (Critical / Major / Minor) and nutrition math tally (VERIFIED / LIKELY OK / FLAG / ERROR).
- Top 3-5 must-fix items with 1-2 sentence context each.
- Brief discussion of the headline issue.
- Pointer to the attached .docx.
- Any dropped Minors noted.

The .docx is the official deliverable; the chat summary is the briefing.

---

## Anti-patterns

- No black tables. No 1pt black borders. No Times New Roman.
- No emoji icons inside table cells (consume horizontal space, render unreliably in Word/Google Docs). Emoji and warning symbols (`⚠`) only allowed in the Inputs/Assumptions banner.
- No clip art, no logos in the body. The crimson header bar carries the brand.
- No multi-color backgrounds for non-severity cells.
- No `HeightRule.EXACT` on the title bar (clips content).
- No silent defaults — every defaulted value flagged amber in the Inputs banner.
