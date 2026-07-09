import { useState, useEffect } from "react";
import { parseDateString } from "@/utils/dateUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { INACTIVE_BULK_OPTIONS } from "@/lib/rdInactiveOptions";
import { useCreateVersion } from "@/hooks/useRDProjectVersions";
import { useRDProject, useRDProjectVersions } from "@/hooks/useRDProjects";
import { useRDBaseTemplates } from "@/hooks/useRDBaseTemplates";

interface AddVersionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
}

export const AddVersionModal = ({ open, onOpenChange, projectId }: AddVersionModalProps) => {
  const [flavor, setFlavor] = useState("");
  const [color, setColor] = useState("");
  const [moldSize, setMoldSize] = useState("");
  const [notes, setNotes] = useState("");
  const [actives, setActives] = useState<Array<{ active_name: string; mg_per_gummy: number; overage_pct?: number }>>([
    { active_name: "", mg_per_gummy: 0 },
  ]);
  const [inactives, setInactives] = useState<string[]>([""]);
  const [gummiesCount, setGummiesCount] = useState<number | undefined>();
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [copyFromLatest, setCopyFromLatest] = useState(false);
  const [baseTemplateId, setBaseTemplateId] = useState<string>("");
  const [pieceWeightG, setPieceWeightG] = useState<string>("");

  const MOLD_SIZE_OPTIONS = [
    "3g coin/button shaped mold",
    "3.5g berry mold",
    "4g berry mold",
    "4.5g fruit mold",
  ];


  const { data: project } = useRDProject(projectId);
  const { data: versions = [] } = useRDProjectVersions(projectId);
  const { data: baseTemplates = [] } = useRDBaseTemplates();
  const createVersion = useCreateVersion();

  useEffect(() => {
    if (open && copyFromLatest && versions.length > 0) {
      const latestVersion = versions[0];
      setFlavor(latestVersion.flavor);
      setColor(latestVersion.color);
      setMoldSize((latestVersion as any).mold_size || "");
      setNotes(latestVersion.notes || "");
      setGummiesCount(latestVersion.gummies_count || undefined);
      setScheduledDate(latestVersion.scheduled_date ? parseDateString(latestVersion.scheduled_date) : undefined);
      const overageMap: Record<string, number> = {};
      ((latestVersion as any).active_overage_percent || []).forEach((o: any) => {
        if (o?.name) overageMap[o.name] = o.overage_pct;
      });
      setActives(
        latestVersion.actives?.map((a) => ({
          active_name: a.active_name,
          mg_per_gummy: a.mg_per_gummy,
          overage_pct: overageMap[a.active_name] || 0,
        })) || [{ active_name: "", mg_per_gummy: 0 }]
      );
      setInactives(
        (latestVersion as any).inactives?.length
          ? (latestVersion as any).inactives.map((i: any) => i.name)
          : [""]
      );
      setBaseTemplateId((latestVersion as any).base_template_id || "");
      setPieceWeightG((latestVersion as any).piece_weight_g ? String((latestVersion as any).piece_weight_g) : "");
    } else if (open && !copyFromLatest) {
      setFlavor("");
      setColor("");
      setMoldSize("");
      setNotes("");
      setActives([{ active_name: "", mg_per_gummy: 0 }]);
      setInactives([""]);
      setGummiesCount(undefined);
      setScheduledDate(undefined);
      setBaseTemplateId("");
      setPieceWeightG("");
    }

  }, [open, copyFromLatest, versions]);

  const addActive = () => {
    setActives([...actives, { active_name: "", mg_per_gummy: 0 }]);
  };

  const removeActive = (index: number) => {
    if (actives.length > 1) {
      setActives(actives.filter((_, i) => i !== index));
    }
  };

  const updateActive = (index: number, field: "active_name" | "mg_per_gummy", value: string | number) => {
    const newActives = [...actives];
    newActives[index] = { ...newActives[index], [field]: value };
    setActives(newActives);
  };

  const addInactive = () => setInactives([...inactives, ""]);
  const removeInactive = (index: number) => {
    if (inactives.length > 1) setInactives(inactives.filter((_, i) => i !== index));
  };
  const updateInactive = (index: number, value: string) => {
    const next = [...inactives];
    next[index] = value;
    setInactives(next);
  };

  const handleSubmit = () => {
    if (!projectId || !flavor || !color) {
      return;
    }

    const validActives = actives.filter((a) => a.active_name && a.mg_per_gummy > 0);

    createVersion.mutate(
      {
        rd_project_id: projectId,
        flavor,
        color,
        mold_size: moldSize || undefined,
        actives: validActives,
        inactives: inactives.map(s => s.trim()).filter(Boolean),
        notes: notes || undefined,
        gummies_count: gummiesCount,
        scheduled_date: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : undefined,
        base_template_id: baseTemplateId || null,
        piece_weight_g: pieceWeightG ? parseFloat(pieceWeightG) : null,
      },

      {
        onSuccess: () => {
          onOpenChange(false);
          setCopyFromLatest(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:42rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Version - {project?.project_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="copyFromLatest"
              checked={copyFromLatest}
              onChange={(e) => setCopyFromLatest(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="copyFromLatest">Copy from latest version</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="flavor">Flavor *</Label>
              <Input
                id="flavor"
                value={flavor}
                onChange={(e) => setFlavor(e.target.value)}
                placeholder="e.g., Strawberry"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color *</Label>
              <Input
                id="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g., Red"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="moldSize">Mold Size</Label>
            <Select value={moldSize} onValueChange={setMoldSize}>
              <SelectTrigger id="moldSize">
                <SelectValue placeholder="Select mold size" />
              </SelectTrigger>
              <SelectContent>
                {MOLD_SIZE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>



          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Active Ingredients *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addActive}>
                <Plus className="h-4 w-4 mr-1" />
                Add Active
              </Button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_112px_96px_96px_40px] gap-2 text-xs text-muted-foreground px-1">
                <div>Active Name</div>
                <div>Label Claim (mg)</div>
                <div>Overage (%)</div>
                <div>Total (mg)</div>
                <div></div>
              </div>
              {actives.map((active, index) => {
                const lc = Number(active.mg_per_gummy) || 0;
                const ov = Number(active.overage_pct) || 0;
                const total = lc > 0 ? (lc * (1 + ov / 100)).toFixed(2) : "—";
                return (
                  <div key={index} className="grid grid-cols-[1fr_112px_96px_96px_40px] gap-2 items-center">
                    <Input
                      placeholder="Active name"
                      value={active.active_name}
                      onChange={(e) => updateActive(index, "active_name", e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="mg"
                      value={active.mg_per_gummy || ""}
                      onChange={(e) => updateActive(index, "mg_per_gummy", parseFloat(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      placeholder="%"
                      value={active.overage_pct || ""}
                      onChange={(e) => {
                        const next = [...actives];
                        next[index] = { ...next[index], overage_pct: parseFloat(e.target.value) || 0 };
                        setActives(next);
                      }}
                      title="Optional overage %"
                    />
                    <div className="h-10 rounded-md border border-input bg-muted/40 px-3 flex items-center text-sm tabular-nums">
                      {total}
                    </div>
                    {actives.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeActive(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Inactive Ingredients</Label>
              <Button type="button" variant="outline" size="sm" onClick={addInactive}>
                <Plus className="h-4 w-4 mr-1" />
                Add Inactive
              </Button>
            </div>
            <div className="space-y-2">
              {inactives.map((inactive, index) => {
                const isCustom = inactive && !INACTIVE_BULK_OPTIONS.includes(inactive);
                return (
                  <div key={index} className="flex gap-2">
                    <Select
                      value={inactive || undefined}
                      onValueChange={(v) => updateInactive(index, v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select inactive bulk..." />
                      </SelectTrigger>
                      <SelectContent>
                        {INACTIVE_BULK_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                        {isCustom && (
                          <SelectItem value={inactive}>(custom) {inactive}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {inactives.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeInactive(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>


          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gummies">Number of Gummies</Label>
              <Input
                id="gummies"
                type="number"
                value={gummiesCount || ""}
                onChange={(e) => setGummiesCount(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="e.g., 1000"
              />
            </div>

            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Template (for Batch Sheet PDF)</Label>
              <Select
                value={baseTemplateId}
                onValueChange={(v) => {
                  setBaseTemplateId(v);
                  const t = baseTemplates.find((x: any) => x.id === v);
                  if (t && !pieceWeightG) setPieceWeightG(String(t.default_piece_weight_g));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select base template" /></SelectTrigger>
                <SelectContent>
                  {baseTemplates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Piece Weight (g)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g., 3.5"
                value={pieceWeightG}
                onChange={(e) => setPieceWeightG(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this version..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!flavor || !color || createVersion.isPending}
            >
              {createVersion.isPending ? "Creating..." : "Create Version"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
