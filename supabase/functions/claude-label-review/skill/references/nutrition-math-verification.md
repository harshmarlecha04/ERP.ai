# Nutrition Math Verification — 21 CFR 101.36(b) + 101.9(c)/(g)

This is the math-verification pass for the Supplement Facts panel. Load this in addition to `cfr-101-36-supplement-facts.md` whenever you need to verify whether the declared nutrition values (calories, total carbohydrate, total sugars, added sugars, sodium, protein) are mathematically accurate — not just formatted correctly.

The format pass (cfr-101-36) asks "is the panel laid out per CFR?" This pass asks "are the numbers themselves right?"

## When to run this pass

Always run for gummy label reviews. Optional but useful for tablets/capsules/powders. Skip only if the user explicitly opts out.

## Inputs needed from the user — ASK, DO NOT ASSUME

Before running the math pass, the assistant MUST ask the user this one question in chat (using ask_user_input_v0 or plain prose). Do not silently default. The user must either answer or explicitly waive for the default to apply:

1. **Weight per gummy (grams)?** — Pharmvista default: 3.0 g.

**Do NOT ask** about the base type (pectin vs carrageenan). Infer it from the "Other Ingredients" line on the label:
- If "pectin" appears → use pectin base benchmarks
- If "carrageenan" appears → use carrageenan base benchmarks
- If both or neither appears → default to pectin

Optional follow-ups if relevant:
- Formula / batch sheet (if available, switch to formula-based verification)
- COA from a previous production run

