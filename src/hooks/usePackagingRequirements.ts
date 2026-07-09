import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PackagingRequirementCategory =
  | "BOTTLES"
  | "CAPS"
  | "LABELS"
  | "CORRUGATED"
  | "POUCHES";

export interface PackagingRequirement {
  id: string;
  item_name: string;
  category: PackagingRequirementCategory;
  required: number;
  on_hand: number;
  shortage: number;
  used_by: string[];
  min_level?: number;
  uom?: string;
}

export interface PackagingRequirementsSummary {
  bottles: { required: number; onHand: number; shortage: number };
  caps: { required: number; onHand: number; shortage: number };
  labels: { required: number; onHand: number; shortage: number };
  corrugated: { required: number; onHand: number; shortage: number };
  pouches: { required: number; onHand: number; shortage: number };
  shortageCount: number;
}

type RequirementBucket = {
  required: number;
  onHand: number;
  itemName: string;
  category: PackagingRequirementCategory;
  usedBy: Set<string>;
  minLevel?: number;
  uom?: string;
};

const BRIGHT_STOCK_VALUE = "BRIGHT_STOCK";

const addRequirement = (
  buckets: Map<string, RequirementBucket>,
  id: string,
  itemName: string,
  category: PackagingRequirementCategory,
  required: number,
  onHand: number,
  usedBy: string,
  options?: { minLevel?: number; uom?: string }
) => {
  if (!id || required <= 0) return;

  const existing = buckets.get(id);
  if (existing) {
    existing.required += required;
    existing.usedBy.add(usedBy);
    return;
  }

  buckets.set(id, {
    required,
    onHand,
    itemName,
    category,
    usedBy: new Set([usedBy]),
    minLevel: options?.minLevel,
    uom: options?.uom,
  });
};

const buildSummary = (
  requirements: PackagingRequirement[],
  category: PackagingRequirementCategory
) => ({
  required: requirements
    .filter((r) => r.category === category)
    .reduce((sum, r) => sum + r.required, 0),
  onHand: requirements
    .filter((r) => r.category === category)
    .reduce((sum, r) => sum + r.on_hand, 0),
  shortage: requirements
    .filter((r) => r.category === category)
    .reduce((sum, r) => sum + r.shortage, 0),
});

