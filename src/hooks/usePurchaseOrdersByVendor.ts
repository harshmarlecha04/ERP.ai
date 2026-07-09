import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VendorPurchaseOrder {
  id: string;
  po_number: string;
  vendor_name: string;
  ingredient_name: string;
  quantity: number;
  uom: string;
  ordered_date: string;
  expected_delivery?: string;
  received_date?: string;
  invoice_total: number | null;
  status: 'ordered' | 'received';
  tracking_number?: string;
  terms?: string;
  created_at: string;
  updated_at: string;
  can_view_financial_data?: boolean;
}

export const usePurchaseOrdersByVendor = (vendorName: string) => {
  const [purchaseOrders, setPurchaseOrders] = useState<VendorPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVendorPurchaseOrders = async () => {
    if (!vendorName) {
      setPurchaseOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Use the secure function that respects financial access permissions
      const { data, error } = await supabase
        .rpc('get_purchase_orders_with_financial_access');

      if (error) throw error;

      // Filter by vendor name with flexible matching
      const vendorOrders = data?.filter(order => {
        if (!order.vendor_name || !vendorName) return false;
        
        const orderVendor = order.vendor_name.toLowerCase();
        const searchVendor = vendorName.toLowerCase();
        
        // Check if vendor names match exactly or contain each other
        return orderVendor === searchVendor ||
               orderVendor.includes(searchVendor) ||
               searchVendor.includes(orderVendor);
      }) || [];

      setPurchaseOrders(vendorOrders.map(order => ({
        ...order,
        status: order.status as 'ordered' | 'received',
        invoice_total: order.invoice_total || 0
      })));
    } catch (error) {
      console.error('Error fetching vendor purchase orders:', error);
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Statistics for the vendor
  const vendorStats = useMemo(() => {
    const totalOrders = purchaseOrders.length;
    const orderedOrders = purchaseOrders.filter(order => order.status === 'ordered').length;
    const receivedOrders = purchaseOrders.filter(order => order.status === 'received').length;
    
    // Only calculate financial stats if user has access and data is available
    const hasFinancialAccess = purchaseOrders.some(order => order.can_view_financial_data);
    const totalValue = hasFinancialAccess 
      ? purchaseOrders.reduce((sum, order) => sum + (order.invoice_total || 0), 0)
      : null;

    return {
      totalOrders,
      pendingOrders: orderedOrders, // Keep the same property name for compatibility
      receivedOrders,
      totalValue,
      hasFinancialAccess
    };
  }, [purchaseOrders]);

  useEffect(() => {
    fetchVendorPurchaseOrders();
  }, [vendorName]);

  return {
    purchaseOrders,
    loading,
    vendorStats,
    refetch: fetchVendorPurchaseOrders,
  };
};