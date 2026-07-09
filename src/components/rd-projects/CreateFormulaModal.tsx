import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSpreadsheet, Save } from "lucide-react";
import { toast } from "sonner";
import { useRDBaseTemplates } from "@/hooks/useRDBaseTemplates";
import { calculateBatchSheet, type BatchSheetData } from "@/utils/rdBatchSheetCalculator";
import { EditBatchSheetModal } from "./EditBatchSheetModal";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  version: any | null;
  projectNumber: string;
  customerName: string;
  rdProjectId: string;
}

export function CreateFormulaModal({ open, onOpenChange, version, projectNumber, customerName, rdProjectId }: Props) {
  const { data: baseTemplates = [] } = useRDBaseTemplates();
  const qc = useQueryClient();
  const [templateId, setTemplateId] = useState<string>("");
  const [gummies, setGummies] = useState<number | "">("");
  const [pieceWeight, setPieceWeight] = useState<number | "">("");
  const [overages, setOverages] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<BatchSheetData | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");

  const template = useMemo(
    () => baseTemplates.find((t: any) => t.id === templateId),
    [baseTemplates, templateId]
  );

  useEffect(() => {
    if (!open || !version) return;
    // Auto-pick the version's saved template, otherwise the first active template
    const defaultTpl =
      baseTemplates.find((t: any) => t.id === version.base_template_id) ||
      baseTemplates.find((t: any) => t.is_active) ||
      baseTemplates[0];
    setTemplateId(defaultTpl?.id || "");
    setGummies(version.gummies_count ?? "");
    setPieceWeight(version.piece_weight_g ?? (defaultTpl?.default_piece_weight_g ?? ""));
    const o: Record<string, number> = {};
    (version.active_overage_percent || []).forEach((x: any) => {
      if (x?.name) o[x.name] = Number(x.overage_pct) || 0;
    });
    setOverages(o);
  }, [open, version, baseTemplates]);

  // When the chosen template changes and the version had no saved piece weight, default from template
  useEffect(() => {
    if (template && (pieceWeight === "" || pieceWeight == null)) {
      setPieceWeight(template.default_piece_weight_g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const actives = (version?.actives || []) as Array<{ active_name: string; mg_per_gummy: number }>;
  const batchSizeG = Number(gummies || 0) * Number(pieceWeight || 0);

  const validate = (): string | null => {
    if (!templateId) return "Pick a base template.";
    if (!gummies || Number(gummies) <= 0) return "Enter a number of gummies.";
    if (!pieceWeight || Number(pieceWeight) <= 0) return "Enter a piece weight in grams.";
    return null;
  };

  const buildOverageList = () =>
    Object.entries(overages)
      .map(([name, overage_pct]) => ({ name, overage_pct: Number(overage_pct) || 0 }))
      .filter((o) => o.overage_pct > 0);

  const generate = () => {
    const err = validate();
    if (err) return toast.error(err);
    if (!template) return;
    const data = calculateBatchSheet({
      projectName: projectNumber,
      customerName,
      flavor: version.flavor,
      template,
      gummiesCount: Number(gummies),
      pieceWeightG: Number(pieceWeight),
      actives: actives.map((a) => ({
        active_name: a.active_name,
        mg_per_gummy: a.mg_per_gummy,
        overage_pct: overages[a.active_name] || 0,
      })),
    });
    const fileName = `${projectNumber}_${version.version_number}_Formula.pdf`;
    setPreviewData(data);
    setPreviewFileName(fileName);
    setPreviewOpen(true);
  };

  const saveAndGenerate = async () => {
    const err = validate();
    if (err) return toast.error(err);
    setSaving(true);
    try {
      const overageList = buildOverageList();
      const { error } = await supabase
        .from("rd_project_versions")
        .update({
          base_template_id: templateId,
          piece_weight_g: Number(pieceWeight),
          gummies_count: Number(gummies),
          active_overage_percent: overageList.length ? (overageList as any) : null,
        } as any)
        .eq("id", version.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["rd-project-versions", rdProjectId] });
      qc.invalidateQueries({ queryKey: ["rd-projects"] });
      generate();
    } catch (e: any) {
      toast.error(e.message || "Failed to save formula settings");
    } finally {
      setSaving(false);
    }
  };

  if (!version) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Formula — {projectNumber} · {version.version_number}</DialogTitle>
          <DialogDescription>
            Choose a base template, set the batch size, and tune per-active overage. We'll generate a printable R&D batch sheet PDF.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-3">
          <div className="space-y-4">
            <div className="rounded border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">R&D Template</span>
              {!templateId && (
                <span className="ml-2 text-destructive">— none configured. Create one in Base Templates first.</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Number of Gummies *</Label>
                <Input
                  type="number"
                  min={1}
                  value={gummies}
                  onChange={(e) => setGummies(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 5000"
                />
              </div>
              <div>
                <Label>Piece Weight (g) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={pieceWeight}
                  onChange={(e) => setPieceWeight(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 3.5"
                />
              </div>
            </div>

            <div className="rounded border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">Batch Size:</span>{" "}
              {gummies && pieceWeight
                ? `${Number(gummies).toLocaleString()} gummies × ${pieceWeight} g = ${batchSizeG.toLocaleString()} g`
                : "—"}
            </div>

            <div>
              <Label className="text-base">Active Ingredients — Overage %</Label>
              {actives.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">This version has no actives. Add actives to the version to include them in the formula.</p>
              ) : (
                <div className="space-y-2 mt-2">
                  {actives.map((a) => (
                    <div key={a.active_name} className="grid grid-cols-[1fr_140px_120px] gap-2 items-center">
                      <div className="text-sm">{a.active_name}</div>
                      <div className="text-sm text-muted-foreground">{a.mg_per_gummy} mg/gummy</div>
                      <Input
                        type="number"
                        step="0.1"
                        min={0}
                        value={overages[a.active_name] ?? 0}
                        onChange={(e) =>
                          setOverages((prev) => ({ ...prev, [a.active_name]: Number(e.target.value) || 0 }))
                        }
                        placeholder="Overage %"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="secondary" onClick={generate}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Generate PDF
          </Button>
          <Button onClick={saveAndGenerate} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save & Generate PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <EditBatchSheetModal
      open={previewOpen}
      onOpenChange={setPreviewOpen}
      initialData={previewData}
      fileName={previewFileName}
      onDownloaded={() => {
        toast.success("Formula PDF downloaded");
        onOpenChange(false);
      }}
    />
    </>
  );
}
