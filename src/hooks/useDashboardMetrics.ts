import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRawMaterialsOptimized } from './useRawMaterialsOptimized';
import { useUserRoles } from './useUserRoles';
import { todayET } from "@/utils/dateUtils";

interface ScheduleItem {
  id: string;
  product: string;
  batches: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'delayed';
}

export function useDashboardMetrics() {
  const queryClient = useQueryClient();
  const { canAccessCosts } = useUserRoles();
  
  const { materials: rawMaterials } = useRawMaterialsOptimized();
  
  const totalInventoryCost = canAccessCosts() ? rawMaterials.reduce((sum, m) => 
    sum + m.lots.reduce((lotSum, lot) => lotSum + (lot.quantity * lot.cost), 0), 0
  ) : 0;

  // --- Quick Stats ---
  const { data: activeOrders } = useQuery({
    queryKey: ['dashboard-active-orders'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('order_headers')
        .select('*', { count: 'exact', head: true })
        .not('header_status', 'in', '("closed","cancelled")');
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const { data: pendingReview } = useQuery({
    queryKey: ['dashboard-pending-review'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('order_headers')
        .select('*', { count: 'exact', head: true })
        .eq('header_status', 'pending');
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const { data: criticalAlerts } = useQuery({
    queryKey: ['dashboard-critical-alerts'],
    queryFn: async () => {
      // Count materials below threshold
      const { data, error } = await supabase
        .from('inventory_thresholds')
        .select('raw_material_id, min_quantity_kg, alert_enabled')
        .eq('alert_enabled', true);
      if (error) throw error;
      if (!data || data.length === 0) return 0;

      // Check current stock for each threshold material
      let alertCount = 0;
      for (const threshold of data) {
        const { data: lots } = await supabase
          .from('raw_material_lots')
          .select('quantity')
          .eq('raw_material_id', threshold.raw_material_id);
        const totalQty = lots?.reduce((s, l) => s + l.quantity, 0) || 0;
        if (totalQty < threshold.min_quantity_kg) alertCount++;
      }
      return alertCount;
    },
    refetchInterval: 60000,
  });

  // --- Weekly Production Schedule ---
  const { data: productionScheduleData } = useQuery({
    queryKey: ['dashboard-production-schedule'],
    queryFn: async () => {
      const weekStart = getWeekStart();
      const weekEnd = getWeekEnd();
      
      const { data, error } = await supabase
        .from('production_schedule_items')
        .select(`
          id, batches, materials_ok, schedule_id,
          production_schedules!inner(schedule_date),
          formulas!inner(code, name)
        `)
        .gte('production_schedules.schedule_date', weekStart)
        .lte('production_schedules.schedule_date', weekEnd);

      if (error) throw error;

      const schedule: Record<string, ScheduleItem[]> = {
        Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: []
      };

      data?.forEach((item) => {
        const date = new Date(item.production_schedules.schedule_date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        if (schedule[dayName]) {
          schedule[dayName].push({
            id: item.id,
            product: item.formulas.name || item.formulas.code,
            batches: item.batches,
            status: mapStatus(item.materials_ok, date)
          });
        }
      });

      return schedule;
    },
    refetchInterval: 30000,
  });

  // --- Weekly Batches ---
  const { data: weeklyBatchesData } = useQuery({
    queryKey: ['dashboard-weekly-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_schedule_items')
        .select('batches, production_schedules!inner(schedule_date)')
        .gte('production_schedules.schedule_date', getWeekStart())
        .lte('production_schedules.schedule_date', getWeekEnd());
      if (error) throw error;
      return data?.reduce((sum, item) => sum + item.batches, 0) || 0;
    },
    refetchInterval: 30000,
  });

  // --- Bottles Packed This Week ---
  const { data: weeklyBottlesData } = useQuery({
    queryKey: ['dashboard-weekly-bottles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packaging_completion_records')
        .select('bottles_packed')
        .gte('completion_date', getWeekStart());
      if (error) throw error;
      return data?.reduce((sum, r) => sum + r.bottles_packed, 0) || 0;
    },
    refetchInterval: 30000,
  });

  // --- On Schedule count (orders with no delayed milestones) ---
  const { data: onScheduleCount } = useQuery({
    queryKey: ['dashboard-on-schedule'],
    queryFn: async () => {
      // Get active orders
      const { data: orders, error } = await supabase
        .from('order_headers')
        .select('id')
        .not('header_status', 'in', '("closed","cancelled")');
      if (error) throw error;
      if (!orders || orders.length === 0) return 0;

      // Get delayed milestones
      const today = todayET();
      const { data: delayedMilestones } = await supabase
        .from('order_delivery_milestones')
        .select('order_id')
        .lt('target_date', today)
        .neq('status', 'completed');
      
      const delayedOrderIds = new Set(delayedMilestones?.map(m => m.order_id) || []);
      return orders.filter(o => !delayedOrderIds.has(o.id)).length;
    },
    refetchInterval: 60000,
  });

  // --- Production Trend (30 days) ---
  const { data: productionTrendData } = useQuery({
    queryKey: ['dashboard-production-trend'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];

      // Batch counts by date
      const { data: batchData } = await supabase
        .from('production_schedule_items')
        .select('batches, production_schedules!inner(schedule_date)')
        .gte('production_schedules.schedule_date', startDate);

      // Bottles packed by date
      const { data: bottlesData } = await supabase
        .from('packaging_completion_records')
        .select('bottles_packed, completion_date')
        .gte('completion_date', startDate);

      // Build 30-day array
      const batchByDate: Record<string, number> = {};
      batchData?.forEach(item => {
        const d = item.production_schedules.schedule_date;
        batchByDate[d] = (batchByDate[d] || 0) + item.batches;
      });

      const bottlesByDate: Record<string, number> = {};
      bottlesData?.forEach(item => {
        const d = item.completion_date;
        bottlesByDate[d] = (bottlesByDate[d] || 0) + item.bottles_packed;
      });

      return Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        const key = date.toISOString().split('T')[0];
        return {
          date: key,
          displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          batches: batchByDate[key] || 0,
          bottles: bottlesByDate[key] || 0,
        };
      });
    },
    refetchInterval: 60000,
  });

  // --- Sparkline data (14 days) ---
  const { data: sparklineBatches } = useQuery({
    queryKey: ['dashboard-sparkline-batches'],
    queryFn: async () => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
      const startDate = fourteenDaysAgo.toISOString().split('T')[0];

      const { data } = await supabase
        .from('production_schedule_items')
        .select('batches, production_schedules!inner(schedule_date)')
        .gte('production_schedules.schedule_date', startDate);

      const byDate: Record<string, number> = {};
      data?.forEach(item => {
        const d = item.production_schedules.schedule_date;
        byDate[d] = (byDate[d] || 0) + item.batches;
      });

      return Array.from({ length: 14 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (13 - i));
        const key = date.toISOString().split('T')[0];
        return { value: byDate[key] || 0 };
      });
    },
    refetchInterval: 60000,
  });

  const { data: sparklineBottles } = useQuery({
    queryKey: ['dashboard-sparkline-bottles'],
    queryFn: async () => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
      const startDate = fourteenDaysAgo.toISOString().split('T')[0];

      const { data } = await supabase
        .from('packaging_completion_records')
        .select('bottles_packed, completion_date')
        .gte('completion_date', startDate);

      const byDate: Record<string, number> = {};
      data?.forEach(item => {
        const d = item.completion_date;
        byDate[d] = (byDate[d] || 0) + item.bottles_packed;
      });

      return Array.from({ length: 14 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (13 - i));
        const key = date.toISOString().split('T')[0];
        return { value: byDate[key] || 0 };
      });
    },
    refetchInterval: 60000,
  });

  // Inventory sparkline: use current value as flat (no daily snapshots exist)
  const sparklineInventory = Array.from({ length: 14 }, () => ({ value: totalInventoryCost }));

  // --- Inventory Breakdown by Supplier ---
  const { data: inventoryBreakdownData } = useQuery({
    queryKey: ['dashboard-inventory-breakdown', rawMaterials],
    queryFn: async () => {
      const supplierMap: Record<string, { value: number; count: number }> = {};

      rawMaterials.forEach(m => {
        const supplier = m.supplier || 'Unknown';
        const lotValue = m.lots.reduce((s, l) => s + l.quantity * l.cost, 0);
        if (!supplierMap[supplier]) supplierMap[supplier] = { value: 0, count: 0 };
        supplierMap[supplier].value += lotValue;
        supplierMap[supplier].count += 1;
      });

      const sorted = Object.entries(supplierMap)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.value - a.value);

      const chartColors = [
        'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
        'hsl(var(--chart-4))', 'hsl(var(--chart-5))'
      ];

      if (sorted.length <= 5) {
        return sorted.map((s, i) => ({ ...s, color: chartColors[i % 5] }));
      }

      const top5 = sorted.slice(0, 5).map((s, i) => ({ ...s, color: chartColors[i] }));
      const otherEntries = sorted.slice(5);
      const otherValue = otherEntries.reduce((acc, s) => acc + s.value, 0);
      const otherCount = otherEntries.reduce((acc, s) => acc + s.count, 0);

      return [...top5, { name: 'Other', value: otherValue, count: otherCount, color: 'hsl(var(--muted-foreground))' }];
    },
    enabled: rawMaterials.length > 0,
    refetchInterval: 60000,
  });

  // Real-time subscriptions
  useEffect(() => {
    const productionChannel = supabase
      .channel('dashboard-production-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_schedule_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-weekly-batches'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-production-schedule'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-production-trend'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-sparkline-batches'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packaging_completion_records' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-weekly-bottles'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-sparkline-bottles'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-production-trend'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_headers' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-active-orders'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-pending-review'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-on-schedule'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productionChannel);
    };
  }, [queryClient]);

  return {
    totalInventoryCost,
    weeklyBatches: weeklyBatchesData ?? null,
    weeklyBottlesPacked: weeklyBottlesData ?? 0,
    productionSchedule: productionScheduleData || {
      Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: []
    },
    activeOrders: activeOrders ?? 0,
    pendingReview: pendingReview ?? 0,
    onScheduleCount: onScheduleCount ?? 0,
    criticalAlerts: criticalAlerts ?? 0,
    productionTrendData: productionTrendData || [],
    inventoryBreakdownData: inventoryBreakdownData || [],
    sparklineInventory,
    sparklineBatches: sparklineBatches || [],
    sparklineBottles: sparklineBottles || [],
    isLoading: false,
  };
}

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function getWeekEnd(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const friday = new Date(now);
  friday.setDate(now.getDate() + mondayOffset + 4);
  friday.setHours(23, 59, 59, 999);
  return friday.toISOString().split('T')[0];
}

function mapStatus(materialsOk: boolean, scheduleDate: Date): 'scheduled' | 'in-progress' | 'completed' | 'delayed' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scheduleDateOnly = new Date(scheduleDate);
  scheduleDateOnly.setHours(0, 0, 0, 0);
  
  if (scheduleDateOnly < today) return 'completed';
  if (scheduleDateOnly.getTime() === today.getTime()) return materialsOk ? 'in-progress' : 'delayed';
  return materialsOk ? 'scheduled' : 'delayed';
}
