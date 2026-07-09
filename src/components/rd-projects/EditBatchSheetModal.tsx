import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, Download, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { BatchSheetData, ComputedIngredientRow, RowSection, CalculationLine } from "@/utils/rdBatchSheetCalculator";
import { generateRDBatchSheetPDF } from "@/utils/rdBatchSheetPdfGenerator";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialData: BatchSheetData | null;
  fileName: string;
  onDownloaded?: () => void;
}


export function EditBatchSheetModal({ open, onOpenChange, initialData, fileName, onDownloaded }: Props) {
  const [data, setData] = useState<BatchSheetData | null>(initialData);

  useEffect(() => {
    if (open) setData(initialData ? JSON.parse(JSON.stringify(initialData)) : null);
  }, [open, initialData]);

  const totals = useMemo(() => {
    if (!data) return { grams: 0, percent: 0 };
    const g = data.ingredients.reduce((s, r) => s + (Number(r.grams) || 0), 0);
    const p = data.ingredients.reduce((s, r) => s + (Number(r.percent) || 0), 0);
    return { grams: Math.round(g * 100) / 100, percent: Math.round(p * 100) / 100 };
  }, [data]);

  if (!data) return null;

  const update = (patch: Partial<BatchSheetData>) => setData((d) => (d ? { ...d, ...patch } : d));

  const updateRow = (i: number, patch: Partial<ComputedIngredientRow>) =>
    setData((d) => {
      if (!d) return d;
      const ingredients = d.ingredients.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
      return { ...d, ingredients };
    });

  const moveRow = (i: number, dir: -1 | 1) =>
    setData((d) => {
      if (!d) return d;
      const j = i + dir;
      if (j < 0 || j >= d.ingredients.length) return d;
      const ingredients = [...d.ingredients];
      [ingredients[i], ingredients[j]] = [ingredients[j], ingredients[i]];
      return { ...d, ingredients };
    });

  const deleteRow = (i: number) =>
    setData((d) => (d ? { ...d, ingredients: d.ingredients.filter((_, idx) => idx !== i) } : d));

  const addRow = () =>
    setData((d) =>
      d
        ? {
            ...d,
            ingredients: [
              ...d.ingredients,
              { name: "", supplier: "", percent: 0, grams: 0, highlight: "none", isActive: false, section: "inactive_bulk" },
            ],
          }
        : d
    );

  const recalcPercent = () =>
    setData((d) => {
      if (!d) return d;
      const total = d.ingredients.reduce((s, r) => s + (Number(r.grams) || 0), 0);
      const ingredients = d.ingredients.map((r) => ({
        ...r,
        percent: total > 0 ? Math.round(((Number(r.grams) || 0) / total) * 10000) / 100 : 0,
      }));
      return { ...d, ingredients, totals: { grams: Math.round(total * 100) / 100, percent: 100 } };
    });

  const updateCalcLine = (i: number, patch: Partial<CalculationLine>) =>
    setData((d) => {
      if (!d) return d;
      const calculationLines = d.calculationLines.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
      return { ...d, calculationLines };
    });

  const updateStep = (i: number, text: string) =>
    setData((d) => {
      if (!d) return d;
      const procedureSteps = d.procedureSteps.map((s, idx) => (idx === i ? text : s));
      return { ...d, procedureSteps };
    });

  const moveStep = (i: number, dir: -1 | 1) =>
    setData((d) => {
      if (!d) return d;
      const j = i + dir;
      if (j < 0 || j >= d.procedureSteps.length) return d;
      const procedureSteps = [...d.procedureSteps];
      [procedureSteps[i], procedureSteps[j]] = [procedureSteps[j], procedureSteps[i]];
      return { ...d, procedureSteps };
    });

  const deleteStep = (i: number) =>
    setData((d) => (d ? { ...d, procedureSteps: d.procedureSteps.filter((_, idx) => idx !== i) } : d));

  const addStep = () =>
    setData((d) => (d ? { ...d, procedureSteps: [...d.procedureSteps, ""] } : d));

  const download = () => {
    if (!data) return;
    const final: BatchSheetData = { ...data, totals: { grams: totals.grams, percent: totals.percent } };
    generateRDBatchSheetPDF(final, fileName);
    onDownloaded?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:95vw] w-[95vw] sm:max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Preview & Edit Batch Sheet</DialogTitle>
          <DialogDescription>
            Adjust any value before generating the PDF. Nothing here is saved to the project.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-3">
          <div className="space-y-6">
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Title</Label>
                <Input value={data.title} onChange={(e) => update({ title: e.target.value })} />
              </div>
              <div>
                <Label>Date</Label>
                <Input value={data.date} onChange={(e) => update({ date: e.target.value })} />
              </div>
              <div>
                <Label>Mold Size</Label>
                <Input value={data.moldSize} onChange={(e) => update({ moldSize: e.target.value })} />
              </div>
              <div>
                <Label>Batch Size Line</Label>
                <Input value={data.batchSizeLine} onChange={(e) => update({ batchSizeLine: e.target.value })} />
              </div>
              <div>
                <Label>Gummies Count</Label>
                <Input
                  type="number"
                  value={data.gummiesCount}
                  onChange={(e) => update({ gummiesCount: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Piece Weight (g)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={data.pieceWeightG}
                  onChange={(e) => update({ pieceWeightG: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-2">
                <Label>Objective</Label>
                <Textarea value={data.objective} onChange={(e) => update({ objective: e.target.value })} />
              </div>
            </div>

            {/* Calculation lines */}
            {data.calculationLines.length > 0 && (
              <div>
                <Label className="text-base">Active Calculations</Label>
                <div className="space-y-2 mt-2">
                  {data.calculationLines.map((c, i) => (
                    <div key={i} className="grid grid-cols-[160px_1fr_120px] gap-2 items-center">
                      <Input
                        value={c.active_name}
                        onChange={(e) => updateCalcLine(i, { active_name: e.target.value })}
                      />
                      <Input value={c.text} onChange={(e) => updateCalcLine(i, { text: e.target.value })} />
                      <Input
                        type="number"
                        step="0.0001"
                        value={c.grams}
                        onChange={(e) => updateCalcLine(i, { grams: Number(e.target.value) || 0 })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base">Ingredients</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={recalcPercent}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Recalc %
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addRow}>
                    <Plus className="h-4 w-4 mr-1" /> Add Row
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%]">Name</TableHead>
                    <TableHead className="w-[28%]">Supplier</TableHead>
                    <TableHead className="w-[14%]">%</TableHead>
                    <TableHead className="w-[16%]">Grams</TableHead>
                    <TableHead className="w-[14%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ingredients.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input value={r.name} onChange={(e) => updateRow(i, { name: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.supplier ?? ""}
                          onChange={(e) => updateRow(i, { supplier: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          value={(Number(r.percent) || 0).toFixed(1)}
                          onChange={(e) => updateRow(i, { percent: Math.round((Number(e.target.value) || 0) * 10) / 10 })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={(Number(r.grams) || 0).toFixed(2)}
                          onChange={(e) => updateRow(i, { grams: Math.round((Number(e.target.value) || 0) * 100) / 100 })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button type="button" size="icon" variant="ghost" onClick={() => moveRow(i, -1)}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" onClick={() => moveRow(i, 1)}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" onClick={() => deleteRow(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end gap-6 pt-3 text-sm font-medium">
                <span>Total %: {totals.percent}</span>
                <span>Total g: {totals.grams}</span>
              </div>
            </div>

            {/* Procedure steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base">Procedure Steps</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-1" /> Add Step
                </Button>
              </div>
              <div className="space-y-2">
                {data.procedureSteps.map((s, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-sm text-muted-foreground pt-2 w-6">{i + 1}.</span>
                    <Textarea
                      value={s}
                      onChange={(e) => updateStep(i, e.target.value)}
                      rows={2}
                      className="flex-1"
                    />
                    <div className="flex flex-col gap-1">
                      <Button type="button" size="icon" variant="ghost" onClick={() => moveStep(i, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => moveStep(i, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => deleteStep(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={download}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
