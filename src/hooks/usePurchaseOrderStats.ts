import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PurchaseOrderStats {
  totalOrders: number;
  pendingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  totalValue: number;
  monthlyValue: number;
  hasFinancialAccess: boolean;
}

export const usePurchaseOrderStats = () => {
  const [stats, setStats] = useState<PurchaseOrderStats>({
    totalOrders: 0,
    pendingOrders: 0,
    shippedOrders: 0,
    deliveredOrders: 0,
    totalValue: 0,
    monthlyValue: 0,
    hasFinancialAccess: false,
  });
  const [loading, setLoading] = useState(true);
  const [hasFinancialAccess, setHasFinancialAccess] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Use the new secure function to get stats with multi-ingredient support
      const { data, error } = await supabase.rpc('get_purchase_order_stats_with_items_secure');

      if (error) throw error;

      if (data) {
        const statsData = data as any; // Type assertion for RPC response
        setStats({
          totalOrders: statsData.totalOrders || 0,
          pendingOrders: statsData.pendingOrders || 0,
          shippedOrders: statsData.shippedOrders || 0,
          deliveredOrders: statsData.deliveredOrders || 0,
          totalValue: statsData.totalValue || 0,
          monthlyValue: statsData.monthlyValue || 0,
          hasFinancialAccess: statsData.hasFinancialAccess || false,
        });
        setHasFinancialAccess(statsData.hasFinancialAccess || false);
      }
    } catch (error) {
      console.error('Error fetching purchase order stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    stats,
    loading,
    hasFinancialAccess,
    refetch: fetchStats,
  };
};