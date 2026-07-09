import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseDateString } from "@/utils/dateUtils";
import { useCustomers } from "@/hooks/useCustomers";
import {
  RDReceivedSample,
  useCreateRDReceivedSample,
  useUpdateRDReceivedSample,
} from "@/hooks/useRDReceivedSamples";
import { useRDProjectVersions } from "@/hooks/useRDProjectVersions";
import { useRDProject } from "@/hooks/useRDProjects";
import {
  useRDColorOptions,
  useAddRDColorOption,
} from "@/hooks/useRDColorOptions";
import {
  useRDFlavorOptions,
  useAddRDFlavorOption,
} from "@/hooks/useRDFlavorOptions";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  editing?: RDReceivedSample | null;
  defaultFlavor?: string;
  defaultMadeOnDate?: string | null;
  onCreated?: (sample: RDReceivedSample) => void;
}

const MOLD_SIZES = ["2.5g", "3g", "3.5g", "4g"];

const PRESET_FLAVORS = [
  "Strawberry",
  "Wild Berry",
  "Pineapple",
  "Cherry",
  "Mango",
  "Passionfruit",
  "Lemon",
  "Mixed Berry",
  "Berries",
  "Green Apple",
  "Cherry/Lemon",
  "Orange",
  "Grape",
  "Watermelon",
  "Citrus",
  "Passionfruit + Berry",
];

const ADD_NEW_COLOR_VALUE = "__add_new_color__";
const ADD_NEW_FLAVOR_VALUE = "__add_new_flavor__";

const toDateStr = (d: Date | undefined): string | null =>
  d ? format(d, "yyyy-MM-dd") : null;

