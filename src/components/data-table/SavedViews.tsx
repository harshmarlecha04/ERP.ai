import { useState } from "react";
import { Bookmark, BookmarkPlus, Check, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useSavedViews, SavedView } from "@/hooks/useSavedViews";

interface SavedViewsProps<TConfig> {
  pageKey: string;
  currentConfig: TConfig;
  onApply: (config: TConfig) => void;
}

export function SavedViews<TConfig extends Record<string, unknown>>({
  pageKey,
  currentConfig,
  onApply,
}: SavedViewsProps<TConfig>) {
  const {
    views,
    activeView,
    setActiveViewId,
    saveView,
    deleteView,
    setDefaultView,
  } = useSavedViews<TConfig>(pageKey);

  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleApply = (view: SavedView<TConfig>) => {
    setActiveViewId(view.id);
    onApply(view.config);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const created = await saveView(name.trim(), currentConfig, makeDefault);
    setSaving(false);
    if (created) {
      setActiveViewId(created.id);
      setSaveOpen(false);
      setName("");
      setMakeDefault(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">
              {activeView ? activeView.name : "Views"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          {views.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              No saved views yet
            </div>
          )}
          {views.map((v) => (
            <DropdownMenuItem
              key={v.id}
              onClick={() => handleApply(v)}
              className="flex items-center gap-2"
            >
              {activeView?.id === v.id ? (
                <Check className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <span className="flex-1 truncate">{v.name}</span>
              {v.is_default && (
                <Star className="h-3 w-3 fill-primary text-primary shrink-0" />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDefaultView(v.id);
                }}
                aria-label={v.is_default ? "Default view" : "Set as default"}
                className="hover:text-primary"
              >
                {!v.is_default && <Star className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete view "${v.name}"?`)) deleteView(v.id);
                }}
                aria-label="Delete view"
                className="hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSaveOpen(true)}>
            <BookmarkPlus className="mr-2 h-4 w-4" />
            Save current view…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent
          className="sm:max-w-md"
          onFocusOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="view-name">Name</Label>
              <Input
                id="view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My open POs"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="view-default"
                checked={makeDefault}
                onCheckedChange={(c) => setMakeDefault(c === true)}
              />
              <Label htmlFor="view-default" className="text-sm font-normal">
                Make this my default view on this page
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Save view"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
