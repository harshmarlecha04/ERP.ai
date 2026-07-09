import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Download, RefreshCw, Trash2, Plus } from "lucide-react";
import type { SupplementFactsPanel, PanelRow } from "./types";

interface Props {
  panel: SupplementFactsPanel | null;
  onChange?: (next: SupplementFactsPanel) => void;
  onRegenerate?: (panel: SupplementFactsPanel) => Promise<void> | void;
  onDownload?: () => void;
  regenerating?: boolean;
  docxUrl?: string | null;
}

export function SupplementFactsPreview({ panel, onChange, onRegenerate, onDownload, regenerating, docxUrl }: Props) {
  const [local, setLocal] = useState<SupplementFactsPanel | null>(panel);

  useEffect(() => {
    setLocal(panel);
  }, [panel]);

  if (!local) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
        The generated Supplement Facts panel will appear here.
      </div>
    );
  }

  function update(next: SupplementFactsPanel) {
    setLocal(next);
    onChange?.(next);
  }

  function updateActive(i: number, patch: Partial<PanelRow>) {
    if (!local) return;
    const activeRows = local.activeRows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    update({ ...local, activeRows });
  }

  function removeActive(i: number) {
    if (!local) return;
    update({ ...local, activeRows: local.activeRows.filter((_, idx) => idx !== i) });
  }

  function addActive() {
    if (!local) return;
    update({ ...local, activeRows: [...local.activeRows, { label: "New Ingredient", amount: "0 mg", percentDV: "†" }] });
  }

  function updateMacro(i: number, patch: Partial<PanelRow>) {
    if (!local) return;
    const amountPerServingRows = local.amountPerServingRows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    update({ ...local, amountPerServingRows });
  }

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => onRegenerate?.(local)}
          disabled={regenerating || !onRegenerate}
          size="sm"
        >
          {regenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Regenerate .docx
        </Button>
        {docxUrl && (
          <Button variant="outline" size="sm" onClick={onDownload} asChild>
            <a href={docxUrl} target="_blank" rel="noreferrer" download>
              <Download className="w-4 h-4 mr-2" /> Download
            </a>
          </Button>
        )}
        <div className="text-xs text-muted-foreground ml-auto">Edit any field, then Regenerate.</div>
      </div>

      <div className="bg-white text-black border-2 border-black p-4 max-w-md mx-auto font-sans text-sm space-y-1">
        {/* Header */}
        <div className="mb-2 space-y-1">
          <Input
            className="h-8 font-bold text-base bg-white text-black border-gray-300"
            value={local.header.productName}
            onChange={(e) => update({ ...local, header: { ...local.header, productName: e.target.value } })}
          />
          <Input
            className="h-7 italic text-xs bg-white text-black border-gray-300"
            value={local.header.customerName ?? ""}
            placeholder="Customer name (optional)"
            onChange={(e) => update({ ...local, header: { ...local.header, customerName: e.target.value || undefined } })}
          />
        </div>

        {/* Title */}
        <div className="border-b-8 border-black py-1">
          <h2 className="font-extrabold text-2xl leading-none">Supplement Facts</h2>
        </div>

        {/* Serving */}
        <div className="border-b-4 border-black py-1">
          <div className="flex items-center gap-2">
            <span className="font-bold whitespace-nowrap">Serving Size</span>
            <Input
              className="h-7 bg-white text-black border-gray-300 font-bold"
              value={local.servingSize}
              onChange={(e) => update({ ...local, servingSize: e.target.value })}
            />
          </div>
        </div>

        {/* Column headers */}
        <div className="border-b border-black py-1 flex justify-end gap-4">
          <div className="text-right text-xs font-bold flex-1">&nbsp;</div>
          <div className="text-right text-xs font-bold w-24">Amount Per Serving</div>
          <div className="text-right text-xs font-bold w-16">% Daily Value</div>
        </div>

        {/* Macro rows (editable) */}
        {local.amountPerServingRows.map((r, i) => (
          <div key={`m-${i}`} className={`border-b border-black py-1 flex gap-2 items-center ${r.indent ? "pl-4" : ""}`}>
            <Input
              className={`h-7 flex-1 bg-white text-black border-gray-300 ${r.indent ? "" : "font-bold"}`}
              value={r.label}
              onChange={(e) => updateMacro(i, { label: e.target.value })}
            />
            <Input
              className="h-7 w-24 text-right bg-white text-black border-gray-300"
              value={r.amount}
              onChange={(e) => updateMacro(i, { amount: e.target.value })}
            />
            <Input
              className="h-7 w-16 text-right font-bold bg-white text-black border-gray-300"
              value={r.percentDV}
              onChange={(e) => updateMacro(i, { percentDV: e.target.value })}
            />
          </div>
        ))}

        {/* Active rows (editable) */}
        {local.activeRows.length > 0 && <div className="border-t-8 border-black" />}
        {local.activeRows.map((r, i) => (
          <div key={`a-${i}`} className="border-b border-black py-1 flex gap-2 items-center">
            <Input
              className="h-7 flex-1 bg-white text-black border-gray-300"
              value={r.label}
              onChange={(e) => updateActive(i, { label: e.target.value })}
            />
            <Input
              className="h-7 w-24 text-right bg-white text-black border-gray-300"
              value={r.amount}
              onChange={(e) => updateActive(i, { amount: e.target.value })}
            />
            <Input
              className="h-7 w-16 text-right font-bold bg-white text-black border-gray-300"
              value={r.percentDV}
              onChange={(e) => updateActive(i, { percentDV: e.target.value })}
            />
            <Button size="icon" variant="ghost" className="h-6 w-6 text-black hover:text-red-600" onClick={() => removeActive(i)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="ghost" className="text-black hover:bg-gray-100 text-xs h-7" onClick={addActive}>
          <Plus className="w-3 h-3 mr-1" /> Add ingredient
        </Button>

        {/* Footnotes */}
        <div className="text-xs mt-2 italic">
          {local.footnotes.map((f, i) => (
            <Input
              key={i}
              className="h-6 bg-white text-black border-gray-300 text-xs italic mb-1"
              value={f}
              onChange={(e) => {
                const footnotes = local.footnotes.map((x, idx) => (idx === i ? e.target.value : x));
                update({ ...local, footnotes });
              }}
            />
          ))}
        </div>

        {/* Other ingredients */}
        <div className="text-xs mt-3">
          <div className="font-bold">Other Ingredients:</div>
          <Textarea
            className="bg-white text-black border-gray-300 text-xs min-h-[60px]"
            value={local.otherIngredients}
            onChange={(e) => update({ ...local, otherIngredients: e.target.value })}
          />
        </div>

        {/* Directions */}
        <div className="text-xs mt-2">
          <div className="font-bold">Directions:</div>
          <Textarea
            className="bg-white text-black border-gray-300 text-xs min-h-[50px]"
            value={local.directions}
            onChange={(e) => update({ ...local, directions: e.target.value })}
          />
        </div>

        {/* Warnings */}
        <div className="text-xs mt-3">
          <div className="font-bold">Warnings</div>
          {local.warnings.map((w, i) => (
            <Input
              key={i}
              className="h-6 bg-white text-black border-gray-300 text-xs mb-1"
              value={w}
              onChange={(e) => {
                const warnings = local.warnings.map((x, idx) => (idx === i ? e.target.value : x));
                update({ ...local, warnings });
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
