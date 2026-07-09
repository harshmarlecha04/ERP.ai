import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, FileText, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { generateCoaPDF, type CoaPdfData, type CoaSettings } from "@/utils/coaPdfGenerator";
import { formatET } from "@/utils/dateUtils";

export interface CoaBatchPrefill {
  batchLot?: string;
  manufacturingDate?: string; // ISO yyyy-mm-dd
  productionBatchId?: string;
  customerName?: string;
  remark?: string;
}

interface Props {
  formula: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prefill?: CoaBatchPrefill;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Accepts YYYY-MM or YYYY-MM-DD and returns e.g. "July 2028"
const formatExp = (val: string) => {
  if (!val) return "";
  const [y, m] = val.split("-").map(Number);
  if (!y || !m) return "";
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

// Returns YYYY-MM (month + year only) from a YYYY-MM-DD manufacturing date
const addMonthsToMonthYear = (iso: string, months: number): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setMonth(dt.getMonth() + months);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
};

const parseClaim = (s: string): { value: number; unit: string } | null => {
  if (!s) return null;
  const m = String(s).trim().match(/^([\d.,]+)\s*([a-zA-Zµμ]+)/);
  if (!m) return null;
  const value = parseFloat(m[1].replace(/,/g, ""));
  if (!isFinite(value)) return null;
  return { value, unit: m[2] };
};

const buildAssaySpec = (
  labelClaim: string,
  tolerancePct: number,
  gummiesLabel: string
): string => {
  const p = parseClaim(labelClaim);

  if (!p) return "";
  const lo = p.value * (1 - tolerancePct / 100);
  const hi = p.value * (1 + tolerancePct / 100);
  const fmt = (n: number) =>
    n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, "");
  return `${fmt(lo)}–${fmt(hi)} ${p.unit}/${gummiesLabel}`;
};

const COMPOUND_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolveActiveNames = async (
  actives: any[],
  recipe: any[] | undefined
): Promise<string[]> => {
  const recipeNameMap: Record<string, string> = {};
  (recipe || []).forEach((r: any) => {
    if (r?.name && r?.materialName) recipeNameMap[r.name] = r.materialName;
  });

  const idsToFetch: string[] = [];
  actives.forEach((a: any) => {
    const n = a?.name;
    if (typeof n === "string") {
      if (COMPOUND_UUID_RE.test(n)) idsToFetch.push(n.substring(0, 36));
      else if (UUID_RE.test(n)) idsToFetch.push(n);
    }
    if (a?.materialId && typeof a.materialId === "string" && UUID_RE.test(a.materialId)) {
      idsToFetch.push(a.materialId);
    }
  });

  const materialMap: Record<string, string> = {};
  if (idsToFetch.length > 0) {
    const { data } = await supabase
      .from("raw_materials")
      .select("id, name")
      .in("id", Array.from(new Set(idsToFetch)));
    (data || []).forEach((m: any) => { materialMap[m.id] = m.name; });
  }

  return actives.map((a: any, idx: number) => {
    if (a?.materialName) return a.materialName;
    if (a?.ingredient_name) return a.ingredient_name;
    const n = a?.name;
    if (typeof n === "string") {
      if (COMPOUND_UUID_RE.test(n)) {
        return materialMap[n.substring(0, 36)] || recipeNameMap[n] || `Active ${idx + 1}`;
      }
      if (UUID_RE.test(n)) {
        return materialMap[n] || recipeNameMap[n] || `Active ${idx + 1}`;
      }
      if (n.trim()) return n;
    }
    if (a?.materialId && materialMap[a.materialId]) return materialMap[a.materialId];
    return `Active ${idx + 1}`;
  });
};



