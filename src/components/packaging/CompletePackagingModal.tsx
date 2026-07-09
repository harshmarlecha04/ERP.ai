import React, { useState, useMemo, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Package, Sparkles, Plus } from "lucide-react";
import { format } from "date-fns";
import { parseDateString, formatET } from "@/utils/dateUtils";
import { useCompletePackaging, PackagingScheduleItem } from "@/hooks/usePackagingSchedule";
import { useCreatePackagingMovement, usePackagingItems } from "@/hooks/usePackagingInventory";
import { useCreateLabelInventoryRecord, useCustomerProducts } from "@/hooks/useLabelInventory";
import { useFormulas } from "@/hooks/useFormulas";
import { usePouchInventory, useCreatePouch } from "@/hooks/usePouchInventory";

interface CompletePackagingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleItem: PackagingScheduleItem | null;
}

const BOTTLE_SIZE_OPTIONS = ["60ct", "70ct", "90ct", "120ct"];
type ExtraForm = "bulk" | "bottled";
type ExtraLabelMode = "labeled" | "not_labeled";

export const CompletePackagingModal: React.FC<CompletePackagingModalProps> = ({
  open,
  onOpenChange,
  scheduleItem,
}) => {
  const [bottlesPacked, setBottlesPacked] = useState("");
  const [notes, setNotes] = useState("");

  // Material selection (carried over from schedule)
  const [bottleItemId, setBottleItemId] = useState<string>("");
  const [capItemId, setCapItemId] = useState<string>("");
  const [labelCustomerProduct, setLabelCustomerProduct] = useState<string>("");
  const [bottleCount, setBottleCount] = useState<string>("");

  // Per-material correct + wastage
  const [labelCorrect, setLabelCorrect] = useState("");
  const [labelWaste, setLabelWaste] = useState("0");
  const [bottleCorrect, setBottleCorrect] = useState("");
  const [bottleWaste, setBottleWaste] = useState("0");
  const [capCorrect, setCapCorrect] = useState("");
  const [capWaste, setCapWaste] = useState("0");
  const [corrugatedItemId, setCorrugatedItemId] = useState<string>("");
  const [bottlesPerCorrugated, setBottlesPerCorrugated] = useState<string>("");
  const [corrugatedCorrect, setCorrugatedCorrect] = useState("");
  const [corrugatedWaste, setCorrugatedWaste] = useState("0");

  // Extras (disabled by default)
  const [extrasEnabled, setExtrasEnabled] = useState(false);
  const [extraForm, setExtraForm] = useState<ExtraForm>("bottled");
  const [extraLabelMode, setExtraLabelMode] = useState<ExtraLabelMode>("labeled");
  const [extraLabelCustomerProduct, setExtraLabelCustomerProduct] = useState<string>("");
  const [extraBottleCount, setExtraBottleCount] = useState<string>("60ct");
  const [extraBottlesQty, setExtraBottlesQty] = useState("");
  const [extraBottleItemId, setExtraBottleItemId] = useState<string>("");
  const [extraPouchId, setExtraPouchId] = useState<string>("");
  const [extraGummiesPerPouch, setExtraGummiesPerPouch] = useState("");
  const [extraPouches, setExtraPouches] = useState("");
  const [newPouchName, setNewPouchName] = useState("");
  const [createBrightStock, setCreateBrightStock] = useState(false);
  const [selectedFormulaId, setSelectedFormulaId] = useState("");

  const { mutateAsync: completePackaging, isPending: isCompleting } = useCompletePackaging();
  const { mutateAsync: createMovement } = useCreatePackagingMovement();
  const { mutateAsync: createLabelRecord } = useCreateLabelInventoryRecord();
  const { formulas } = useFormulas();
  const { data: packagingItems = [] } = usePackagingItems();
  const { data: customerProducts = [] } = useCustomerProducts();

  const bottleOptions = useMemo(
    () => packagingItems.filter((i: any) => i.category === "BOTTLES"),
    [packagingItems]
  );
  const capOptions = useMemo(
    () => packagingItems.filter((i: any) => i.category === "CAPS"),
    [packagingItems]
  );
  const corrugatedOptions = useMemo(
    () => packagingItems.filter((i: any) => i.category === "CORRUGATED"),
    [packagingItems]
  );

  const selectedBottle = bottleOptions.find((b: any) => b.id === bottleItemId);
  const bottlesPerUnit = selectedBottle?.bottles_per_unit || scheduleItem?.bottle_item?.bottles_per_unit || 1;
  const selectedCorrugated = corrugatedOptions.find((c: any) => c.id === corrugatedItemId);

  const isBrightStockRun = labelCustomerProduct === "BRIGHT_STOCK";

  // Initialize form from scheduled data when modal opens
  useEffect(() => {
    if (open && scheduleItem) {
      const expected = scheduleItem.expected_bottles || 0;
      const startIsBright = scheduleItem.label_customer_product === "BRIGHT_STOCK";

      setBottlesPacked(expected.toString());
      setNotes("");

      // Materials carried over from schedule
      setBottleItemId(scheduleItem.bottle_item_id || "");
      setCapItemId(scheduleItem.cap_item_id || "");
      setLabelCustomerProduct(scheduleItem.label_customer_product || "");
      setBottleCount(scheduleItem.count || "60ct");

      // Correct quantities default from scheduled bottle count
      const bpu = scheduleItem.bottle_item?.bottles_per_unit || 1;
      const bottleUnits = Math.ceil(expected / bpu);
      setLabelCorrect(startIsBright ? "0" : expected.toString());
      setLabelWaste("0");
      setBottleCorrect(bottleUnits.toString());
      setBottleWaste("0");
      setCapCorrect(expected.toString());
      setCapWaste("0");

      // Corrugated (optional, no schedule carryover — user selects per run)
      setCorrugatedItemId("");
      setBottlesPerCorrugated("");
      setCorrugatedCorrect("");
      setCorrugatedWaste("0");

      // Reset extras
      setExtrasEnabled(false);
      setExtraForm("bottled");
      setExtraLabelMode("labeled");
      setExtraLabelCustomerProduct(scheduleItem.label_customer_product || "");
      setExtraBottleCount(scheduleItem.count || "60ct");
      setExtraBottlesQty("");
      setExtraPouchId("");
      setExtraGummiesPerPouch("");
      setExtraPouches("");
      setNewPouchName("");
      setCreateBrightStock(false);
      setSelectedFormulaId("");
    }
  }, [open, scheduleItem]);

  // Auto-update correct quantities when bottlesPacked changes
  useEffect(() => {
    if (!bottlesPacked) return;
    const packed = parseInt(bottlesPacked) || 0;
    if (!isBrightStockRun) setLabelCorrect(packed.toString());
    setCapCorrect(packed.toString());
    setBottleCorrect(Math.ceil(packed / bottlesPerUnit).toString());
  }, [bottlesPacked, bottlesPerUnit, isBrightStockRun]);

  // When corrugated type is selected, default bottles-per-corrugated from item
  useEffect(() => {
    if (selectedCorrugated?.bottles_per_unit) {
      setBottlesPerCorrugated(String(selectedCorrugated.bottles_per_unit));
    }
  }, [selectedCorrugated?.id, selectedCorrugated?.bottles_per_unit]);

  // Recompute corrugated correct units from actual bottles ÷ bottles-per-corrugated
  useEffect(() => {
    const packed = parseInt(bottlesPacked) || 0;
    const bpc = parseInt(bottlesPerCorrugated) || 0;
    if (!corrugatedItemId || packed <= 0 || bpc <= 0) return;
    setCorrugatedCorrect(Math.ceil(packed / bpc).toString());
  }, [bottlesPacked, bottlesPerCorrugated, corrugatedItemId]);

  const num = (v: string) => parseFloat(v) || 0;
  const labelTotal = num(labelCorrect) + num(labelWaste);
  const bottleTotal = num(bottleCorrect) + num(bottleWaste);
  const capTotal = num(capCorrect) + num(capWaste);
  const corrugatedTotal = num(corrugatedCorrect) + num(corrugatedWaste);

  // Extras derived
  const isBulkExtra = extrasEnabled && extraForm === "bulk";
  const isBottledExtra = extrasEnabled && extraForm === "bottled";
  const isExtraLabeled = extraLabelMode === "labeled";
  const extraBottlesNum = isBottledExtra ? (parseInt(extraBottlesQty) || 0) : 0;
  const extraPouchesNum = isBulkExtra ? (parseInt(extraPouches) || 0) : 0;
  const extraGppNum = isBulkExtra ? (parseInt(extraGummiesPerPouch) || 0) : 0;
  const extraTotalGummies = extraPouchesNum * extraGppNum;

  const { data: pouchOptions = [] } = usePouchInventory();
  const { mutateAsync: createPouch } = useCreatePouch();

  const handleAddPouch = async () => {
    const name = newPouchName.trim();
    if (!name) return;
    const created = await createPouch({ name, quantity_on_hand: 0 });
    setExtraPouchId(created.id);
    setNewPouchName("");
  };

  const handleComplete = async () => {
    if (!scheduleItem) return;

    const packed = parseInt(bottlesPacked) || 0;

    try {
      // Extras add-on deductions for bottled path
      const extraBottlesUse = isBottledExtra ? extraBottlesNum : 0;
      const extraCapsUse = isBottledExtra ? extraBottlesNum : 0;
      const extraLabelsUse = isBottledExtra && isExtraLabeled ? extraBottlesNum : 0;

      // If extras use the same bottle SKU as the run, combine deductions; otherwise deduct separately
      const effectiveExtraBottleId = isBottledExtra ? (extraBottleItemId || bottleItemId) : "";
      const extrasShareBottle = effectiveExtraBottleId === bottleItemId;
      const extraBottleSelected = bottleOptions.find((b: any) => b.id === effectiveExtraBottleId);
      const extraBottlesPerUnit = extraBottleSelected?.bottles_per_unit || bottlesPerUnit || 1;
      const extraBottleDeductUnits = Math.ceil(extraBottlesUse / (extraBottlesPerUnit || 1));

      const totalBottleDeduct = bottleTotal + (extrasShareBottle ? extraBottleDeductUnits : 0);
      const totalCapDeduct = capTotal + extraCapsUse;
      const totalLabelDeduct = labelTotal + extraLabelsUse;

      // 1. Deduct bottle inventory (run + extras if same SKU)
      if (bottleItemId && totalBottleDeduct > 0) {
        await createMovement({
          item_id: bottleItemId,
          move_type: "USAGE",
          qty: totalBottleDeduct,
          move_date: formatET(new Date(), "yyyy-MM-dd"),
          notes: `Packaging: ${scheduleItem.customer_name} - ${scheduleItem.product_name} (run ${bottleCorrect}+waste ${bottleWaste}${extrasShareBottle && extraBottlesUse ? `, extras ${extraBottlesUse}` : ""})`,
        });
      }

      // 1b. Separate deduction when extras use a different bottle SKU
      if (!extrasShareBottle && effectiveExtraBottleId && extraBottleDeductUnits > 0) {
        await createMovement({
          item_id: effectiveExtraBottleId,
          move_type: "USAGE",
          qty: extraBottleDeductUnits,
          move_date: formatET(new Date(), "yyyy-MM-dd"),
          notes: `Packaging extras: ${scheduleItem.customer_name} - ${scheduleItem.product_name} (extras ${extraBottlesUse})`,
        });
      }

      // 2. Deduct cap inventory
      if (capItemId && totalCapDeduct > 0) {
        await createMovement({
          item_id: capItemId,
          move_type: "USAGE",
          qty: totalCapDeduct,
          move_date: formatET(new Date(), "yyyy-MM-dd"),
          notes: `Packaging: ${scheduleItem.customer_name} - ${scheduleItem.product_name} (run ${capCorrect}+waste ${capWaste}${extraCapsUse ? `, extras ${extraCapsUse}` : ""})`,
        });
      }

      // 2b. Deduct corrugated inventory
      if (corrugatedItemId && corrugatedTotal > 0) {
        await createMovement({
          item_id: corrugatedItemId,
          move_type: "USAGE",
          qty: corrugatedTotal,
          move_date: formatET(new Date(), "yyyy-MM-dd"),
          notes: `Packaging: ${scheduleItem.customer_name} - ${scheduleItem.product_name} (corrugated ${corrugatedCorrect}+waste ${corrugatedWaste}, ${bottlesPerCorrugated} bottles/box)`,
        });
      }



      // 3. Deduct label inventory for run (skip if bright stock)
      if (!isBrightStockRun && labelCustomerProduct && labelTotal > 0) {
        await createLabelRecord({
          customer_product: labelCustomerProduct,
          date: formatET(new Date(), "yyyy-MM-dd"),
          received_qty: 0,
          used_qty: labelTotal,
          on_hand: -labelTotal,
          source_sheet: null,
          customer_id: null,
          product_name: scheduleItem.product_name || null,
        });
      }

      // 3b. Deduct labels for bottled-extra when labeled
      if (extraLabelsUse > 0 && extraLabelCustomerProduct) {
        await createLabelRecord({
          customer_product: extraLabelCustomerProduct,
          date: formatET(new Date(), "yyyy-MM-dd"),
          received_qty: 0,
          used_qty: extraLabelsUse,
          on_hand: -extraLabelsUse,
          source_sheet: null,
          customer_id: null,
          product_name: scheduleItem.product_name || null,
        });
      }

      const extrasNote = isBulkExtra
        ? `Extras (Bulk): ${extraPouchesNum} pouches × ${extraGppNum} = ${extraTotalGummies} gummies`
        : isBottledExtra
          ? `Extras (Bottled${isExtraLabeled ? "/Labeled" : "/Not Labeled"}): ${extraBottlesNum} bottles ${extraBottleCount}`
          : "";
      const combinedNotes = [notes, extrasNote].filter(Boolean).join(" | ");

      const bottleSizeNum = isBottledExtra
        ? parseInt((extraBottleCount || bottleCount).replace(/\D/g, "")) || 60
        : parseInt((bottleCount || scheduleItem.count).replace(/\D/g, "")) || 60;

      const brightStockQty = isBottledExtra ? extraBottlesNum : 0;
      const willCreateBrightStock =
        extrasEnabled && createBrightStock && !!selectedFormulaId &&
        ((isBulkExtra && extraTotalGummies > 0) || (isBottledExtra && extraBottlesNum > 0));

      await completePackaging({
        schedule_id: scheduleItem.id,
        completion_date: formatET(new Date(), "yyyy-MM-dd"),
        bottles_packed: packed,
        labels_used: totalLabelDeduct,
        caps_used: totalCapDeduct,
        bottles_used: totalBottleDeduct,
        bright_stock_qty: brightStockQty,
        notes: combinedNotes,
        create_bright_stock: willCreateBrightStock,
        bright_stock_data: willCreateBrightStock
          ? { formula_id: selectedFormulaId, bottle_size: bottleSizeNum }
          : undefined,
        extra_form: extrasEnabled ? extraForm : null,
        extra_is_labeled: isBottledExtra ? isExtraLabeled : null,
        extra_pouches_used: isBulkExtra ? extraPouchesNum : null,
        extra_gummies_per_pouch: isBulkExtra ? extraGppNum : null,
        extra_total_gummies: isBulkExtra ? extraTotalGummies : null,
        extra_bottle_count: isBottledExtra ? extraBottleCount : null,
        extra_label_customer_product: isBottledExtra && isExtraLabeled ? extraLabelCustomerProduct : null,
        extra_pouch_inventory_id: isBulkExtra ? (extraPouchId || null) : null,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to complete packaging:", error);
    }
  };

  if (!scheduleItem) return null;

  const hasExtraQty = isBulkExtra ? extraTotalGummies > 0 : isBottledExtra && extraBottlesNum > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        style={{ ['--dialog-max-width' as any]: '1100px' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Complete Packaging Run
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Schedule Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                {scheduleItem.customer_name} - {scheduleItem.product_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">{scheduleItem.count}</Badge>
                <Badge variant="outline">
                  Scheduled: {scheduleItem.expected_bottles.toLocaleString()} bottles
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Date: {formatET(scheduleItem.schedule_date, "PPP")}
              </p>
            </CardContent>
          </Card>

          {/* Actual bottles packed */}
          <div className="space-y-2">
            <Label htmlFor="bottles-packed">Actual Bottles Packed *</Label>
            <Input
              id="bottles-packed"
              type="number"
              value={bottlesPacked}
              onChange={(e) => setBottlesPacked(e.target.value)}
              placeholder="0"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Carried from schedule. Changing this updates the suggested correct units below.
            </p>
          </div>

          {/* Materials table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Materials Used</CardTitle>
              <p className="text-xs text-muted-foreground">
                Values carried over from the scheduled data. Edit the correct units or add wastage; totals deduct from inventory.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2 w-[18%]">Material</th>
                      <th className="text-left font-medium px-3 py-2 w-[34%]">Selected</th>
                      <th className="text-left font-medium px-3 py-2 w-[16%]">Correct Units</th>
                      <th className="text-left font-medium px-3 py-2 w-[16%]">Wastage</th>
                      <th className="text-right font-medium px-3 py-2 w-[16%]">Total to Deduct</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Label / Product */}
                    <tr className="border-t">
                      <td className="px-3 py-2 font-medium align-middle">Label / Product</td>
                      <td className="px-3 py-2">
                        <Select
                          value={labelCustomerProduct || "__none__"}
                          onValueChange={(v) => setLabelCustomerProduct(v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger><SelectValue placeholder="Select label..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BRIGHT_STOCK">Bright Stock — No Label</SelectItem>
                            <SelectItem value="__none__">None</SelectItem>
                            {customerProducts.map((p: string) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={labelCorrect}
                          onChange={(e) => setLabelCorrect(e.target.value)}
                          disabled={isBrightStockRun}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={labelWaste}
                          onChange={(e) => setLabelWaste(e.target.value)}
                          disabled={isBrightStockRun}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {isBrightStockRun ? "—" : labelTotal.toLocaleString()}
                      </td>
                    </tr>

                    {/* Bottle */}
                    <tr className="border-t">
                      <td className="px-3 py-2 font-medium align-middle">
                        Bottle
                        <div className="text-[10px] font-normal text-muted-foreground">
                          {bottlesPerUnit} bottles/unit
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={bottleItemId || "__none__"}
                          onValueChange={(v) => setBottleItemId(v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger><SelectValue placeholder="Select bottle..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {bottleOptions.map((b: any) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.item_name} ({b.bottles_per_unit}/unit)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={bottleCorrect}
                          onChange={(e) => setBottleCorrect(e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={bottleWaste}
                          onChange={(e) => setBottleWaste(e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {bottleTotal.toLocaleString()}
                      </td>
                    </tr>

                    {/* Cap */}
                    <tr className="border-t">
                      <td className="px-3 py-2 font-medium align-middle">Cap</td>
                      <td className="px-3 py-2">
                        <Select
                          value={capItemId || "__none__"}
                          onValueChange={(v) => setCapItemId(v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger><SelectValue placeholder="Select cap..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {capOptions.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>{c.item_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={capCorrect}
                          onChange={(e) => setCapCorrect(e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={capWaste}
                          onChange={(e) => setCapWaste(e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {capTotal.toLocaleString()}
                      </td>
                    </tr>

                    {/* Bottle Size */}
                    <tr className="border-t">
                      <td className="px-3 py-2 font-medium align-middle">Bottle Size</td>
                      <td className="px-3 py-2">
                        <Select value={bottleCount} onValueChange={setBottleCount}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {BOTTLE_SIZE_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">—</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">—</td>
                      <td className="px-3 py-2 text-right text-muted-foreground text-xs">—</td>
                    </tr>

                    {/* Corrugated */}
                    <tr className="border-t">
                      <td className="px-3 py-2 font-medium align-middle">
                        <div>Corrugated</div>
                        {corrugatedItemId && bottlesPerCorrugated && (
                          <div className="text-xs text-muted-foreground font-normal">
                            {bottlesPerCorrugated} bottles/box
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          <Select
                            value={corrugatedItemId || "__none__"}
                            onValueChange={(v) => setCorrugatedItemId(v === "__none__" ? "" : v)}
                          >
                            <SelectTrigger><SelectValue placeholder="Select corrugated..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {corrugatedOptions.map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.item_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {corrugatedItemId && (
                            <Input
                              type="number"
                              min={1}
                              placeholder="Bottles per corrugated"
                              value={bottlesPerCorrugated}
                              onChange={(e) => setBottlesPerCorrugated(e.target.value)}
                              className="h-8 text-xs"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {corrugatedItemId ? (
                          <Input
                            type="number"
                            value={corrugatedCorrect}
                            onChange={(e) => setCorrugatedCorrect(e.target.value)}
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {corrugatedItemId ? (
                          <Input
                            type="number"
                            value={corrugatedWaste}
                            onChange={(e) => setCorrugatedWaste(e.target.value)}
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {corrugatedItemId ? corrugatedTotal.toLocaleString() : <span className="text-muted-foreground text-xs font-normal">—</span>}
                      </td>
                    </tr>
                  </tbody>

                </table>
              </div>
            </CardContent>
          </Card>

          {/* Extra Bottles - disabled by default */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Extra Bottles / Bright Stock
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="extras-toggle" className="text-xs text-muted-foreground">
                  Enable
                </Label>
                <Switch
                  id="extras-toggle"
                  checked={extrasEnabled}
                  onCheckedChange={setExtrasEnabled}
                />
              </div>
            </CardHeader>
            {extrasEnabled && (
              <CardContent className="space-y-4">
                {/* Step 1: Form */}
                <div className="space-y-2">
                  <Label>Form</Label>
                  <ToggleGroup
                    type="single"
                    value={extraForm}
                    onValueChange={(v) => v && setExtraForm(v as ExtraForm)}
                    className="justify-start flex-wrap"
                  >
                    <ToggleGroupItem value="bulk" className="border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Bulk</ToggleGroupItem>
                    <ToggleGroupItem value="bottled" className="border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Bottled</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* Bulk fields */}
                {isBulkExtra && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 border rounded-md bg-background">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Pouch Type *</Label>
                      <Select value={extraPouchId} onValueChange={setExtraPouchId}>
                        <SelectTrigger><SelectValue placeholder="Select pouch..." /></SelectTrigger>
                        <SelectContent>
                          {pouchOptions.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} (on hand: {p.quantity_on_hand})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add new pouch type..."
                          value={newPouchName}
                          onChange={(e) => setNewPouchName(e.target.value)}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={handleAddPouch} disabled={!newPouchName.trim()}>
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Gummies / Pouch *</Label>
                      <Input type="number" value={extraGummiesPerPouch} onChange={(e) => setExtraGummiesPerPouch(e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label>Number of Pouches *</Label>
                      <Input type="number" value={extraPouches} onChange={(e) => setExtraPouches(e.target.value)} placeholder="0" />
                    </div>
                    <div className="md:col-span-2 text-sm font-medium">
                      Total Gummies: <span className="tabular-nums">{extraTotalGummies.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Bottled fields */}
                {isBottledExtra && (
                  <div className="space-y-4 p-3 border rounded-md bg-background">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Total Bottles Packed *</Label>
                        <Input type="number" value={extraBottlesQty} onChange={(e) => setExtraBottlesQty(e.target.value)} placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label>Bottle Count</Label>
                        <Select value={extraBottleCount} onValueChange={setExtraBottleCount}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {BOTTLE_SIZE_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Bottle</Label>
                        <Select
                          value={(extraBottleItemId || bottleItemId) || "__none__"}
                          onValueChange={(v) => setExtraBottleItemId(v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger><SelectValue placeholder="Select bottle..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {bottleOptions.map((b: any) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.item_name} ({b.bottles_per_unit}/unit)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Step 2: Label */}
                    <div className="space-y-2">
                      <Label>Label</Label>
                      <ToggleGroup
                        type="single"
                        value={extraLabelMode}
                        onValueChange={(v) => v && setExtraLabelMode(v as ExtraLabelMode)}
                        className="justify-start flex-wrap"
                      >
                        <ToggleGroupItem value="labeled" className="border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Labeled</ToggleGroupItem>
                        <ToggleGroupItem value="not_labeled" className="border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Not Labeled</ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    {isExtraLabeled && (
                      <div className="space-y-2">
                        <Label>Label / Product (defaults to schedule)</Label>
                        <Select value={extraLabelCustomerProduct || "__none__"} onValueChange={(v) => setExtraLabelCustomerProduct(v === "__none__" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="Select label..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {customerProducts.map((p: string) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {/* Bright stock toggle */}
                {hasExtraQty && (
                  <div className="space-y-3 p-3 border rounded-md bg-background">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="create-bright-stock"
                        checked={createBrightStock}
                        onCheckedChange={(checked) => setCreateBrightStock(checked === true)}
                      />
                      <Label htmlFor="create-bright-stock" className="text-sm">
                        Record as Bright Stock entry ({isBulkExtra ? `${extraTotalGummies} gummies` : `${extraBottlesNum} bottles`})
                      </Label>
                    </div>
                    {createBrightStock && (
                      <div className="space-y-2">
                        <Label htmlFor="formula">Formula *</Label>
                        <Select value={selectedFormulaId} onValueChange={setSelectedFormulaId}>
                          <SelectTrigger><SelectValue placeholder="Select formula..." /></SelectTrigger>
                          <SelectContent>
                            {formulas.map((formula) => (
                              <SelectItem key={formula.id} value={formula.id}>
                                {formula.code} - {formula.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this packaging run..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={
              isCompleting ||
              !bottlesPacked ||
              (extrasEnabled && createBrightStock && hasExtraQty && !selectedFormulaId) ||
              (isBulkExtra && !extraPouchId && extraTotalGummies > 0)
            }
          >
            {isCompleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Complete & Deduct"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
