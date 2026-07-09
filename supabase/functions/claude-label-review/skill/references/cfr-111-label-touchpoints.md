# 21 CFR Part 111 — Label Touchpoints (cGMP)

Part 111 is mostly about manufacturing operations and is internal-facing. Only a few items affect what appears on a label — those are covered here. A full Part 111 cGMP audit (batch records, specifications, identity testing) is a separate workstream.

## What to check from the label

### Lot / Batch Identification — §111.260(a)

Batch production records must identify the unique lot or batch number (21 CFR 111.260(a)). For traceability, the lot code typically appears on the printed label or is hot-stamped/ink-jet onto the container at fill.

**Verify:**
- A lot code is present somewhere on the package (printed, hot-stamped, or ink-jet at fill).
- If the artwork shows "LOT:" placeholder text, that's fine — actual code is applied at fill.
- If artwork has neither lot code nor lot placeholder, that's a finding — confirm with the brand how lot is applied.

**Citation:** 21 CFR 111.260(a). Severity: Major.

---

### Expiration / Best By Date — §111.70, §111.55

Expiration dating is **not federally required** for dietary supplements. However, if a date is shown on the label, the manufacturer must have stability data supporting it per 21 CFR 111.70 (specifications for purity, strength, composition must be maintained through the claimed shelf life).

**Verify:**
- If "Best By," "Expires," or similar date is on the artwork, confirm with QA that stability data exists.
- Date format should be unambiguous (MMM YYYY, MM/YYYY, or MM/DD/YYYY).
- If artwork shows "EXP:" placeholder, fine — actual date is applied at fill.

**Citation:** 21 CFR 111.70(b), (d); 21 CFR 111.55. Severity: Major (if claimed without data); Minor (if format is ambiguous).

---

### Identity Must Match Specifications — §111.70(d)

What the label claims (ingredient identity, amount per serving, strength/concentration) must match the master manufacturing record specifications and what's actually in the product.

**Verify:**
- Active ingredients listed on the label match the brand's submitted formula.
- Standardization claims (e.g., "Turmeric Extract (4:1)," "Garcinia (95% HCA)") match the master spec for that raw material.
- Amount Per Serving values match the formula's per-serving dose after any required overages.

**This check usually requires comparing the label to the formula sheet.** If only the label is available, flag any standardization claim, dose claim, or special-form claim (e.g., "Methylcobalamin" vs. "Cyanocobalamin") for cross-check.

**Citation:** 21 CFR 111.70(d). Severity: Major.

---

### Suggested Use / Dosing — §111.70(c)

Dosing instructions on the label (e.g., "Take 3 gummies daily") must be consistent with the formula's per-serving dose and the safety profile of the ingredients.

**Verify:**
- "Suggested Use" / "Directions" matches Serving Size in the Supplement Facts panel.
- Frequency stated (e.g., "daily," "once per day") is consistent with formulation intent.
- No conflicting instructions across panels (e.g., PDP says "2 gummies" but panel says "3 gummies").

**Citation:** 21 CFR 111.70(c). Severity: Major if inconsistent across panels; Minor if missing frequency word.

---

### Storage Conditions — §111.95

Holding for distribution requires conditions that protect the supplement from contamination and deterioration. Labels often state "Store in a cool, dry place" or "Keep tightly closed."

**Verify:**
- Storage statement is present (best practice, supports §111.95 compliance).
- Any specific storage condition (e.g., "Refrigerate after opening") is supported by stability data.

**Citation:** 21 CFR 111.95. Severity: Minor (storage statement is industry standard; absence isn't strictly a violation).

---

### Other Ingredients completeness — Pharmvista gummy base check

For any gummy manufactured by Pharmvista, the "Other Ingredients" section on the label must reflect the actual base/excipient system used in the gummy. The Pharmvista house gummy system (carrageenan + pectin gel matrix, 68% brix cook target, trisodium citrate buffer, no salt) has a fixed set of required base ingredients. If any of these are present in the formula but missing from the label, that is an identity-mismatch violation under §111.70(d) — what the consumer reads on the label does not match what is actually in the product.

**Pharmvista gummy base ingredient checklist:**

| Category | Requirement | Acceptable members |
|---|---|---|
| Bulk sweetener / fiber syrup | At least ONE present | Organic Tapioca Syrup · Fibersol (resistant maltodextrin) · VegaPure · Maltitol Syrup |
| Sugar / IMO sweetener | At least ONE present | Organic Cane Sugar · IMO Powder · IMO Syrup |
| Water | Required | Purified Water |
| Gel matrix — algae | Required | Seaweed Extract (carrageenan source; may name varieties — Brown Algae, Kelp, Fucus, etc.) |
| Gel matrix — pectin | Required | Pectin (may name source — citrus, apple, etc.) |
| Buffer | Required | Trisodium Citrate |
| pH adjuster | Required | Citric Acid |
| Sensory | Required | Natural Flavor and Color (or Natural Flavor + named specific color) |

**How to apply:**

1. Read the "Other Ingredients" section of the label.
2. For each required category, confirm at least one acceptable member is present.
3. For each missing category, flag as **Major** with citation **21 CFR 111.70(d)** — "label identity does not match master manufacturing record specifications. Confirm with QA whether the missing base ingredient is in the formula and update the label accordingly."

**Common reasons a category is missing:**
- Client drafted the label without consulting the formula sheet.
- Client omitted "Purified Water" thinking it doesn't need to be declared (it does — it's a real ingredient).
- Client forgot the buffer (Trisodium Citrate) or pH adjuster (Citric Acid).
- Client wrote "Sugar" without specifying organic/source.
- "Seaweed Extract" sometimes omitted when client only sees "carrageenan" on raw material spec.

**Pass/fail note:**
- All eight categories satisfied → label passes the base check; note in chat summary as "Base check: pass."
- Any category missing → Major finding with §111.70(d) citation. Confirm formula with QA before approving.

---

### Allergen / Cross-Contact Statements — §111.50(g)

§111.50(g) requires written procedures for ensuring that components, dietary supplements, packaging, and labels meet specifications, including allergen-related specs. This is mostly internal, but cross-contact statements ("Manufactured in a facility that also processes...") if present on the label must reflect the actual manufacturing situation.

**Verify:**
- If a cross-contact statement is on the label, confirm it accurately reflects Pharmvista's facility allergen risk profile.

**Citation:** 21 CFR 111.50(g). Severity: Minor (only a concern if statement misrepresents facility).

---

## Quick pass criteria

| Item | Pass criteria | Citation |
|---|---|---|
| Lot code | Present (or placeholder shown) | 21 CFR 111.260(a) |
| Expiration date | Stability data supports any claim; format unambiguous | 21 CFR 111.70(b), 111.55 |
| Identity matches spec | Active ingredients and standardization match master formula | 21 CFR 111.70(d) |
| **Pharmvista gummy base check** | **All 8 base ingredient categories present in Other Ingredients (≥1 bulk syrup, ≥1 sugar, water, seaweed extract, pectin, trisodium citrate, citric acid, natural flavor & color)** | **21 CFR 111.70(d)** |
| Dosing consistency | Suggested Use matches Serving Size across panels | 21 CFR 111.70(c) |
| Storage statement | Present (best practice) | 21 CFR 111.95 |
| Cross-contact statement | Accurate if present | 21 CFR 111.50(g) |
