import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, X, Pencil } from "lucide-react";
import {
  useRDBaseTemplates,
  useSaveRDBaseTemplate,
  useDeleteRDBaseTemplate,
  type RDBaseTemplate,
  type RDBaseTemplateIngredient,
  type RDBaseTemplateStep,
} from "@/hooks/useRDBaseTemplates";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ROLES = ["syrup", "sugar", "water", "gelling", "acid", "flavor", "color", "sweetener", "other"];
const HIGHLIGHTS = ["none", "yellow", "green", "blue", "orange", "red"];
const SECTIONS: { value: "inactive_bulk" | "color_flavor" | "sweetener_masking"; label: string }[] = [
  { value: "inactive_bulk", label: "Inactive Bulks" },
  { value: "color_flavor", label: "Color & Flavor" },
  { value: "sweetener_masking", label: "Sweeteners & Masking Agents" },
];

const empty: Partial<RDBaseTemplate> & { ingredients: RDBaseTemplateIngredient[]; steps: RDBaseTemplateStep[] } = {
  name: "",
  mold_size: "",
  default_piece_weight_g: 3.5,
  default_batch_weight_g: 500,
  cook_temp_c: 100,
  brix_target: 67,
  add_active_temp_c: 90,
  tri_sodium_citrate_temp_c: 80,
  is_active: true,
  ingredients: [],
  steps: [],
};

export const RDBaseTemplatesModal = ({ open, onOpenChange }: Props) => {
  const { data: templates = [] } = useRDBaseTemplates();
  const saveTpl = useSaveRDBaseTemplate();
  const delTpl = useDeleteRDBaseTemplate();
  const [editing, setEditing] = useState<typeof empty | null>(null);

  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);

  const startNew = () => setEditing({ ...empty, ingredients: [], steps: [{ step_number: 1, text: "" }] });
  const startEdit = (t: RDBaseTemplate) =>
    setEditing({
      ...t,
      ingredients: [...(t.ingredients || [])],
      steps: [...(t.steps || [])],
    });

  if (editing) {
    const e = editing;
    const upd = (patch: Partial<typeof empty>) => setEditing({ ...e, ...patch });
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{e.id ? "Edit Template" : "New Base Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input value={e.name || ""} onChange={(ev) => upd({ name: ev.target.value })} />
              </div>
              <div>
                <Label>Mold Size</Label>
                <Input value={e.mold_size || ""} onChange={(ev) => upd({ mold_size: ev.target.value })} placeholder="e.g. Button Fly Molds" />
              </div>
              <div>
                <Label>Piece Weight (g)</Label>
                <Input type="number" step="0.1" value={e.default_piece_weight_g} onChange={(ev) => upd({ default_piece_weight_g: parseFloat(ev.target.value) })} />
              </div>
              <div>
                <Label>Default Batch Weight (g)</Label>
                <Input type="number" step="1" value={e.default_batch_weight_g} onChange={(ev) => upd({ default_batch_weight_g: parseFloat(ev.target.value) })} />
              </div>
              <div>
                <Label>Cook Temp (°C)</Label>
                <Input type="number" value={e.cook_temp_c ?? ""} onChange={(ev) => upd({ cook_temp_c: ev.target.value ? parseFloat(ev.target.value) : null })} />
              </div>
              <div>
                <Label>Brix Target (%)</Label>
                <Input type="number" value={e.brix_target ?? ""} onChange={(ev) => upd({ brix_target: ev.target.value ? parseFloat(ev.target.value) : null })} />
              </div>
              <div>
                <Label>Add-Active Temp (°C)</Label>
                <Input type="number" value={e.add_active_temp_c ?? ""} onChange={(ev) => upd({ add_active_temp_c: ev.target.value ? parseFloat(ev.target.value) : null })} />
              </div>
              <div>
                <Label>Tri Sodium Citrate Temp (°C)</Label>
                <Input type="number" value={e.tri_sodium_citrate_temp_c ?? ""} onChange={(ev) => upd({ tri_sodium_citrate_temp_c: ev.target.value ? parseFloat(ev.target.value) : null })} />
              </div>
            </div>

            {SECTIONS.map((sec) => {
              const rowsInSec = e.ingredients
                .map((ing, idx) => ({ ing, idx }))
                .filter(({ ing }) => (ing.section || "inactive_bulk") === sec.value);
              return (
                <div key={sec.value}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base">{sec.label}</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        upd({
                          ingredients: [
                            ...e.ingredients,
                            { sort_order: e.ingredients.length, name: "", supplier: "", default_percent: 0, highlight_color: "none", role: "other", section: sec.value },
                          ],
                        })
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {rowsInSec.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No ingredients in this section.</p>
                    )}
                    {rowsInSec.map(({ ing, idx: i }) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_90px_110px_110px_40px] gap-2 items-center">
                        <Input placeholder="Name" value={ing.name} onChange={(ev) => { const ar = [...e.ingredients]; ar[i] = { ...ing, name: ev.target.value }; upd({ ingredients: ar }); }} />
                        <Input placeholder="Supplier" value={ing.supplier || ""} onChange={(ev) => { const ar = [...e.ingredients]; ar[i] = { ...ing, supplier: ev.target.value }; upd({ ingredients: ar }); }} />
                        <Input type="number" step="0.0001" placeholder="%" value={ing.default_percent} onChange={(ev) => { const ar = [...e.ingredients]; ar[i] = { ...ing, default_percent: parseFloat(ev.target.value) || 0 }; upd({ ingredients: ar }); }} />
                        <Select value={ing.role || "other"} onValueChange={(v) => { const ar = [...e.ingredients]; ar[i] = { ...ing, role: v }; upd({ ingredients: ar }); }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={ing.highlight_color || "none"} onValueChange={(v) => { const ar = [...e.ingredients]; ar[i] = { ...ing, highlight_color: v }; upd({ ingredients: ar }); }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{HIGHLIGHTS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="icon" onClick={() => { const ar = e.ingredients.filter((_, k) => k !== i); upd({ ingredients: ar }); }}><X className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base">Procedure Steps</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => upd({ steps: [...e.steps, { step_number: e.steps.length + 1, text: "" }] })}>
                  <Plus className="h-4 w-4 mr-1" /> Add Step
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Tokens: <code>{"{cook_temp}"}</code>, <code>{"{brix}"}</code>, <code>{"{add_active_temp}"}</code>, <code>{"{tri_sodium_citrate_temp}"}</code></p>
              <div className="space-y-2">
                {e.steps.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="w-6 text-sm text-muted-foreground">{i + 1}.</span>
                    <Input value={s.text} onChange={(ev) => { const ar = [...e.steps]; ar[i] = { ...s, text: ev.target.value }; upd({ steps: ar }); }} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => { const ar = e.steps.filter((_, k) => k !== i); upd({ steps: ar }); }}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                disabled={saveTpl.isPending || !e.name}
                onClick={async () => { await saveTpl.mutateAsync(e as any); setEditing(null); }}
              >
                {saveTpl.isPending ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>R&D Base Templates</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end mb-2">
          <Button onClick={startNew} size="sm"><Plus className="h-4 w-4 mr-1" /> New Template</Button>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2">
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No templates yet. Create one to start generating batch sheets.</p>
            )}
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.mold_size || "—"} • {t.default_piece_weight_g}g/piece • {(t.ingredients || []).length} ingredients • {(t.steps || []).length} steps
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete "${t.name}"?`)) delTpl.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