export function usePackagingRequirements(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["packaging-requirements", "scheduled-only-v2", startDate, endDate],
    queryFn: async () => {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("packaging_schedule")
        .select(
          `
          id,
          schedule_date,
          customer_name,
          product_name,
          bottle_item_id,
          cap_item_id,
          label_customer_product,
          count,
          expected_bottles,
          status,
          lot_number,
          order_header_id,
          bottle_item:packaging_item!packaging_schedule_bottle_item_id_fkey(id, item_name, bottles_per_unit, min_level, uom),
          cap_item:packaging_item!packaging_schedule_cap_item_id_fkey(id, item_name, min_level, uom)
        `
        )
        .gte("schedule_date", startDate)
        .lte("schedule_date", endDate)
        .in("status", ["pending", "in_progress"]);

      if (scheduleError) throw scheduleError;

      const activeSchedule = scheduleData || [];
      const scheduledBottleIds = [
        ...new Set(activeSchedule.map((item: any) => item.bottle_item_id).filter(Boolean)),
      ];
      const scheduledCapIds = [
        ...new Set(activeSchedule.map((item: any) => item.cap_item_id).filter(Boolean)),
      ];
      const scheduledPackagingIds = [...new Set([...scheduledBottleIds, ...scheduledCapIds])];
      const scheduledLabelNames = [
        ...new Set(
          activeSchedule
            .map((item: any) => item.label_customer_product)
            .filter((labelName: string | null) => labelName && labelName !== BRIGHT_STOCK_VALUE)
        ),
      ];
      const orderHeaderIds = activeSchedule
        .map((item: any) => item.order_header_id)
        .filter(Boolean);

      let orderHeaders: any[] = [];
      if (orderHeaderIds.length > 0) {
        const { data, error } = await supabase
          .from("order_headers")
          .select("id, po_number, order_number")
          .in("id", [...new Set(orderHeaderIds)]);

        if (error) throw error;
        orderHeaders = data || [];
      }

      let packagingBalances: any[] = [];
      if (scheduledPackagingIds.length > 0) {
        const { data, error } = await supabase
          .from("v_packaging_balances")
          .select("*")
          .in("item_id", scheduledPackagingIds);

        if (error) throw error;
        packagingBalances = data || [];
      }

      let labelInventory: any[] = [];
      if (scheduledLabelNames.length > 0) {
        const { data, error } = await supabase
          .from("label_inventory")
          .select("id, customer_product, on_hand")
          .in("customer_product", scheduledLabelNames);

        if (error) throw error;
        labelInventory = data || [];
      }

      const { data: corrugatedShippers, error: corrugatedError } = await supabase
        .from("corrugated_shippers")
        .select("id, name, quantity, bottles_per_box");

      if (corrugatedError) throw corrugatedError;

      const orderMap = new Map(orderHeaders.map((order) => [order.id, order]));
      const packagingMap = new Map(
        (packagingBalances || []).map((item: any) => [item.item_id, item])
      );
      const labelOnHandByName = new Map<string, number>();

      (labelInventory || []).forEach((label: any) => {
        labelOnHandByName.set(
          label.customer_product,
          (labelOnHandByName.get(label.customer_product) || 0) + (label.on_hand || 0)
        );
      });

      const requirementsById = new Map<string, RequirementBucket>();

      const corrugatedInventoryRows = (packagingBalances || []).filter(
        (item: any) => item.category === "CORRUGATED"
      );
      const corrugatedOnHandFromPackaging = corrugatedInventoryRows.reduce(
        (sum: number, item: any) => sum + (item.on_hand || 0),
        0
      );
      const corrugatedOnHandFromShippers = (corrugatedShippers || []).reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0
      );
      const corrugatedOnHand = corrugatedOnHandFromPackaging || corrugatedOnHandFromShippers;
      const corrugatedBottlesPerBox =
        corrugatedInventoryRows.find((item: any) => item.bottles_per_unit)?.bottles_per_unit ||
        (corrugatedShippers || []).find((item: any) => item.bottles_per_box)?.bottles_per_box ||
        12;
      const corrugatedUsedBy = new Set<string>();
      let corrugatedRequired = 0;

      activeSchedule.forEach((scheduleItem: any) => {
        const expectedBottles = scheduleItem.expected_bottles || 0;
        const order = orderMap.get(scheduleItem.order_header_id);
        const orderRef = order?.po_number || order?.order_number || "No PO";
        const usedBy = `${scheduleItem.customer_name} · ${scheduleItem.product_name} · ${orderRef} · ${scheduleItem.schedule_date} · ${expectedBottles.toLocaleString()} bottles`;

        const bottleId = scheduleItem.bottle_item_id;
        if (bottleId) {
          const balance = packagingMap.get(bottleId) as any;
          const bottleItem = scheduleItem.bottle_item as any;
          const bottlesPerUnit = balance?.bottles_per_unit || bottleItem?.bottles_per_unit || 1;
          const requiredUnits = Math.ceil(expectedBottles / Math.max(1, bottlesPerUnit));

          addRequirement(
            requirementsById,
            bottleId,
            balance?.item_name || bottleItem?.item_name || "Unknown Bottle",
            "BOTTLES",
            requiredUnits,
            balance?.on_hand || 0,
            usedBy,
            {
              minLevel: balance?.min_level || bottleItem?.min_level,
              uom: balance?.uom || bottleItem?.uom,
            }
          );
        }

        const capId = scheduleItem.cap_item_id;
        if (capId) {
          const balance = packagingMap.get(capId) as any;
          const capItem = scheduleItem.cap_item as any;

          addRequirement(
            requirementsById,
            capId,
            balance?.item_name || capItem?.item_name || "Unknown Cap",
            "CAPS",
            expectedBottles,
            balance?.on_hand || 0,
            usedBy,
            {
              minLevel: balance?.min_level || capItem?.min_level,
              uom: balance?.uom || capItem?.uom,
            }
          );
        }

        const labelName = scheduleItem.label_customer_product;
        if (labelName && labelName !== BRIGHT_STOCK_VALUE) {
          addRequirement(
            requirementsById,
            `label:${labelName}`,
            labelName,
            "LABELS",
            expectedBottles,
            labelOnHandByName.get(labelName) || 0,
            usedBy
          );
        }

        if (expectedBottles > 0) {
          corrugatedRequired += Math.ceil(expectedBottles / Math.max(1, corrugatedBottlesPerBox));
          corrugatedUsedBy.add(usedBy);
        }
      });

      if (corrugatedRequired > 0) {
        requirementsById.set("corrugated:scheduled-total", {
          required: corrugatedRequired,
          onHand: corrugatedOnHand,
          itemName: `Corrugated Shippers (${corrugatedBottlesPerBox} bottles/box)`,
          category: "CORRUGATED",
          usedBy: corrugatedUsedBy,
          uom: "boxes",
        });
      }

      const requirements: PackagingRequirement[] = Array.from(requirementsById.entries()).map(
        ([id, req]) => ({
          id,
          item_name: req.itemName,
          category: req.category,
          required: req.required,
          on_hand: req.onHand,
          shortage: Math.max(0, req.required - req.onHand),
          used_by: Array.from(req.usedBy),
          min_level: req.minLevel,
          uom: req.uom,
        })
      ).filter((req) => req.required > 0);


      const summary: PackagingRequirementsSummary = {
        bottles: buildSummary(requirements, "BOTTLES"),
        caps: buildSummary(requirements, "CAPS"),
        labels: buildSummary(requirements, "LABELS"),
        corrugated: buildSummary(requirements, "CORRUGATED"),
        pouches: buildSummary(requirements, "POUCHES"),
        shortageCount: requirements.filter((r) => r.shortage > 0).length,
      };

      return { requirements, summary };
    },
    enabled: !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000,
  });
}