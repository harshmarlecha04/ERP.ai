import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, format, parseISO } from 'date-fns';

export interface UsageTrendData {
  date: string;
  total_kg_used: number;
  batch_count: number;
  unique_materials_used: number;
}

export interface TopMaterial {
  material_id: string;
  code: string;
  name: string;
  supplier: string | null;
  total_kg_used: number;
  usage_count: number;
  total_cost: number;
  avg_cost_per_kg: number;
  last_used: string | null;
  turnover_rate: number;
}

export interface SupplierCostAnalysis {
  supplier: string;
  total_materials: number;
  total_kg_used: number;
  total_cost: number;
  material_list: string[];
}

export interface MaterialCategoryStats {
  category: string;
  material_count: number;
  total_kg_used: number;
  total_cost: number;
  avg_usage_per_material: number;
}

export interface InventoryEfficiency {
  slow_moving_materials: Array<{
    material_id: string;
    name: string;
    code: string;
    days_since_last_use: number | null;
    quantity_on_hand: number;
    estimated_value: number;
  }>;
  fast_moving_materials: Array<{
    material_id: string;
    name: string;
    code: string;
    usage_frequency: number;
    avg_days_between_use: number;
  }>;
  expiring_soon: Array<{
    material_id: string;
    name: string;
    code: string;
    lot_number: string | null;
    expires_on: string;
    days_until_expiry: number;
    quantity: number;
  }>;
}

export interface RawMaterialAnalytics {
  usageTrends: UsageTrendData[];
  topMaterials: TopMaterial[];
  supplierAnalysis: SupplierCostAnalysis[];
  categoryStats: MaterialCategoryStats[];
  inventoryEfficiency: InventoryEfficiency;
  totalMetrics: {
    total_materials_used: number;
    total_batches: number;
    total_cost: number;
    avg_cost_per_batch: number;
  };
}