export function GenerateCOAModal({ formula, open, onOpenChange, prefill }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [parsing, setParsing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [settings, setSettings] = useState<CoaSettings | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [batchLot, setBatchLot] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [remark, setRemark] = useState("None");

  // Specs (auto-filled from formula/settings, editable)
  const [attributeSpecs, setAttributeSpecs] = useState({
    color: "",
    shape: "",
    consistency: "",
    flavor: "",
    foreign_particles: "No visible foreign matter",
    average_weight: "",
  });

  // Actual test results (Complies or numeric override)
  const [attributeResults, setAttributeResults] = useState({
    color: "Complies",
    shape: "Complies",
    consistency: "Complies",
    flavor: "Complies",
    foreign_particles: "Complies",
    average_weight: "Complies",
  });

  const [parsed, setParsed] = useState<any>({
    active_ingredient_assay: [],
    heavy_metals: { lead: "Complies", arsenic: "Complies", mercury: "Complies", cadmium: "Complies" },
    microbiological: {
      total_aerobic_microbial_count: "Complies",
      total_coliforms: "Complies",
      total_yeast_mold: "Complies",
      e_coli: "Absent",
      salmonella: "Absent",
      staphylococcus_aureus: "Absent",
    },
  });

  const servingSize: number = formula?.serving_size || 2;
  const gummiesLabel = `${servingSize} gumm${servingSize === 1 ? "y" : "ies"}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      // Load settings (formula override or global default)
      let loaded: any = null;
      const { data: override } = await supabase
        .from("coa_settings").select("*").eq("formula_id", formula.id).maybeSingle();
      if (override) loaded = override;
      else {
        const { data: global } = await supabase
          .from("coa_settings").select("*").eq("is_global_default", true).maybeSingle();
        loaded = global;
      }
      if (cancelled) return;
      if (loaded) setSettings(loaded);

      // Customer name auto-fill
      let custName = prefill?.customerName || "";
      if (!custName && formula?.customer_id) {
        const { data: c } = await supabase
          .from("customers").select("company_name").eq("id", formula.customer_id).maybeSingle();
        if (c?.company_name) custName = c.company_name;
      }

      if (cancelled) return;
      setCustomerName(custName);

      // Attribute specs from formula, fallback to blank
      setAttributeSpecs({
        color: formula?.spec_color_text || "",
        shape: formula?.spec_shape_text || "",
        consistency: formula?.spec_consistency_text || "Chewy, occasionally with tiny air bubble",
        flavor: (() => {
          if (formula?.spec_flavor_text) return formula.spec_flavor_text;
          const recipe = formula?.recipe_json;
          const ings: any[] = Array.isArray(recipe)
            ? recipe
            : (recipe?.ingredients || recipe?.rows || []);
          const colorRx = /(color|colou?r|dye|fd&c|fd & c|lake|titanium|beet|beta[- ]?carotene|annatto|turmeric|spirulina)/i;
          const stripRx = /\b(flavou?r|natural|artificial|wonf|extract|powder|liquid|type)\b/gi;
          const cleanFlavorName = (raw: string) => {
            let s = raw.split(/\s+[-–]\s+/)[0]; // drop supplier tail
            s = s.replace(stripRx, " ");
            s = s.replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
            return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
          };
          const uuidLike = /^[0-9a-f]{8}-[0-9a-f-]+$/i;
          const getName = (r: any) => {
            const cands = [r?.materialName, r?.material_name, r?.ingredient_name, r?.displayName, r?.name];
            for (const c of cands) {
              const s = String(c || "").trim();
              if (s && !uuidLike.test(s)) return s;
            }
            return "";
          };
          const flavors = ings
            .map(getName)
            .filter((n: string) => n && /flavou?r/i.test(n) && !colorRx.test(n))
            .map(cleanFlavorName)
            .filter(Boolean);
          return flavors.length ? Array.from(new Set(flavors)).join(", ") : "";
        })(),
        foreign_particles: formula?.spec_foreign_particles_text || "No visible foreign matter",
        average_weight:
          formula?.spec_weight_range_text ||
          (formula?.average_piece_weight ? String(formula.average_piece_weight) : ""),
      });

      // Batch prefill
      const mfg = prefill?.manufacturingDate || "";
      const monthsShelf = loaded?.shelf_life_months || 24;
      setBatchLot(prefill?.batchLot || "");
      setMfgDate(mfg);
      setExpDate(mfg ? addMonthsToMonthYear(mfg, monthsShelf) : "");
      setRemark(prefill?.remark || "None");

      // Build active assay specs from label claims + tolerance
      const tol = loaded?.active_assay_tolerance_pct || 10;
      const actives = formula?.active_ingredients_json || [];
      const resolvedNames = await resolveActiveNames(actives, formula?.recipe_json);
      const assays = actives.map((a: any, i: number) => {
        const labelClaim = a.labelClaim || a.label_claim || "";
        return {
          name: resolvedNames[i],
          specification: buildAssaySpec(labelClaim, tol, gummiesLabel),
          result: "Complies",
        };
      });
      setParsed((p: any) => ({ ...p, active_ingredient_assay: assays }));

    })();

    return () => { cancelled = true; };
  }, [open, formula?.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1];
      const { data, error } = await supabase.functions.invoke("parse-coa-test-results", {
        body: { fileBase64: base64, mimeType: file.type },
      });
      if (error) throw error;
      const result = data?.data;
      if (!result) throw new Error("No data returned");

      // Overlay results only (keep pre-filled specs)
      setParsed((prev: any) => {
        const existing = prev.active_ingredient_assay || [];
        const incoming = result.active_ingredient_assay || [];
        const merged = existing.map((row: any) => {
          const m = incoming.find((x: any) =>
            (x.name || "").toLowerCase().includes(String(row.name).toLowerCase().split(" ")[0])
          );
          return { ...row, result: m?.result ?? row.result };
        });
        return {
          ...prev,
          active_ingredient_assay: merged,
          heavy_metals: { ...prev.heavy_metals, ...(result.heavy_metals || {}) },
          microbiological: { ...prev.microbiological, ...(result.microbiological || {}) },
        };
      });
      if (result.attributes) {
        setAttributeResults((r) => ({
          ...r,
          ...(result.attributes.color ? { color: result.attributes.color } : {}),
          ...(result.attributes.average_weight ? { average_weight: result.attributes.average_weight } : {}),
        }));
      }
      if (result.batch_lot && !batchLot) setBatchLot(result.batch_lot);
      if (result.manufacturing_date && !mfgDate) setMfgDate(result.manufacturing_date);
      if (result.expiration_date && !expDate) setExpDate(result.expiration_date);
      toast({ title: "Test results parsed", description: "Review the values below before generating." });
    } catch (err: any) {
      toast({ title: "Parsing failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const handleGenerate = async () => {
    if (!settings || !user) return;
    if (!customerName || !batchLot) {
      toast({ title: "Missing fields", description: "Customer Name and Batch/Lot are required.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      let signatureDataUrl: string | undefined;
      let approverName: string | undefined;
      const { data: sig } = await supabase
        .from("user_signatures").select("*").eq("user_id", user.id).maybeSingle();
      if (sig?.signature_path) {
        const { data: signed } = await supabase.storage.from("signatures").createSignedUrl(sig.signature_path, 300);
        if (signed?.signedUrl) {
          const blob = await (await fetch(signed.signedUrl)).blob();
          signatureDataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
        }
        approverName = sig.approver_name || undefined;
      }

      const activesRaw = formula.active_ingredients_json || [];
      const resolvedIngredientNames = await resolveActiveNames(activesRaw, formula.recipe_json);
      const ingredients = activesRaw.map((a: any, i: number) => {
        const name = resolvedIngredientNames[i];
        const labelClaim = a.labelClaim || a.label_claim || "";
        const overagePct = parseFloat(a.overage || a.overage_pct || 0) || 0;
        // Input = label claim * (1 + overage%)
        const parsedClaim = parseClaim(labelClaim);
        let input = a.input || "";
        if (!input && parsedClaim && overagePct > 0) {
          const v = parsedClaim.value * (1 + overagePct / 100);
          input = `${Math.round(v)} ${parsedClaim.unit}*`;
        } else if (!input) {
          input = labelClaim;
        }
        return { name, labelClaim, input };
      });


      const pdfData: CoaPdfData = {
        productCode: formula.code || "",
        productName: formula.name || "",
        customerName,
        weight: formula.average_piece_weight ? `${formula.average_piece_weight} g/ gummy` : "",
        remark,
        batchLot,
        expirationDate: formatExp(expDate),
        servingSize,
        ingredients,
        attributes: attributeResults,
        attributeSpecs,
        attributeResults,
        activeAssays: parsed.active_ingredient_assay || [],
        heavyMetals: parsed.heavy_metals,
        microbiological: parsed.microbiological,
        approverName,
        approvalDate: formatET(new Date(), "M/d/yyyy"),
        signatureDataUrl,
        settings,
      };

      const blob = await generateCoaPDF(pdfData);
      const path = `${formula.id}/${batchLot}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("coa-pdfs").upload(path, blob, { contentType: "application/pdf" });
      if (upErr) throw upErr;

      await supabase.from("certificates_of_analysis").insert({
        formula_id: formula.id,
        batch_lot: batchLot,
        customer_name: customerName,
        remark,
        manufacturing_date: mfgDate || null,
        expiration_date: expDate ? (expDate.length === 7 ? `${expDate}-01` : expDate) : null,
        shelf_life_text: settings.shelf_life_text,
        qf_revision: settings.qf_revision,
        generated_data: { ...parsed, attribute_specs: attributeSpecs, attribute_results: attributeResults },
        pdf_path: path,
        generated_by: user.id,
        approved_by_name: approverName,
        production_batch_id: prefill?.productionBatchId || null,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `COA-${formula.code}-${batchLot}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "COA generated", description: "PDF downloaded and saved." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const hasPrefill = !!prefill?.batchLot;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onFocusOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Generate Certificate of Analysis</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {hasPrefill && (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Pre-filled from batch <strong>{prefill?.batchLot}</strong>. Review and adjust as needed.</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Customer Name *</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
            <div><Label>Batch / Lot # *</Label><Input value={batchLot} onChange={(e) => setBatchLot(e.target.value)} placeholder="PV02262026-60" /></div>
            <div><Label>Manufacturing Date</Label><Input type="date" value={mfgDate} onChange={(e) => {
              setMfgDate(e.target.value);
              if (settings?.shelf_life_months) setExpDate(addMonthsToMonthYear(e.target.value, settings.shelf_life_months));
            }} /></div>
            <div>
              <Label>Expiration (Month / Year)</Label>
              <Input type="month" value={expDate} onChange={(e) => setExpDate(e.target.value)} />
              {expDate && <p className="text-xs text-muted-foreground mt-1">{formatExp(expDate)}</p>}
            </div>
            <div className="col-span-2"><Label>Remark</Label><Input value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
          </div>

          <div className="border-2 border-dashed rounded-lg p-4 text-center">
            <input type="file" id="coa-file" className="hidden" accept="application/pdf,image/*" onChange={handleFileUpload} disabled={parsing} />
            <label htmlFor="coa-file" className="cursor-pointer flex flex-col items-center gap-2">
              {parsing ? <Loader2 className="h-8 w-8 animate-spin" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
              <span className="text-sm font-medium">{parsing ? "Parsing test results..." : "Upload lab test results (optional)"}</span>
              <span className="text-xs text-muted-foreground">Numeric values will overlay onto pre-filled "Complies" defaults.</span>
            </label>
          </div>

          <details open className="border rounded-lg p-3">
            <summary className="cursor-pointer font-semibold text-sm">Attributes (specs auto-filled from formula)</summary>
            <div className="mt-3 space-y-3 text-sm">
              {(["color","shape","consistency","flavor","foreign_particles","average_weight"] as const).map(k => (
                <div key={k} className="grid grid-cols-3 gap-2 items-center">
                  <Label className="capitalize">{k.replace(/_/g," ")}</Label>
                  <Input placeholder="Specification" value={(attributeSpecs as any)[k] || ""} onChange={(e) => setAttributeSpecs((s) => ({ ...s, [k]: e.target.value }))} />
                  <Input placeholder="Result (Complies)" value={(attributeResults as any)[k] || ""} onChange={(e) => setAttributeResults((r) => ({ ...r, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
          </details>

          <details className="border rounded-lg p-3">
            <summary className="cursor-pointer font-semibold text-sm">Active Ingredient Assays (specs auto-built from label claim ± tolerance)</summary>
            <div className="mt-3 space-y-2 text-sm">
              {(parsed.active_ingredient_assay || []).map((row: any, i: number) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <Input value={row.name} onChange={(e) => setParsed((p: any) => {
                    const arr = [...p.active_ingredient_assay]; arr[i] = { ...arr[i], name: e.target.value }; return { ...p, active_ingredient_assay: arr };
                  })} />
                  <Input placeholder="Spec" value={row.specification || ""} onChange={(e) => setParsed((p: any) => {
                    const arr = [...p.active_ingredient_assay]; arr[i] = { ...arr[i], specification: e.target.value }; return { ...p, active_ingredient_assay: arr };
                  })} />
                  <Input placeholder="Result" value={row.result || ""} onChange={(e) => setParsed((p: any) => {
                    const arr = [...p.active_ingredient_assay]; arr[i] = { ...arr[i], result: e.target.value }; return { ...p, active_ingredient_assay: arr };
                  })} />
                </div>
              ))}
            </div>
          </details>

          <details className="border rounded-lg p-3">
            <summary className="cursor-pointer font-semibold text-sm">Heavy Metals & Microbiological (Results)</summary>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <div className="font-medium mb-1">Heavy Metals</div>
                <div className="grid grid-cols-4 gap-2">
                  {(["lead","arsenic","mercury","cadmium"] as const).map(k => (
                    <Input key={k} placeholder={k} value={parsed.heavy_metals?.[k] || ""} onChange={(e) => setParsed((p: any) => ({ ...p, heavy_metals: { ...p.heavy_metals, [k]: e.target.value } }))} />
                  ))}
                </div>
              </div>
              <div>
                <div className="font-medium mb-1">Microbiological Analysis (USP)</div>
                <div className="space-y-1">
                  {([
                    ["total_aerobic_microbial_count", "Total Aerobic Microbial Count", "<2,000 CFU/g"],
                    ["total_coliforms", "Total Coliforms", "<10 CFU/g"],
                    ["total_yeast_mold", "Total Yeast & Mold", "<200 CFU/g"],
                    ["e_coli", "E. coli", "Absent"],
                    ["salmonella", "Salmonella", "Absent"],
                    ["staphylococcus_aureus", "Staphylococcus Aureus", "Absent"],
                  ] as const).map(([k, label, spec]) => (
                    <div key={k} className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center">
                      <div className="text-xs">{label}</div>
                      <div className="text-xs text-muted-foreground">{spec}</div>
                      <Input
                        value={parsed.microbiological?.[k] || ""}
                        onChange={(e) => setParsed((p: any) => ({ ...p, microbiological: { ...p.microbiological, [k]: e.target.value } }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </details>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={generating || !settings}>
            {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><FileText className="h-4 w-4 mr-2" /> Generate COA</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
