import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePurchaseOrdersByVendor, VendorPurchaseOrder } from '@/hooks/usePurchaseOrdersByVendor';
import { cn } from "@/lib/utils";
import { Eye, Search, Package, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { PurchaseOrderDetailModal } from './PurchaseOrderDetailModal';

interface VendorPOHistoryProps {
  vendorName: string;
  onEditOrder?: (order: VendorPurchaseOrder) => void;
  onDeleteOrder?: (orderId: string) => void;
  onMarkAsReceived?: (orderId: string) => void;
}

export function VendorPOHistory({ 
  vendorName, 
  onEditOrder, 
  onDeleteOrder, 
  onMarkAsReceived 
}: VendorPOHistoryProps) {
  const { purchaseOrders, loading, vendorStats, refetch } = usePurchaseOrdersByVendor(vendorName);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<VendorPurchaseOrder | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ordered: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", label: "Ordered" },
      received: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", label: "Received" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.ordered;
    return (
      <Badge className={cn("text-xs", config.color)}>
        {config.label}
      </Badge>
    );
  };

  // Filter purchase orders based on search and status
  const filteredOrders = purchaseOrders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.ingredient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Enhanced callback functions that refetch data immediately
  // Adapter to convert VendorPurchaseOrder to PurchaseOrder format for modal
  const adaptOrderForModal = (order: VendorPurchaseOrder) => {
    return {
      ...order,
      items: [{
        id: `${order.id}-item`,
        ingredient_id: undefined,
        ingredient_name: order.ingredient_name,
        quantity: order.quantity,
        uom: order.uom,
        unit_cost: null,
        total_cost: null
      }]
    };
  };

  const handleEditOrder = (order: VendorPurchaseOrder) => {
    onEditOrder?.(order);
    // Immediate refetch for instant updates
    refetch();
  };

  const handleDeleteOrder = (orderId: string) => {
    onDeleteOrder?.(orderId);
    // Immediate refetch for instant updates
    refetch();
  };

  const handleMarkAsReceived = (orderId: string) => {
    onMarkAsReceived?.(orderId);
    // Immediate refetch for instant updates
    refetch();
  };

  // Sort by most recent first
  const sortedOrders = filteredOrders.sort((a, b) => 
    new Date(b.ordered_date).getTime() - new Date(a.ordered_date).getTime()
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading purchase order history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-lg font-bold">{vendorStats.totalOrders}</div>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-lg font-bold text-blue-600">{vendorStats.pendingOrders}</div>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-lg font-bold text-green-600">{vendorStats.receivedOrders}</div>
                <p className="text-xs text-muted-foreground">Received</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-lg font-bold">
                  {vendorStats.hasFinancialAccess && vendorStats.totalValue !== null
                    ? formatCurrency(vendorStats.totalValue)
                    : "Restricted"
                  }
                </div>
                <p className="text-xs text-muted-foreground">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search PO number, item, or tracking..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ordered">Ordered</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={loading}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Purchase Orders Table */}
      {sortedOrders.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Purchase Orders Found</h3>
              <p className="text-muted-foreground">
                {purchaseOrders.length === 0 
                  ? `No purchase orders found for ${vendorName}`
                  : "No orders match your current filters"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Purchase Order History ({sortedOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ordered Date</TableHead>
                  <TableHead>Expected/Received</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-primary hover:text-primary/80 underline"
                      >
                        {order.po_number}
                      </button>
                    </TableCell>
                    <TableCell>{order.ingredient_name}</TableCell>
                    <TableCell>{order.quantity} {order.uom || 'kg'}</TableCell>
                    <TableCell>
                      {order.can_view_financial_data && order.invoice_total !== null
                        ? formatCurrency(order.invoice_total)
                        : "Restricted"
                      }
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>{formatDate(order.ordered_date)}</TableCell>
                    <TableCell>
                      {order.status === 'received' && order.received_date
                        ? formatDate(order.received_date)
                        : order.expected_delivery
                        ? formatDate(order.expected_delivery)
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Purchase Order Detail Modal */}
      <PurchaseOrderDetailModal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder ? adaptOrderForModal(selectedOrder) : null}
        onEdit={(adaptedOrder) => {
          // Convert back to VendorPurchaseOrder format
          if (selectedOrder && handleEditOrder) {
            handleEditOrder(selectedOrder);
          }
        }}
        onDelete={handleDeleteOrder}
        onMarkAsReceived={handleMarkAsReceived}
      />
    </div>
  );
}