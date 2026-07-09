import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, FileText, X, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { SupplementFactsPreview } from "./SupplementFactsPreview";
import type {
  ActiveIngredient,
  ProductInput,
  SupplementFactsPanel,
  Unit,
  VersionContext,
} from "./types";

interface Props {
  versionId: string;
  onClose?: () => void;
}

const UNITS: Unit[] = ["mg", "mcg", "IU", "g"];

function defaultDirectionsFor(serving: number): string {
  const s = Math.max(1, Math.round(serving));
  return `Take ${s} gumm${s === 1 ? "y" : "ies"} daily, preferably with a meal, or as directed by your healthcare professional.`;
}

export function SupplementFactsForm({ versionId, onClose }: Props) {
  const [context, setContext] = useState<VersionContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);

  const [productName, setProductName] = useState("");
  const [servingSize, setServingSize] = useState<number>(2);
  const [actives, setActives] = useState<ActiveIngredient[]>([]);
  const [mgPerGummyMap, setMgPerGummyMap] = useState<Record<string, number>>({});
  const [otherIngredients, setOtherIngredients] = useState("");
  const [directions, setDirections] = useState("");

  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [panel, setPanel] = useState<SupplementFactsPanel | null>(null);
  const [editedPanel, setEditedPanel] = useState<SupplementFactsPanel | null>(null);
  const [docxUrl, setDocxUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingContext(true);
      try {
        const { data, error } = await supabase.functions.invoke("supplement-facts-agent", {
          body: { action: "load_version", versionId },
        });
        if (error) throw error;
        const ctx = data as VersionContext;
        setContext(ctx);
        setProductName(ctx.productName || "");
        const s = ctx.servingSize || 2;
        setServingSize(s);
        const raw = ctx.activesRaw || [];
        const map: Record<string, number> = {};
        raw.forEach((a) => (map[a.name] = a.mgPerGummy));
        setMgPerGummyMap(map);
        setActives(
          raw.length
            ? raw.map((a) => ({ name: a.name, amountPerServing: a.mgPerGummy * s, unit: a.unit }))
            : ctx.activeIngredients || []
        );
        setOtherIngredients(ctx.defaultOtherIngredients || "");
        setDirections(defaultDirectionsFor(s));
      } catch (e: any) {
        toast.error(e.message || "Failed to load R&D version");
      } finally {
        setLoadingContext(false);
      }
    })();
  }, [versionId]);

  // Recompute amountPerServing when servingSize changes
  useEffect(() => {
    setActives((prev) =>
      prev.map((a) => {
        const mg = mgPerGummyMap[a.name];
        return mg != null ? { ...a, amountPerServing: mg * servingSize } : a;
      })
    );
    setDirections((prev) => {
      // Only update if user hasn't customized past the default template
      const defaultForAny = /^Take \d+ gumm(y|ies) daily/i.test(prev);
      return defaultForAny ? defaultDirectionsFor(servingSize) : prev;
    });
  }, [servingSize, mgPerGummyMap]);

  const mismatchByName = useMemo(() => {
    const m = new Map<string, string>();
    (context?.unitMismatches || []).forEach((u) => m.set(u.name, u.suggestion));
    return m;
  }, [context]);

  const canGenerate = productName.trim().length > 0 && servingSize >= 1 && actives.length > 0;

  async function handleGenerate() {
    if (!context || !canGenerate) return;
    setGenerating(true);
    try {
      const input: ProductInput = {
        productName: productName.trim(),
        customerName: context.customerName || undefined,
        servingSizeGummies: servingSize,
        activeIngredients: actives,
        otherIngredients: otherIngredients.trim()
          ? otherIngredients
              .replace(/\.\s*$/, "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : null,
        directions: directions.trim() || null,
      };
      const { data, error } = await supabase.functions.invoke("supplement-facts-agent", {
        body: { action: "generate", input, versionId, projectId: context.project?.id },
      });
      if (error) throw error;
      setPanel(data.panel);
      setEditedPanel(data.panel);
      setDocxUrl(data.signedUrl);
      toast.success("Supplement Facts .docx ready — edit the preview and regenerate as needed");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate(edited: SupplementFactsPanel) {
    if (!context) return;
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("supplement-facts-agent", {
        body: {
          action: "regenerate",
          panel: edited,
          productName: edited.header.productName,
          customerName: edited.header.customerName ?? null,
          versionId,
          projectId: context.project?.id,
        },
      });
      if (error) throw error;
      setPanel(edited);
      setEditedPanel(edited);
      setDocxUrl(data.signedUrl);
      toast.success("Regenerated .docx with your edits");
    } catch (e: any) {
      toast.error(e.message || "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }

  function updateActive(i: number, patch: Partial<ActiveIngredient>) {
    setActives((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-8rem)]">
      {/* Form */}
      <Card className="flex flex-col overflow-hidden min-h-0">
        <CardHeader className="shrink-0 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4" /> Configure Supplement Facts
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="h-7 w-7">
              <X className="w-4 h-4" />
            </Button>
          )}
        </CardHeader>

        <CardContent className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden p-4">
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
            {loadingContext ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading R&D version…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sf-product">Product Name</Label>
                    <Input
                      id="sf-product"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Customer</Label>
                    <Input value={context?.customerName || "—"} readOnly disabled />
                  </div>
                </div>

                <div className="space-y-1.5 max-w-[200px]">
                  <Label htmlFor="sf-serving">Serving Size (gummies)</Label>
                  <Input
                    id="sf-serving"
                    type="number"
                    min={1}
                    value={servingSize}
                    onChange={(e) => setServingSize(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Active Ingredients</Label>
                  <div className="rounded-md border divide-y">
                    <div className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.7fr] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/40">
                      <div>Name</div>
                      <div>mg / gummy</div>
                      <div>Amount / serving</div>
                      <div>Unit</div>
                    </div>
                    {actives.map((a, i) => {
                      const mg = mgPerGummyMap[a.name];
                      const suggestion = mismatchByName.get(a.name);
                      return (
                        <div
                          key={`${a.name}-${i}`}
                          className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.7fr] gap-2 px-3 py-2 items-center text-sm"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{a.name}</span>
                            {suggestion && (
                              <span title={suggestion} className="text-amber-500 shrink-0">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            {mg != null ? mg : "—"}
                          </div>
                          <Input
                            type="number"
                            step="any"
                            value={a.amountPerServing}
                            onChange={(e) =>
                              updateActive(i, { amountPerServing: Number(e.target.value) || 0 })
                            }
                            className="h-8"
                          />
                          <Select
                            value={a.unit}
                            onValueChange={(v) => updateActive(i, { unit: v as Unit })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UNITS.map((u) => (
                                <SelectItem key={u} value={u}>
                                  {u}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                    {actives.length === 0 && (
                      <div className="px-3 py-4 text-sm text-muted-foreground">
                        No actives found on this R&D version.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sf-other">Other Ingredients</Label>
                    {context?.defaultOtherIngredients && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setOtherIngredients(context.defaultOtherIngredients!)}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" /> Reset to standard
                      </Button>
                    )}
                  </div>
                  <Textarea
                    id="sf-other"
                    rows={4}
                    value={otherIngredients}
                    onChange={(e) => setOtherIngredients(e.target.value)}
                    placeholder="Comma-separated ingredient list…"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sf-directions">Directions</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setDirections(defaultDirectionsFor(servingSize))}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Reset
                    </Button>
                  </div>
                  <Textarea
                    id="sf-directions"
                    rows={3}
                    value={directions}
                    onChange={(e) => setDirections(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-2 pt-2 border-t">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || generating || loadingContext}
              className="flex-1"
            >
              {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Generate Supplement Facts .docx
            </Button>
            {docxUrl && (
              <a href={docxUrl} target="_blank" rel="noreferrer">
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" /> .docx
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="overflow-hidden flex flex-col min-h-0">
        <CardHeader className="shrink-0">
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto">
          <SupplementFactsPreview
            panel={editedPanel ?? panel}
            onChange={setEditedPanel}
            onRegenerate={handleRegenerate}
            regenerating={regenerating}
            docxUrl={docxUrl}
          />
        </CardContent>
      </Card>
    </div>
  );
}