export const ReceivedSampleModal = ({ open, onOpenChange, projectId, editing, defaultFlavor, defaultMadeOnDate, onCreated }: Props) => {
  const { customers } = useCustomers();
  const create = useCreateRDReceivedSample();
  const update = useUpdateRDReceivedSample();
  const { data: customColors = [] } = useRDColorOptions();
  const addColor = useAddRDColorOption();
  const { data: customFlavors = [] } = useRDFlavorOptions();
  const addFlavor = useAddRDFlavorOption();

  const { data: versions = [] } = useRDProjectVersions(projectId);
  const { data: project } = useRDProject(projectId);

  const [receivedDate, setReceivedDate] = useState<Date | undefined>();
  const [madeOnDate, setMadeOnDate] = useState<Date | undefined>();
  const [moldSize, setMoldSize] = useState<string>("");
  const [lotNumber, setLotNumber] = useState("");
  const [flavor, setFlavor] = useState("");
  const [color, setColor] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [versionId, setVersionId] = useState<string>("");
  const [quantityOnHand, setQuantityOnHand] = useState<string>("");


  const [showAddColor, setShowAddColor] = useState(false);
  const [newColorName, setNewColorName] = useState("");
  const [showAddFlavor, setShowAddFlavor] = useState(false);
  const [newFlavorName, setNewFlavorName] = useState("");

  const colorOptions = useMemo(() => {
    const merged = new Set<string>(customColors.map((c) => c.name));
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [customColors]);

  const flavorOptions = useMemo(() => {
    const merged = new Set<string>([
      ...PRESET_FLAVORS,
      ...customFlavors.map((f) => f.name),
    ]);
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [customFlavors]);

  useEffect(() => {
    if (open) {
      if (editing) {
        setReceivedDate(editing.received_date ? parseDateString(editing.received_date) : undefined);
        setMadeOnDate(editing.made_on_date ? parseDateString(editing.made_on_date) : undefined);
        setMoldSize(editing.mold_size || "");
        setLotNumber(editing.lot_number || "");
        setFlavor(editing.flavor || "");
        setColor(editing.color || "");
        setCustomerId(editing.customer_id || "");
        setVersionId(editing.rd_version_id || "");
        setQuantityOnHand(
          editing.quantity_on_hand != null ? String(editing.quantity_on_hand) : ""
        );
      } else {
        setReceivedDate(new Date());
        setMadeOnDate(defaultMadeOnDate ? parseDateString(defaultMadeOnDate) : undefined);
        setMoldSize("");
        setLotNumber("");
        setFlavor(defaultFlavor || "");
        setColor("");
        setCustomerId(project?.customer_id || "");
        setVersionId("");
        setQuantityOnHand("");
      }

      setShowAddColor(false);
      setNewColorName("");
      setShowAddFlavor(false);
      setNewFlavorName("");
    }
  }, [open, editing, defaultFlavor, defaultMadeOnDate, project?.customer_id]);

  const handleColorChange = (val: string) => {
    if (val === ADD_NEW_COLOR_VALUE) {
      setShowAddColor(true);
      return;
    }
    setColor(val);
  };

  const handleSaveNewColor = async () => {
    const name = newColorName.trim();
    if (!name) return;
    try {
      const created = await addColor.mutateAsync(name);
      setColor(created.name);
      setNewColorName("");
      setShowAddColor(false);
    } catch {
      // toast handled in hook
    }
  };

  const handleFlavorChange = (val: string) => {
    if (val === ADD_NEW_FLAVOR_VALUE) {
      setShowAddFlavor(true);
      return;
    }
    setFlavor(val);
  };

  const handleSaveNewFlavor = async () => {
    const name = newFlavorName.trim();
    if (!name) return;
    try {
      const created = await addFlavor.mutateAsync(name);
      setFlavor(created.name);
      setNewFlavorName("");
      setShowAddFlavor(false);
    } catch {
      // toast handled in hook
    }
  };

  const handleSubmit = async () => {
    if (!projectId && !editing) return;
    if (!versionId) {
      const { toast } = await import("sonner");
      toast.error("Please select a version");
      return;
    }

    const customer = customers.find((c) => c.id === customerId);
    const payload = {
      rd_project_id: editing?.rd_project_id || projectId!,
      rd_version_id: versionId || null,
      received_date: toDateStr(receivedDate),
      made_on_date: toDateStr(madeOnDate),
      product_name: null,
      mold_size: moldSize || null,
      lot_number: lotNumber.trim() || null,
      flavor: flavor.trim() || null,
      color: color.trim() || null,
      customer_id: customerId || null,
      customer_name: customer?.company_name || null,
      on_hand: !!quantityOnHand && parseInt(quantityOnHand, 10) > 0,
      quantity_on_hand: quantityOnHand && parseInt(quantityOnHand, 10) > 0 ? parseInt(quantityOnHand, 10) : null,
    };


    if (editing) {
      await update.mutateAsync({ id: editing.id, ...payload });
    } else {
      const created = await create.mutateAsync(payload);
      onCreated?.(created);
    }
    onOpenChange(false);
  };

  const DateField = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: Date | undefined;
    onChange: (d: Date | undefined) => void;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Received Sample" : "Log Received Sample"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-2 col-span-2">
            <Label>
              Version <span className="text-destructive">*</span>
            </Label>
            <Select value={versionId} onValueChange={setVersionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {[...versions]
                  .map((v: any) => ({
                    ...v,
                    _num: parseInt(String(v.version_number).replace(/\D/g, ""), 10) || 0,
                  }))
                  .sort((a, b) => a._num - b._num)
                  .map((v) => {
                    const label =
                      project?.project_number
                        ? v._num > 1
                          ? `${project.project_number}-V${v._num}`
                          : project.project_number
                        : `V${v._num}`;
                    return (
                      <SelectItem key={v.id} value={v.id}>
                        {label}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>

          <DateField label="R&D Samples Received Date" value={receivedDate} onChange={setReceivedDate} />
          <DateField label="R&D Sample Made On" value={madeOnDate} onChange={setMadeOnDate} />


          <div className="space-y-2">
            <Label>Mold Size</Label>
            <Select value={moldSize} onValueChange={setMoldSize}>
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {MOLD_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>LOT #</Label>
            <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Flavor</Label>
            <Select value={flavor} onValueChange={handleFlavorChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select flavor" />
              </SelectTrigger>
              <SelectContent>
                {flavorOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
                <SelectItem value={ADD_NEW_FLAVOR_VALUE} className="text-primary">
                  <span className="flex items-center">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add new flavor…
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {showAddFlavor && (
              <div className="flex gap-2 pt-1">
                <Input
                  autoFocus
                  placeholder="New flavor name"
                  value={newFlavorName}
                  onChange={(e) => setNewFlavorName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveNewFlavor();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveNewFlavor}
                  disabled={addFlavor.isPending || !newFlavorName.trim()}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddFlavor(false);
                    setNewFlavorName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <Select value={color} onValueChange={handleColorChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select color" />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value={ADD_NEW_COLOR_VALUE} className="text-primary">
                  <span className="flex items-center">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add new color…
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {showAddColor && (
              <div className="flex gap-2 pt-1">
                <Input
                  autoFocus
                  placeholder="New color name"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveNewColor();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveNewColor}
                  disabled={addColor.isPending || !newColorName.trim()}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddColor(false);
                    setNewColorName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Gummies Made For</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Quantity on Hand (gummies)</Label>
            <Input
              type="number"
              min="0"
              placeholder="0 if none on hand"
              value={quantityOnHand}
              onChange={(e) => setQuantityOnHand(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {editing ? "Save Changes" : "Log Sample"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
