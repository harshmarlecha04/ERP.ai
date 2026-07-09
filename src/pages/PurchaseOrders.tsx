import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart, Package, DollarSign, Truck, Plus, Filter, Edit, Trash2, CheckCircle, Calendar as CalendarIcon, List, Download } from "lucide-react";
import { ExportExcelDialog } from "@/components/purchase-orders/ExportExcelDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { usePurchaseOrderStats } from "@/hooks/usePurchaseOrderStats";
import { AddPurchaseOrderModal } from "@/components/purchase-orders/AddPurchaseOrderModal";
import { PurchaseOrderDetailModal } from "@/components/purchase-orders/PurchaseOrderDetailModal";
import { PurchaseOrderReceivingModal } from "@/components/purchase-orders/PurchaseOrderReceivingModal";
import { PurchaseOrderCalendar } from "@/components/purchase-orders/PurchaseOrderCalendar";
import { DeleteConfirmationModal } from "@/components/inventory/DeleteConfirmationModal";
import { useUserRoles } from "@/hooks/useUserRoles";
import { FinancialAccessDenied } from "@/components/access-control/FinancialAccessDenied";
import { format, parseISO, addDays, isWithinInterval, startOfToday } from "date-fns";
import Fuse from 'fuse.js';

export default function PurchaseOrders() {
  const { toast } = useToast();
  const { loading: rolesLoading, canAccessFinancialData } = useUserRoles();
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('calendar');
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("ordered_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; orderId: string | null }>({
    isOpen: false,
    orderId: null
  });
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState<any>(null);
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const {
    purchaseOrders,
    isLoading,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    markAsReceived,
    refetch
  } = usePurchaseOrders();

  const { stats, hasFinancialAccess } = usePurchaseOrderStats();

  // Initialize Fuse for fuzzy search
  const fuse = new Fuse(purchaseOrders || [], {
    keys: ['po_number', 'vendor_name', 'items.ingredient_name', 'tracking_number'],
    threshold: 0.3,
  });

  // Filter and sort orders (defensive: never let a bad row crash the page)
  const filteredOrders = (() => {
    try {
      let filtered = purchaseOrders || [];

      // Apply search
      if (searchTerm.trim()) {
        const fuseResults = fuse.search(searchTerm.trim());
        filtered = fuseResults.map(result => result.item);
      }

      // Apply status filter
      if (statusFilter !== "all") {
        filtered = filtered.filter(order => order.status === statusFilter);
      }

      const safeParse = (s?: string | null): Date | null => {
        if (!s) return null;
        try {
          const d = parseISO(s);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      };

      // Handle special sorting/filtering for expected delivery dates
      const sortValue = `${sortField}-${sortOrder}`;
      if (sortValue === "expected_3_days-asc" || sortValue === "expected_7_days-asc") {
        const today = startOfToday();
        const windowEnd = addDays(today, sortValue === "expected_3_days-asc" ? 3 : 7);
        filtered = filtered.filter(order => {
          const d = safeParse(order.expected_delivery);
          if (!d) return false;
          return isWithinInterval(d, { start: today, end: windowEnd });
        });
        return filtered.sort((a, b) => {
          const aDate = safeParse(a.expected_delivery);
          const bDate = safeParse(b.expected_delivery);
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return aDate.getTime() - bDate.getTime();
        });
      }

      // Apply regular sorting for other cases
      return [...filtered].sort((a, b) => {
        const aValue = (a as any)[sortField];
        const bValue = (b as any)[sortField];
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        if (sortOrder === "asc") {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      });
    } catch (e) {
      console.error('PurchaseOrders filter/sort failed:', e);
      return purchaseOrders || [];
    }
  })();

  const handleSaveOrder = async (orderData: any) => {
    try {
      if (editingOrder) {
        await updatePurchaseOrder(editingOrder.id, orderData);
        toast({
          title: "Purchase order updated",
          description: "The purchase order has been successfully updated.",
        });
      } else {
        await createPurchaseOrder(orderData);
        toast({
          title: "Purchase order created",
          description: "The purchase order has been successfully created.",
        });
      }
      setIsAddModalOpen(false);
      setEditingOrder(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleDeleteOrder = async () => {
    if (!deleteConfirmation.orderId) return;
    
    try {
      await deletePurchaseOrder(deleteConfirmation.orderId);
      toast({
        title: "Purchase order deleted",
        description: "The purchase order has been successfully deleted.",
      });
      setDeleteConfirmation({ isOpen: false, orderId: null });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleMarkAsReceived = async (orderId: string) => {
    try {
      await markAsReceived(orderId);
      toast({
        title: "Order marked as received",
        description: "The purchase order has been successfully marked as received.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleReceiveIntoInventory = (order: any) => {
    setReceivingOrder(order);
    setIsReceivingModalOpen(true);
  };

  const handleReceivingComplete = (orderId: string) => {
    setIsReceivingModalOpen(false);
    setReceivingOrder(null);
    refetch(); // Refresh the purchase orders list
  };

  const handleRescheduleDelivery = async (orderId: string, newDate: string) => {
    try {
      await updatePurchaseOrder(orderId, { expected_delivery: newDate });
      toast({
        title: "Delivery rescheduled",
        description: "Expected delivery date has been updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      throw error; // Re-throw to handle in calendar component
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ordered: { color: "bg-blue-100 text-blue-800", label: "Ordered" },
      received: { color: "bg-emerald-100 text-emerald-800", label: "Received" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.ordered;
    return (
      <Badge className={cn("text-xs", config.color)}>
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      // Parse the date string as a local date to avoid timezone conversion issues
      return format(parseISO(dateString), 'M/d/yyyy');
    } catch (error) {
      return dateString; // Fallback to original string if parsing fails
    }
  };

  const handleRequestAccess = () => {
    toast({
      title: "Access Request",
      description: "Please contact your administrator to request access to financial data.",
    });
  };

  // Show loading state while checking roles
  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  // All authenticated users now have access to purchase orders

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Button>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="rounded-r-none"
            >
              <List className="mr-2 h-4 w-4" />
              Table View
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="rounded-l-none"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              Calendar View
            </Button>
          </div>
          <Button variant="outline" onClick={() => setIsExportOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
        <div className="text-right">
          <h1 className="text-3xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage your purchase orders and track deliveries</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchaseOrders?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ordered</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchaseOrders?.filter(o => o.status === 'ordered').length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Received</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchaseOrders?.filter(o => o.status === 'received').length || 0}</div>
          </CardContent>
        </Card>
        {hasFinancialAccess && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats?.hasFinancialAccess ? (
              <div className="text-2xl font-bold">{formatCurrency(stats?.totalValue || 0)}</div>
            ) : (
              <FinancialAccessDenied feature="Purchase Order Values" onContactAdmin={handleRequestAccess} />
            )}
          </CardContent>
        </Card>
        )}
        {!hasFinancialAccess && (
          <Card className="border-dashed border-muted-foreground/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg text-muted-foreground">Restricted</div>
              <p className="text-xs text-muted-foreground mt-1">Financial data requires admin or production manager role</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <PurchaseOrderCalendar
          purchaseOrders={purchaseOrders || []}
          onReschedule={handleRescheduleDelivery}
          onMarkAsReceived={handleMarkAsReceived}
          onEdit={(order) => {
            setEditingOrder(order);
            setIsAddModalOpen(true);
          }}
          onReceiveIntoInventory={handleReceiveIntoInventory}
        />
      )}

      {/* Table View - Filters and Search */}
      {viewMode === 'table' && (
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders</CardTitle>
          <CardDescription>View and manage all purchase orders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by PO number, vendor, ingredient, or tracking..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
            <Select value={`${sortField}-${sortOrder}`} onValueChange={(value) => {
              const [field, order] = value.split('-');
              setSortField(field);
              setSortOrder(order as "asc" | "desc");
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ordered_date-desc">Date (Newest)</SelectItem>
                <SelectItem value="expected_3_days-asc">Expected Next 3 Days</SelectItem>
                <SelectItem value="expected_7_days-asc">Expected Next 7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <ScrollArea 
            className="rounded-md border h-[calc(100vh-400px)]" 
            scrollbars="both" 
            alwaysVisible
            viewportClassName="pb-6 pr-3"
          >
              <Table 
                noWrapper
                className="min-w-[1200px]"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">PO Number</TableHead>
                    <TableHead className="text-center">Vendor</TableHead>
                    <TableHead className="text-center">Ingredient</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead className="text-center">UoM</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Expected Delivery</TableHead>
                    <TableHead className="text-center">Tracking #</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
               <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading purchase orders...
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        {searchTerm ? "No purchase orders found matching your search." : "No purchase orders found."}
                      </TableCell>
                    </TableRow>
                 ) : (
                    filteredOrders.map((order) => (
                       <TableRow key={order.id}>
                         <TableCell className="font-medium text-center">
                           <button
                             onClick={() => {
                               setSelectedOrder(order);
                               setIsDetailModalOpen(true);
                             }}
                             className="text-primary hover:text-primary/80 hover:underline cursor-pointer"
                           >
                             {order.po_number}
                           </button>
                         </TableCell>
                         <TableCell className="text-center">{order.vendor_name}</TableCell>
                          <TableCell>
                            {order.items && order.items.length > 0 ? (
                              <div>
                                <div className="font-medium">{order.items[0].ingredient_name}</div>
                                {order.items.length > 1 && (
                                  <div className="text-xs text-muted-foreground">
                                    +{order.items.length - 1} more ingredient{order.items.length > 2 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">No ingredients</span>
                            )}
                          </TableCell>
                           <TableCell>
                             {order.items && order.items.length > 0 ? (
                               <div>
                                 <div>{order.items[0].quantity}</div>
                                 {order.items.length > 1 && (
                                   <div className="text-xs text-muted-foreground">
                                     Multiple items
                                   </div>
                                 )}
                               </div>
                             ) : (
                               <span className="text-muted-foreground">-</span>
                             )}
                           </TableCell>
                           <TableCell className="text-center">
                             {order.items && order.items.length > 0 ? (
                               <div>
                                 <div>{order.items[0].uom}</div>
                                 {order.items.length > 1 && (
                                   <div className="text-xs text-muted-foreground">
                                     Mixed units
                                   </div>
                                 )}
                               </div>
                             ) : (
                               <span className="text-muted-foreground">-</span>
                             )}
                           </TableCell>
                         <TableCell className="text-center">{getStatusBadge(order.status)}</TableCell>
                         <TableCell className="text-center">
                           {order.expected_delivery ? formatDate(order.expected_delivery) : '-'}
                         </TableCell>
                         <TableCell className="text-center">{order.tracking_number || '-'}</TableCell>
                         <TableCell className="text-center">
                           <div className="flex justify-center gap-2">
                             {order.status !== 'received' && (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => handleReceiveIntoInventory(order)}
                                 className="text-green-600 hover:text-green-700"
                                 title="Receive into Inventory"
                               >
                                 <CheckCircle className="h-4 w-4" />
                               </Button>
                             )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingOrder(order);
                                setIsAddModalOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteConfirmation({ isOpen: true, orderId: order.id })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                   ))
                 )}
               </TableBody>
              </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      )}

      {/* Modals */}
      <AddPurchaseOrderModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingOrder(null);
        }}
        onSave={handleSaveOrder}
        initialData={editingOrder}
      />

      <PurchaseOrderDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onEdit={(order) => {
          setEditingOrder(order);
          setIsAddModalOpen(true);
          setIsDetailModalOpen(false);
        }}
        onDelete={(orderId) => {
          setDeleteConfirmation({ isOpen: true, orderId });
          setIsDetailModalOpen(false);
        }}
        onMarkAsReceived={handleMarkAsReceived}
      />

      <PurchaseOrderReceivingModal
        isOpen={isReceivingModalOpen}
        onClose={() => {
          setIsReceivingModalOpen(false);
          setReceivingOrder(null);
        }}
        order={receivingOrder}
        onReceived={handleReceivingComplete}
      />

      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, orderId: null })}
        onConfirm={handleDeleteOrder}
        title="Delete Purchase Order"
        description="Are you sure you want to delete this purchase order? This action cannot be undone."
      />

      <ExportExcelDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        purchaseOrders={purchaseOrders || []}
      />
    </div>
  );
}