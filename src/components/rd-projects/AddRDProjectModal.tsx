import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, CalendarIcon, AlertCircle } from "lucide-react";
import { useCreateRDProject, useUpdateRDProject } from "@/hooks/useRDProjects";
import { useUpdateVersion } from "@/hooks/useRDProjectVersions";
import { useRDBaseTemplates } from "@/hooks/useRDBaseTemplates";
import { useCustomers, type Customer } from "@/hooks/useCustomers";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AddCustomerModal } from "@/components/orders/AddCustomerModal";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { INACTIVE_BULK_OPTIONS } from "@/lib/rdInactiveOptions";

interface AddRDProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProject?: any;
  editingVersion?: any;
}

interface Active {
  active_name: string;
  mg_per_gummy: string;
  overage_pct?: string;
}

export const AddRDProjectModal = ({
  open,
  onOpenChange,
  editingProject,
  editingVersion,
}: AddRDProjectModalProps) => {

  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [flavor, setFlavor] = useState("");
  const [color, setColor] = useState("");
  const [notes, setNotes] = useState("");
  const [moldSize, setMoldSize] = useState<string>("");
  const [actives, setActives] = useState<Active[]>([{ active_name: "", mg_per_gummy: "" }]);
  const [inactives, setInactives] = useState<string[]>([""]);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [formulaReferenceLink, setFormulaReferenceLink] = useState("");
  const [gummiesCount, setGummiesCount] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [isVersionLocked, setIsVersionLocked] = useState(false);
  const [versionStatus, setVersionStatus] = useState<string>("");
  const [baseTemplateId, setBaseTemplateId] = useState<string>("");
  const [pieceWeightG, setPieceWeightG] = useState<string>("");
  const { data: baseTemplates = [] } = useRDBaseTemplates();

  const MOLD_SIZE_OPTIONS = [
    "3g coin/button shaped mold",
    "3.5g berry mold",
    "4g berry mold",
    "4.5g fruit mold",
  ];


  const { customers = [] } = useCustomers();
  const createProject = useCreateRDProject();
  const updateProject = useUpdateRDProject();
  const updateVersion = useUpdateVersion();
  const { toast } = useToast();

  useEffect(() => {
    if (open && !editingProject) {
      setCustomerId("");
      setCustomerName("");
      setProjectName("");
      setFlavor("");
      setColor("");
      setNotes("");
      setMoldSize("");
      setFormulaReferenceLink("");
      setGummiesCount("");
      setScheduledDate(undefined);
      setActives([{ active_name: "", mg_per_gummy: "", overage_pct: "" }]);
      setInactives([""]);
      setIsVersionLocked(false);
      setVersionStatus("");
      setBaseTemplateId("");
      setPieceWeightG("");
    } else if (open && editingProject) {
      setCustomerId(editingProject.customer_id || "");
      setCustomerName(editingProject.customer_name);
      setProjectName(editingProject.project_name || "");
      setFormulaReferenceLink(editingProject.formula_reference_link || "");
      
      // Use the explicitly-targeted version when provided, else fall back to current version
      const targetVersion = editingVersion || editingProject.current_version;
      const status = targetVersion?.status || "";
      setVersionStatus(status);
      setIsVersionLocked(status !== 'pending_approval' && status !== 'scheduled' && status !== '');
      
      setFlavor(targetVersion?.flavor || "");
      setColor(targetVersion?.color || "");
      setMoldSize(targetVersion?.mold_size || editingProject.mold_size || "");
      setNotes(targetVersion?.notes || "");
      setGummiesCount(targetVersion?.gummies_count?.toString() || "");
      setScheduledDate(
        targetVersion?.scheduled_date 
          ? new Date(targetVersion.scheduled_date) 
          : undefined
      );
      const overageMap: Record<string, number> = {};
      ((targetVersion as any)?.active_overage_percent || []).forEach((o: any) => {
        if (o?.name) overageMap[o.name] = o.overage_pct;
      });
      setActives(
        targetVersion?.actives?.map((a: any) => ({
          active_name: a.active_name,
          mg_per_gummy: String(a.mg_per_gummy),
          overage_pct: overageMap[a.active_name] ? String(overageMap[a.active_name]) : "",
        })) || [{ active_name: "", mg_per_gummy: "", overage_pct: "" }]
      );
      setInactives(
        targetVersion?.inactives?.length
          ? targetVersion.inactives.map((i: any) => i.name)
          : [""]
      );
      setBaseTemplateId((targetVersion as any)?.base_template_id || "");
      setPieceWeightG((targetVersion as any)?.piece_weight_g ? String((targetVersion as any).piece_weight_g) : "");
    }

  }, [open, editingProject, editingVersion]);


  const handleCustomerChange = (value: string) => {
    setCustomerId(value);
    const customer = customers.find((c: any) => c.id === value);
    if (customer) {
      setCustomerName(customer.company_name);
    }
  };

  const handleCustomerCreated = (newCustomer: Customer) => {
    setCustomerId(newCustomer.id);
    setCustomerName(newCustomer.company_name);
    setShowAddCustomerModal(false);
    
    toast({
      title: "Customer created",
      description: `${newCustomer.company_name} has been added and selected.`,
    });
  };

  const addActive = () => {
    setActives([...actives, { active_name: "", mg_per_gummy: "", overage_pct: "" }]);
  };

  const removeActive = (index: number) => {
    setActives(actives.filter((_, i) => i !== index));
  };

  const updateActive = (index: number, field: keyof Active, value: string) => {
    const newActives = [...actives];
    newActives[index][field] = value;
    setActives(newActives);
  };

  const addInactive = () => setInactives([...inactives, ""]);
  const removeInactive = (index: number) => setInactives(inactives.filter((_, i) => i !== index));
  const updateInactive = (index: number, value: string) => {
    const next = [...inactives];
    next[index] = value;
    setInactives(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId || !customerName) {
      toast({
        title: "Customer required",
        description: "Please select a customer or create a new one.",
        variant: "destructive",
      });
      return;
    }

    if (!projectName) {
      toast({
        title: "Project name required",
        description: "Please provide a project name.",
        variant: "destructive",
      });
      return;
    }

    if (!flavor || !color || actives.length === 0) {
      toast({
        title: "Missing required fields",
        description: "Please fill in flavor, color, and at least one active ingredient.",
        variant: "destructive",
      });
      return;
    }

    const activesData = actives
      .filter((a) => a.active_name && a.mg_per_gummy)
      .map((a) => ({
        active_name: a.active_name,
        mg_per_gummy: parseFloat(a.mg_per_gummy),
        overage_pct: a.overage_pct ? parseFloat(a.overage_pct) : 0,
      }));

    if (activesData.length === 0) {
      toast({
        title: "Invalid active ingredients",
        description: "Please add at least one valid active ingredient with name and mg/gummy.",
        variant: "destructive",
      });
      return;
    }

    const projectData = {
      customer_id: customerId,
      customer_name: customerName,
      project_name: projectName,
      flavor,
      color,
      mold_size: moldSize || null,
      notes,
      formula_reference_link: formulaReferenceLink || null,
      gummies_count: gummiesCount ? parseInt(gummiesCount) : null,
      scheduled_date: scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : null,
      actives: activesData,
      inactives: inactives.map(s => s.trim()).filter(Boolean),
      base_template_id: baseTemplateId || null,
      piece_weight_g: pieceWeightG ? parseFloat(pieceWeightG) : null,
    };

    if (editingProject) {
      // Always update project-level fields
      await updateProject.mutateAsync({
        id: editingProject.id,
        project_number: editingProject.project_number,
        customer_id: customerId,
        customer_name: customerName,
        project_name: projectName,
        formula_reference_link: formulaReferenceLink || undefined,
      });

      // Update version fields if the targeted version is editable (pending/scheduled)
      const targetVersion = editingVersion || editingProject.current_version;
      const editableStatuses = ['pending_approval', 'scheduled'];
      if (targetVersion && editableStatuses.includes(targetVersion.status)) {
        await updateVersion.mutateAsync({
          id: targetVersion.id,
          rd_project_id: editingProject.id,
          flavor,
          color,
          mold_size: moldSize || undefined,
          actives: activesData,
          inactives: inactives.map(s => s.trim()).filter(Boolean),
          notes,
          gummies_count: gummiesCount ? parseInt(gummiesCount) : undefined,
          scheduled_date: scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : undefined,
          base_template_id: baseTemplateId || null,
          piece_weight_g: pieceWeightG ? parseFloat(pieceWeightG) : null,
        });
        toast({
          title: "Success",
          description: `Version ${targetVersion.version_number || ''} updated successfully`.trim(),
        });
      } else if (targetVersion && !editableStatuses.includes(targetVersion.status)) {
        toast({
          title: "Project updated",
          description: "Version is locked. Formula changes require creating a new version.",
        });
      }

    } else {
      await createProject.mutateAsync(projectData);
    }


    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[--dialog-max-width:42rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingProject ? `Edit R&D Project${editingVersion?.version_number ? ` - ${editingVersion.version_number}` : ""}` : "New R&D Project"}
            {isVersionLocked && (
              <Badge variant="secondary" className="ml-2">
                {versionStatus === 'approved' ? 'Approved' :
                 versionStatus === 'rejected' ? 'Rejected' :
                 versionStatus === 'qa_received' ? 'QA Received' :
                 versionStatus}
              </Badge>
            )}

          </DialogTitle>
        </DialogHeader>

        {isVersionLocked && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This version has been {versionStatus}. Formula fields are locked. Only customer and reference link can be updated. To make formula changes, create a new version.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="customer">Customer *</Label>
            <div className="flex gap-2">
              <Select value={customerId} onValueChange={handleCustomerChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer: any) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => setShowAddCustomerModal(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Customer
              </Button>
            </div>
            {!customerId && (
              <p className="text-sm text-muted-foreground">
                Customer is required. Select from list or create a new one.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name *</Label>
            <Input
              id="projectName"
              placeholder="e.g., Melatonin Sleep Gummies, Immunity Boost Formula"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
            />
            <p className="text-sm text-muted-foreground">
              A descriptive name to identify this R&D project.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="formulaLink">R&D Formula Link (Optional)</Label>
            <Input
              id="formulaLink"
              type="url"
              placeholder="e.g., https://dropbox.com/... or any reference link"
              value={formulaReferenceLink}
              onChange={(e) => setFormulaReferenceLink(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Paste a link to Dropbox, Google Drive, or any reference documentation for this R&D formula.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Active Ingredients</Label>
              <Button type="button" variant="outline" size="sm" onClick={addActive}>
                <Plus className="h-4 w-4 mr-1" />
                Add Active
              </Button>
            </div>

            <div className="grid grid-cols-[1fr_128px_96px_96px_40px] gap-2 text-xs text-muted-foreground px-1">
              <div>Active Name</div>
              <div>Label Claim (mg)</div>
              <div>Overage (%)</div>
              <div>Total (mg)</div>
              <div></div>
            </div>

            {actives.map((active, index) => {
              const lc = parseFloat(active.mg_per_gummy) || 0;
              const ov = parseFloat(active.overage_pct || "") || 0;
              const total = lc > 0 ? (lc * (1 + ov / 100)).toFixed(2) : "—";
              return (
                <div key={index} className="grid grid-cols-[1fr_128px_96px_96px_40px] gap-2 items-start">
                  <Input
                    placeholder="e.g., Vitamin D3, Melatonin"
                    value={active.active_name}
                    onChange={(e) => updateActive(index, "active_name", e.target.value)}
                    disabled={isVersionLocked}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="mg"
                    value={active.mg_per_gummy}
                    onChange={(e) => updateActive(index, "mg_per_gummy", e.target.value)}
                    disabled={isVersionLocked}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="%"
                    value={active.overage_pct || ""}
                    onChange={(e) => updateActive(index, "overage_pct", e.target.value)}
                    disabled={isVersionLocked}
                    title="Optional overage % (e.g. 10 for +10%)"
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
                      disabled={isVersionLocked}
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Inactive Ingredients</Label>
              <Button type="button" variant="outline" size="sm" onClick={addInactive} disabled={isVersionLocked}>
                <Plus className="h-4 w-4 mr-1" />
                Add Inactive
              </Button>
            </div>
            {inactives.map((inactive, index) => {
              const isCustom = inactive && !INACTIVE_BULK_OPTIONS.includes(inactive);
              return (
                <div key={index} className="flex gap-2 items-start">
                  <Select
                    value={inactive || undefined}
                    onValueChange={(v) => updateInactive(index, v)}
                    disabled={isVersionLocked}
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
                      disabled={isVersionLocked}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>


          <div className="space-y-2">
            <Label htmlFor="flavor">Flavor</Label>
            <Input
              id="flavor"
              placeholder="e.g., Mixed Berry, Orange Citrus"
              value={flavor}
              onChange={(e) => setFlavor(e.target.value)}
              required
              disabled={isVersionLocked}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              placeholder="e.g., Red, Natural Amber"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              required
              disabled={isVersionLocked}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="moldSize">Mold Size</Label>
            <Select value={moldSize} onValueChange={setMoldSize} disabled={isVersionLocked}>
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
            <Label htmlFor="gummiesCount">Number of Gummies (Optional)</Label>
            <Input
              id="gummiesCount"
              type="number"
              min="0"
              placeholder="e.g., 1000"
              value={gummiesCount}
              onChange={(e) => setGummiesCount(e.target.value)}
              disabled={isVersionLocked}
            />
            <p className="text-sm text-muted-foreground">
              Total number of gummies planned for R&D production.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Base Template (for Batch Sheet PDF)</Label>
              <Select
                value={baseTemplateId}
                onValueChange={(v) => {
                  setBaseTemplateId(v);
                  const t = baseTemplates.find((x: any) => x.id === v);
                  if (t && !pieceWeightG) setPieceWeightG(String(t.default_piece_weight_g));
                }}
                disabled={isVersionLocked}
              >
                <SelectTrigger><SelectValue placeholder="Select base template" /></SelectTrigger>
                <SelectContent>
                  {baseTemplates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Required to generate batch sheet PDF.</p>
            </div>
            <div className="space-y-2">
              <Label>Piece Weight (g)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g., 3.5"
                value={pieceWeightG}
                onChange={(e) => setPieceWeightG(e.target.value)}
                disabled={isVersionLocked}
              />
            </div>
          </div>


          <div className="space-y-2">
            <Label htmlFor="scheduledDate">Scheduled R&D Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !scheduledDate && "text-muted-foreground"
                  )}
                  disabled={isVersionLocked}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <p className="text-sm text-muted-foreground">
              Scheduled date for R&D production/testing.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional project notes or requirements..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={isVersionLocked}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProject.isPending || updateProject.isPending || updateVersion.isPending}
            >
              {editingProject ? "Update Project" : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>

      <AddCustomerModal
        open={showAddCustomerModal}
        onOpenChange={setShowAddCustomerModal}
        onSuccess={handleCustomerCreated}
      />
    </Dialog>
  );
};