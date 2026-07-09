import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

const SUGGESTED = ["Research", "UX", "System", "Urgent", "Design", "Bug", "Marketing"];

export function TaskTagsEditor({ tags, onChange }: Props) {
  const [draft, setDraft] = useState("");

  const add = (v: string) => {
    const t = v.trim().replace(/^#/, "");
    if (!t) return;
    if (tags.map((x) => x.toLowerCase()).includes(t.toLowerCase())) return;
    onChange([...tags, t]);
    setDraft("");
  };

  const remove = (t: string) => onChange(tags.filter((x) => x !== t));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-primary/10 text-primary">
            #{t}
            <button onClick={() => remove(t)}><X className="h-3 w-3" /></button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add tag (e.g. Research)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" onClick={() => add(draft)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {SUGGESTED.filter((s) => !tags.map((t) => t.toLowerCase()).includes(s.toLowerCase())).slice(0, 6).map((s) => (
          <button
            key={s}
            onClick={() => add(s)}
            className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground"
          >
            +{s}
          </button>
        ))}
      </div>
    </div>
  );
}