**Defaults are a last resort, not a first choice.** If the user explicitly waives or cannot provide an answer (e.g., a competitor label or M&A due-diligence label where the formula isn't accessible), then assume **3.0 g per gummy** (Pharmvista standard) and surface the assumption prominently in the report's Assumptions line. Never let an assumption hide.

---

## 1. Internal consistency checks (no formula needed)

These checks use ONLY values printed on the label. They are **definitive** — a fail here is a hard math error, not a guess.

### 1.1 Serving size verification — calculate, don't trust the label

Do this FIRST in every math pass. Without a verified serving size, all downstream checks are unreliable.

**Check A — Count math:**
```
gummies per serving × servings per container = total count on PDP
```
3 gummies/serving × 30 servings = 90 gummies. Must match the count on the front panel.

**Check B — Serving weight math:**
```
gummies per serving × weight per gummy = serving weight (g)
```
3 gummies × 3.0 g = 9.0 g serving (using the Pharmvista 3.0 g default). Confirm gummy weight with the user before running this — it's the first question asked under Inputs.

**Check C — Realistic serving range:**
Typical gummy serving sizes are 5–12 g (2–4 gummies at 2.5–4 g each). Outside this range = flag for review.

**Check D — Serving weight ≥ declared components:**
```
serving weight (g) ≥ Total Carb (g) + Protein (g) + Fat (g) + Fiber (g) + Active solids (g)
```
The serving weight must physically accommodate the declared content. If declared Total Carb alone (e.g., 12 g) exceeds calculated serving weight (e.g., 7.5 g from 3 × 2.5 g), the math is impossible — flag immediately.

### 1.2 Calorie equation

Calories declared on the label must equal the macro breakdown:

```
Calories = (Total Carbohydrate g × 4) + (Protein g × 4) + (Total Fat g × 9)
```

- Acceptable variance: ±5 calories (rounding artifact).
- If declared calories deviate more than ±5 from the equation result, flag.

**Example fail:** Label declares "5 calories, 4 g total carbs, 0 g protein, 0 g fat." Equation gives 16 cal. Label is off by 11. **FLAG as ERROR.**

### 1.3 %DV recalculation

For every line item with a Daily Value, recalculate:

```
%DV = (amount per serving ÷ DV) × 100
```

Then round per the 101.9(c) rules below and compare to the printed %DV. Off by more than one rounding increment = **FLAG**.

### 1.4 Rounding rules — 21 CFR 101.9(c)

Verify every value is rounded to the allowed increment:

| Nutrient | Rounding rule |
|---|---|
| Calories | <5 → "0"; 5–50 → nearest 5; >50 → nearest 10 |
| Total Fat, Sat Fat, Trans Fat | <0.5 g → "0"; <5 g → nearest 0.5 g; ≥5 g → nearest 1 g |
| Cholesterol | <2 mg → "0"; 2–5 mg → "<5 mg"; >5 mg → nearest 5 mg |
| Sodium | <5 mg → "0"; 5–140 mg → nearest 5 mg; >140 mg → nearest 10 mg |
| Total Carb, Fiber, Sugars, Added Sugars | <0.5 g → "0"; <1 g → "<1 g"; ≥1 g → nearest 1 g |
| Protein | <0.5 g → "0"; <1 g → "<1 g"; ≥1 g → nearest 1 g |
| Vitamins & minerals (amount) | Significant figures per 101.9(c)(8)(iii) |
| %DV (all) | <10% → nearest 2%; 10–50% → nearest 5%; >50% → nearest 10% |

### 1.5 Elemental vs salt-weight check

For minerals, the label must declare **elemental** amount, not the compound weight. Quick sanity check using typical elemental percentages:

| Mineral source | % elemental |
|---|---|
| Magnesium oxide | ~60% |
| Magnesium citrate | ~16% |
| Magnesium glycinate | ~14% |
| Magnesium L-threonate | ~8% |
| Calcium carbonate | ~40% |
| Calcium citrate | ~21% |
| Zinc oxide | ~80% |
| Zinc citrate | ~31% |
| Zinc gluconate | ~14% |
| Iron, ferrous sulfate | ~20% |
| Iron, ferrous fumarate | ~33% |
| Iron, ferrous bisglycinate | ~20% |
| Heme iron polypeptide | ~1.5–2.5% (varies by spec) |

If a label declares "100 mg magnesium from magnesium citrate" and the formula only has 200 mg magnesium citrate, that delivers ~32 mg elemental — **label is overstated.** Flag.

---

## 2. Reverse-engineering the base (no formula needed)

Pectin and carrageenan gummy bases are predictable. Use the typical compositions below to estimate expected carbs, sugars, sodium, and calories per serving, then compare to the declared values.

### 2.1 Typical pectin gummy base (per 2.5 g gummy)

| Component | % of gummy | g per gummy |
|---|---|---|
| Glucose syrup (DE 42, ~80% solids, ~75% sugars as-is) | 50–55% | 1.30 |
| Sucrose | 30–35% | 0.80 |
| Pectin | 1.5–2.5% | 0.05 |
| Sodium citrate (buffer) | 0.5–1.5% | 0.03 |
| Citric acid | 1–2% | 0.04 |
| Water (residual) | 8–12% | 0.25 |
| Flavors/colors | <1% | trace |
| Actives | variable | variable |

### 2.2 Typical carrageenan gummy base (per 3.5 g gummy)

| Component | % of gummy | g per gummy |
|---|---|---|
| Glucose syrup (DE 42) | 45–50% | 1.65 |
| Sucrose | 30–35% | 1.15 |
| Carrageenan | 1.0–1.5% | 0.045 |
| Potassium citrate or sodium citrate | 0.5–1.0% | 0.025 |
| Citric acid | 0.8–1.5% | 0.04 |
| Water (residual) | 10–14% | 0.45 |
| Flavors/colors | <1% | trace |
| Actives | variable | variable |

### 2.3 Pharmvista calibration rules (use these when reverse-engineering)

These are empirical Pharmvista-specific rules for spotting sugar/sodium math errors fast. Apply them as soon as you see the relevant ingredient in "Other Ingredients":

| If Other Ingredients shows... | Then expect... |
|---|---|
| Organic cane sugar (or cane sugar) | ~1 g sugar per gummy — so a 3-gummy serving has ~3 g sugar from cane sugar alone, before counting glucose/tapioca syrup. Total Sugars and Added Sugars on the panel must reflect this minimum. |
| Glucose syrup or tapioca syrup | Adds another ~1.0–1.5 g sugar per gummy on top of cane sugar (depending on DE and solids). |
| Trisodium citrate (TSC) | ~10–25 mg sodium per serving for typical use levels. Sodium of "0 mg" is wrong whenever TSC is present. |
| Sodium ascorbate | ~12% of the ascorbate weight comes through as sodium. Add to total sodium calculation. |
| Pectin or carrageenan | Contributes to dietary fiber, not to sugar. |

**Quick sanity check shortcut:** Total Sugars (g per serving) should be at least equal to "1 × gummies per serving" if cane sugar is in Other Ingredients. Added Sugars should match Total Sugars within ~1 g in any gummy that uses cane sugar + glucose/tapioca syrup (both are added sugars by definition).

### 2.4 Expected nutrition per serving (2-gummy serving)

| Value | Pectin (2 × 2.5 g) | Carrageenan (2 × 3.5 g) |
|---|---|---|
| Serving weight | 5.0 g | 7.0 g |
| Total carbs | 3.5–4.5 g | 5.0–6.5 g |
| Total sugars | 3.0–4.0 g | 4.5–5.5 g |
| Added sugars | 3.0–4.0 g | 4.5–5.5 g |
| Sodium | 5–20 mg | 5–15 mg (or 0 if K-citrate used) |
| Calories | 12–20 | 20–28 |
| Protein | 0 g | 0 g |
| Fat | 0 g | 0 g |

### 2.5 How to use the benchmarks

1. Multiply by gummies per serving to scale.
2. Subtract declared actives from the gummy weight to estimate base weight available. If actives consume >30% of gummy weight, base is reduced proportionally — adjust expected values down.
3. Compare declared values on the label to the expected range:
   - **Within range** → mark **LIKELY OK**.
   - **Outside range** → mark **FLAG** and note in the report. Could be a sugar-free formulation, sugar alcohols, allulose, or a math error — needs formula to confirm.
   - **Implausibly low** (e.g., "0 g sugar" in a standard pectin gummy) → mark **FLAG (high suspicion of error)**.

---

## 3. Active ingredient load capacity check

A 2.5 g pectin gummy can structurally hold approximately **150–300 mg total active solids** before texture failure. A 3.5 g carrageenan gummy can hold approximately **250–450 mg**. If the sum of declared actives exceeds these ranges, the formula is either:

- Overloaded (texture/shelf life problems), OR
- Using a very low-dose proprietary blend with inflated label claims, OR
- The label values are exaggerated.

**Sum the elemental/standardized amounts of all declared actives.** Convert any salt-weight declarations to compound weight (using the table in §1.5). If the total exceeds the gummy's load capacity, **FLAG**.

**Example:** A 2.5 g pectin gummy declares 100 mg elemental magnesium (from oxide) + 18 mg iron (from fumarate) + 1000 IU vitamin D3 + 250 mg vitamin C. Compound weights:
- Magnesium oxide: 100 ÷ 0.60 = 167 mg
- Ferrous fumarate: 18 ÷ 0.33 = 55 mg
- Vitamin D3 (1% spec): 1000 IU ≈ 25 mcg / 0.01 = 2.5 mg
- Vitamin C: 250 mg (typically 90–95% ascorbic acid spec) = ~270 mg

Total: ~494 mg. Exceeds 300 mg ceiling. **FLAG as load-capacity concern.**

---

## 4. Red-flag patterns (definitive errors)

These patterns indicate a definite label error, regardless of formula:

| Pattern | Why it's wrong |
|---|---|
| "Sugar-free" claim + non-zero added sugars declared | Direct contradiction (21 CFR 101.60(c)) |
| Calories declared that can't support the macros | Math error — calorie equation fails |
| 1990s-era Daily Values used (e.g., Vit C = 60 mg DV) | DV table updated 2016, enforced 2020 |
| Missing mandatory "from" or "as" statement on minerals | 21 CFR 101.36(b)(2)(i) requires source disclosure |
| Proprietary blend with individual %DV listed for components | Not allowed under 101.36(c) — only total blend gets a %DV |
| Sodium declared as "0 mg" when sodium-form actives present (sodium ascorbate, sodium selenite, sodium molybdate) | Sodium contribution unaccounted for |
| Elemental amount > what the compound can deliver | Math impossibility (see §1.5) |
| Vitamin D in IU only (no mcg) post-2020 | DV is in mcg; IU allowed only parenthetically |
| Vitamin A in IU only (no mcg RAE) post-2020 | DV is in mcg RAE; IU allowed only parenthetically |

---

## 5. FDA compliance margins — 21 CFR 101.9(g)

Even if math is internally consistent, the **actual analyzed value** (from COA) must fall within:

| Nutrient class | Compliance rule |
|---|---|
| Class I (added vitamins/minerals, added protein, added dietary fiber) | Actual ≥ 100% of label claim |
| Class II (naturally occurring nutrients, e.g., vitamins from botanicals) | Actual ≥ 80% of label claim |
| Calories, Total Sugars, Added Sugars, Total Fat, Sat Fat, Sodium, Cholesterol | Actual ≤ 120% of label claim |

This is why labels carry **overage** on added actives (typical: Vit C 20–30%, Vit A 25–50%, methyl-B12 30%+) and conservatively-high declarations on calories/sugars/sodium.

**For label review without COA:** assume the manufacturer applied appropriate overage. Flag only if the math on the label is internally inconsistent or implausible per benchmarks.

---

## 6. Daily Values reference — current (2016 update, 2020 enforcement)

For %DV recalculation, use these:

| Nutrient | DV (adults & children ≥4) |
|---|---|
| Vitamin A | 900 mcg RAE |
| Vitamin C | 90 mg |
| Vitamin D | 20 mcg (800 IU) |
| Vitamin E | 15 mg α-tocopherol |
| Vitamin K | 120 mcg |
| Thiamin (B1) | 1.2 mg |
| Riboflavin (B2) | 1.3 mg |
| Niacin (B3) | 16 mg NE |
| Vitamin B6 | 1.7 mg |
| Folate | 400 mcg DFE |
| Vitamin B12 | 2.4 mcg |
| Biotin | 30 mcg |
| Pantothenic Acid | 5 mg |
| Choline | 550 mg |
| Calcium | 1300 mg |
| Iron | 18 mg |
| Phosphorus | 1250 mg |
| Iodine | 150 mcg |
| Magnesium | 420 mg |
| Zinc | 11 mg |
| Selenium | 55 mcg |
| Copper | 0.9 mg |
| Manganese | 2.3 mg |
| Chromium | 35 mcg |
| Molybdenum | 45 mcg |
| Sodium | 2300 mg |
| Potassium | 4700 mg |
| Total Carb | 275 g |
| Dietary Fiber | 28 g |
| Added Sugars | 50 g |
| Protein | 50 g |
| Total Fat | 78 g |
| Saturated Fat | 20 g |
| Cholesterol | 300 mg |

Ingredients without DVs (botanicals, amino acids, branded actives) get a **†** symbol with the footnote "Daily Value not established."

---

## 7. Output classification

Every math finding gets one of four confidence labels in the report:

- **VERIFIED** — Internal math check (calorie eq., %DV recalc, rounding) confirms the value. Definitive.
- **LIKELY OK** — Value is within the benchmark range for the gummy base and weight. Not verified to the gram, but plausible.
- **FLAG** — Value is outside the benchmark range OR fails an internal check by a small margin. Needs formula to resolve.
- **ERROR** — Definitive math error (calorie equation fails, %DV off by more than one rounding step, elemental impossibility, red-flag pattern). Hard fail.

Severity mapping for the main findings table:

- **ERROR** → Critical or Major (depending on whether the value is misleading to consumers or just internally inconsistent).
- **FLAG** → Major.
- **LIKELY OK** → no entry in the findings table; mention in a one-line confidence note at the bottom of the panel section.
- **VERIFIED** → no entry needed.

---

## 8. Quick workflow when running this pass

1. Ask the user for gummy weight + base type (if not provided).
2. Run §1 internal consistency checks — every value, every line.
3. Run §2 base benchmark — estimate expected vs declared.
4. Run §3 load capacity — sum the actives.
5. Scan for §4 red flags.
6. Classify every value (VERIFIED / LIKELY OK / FLAG / ERROR).
7. Roll the ERROR and FLAG items into the main findings table with severity per §7.
8. Add a single line to the chat summary: **"Nutrition math: N VERIFIED · N LIKELY OK · N FLAG · N ERROR (assumed [pectin/carrageenan] base, [weight] g/gummy)."**

If the user provided a formula sheet, replace the benchmark step (§2) with direct calculation from the formula and re-classify everything that was LIKELY OK as either VERIFIED or ERROR.

---

## 9. How to write math in the Recommended Fix column

Every numerical fix in the .docx report must show worked math. This is what makes the deliverable verifiable rather than aspirational.

### Required format

Each fix is a multi-line array. Mix prose lines and math lines:

```javascript
fix: [
  "Trisodium citrate = 26.7% sodium by weight. Typical pectin gummy uses 0.5–1.5% TSC.",   // prose
  "Example at 1% TSC, 3 × 3.0 g = 9.0 g serving:",                                          // prose
  "  Sodium = 9000 × 0.01 × 0.267 = 24 mg → round to 25 mg.",                               // math (leading space + math symbols → auto Consolas)
  "Get exact TSC % from batch sheet, repeat the math, round to nearest 5 mg."               // prose
]
```

The build template auto-detects math lines using the regex `/[=÷×→]|^\s*•|^\s+\d/` and renders them in Consolas monospace. Math feels different from prose so the reader's eye can find the formulas quickly.

### Required structure for every numerical fix

1. **Formula in words** — "Elemental Zn = compound × elemental fraction:"
2. **Worked example with real numbers** — "7.5 × 0.31 = 2.3 mg elemental Zn."
3. **Conversion to %DV (if applicable)** — "%DV = 2.3 ÷ 11 × 100 = 20.9%"
4. **Rounding step** — "→ round to 20% (nearest 5%)."
5. **Action statement** — "Restate row as: \"Zinc (as zinc citrate) 2 mg, 20%\"."

### When the math is internally inconsistent

Present BOTH scenarios as bulleted alternatives. Do not pick a winner — the user must reconcile from the batch sheet:

```javascript
fix: [
  "Pull the batch sheet and pick the scenario that matches actual formula:",
  "• If Total Carb 12 g is correct → Calories = 12 × 4 = 48 → round to 50.",
  "• If Calories 30 is correct → Total Carb = 30 ÷ 4 = 7.5 g → round to 8 g.",
  "Update both values so: Calories = (Total Carb × 4)."
]
```

### What NOT to do in a fix

- ❌ "Recalculate sodium from TSC contribution." — no math shown
- ❌ "Verify against batch sheet." — no action without a target value
- ❌ "Reformat as ‘Zinc (as zinc citrate) X mg, Y%'." — placeholders, no worked example
- ✅ Show the formula, the inputs, the calculation, the rounding, the action — every time.
