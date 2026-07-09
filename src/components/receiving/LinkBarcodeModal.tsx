import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface LinkBarcodeModalProps {
  open: boolean;
  code: string;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}

type RM = { id: string; code: string; name: string; supplier: string | null };

export function LinkBarcodeModal({ open, code, onOpenChange, onLinked }: LinkBarcodeModalProps) {
  const [search, setSearch] = useState("");
  const [materials, setMaterials] = useState<RM[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("raw_materials")
      .select("id, code, name, supplier")
      .eq("is_archived", false)
      .order("name")
      .limit(500)
      .then(({ data }) => {
        setMaterials((data as RM[]) || []);
        setLoading(false);
      });
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return materials.slice(0, 50);
    return materials
      .filter((m) =>
        [m.code, m.name, m.supplier ?? ""].some((v) => v.toLowerCase().includes(q)),
      )
      .slice(0, 50);
  }, [search, materials]);

  const link = async (rm: RM) => {
    setSavingId(rm.id);
    const { error } = await supabase.from("raw_materials").update({ barcode: code }).eq("id", rm.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Failed to link", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Barcode linked", description: `${rm.name} will auto-match next time.` });
    onLinked();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link new barcode</DialogTitle>
          <DialogDescription>
            Code <span className="font-mono text-foreground">{code}</span> isn't recognized. Pick the raw material it belongs to — we'll remember it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rm-search">Search raw materials</Label>
          <Input
            id="rm-search"
            placeholder="Name, code, or supplier"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-80 overflow-y-auto rounded-md border">
          {loading ? (
            <div className="flex items-center justify-center p-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No matches</div>
          ) : (
            <ul className="divide-y">
              {filtered.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{m.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.code}
                      {m.supplier ? ` • ${m.supplier}` : ""}
                    </div>
                  </div>
                  <Button size="sm" disabled={savingId === m.id} onClick={() => link(m)}>
                    {savingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
