import { useState } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChecklistItem } from "@/hooks/launch/useLaunch";

interface Props {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

export function TaskChecklistEditor({ items, onChange }: Props) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, { id: crypto.randomUUID(), label: v, done: false }]);
    setDraft("");
  };

  const toggle = (id: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  const updateLabel = (id: string, label: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, label } : i)));

  const done = items.filter((i) => i.done).length;

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="text-[11px] text-muted-foreground">
          {done} of {items.length} complete
        </div>
      )}
      <div className="space-y-1">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 group">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            <Checkbox checked={i.done} onCheckedChange={() => toggle(i.id)} />
            <Input
              value={i.label}
              onChange={(e) => updateLabel(i.id, e.target.value)}
              className="h-7 text-sm flex-1"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => remove(i.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add a checklist item…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
