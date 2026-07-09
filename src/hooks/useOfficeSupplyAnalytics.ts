import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, startOfDay, eachDayOfInterval } from "date-fns";
import { formatET } from "@/utils/dateUtils";

export interface UsageTrendData {
  date: string;
  usage: number;
  cost: number;
}

export interface CategoryStats {
  category: string;
  total_cost: number;
  total_usage: number;
  item_count: number;
  avg_cost_per_item: number;
}

export interface PopularItem {
  item_id: string;
  item_name: string;
  category: string;
  usage_count: number;
  total_quantity: number;
  avg_monthly_usage: number;
  days_until_stockout: number | null;
  current_stock: number;
}

export interface CostByCategory {
  category: string;
  total_cost: number;
  percentage: number;
}

export const useOfficeSupplyAnalytics = (days: number = 30) => {
  return useQuery({
    queryKey: ["office-supply-analytics", days],
    queryFn: async () => {
      const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");

      // Get all transactions
      const { data: transactions, error: txError } = await supabase
        .from("office_supply_transactions")
        .select("*, office_supplies(item_name, category, unit_of_measure, quantity_on_hand)")
        .gte("created_at", startDate)
        .order("created_at");

      if (txError) throw txError;

      // Get all supplies for category stats
      const { data: supplies, error: suppliesError } = await supabase
        .from("office_supplies")
        .select("*");

      if (suppliesError) throw suppliesError;

      // Calculate usage trends (daily)
      const usageTrends: UsageTrendData[] = [];
      const dateRange = eachDayOfInterval({
        start: subDays(new Date(), days),
        end: new Date(),
      });

      dateRange.forEach((date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        const dayTransactions = transactions?.filter(
          (tx) => formatET(tx.created_at, "yyyy-MM-dd") === dateStr
        ) || [];

        const usage = dayTransactions
          .filter((tx) => tx.transaction_type === "usage")
          .reduce((sum, tx) => sum + Math.abs(tx.quantity), 0);

        const cost = dayTransactions
          .filter((tx) => tx.transaction_type === "purchase")
          .reduce((sum, tx) => sum + (tx.cost || 0), 0);

        usageTrends.push({ date: dateStr, usage, cost });
      });

      // Calculate popular items
      const itemUsageMap = new Map<string, {
        item_id: string;
        item_name: string;
        category: string;
        usage_count: number;
        total_quantity: number;
        current_stock: number;
      }>();

      transactions?.forEach((tx) => {
        if (tx.transaction_type === "usage") {
          const supply = tx.office_supplies as any;
          const existing = itemUsageMap.get(tx.item_id) || {
            item_id: tx.item_id,
            item_name: supply?.item_name || "Unknown",
            category: supply?.category || "Unknown",
            usage_count: 0,
            total_quantity: 0,
            current_stock: supply?.quantity_on_hand || 0,
          };

          existing.usage_count += 1;
          existing.total_quantity += Math.abs(tx.quantity);
          itemUsageMap.set(tx.item_id, existing);
        }
      });

      const popularItems: PopularItem[] = Array.from(itemUsageMap.values())
        .map((item) => {
          const daysInPeriod = days;
          const avgMonthlyUsage = (item.total_quantity / daysInPeriod) * 30;
          const dailyUsage = item.total_quantity / daysInPeriod;
          const daysUntilStockout = dailyUsage > 0 
            ? Math.floor(item.current_stock / dailyUsage)
            : null;

          return {
            ...item,
            avg_monthly_usage: avgMonthlyUsage,
            days_until_stockout: daysUntilStockout,
          };
        })
        .sort((a, b) => b.total_quantity - a.total_quantity);

      // Calculate cost by category
      const categoryMap = new Map<string, number>();
      transactions?.forEach((tx) => {
        if (tx.transaction_type === "purchase" && tx.cost) {
          const supply = tx.office_supplies as any;
          const category = supply?.category || "Uncategorized";
          categoryMap.set(category, (categoryMap.get(category) || 0) + tx.cost);
        }
      });

      const totalCost = Array.from(categoryMap.values()).reduce((sum, cost) => sum + cost, 0);
      const costByCategory: CostByCategory[] = Array.from(categoryMap.entries())
        .map(([category, cost]) => ({
          category,
          total_cost: cost,
          percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0,
        }))
        .sort((a, b) => b.total_cost - a.total_cost);

      // Calculate category stats
      const categoryStatsMap = new Map<string, CategoryStats>();
      supplies?.forEach((supply) => {
        if (!categoryStatsMap.has(supply.category)) {
          categoryStatsMap.set(supply.category, {
            category: supply.category,
            total_cost: 0,
            total_usage: 0,
            item_count: 0,
            avg_cost_per_item: 0,
          });
        }

        const stats = categoryStatsMap.get(supply.category)!;
        stats.item_count += 1;
        categoryStatsMap.set(supply.category, stats);
      });

      // Add transaction data to category stats
      transactions?.forEach((tx) => {
        const supply = tx.office_supplies as any;
        const category = supply?.category || "Uncategorized";
        
        if (!categoryStatsMap.has(category)) {
          categoryStatsMap.set(category, {
            category,
            total_cost: 0,
            total_usage: 0,
            item_count: 0,
            avg_cost_per_item: 0,
          });
        }

        const stats = categoryStatsMap.get(category)!;
        
        if (tx.transaction_type === "purchase" && tx.cost) {
          stats.total_cost += tx.cost;
        }
        if (tx.transaction_type === "usage") {
          stats.total_usage += Math.abs(tx.quantity);
        }
        
        categoryStatsMap.set(category, stats);
      });

      const categoryStats = Array.from(categoryStatsMap.values()).map((stat) => ({
        ...stat,
        avg_cost_per_item: stat.item_count > 0 ? stat.total_cost / stat.item_count : 0,
      }));

      return {
        usageTrends,
        popularItems,
        costByCategory,
        categoryStats,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
