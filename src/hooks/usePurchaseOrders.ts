import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { todayET } from "@/utils/dateUtils";

export interface PurchaseOrderItem {
  id: string;
  ingredient_id?: string;
  ingredient_name: string;
  quantity: number;
  uom: string;
  unit_cost?: number | null;
  total_cost?: number | null;
}

export interface PurchaseOrder {
  id: string;
  vendor_id?: string;
  vendor_name?: string;
  po_number: string;
  ordered_date: string;
  expected_delivery?: string;
  terms?: string;
  invoice_total: number | null; // Can be null for users without financial access
  tracking_number?: string;
  status: 'ordered' | 'received';
  created_at: string;
  updated_at: string;
  can_view_financial_data?: boolean; // Flag to indicate financial access
  items: PurchaseOrderItem[];
}

export interface CreatePurchaseOrderData {
  vendor_name?: string;
  po_number: string;
  ordered_date: string;
  expected_delivery?: string;
  terms?: string;
  invoice_total: number;
  tracking_number?: string;
  status?: 'ordered' | 'received';
  items: {
    ingredient_name: string;
    ingredient_id?: string;
    quantity: number;
    uom: string;
    unit_cost?: number;
  }[];
}

export const usePurchaseOrders = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      // Use the new business hours function
      const { data: ordersData, error: ordersError } = await supabase
        .rpc('get_purchase_orders_with_business_hours_access');

      if (ordersError) throw ordersError;

      // Fetch items for each purchase order
      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from('purchase_order_items')
            .select('*')
            .eq('purchase_order_id', order.id);

          if (itemsError) {
            console.error('Error fetching items for order:', order.id, itemsError);
          }

          return {
            id: order.id,
            po_number: order.po_number,
            vendor_id: order.vendor_id ?? undefined,
            ordered_date: order.order_date, // Map order_date to ordered_date
            expected_delivery: order.expected_delivery ?? undefined,
            terms: order.payment_terms ?? undefined,
            invoice_total: order.invoice_total, // Can be null for non-financial users
            tracking_number: order.tracking_number ?? undefined,
            status: order.status as 'ordered' | 'received',
            created_at: order.created_at,
            updated_at: order.updated_at,
            can_view_financial_data: order.invoice_total !== null,
            items: (itemsData || []).map((item: any) => ({
              id: item.id,
              ingredient_id: item.ingredient_id,
              ingredient_name: item.ingredient_name,
              quantity: item.quantity,
              uom: item.uom,
              unit_cost: item.unit_cost,
              total_cost: item.total_cost
            }))
          };
        })
      );

      setPurchaseOrders(ordersWithItems);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPurchaseOrder = async (orderData: CreatePurchaseOrderData) => {
    try {
      const { items, ...poData } = orderData;
      
      // Create the purchase order
      const { data: poResult, error: poError } = await supabase
        .from('purchase_orders')
        .insert([{
          ...poData,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (poError) throw poError;

      // Create the purchase order items
      const itemsToInsert = items.map(item => ({
        purchase_order_id: poResult.id,
        ingredient_id: item.ingredient_id,
        ingredient_name: item.ingredient_name,
        quantity: item.quantity,
        uom: item.uom,
        unit_cost: item.unit_cost || 0
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      await fetchPurchaseOrders(); // Refresh the list
      return poResult;
    } catch (error) {
      console.error('Error creating purchase order:', error);
      throw error;
    }
  };

  const updatePurchaseOrder = async (id: string, orderData: Partial<CreatePurchaseOrderData>) => {
    try {
      const { items, ...poData } = orderData;
      
      // Update the purchase order
      const { data, error } = await supabase
        .from('purchase_orders')
        .update(poData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // If items are provided, update them
      if (items) {
        // Delete existing items
        const { error: deleteError } = await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', id);

        if (deleteError) throw deleteError;

        // Insert new items
        const itemsToInsert = items.map(item => ({
          purchase_order_id: id,
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name,
          quantity: item.quantity,
          uom: item.uom,
          unit_cost: item.unit_cost || 0
        }));

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      await fetchPurchaseOrders(); // Refresh the list
      return data;
    } catch (error) {
      console.error('Error updating purchase order:', error);
      throw error;
    }
  };

  const deletePurchaseOrder = async (id: string) => {
    try {
      // Delete items first (cascade should handle this, but being explicit)
      await supabase
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', id);

      // Delete the purchase order
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchPurchaseOrders(); // Refresh the list
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      throw error;
    }
  };

  const markAsReceived = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'received',
          received_date: todayET(), // Current date
          received_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Immediate refresh to ensure UI updates
      await fetchPurchaseOrders();
      return data;
    } catch (error) {
      console.error('Error marking purchase order as received:', error);
      throw error;
    }
  };

  const refetch = () => {
    fetchPurchaseOrders();
  };

  useEffect(() => {
    fetchPurchaseOrders();

    // Set up real-time subscription for purchase orders
    const channel = supabase
      .channel(`purchase-orders-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'purchase_orders'
        },
        (payload) => {
          console.log('Purchase order change detected:', payload);
          // Refetch data when any purchase order changes
          fetchPurchaseOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    purchaseOrders,
    isLoading: loading,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    markAsReceived,
    refetch,
  };
};