export const useRawMaterialAnalytics = (days: number = 30) => {
  return useQuery({
    queryKey: ['raw-material-analytics', days],
    queryFn: async (): Promise<RawMaterialAnalytics> => {
      try {
        console.log('🔍 [Analytics] Starting analytics fetch for days:', days);
        const startDate = days === -1 ? null : format(subDays(new Date(), days), 'yyyy-MM-dd');
        console.log('🔍 [Analytics] Start date:', startDate);

        // Fetch ingredient deductions with date filtering
        let deductionsQuery = supabase
          .from('ingredient_deductions')
          .select(`
            *,
            completed_batch_id,
            raw_material_id,
            lot_id
          `);

        if (startDate) {
          deductionsQuery = deductionsQuery.gte('created_at', startDate);
        }

        const { data: deductions, error: deductionsError } = await deductionsQuery;
        if (deductionsError) {
          console.error('❌ [Analytics] Deductions error:', deductionsError);
          throw deductionsError;
        }
        console.log('✅ [Analytics] Deductions fetched:', deductions?.length || 0);

      // Fetch completed batches for batch count
      let batchesQuery = supabase
        .from('completed_batch_deductions')
        .select('*');

      if (startDate) {
        batchesQuery = batchesQuery.gte('completed_at', startDate);
      }

      const { data: batches, error: batchesError } = await batchesQuery;
      if (batchesError) {
        console.error('❌ [Analytics] Batches error:', batchesError);
        throw batchesError;
      }
      console.log('✅ [Analytics] Batches fetched:', batches?.length || 0);

      // Fetch raw materials with lots
      const { data: materials, error: materialsError } = await supabase
        .from('raw_materials')
        .select(`
          *,
          lots:raw_material_lots!raw_material_lots_raw_material_id_fkey(*)
        `)
        .eq('is_archived', false);

      if (materialsError) {
        console.error('❌ [Analytics] Materials error:', materialsError);
        throw materialsError;
      }
      console.log('✅ [Analytics] Materials fetched:', materials?.length || 0);
      
      if (materials && materials.length > 0) {
        console.log('🧪 [Analytics] Sample material with lots:', {
          id: materials[0].id,
          code: materials[0].code,
          lots: materials[0].lots?.slice(0, 3),
        });
      }

      // Process usage trends
      const trendMap = new Map<string, UsageTrendData>();
      (deductions || []).forEach((deduction) => {
        const date = format(parseISO(deduction.created_at), 'yyyy-MM-dd');
        const existing = trendMap.get(date) || {
          date,
          total_kg_used: 0,
          batch_count: 0,
          unique_materials_used: 0
        };
        existing.total_kg_used += Number(deduction.deducted_quantity_kg) || 0;
        trendMap.set(date, existing);
      });

      // Count unique materials and batches per day
      const batchesPerDay = new Map<string, Set<string>>();
      const materialsPerDay = new Map<string, Set<string>>();
      
      (deductions || []).forEach((deduction) => {
        const date = format(parseISO(deduction.created_at), 'yyyy-MM-dd');
        
        if (!batchesPerDay.has(date)) {
          batchesPerDay.set(date, new Set());
        }
        batchesPerDay.get(date)!.add(deduction.completed_batch_id);
        
        if (!materialsPerDay.has(date)) {
          materialsPerDay.set(date, new Set());
        }
        materialsPerDay.get(date)!.add(deduction.raw_material_id);
      });

      batchesPerDay.forEach((batches, date) => {
        const trend = trendMap.get(date);
        if (trend) {
          trend.batch_count = batches.size;
          trend.unique_materials_used = materialsPerDay.get(date)?.size || 0;
        }
      });

      const usageTrends = Array.from(trendMap.values()).sort((a, b) => 
        a.date.localeCompare(b.date)
      );

      // Process top materials
      const materialUsageMap = new Map<string, {
        kg_used: number;
        count: number;
        total_cost: number;
        last_used: string | null;
      }>();

      (deductions || []).forEach((deduction) => {
        const existing = materialUsageMap.get(deduction.raw_material_id) || {
          kg_used: 0,
          count: 0,
          total_cost: 0,
          last_used: null
        };
        existing.kg_used += Number(deduction.deducted_quantity_kg) || 0;
        existing.count += 1;
        
        // Find lot cost if available
        const material = (materials || []).find(m => m.id === deduction.raw_material_id);
        if (material && deduction.lot_id) {
          const lot = material.lots?.find((l: any) => l.id === deduction.lot_id);
          if (lot) {
            existing.total_cost += Number(deduction.deducted_quantity_kg) * Number(lot.cost);
          }
        }
        
        if (!existing.last_used || deduction.created_at > existing.last_used) {
          existing.last_used = deduction.created_at;
        }
        
        materialUsageMap.set(deduction.raw_material_id, existing);
      });

      const topMaterials: TopMaterial[] = Array.from(materialUsageMap.entries())
        .map(([material_id, usage]) => {
          const material = (materials || []).find(m => m.id === material_id);
          return {
            material_id,
            code: material?.code || 'Unknown',
            name: material?.name || 'Unknown',
            supplier: material?.supplier || null,
            total_kg_used: usage.kg_used,
            usage_count: usage.count,
            total_cost: usage.total_cost,
            avg_cost_per_kg: usage.kg_used > 0 ? usage.total_cost / usage.kg_used : 0,
            last_used: usage.last_used,
            turnover_rate: days > 0 ? usage.count / days : usage.count
          };
        })
        .sort((a, b) => b.total_kg_used - a.total_kg_used);

      // Process supplier analysis
      const supplierMap = new Map<string, {
        materials: Set<string>;
        kg_used: number;
        cost: number;
        material_names: Set<string>;
      }>();

      topMaterials.forEach((material) => {
        const supplier = material.supplier || 'Unknown Supplier';
        const existing = supplierMap.get(supplier) || {
          materials: new Set(),
          kg_used: 0,
          cost: 0,
          material_names: new Set()
        };
        existing.materials.add(material.material_id);
        existing.kg_used += material.total_kg_used;
        existing.cost += material.total_cost;
        existing.material_names.add(material.name);
        supplierMap.set(supplier, existing);
      });

      const supplierAnalysis: SupplierCostAnalysis[] = Array.from(supplierMap.entries())
        .map(([supplier, data]) => ({
          supplier,
          total_materials: data.materials.size,
          total_kg_used: data.kg_used,
          total_cost: data.cost,
          material_list: Array.from(data.material_names)
        }))
        .sort((a, b) => b.total_cost - a.total_cost);

      // Category stats (simplified - based on material name patterns)
      const categoryStats: MaterialCategoryStats[] = [];

      // Inventory efficiency
      const now = new Date();
      const slow_moving_materials = (materials || [])
        .map(material => {
          const lastUsed = materialUsageMap.get(material.id)?.last_used;
          const daysSinceLastUse = lastUsed 
            ? Math.floor((now.getTime() - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24))
            : null;
          
          const totalQty = (material.lots || []).reduce((sum: number, lot: any) => 
            sum + Number(lot.quantity), 0
          );
          
          const avgCost = (material.lots || []).length > 0
            ? (material.lots || []).reduce((sum: number, lot: any) => sum + Number(lot.cost), 0) / (material.lots || []).length
            : 0;

          return {
            material_id: material.id,
            name: material.name,
            code: material.code,
            days_since_last_use: daysSinceLastUse,
            quantity_on_hand: totalQty,
            estimated_value: totalQty * avgCost
          };
        })
        .filter(m => m.days_since_last_use === null || m.days_since_last_use > 60)
        .sort((a, b) => (b.days_since_last_use || 999) - (a.days_since_last_use || 999))
        .slice(0, 10);

      const fast_moving_materials = topMaterials
        .filter(m => m.usage_count > 0)
        .slice(0, 10)
        .map(m => ({
          material_id: m.material_id,
          name: m.name,
          code: m.code,
          usage_frequency: m.usage_count,
          avg_days_between_use: days > 0 && m.usage_count > 0 ? days / m.usage_count : 0
        }));

      const expiring_soon = (materials || [])
        .flatMap(material => 
          (material.lots || [])
            .filter((lot: any) => lot.expires_on)
            .map((lot: any) => {
              const expiryDate = new Date(lot.expires_on);
              const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return {
                material_id: material.id,
                name: material.name,
                code: material.code,
                lot_number: lot.lot_number,
                expires_on: lot.expires_on,
                days_until_expiry: daysUntilExpiry,
                quantity: Number(lot.quantity)
              };
            })
        )
        .filter(item => item.days_until_expiry >= 0 && item.days_until_expiry <= 90)
        .sort((a, b) => a.days_until_expiry - b.days_until_expiry);

      const inventoryEfficiency: InventoryEfficiency = {
        slow_moving_materials,
        fast_moving_materials,
        expiring_soon
      };

      // Total metrics
      const totalMetrics = {
        total_materials_used: new Set(deductions?.map(d => d.raw_material_id) || []).size,
        total_batches: batches?.length || 0,
        total_cost: topMaterials.reduce((sum, m) => sum + m.total_cost, 0),
        avg_cost_per_batch: batches && batches.length > 0 
          ? topMaterials.reduce((sum, m) => sum + m.total_cost, 0) / batches.length 
          : 0
      };

      console.log('✅ [Analytics] Processing complete:', {
        usageTrends: usageTrends.length,
        topMaterials: topMaterials.length,
        supplierAnalysis: supplierAnalysis.length,
        totalMetrics
      });

      return {
        usageTrends,
        topMaterials,
        supplierAnalysis,
        categoryStats,
        inventoryEfficiency,
        totalMetrics
      };
      } catch (error) {
        console.error('❌ [Analytics] Fatal error:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
