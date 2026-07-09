import { useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Search, Package, Calendar, TrendingUp, Download, Users } from 'lucide-react';
import { useOrderHeaders, OrderWithLines } from '@/hooks/useOrderHeaders';
import { useCustomers } from '@/hooks/useCustomers';
import { format, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { exportCustomerOrders } from '@/utils/reportExports';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatET } from "@/utils/dateUtils";

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
    pending: { variant: 'outline', label: 'Pending' },
    materials_checked: { variant: 'secondary', label: 'Materials Checked' },
    scheduled: { variant: 'default', label: 'Scheduled' },
    materials_reserved: { variant: 'default', label: '🔒 Reserved' },
    in_production: { variant: 'default', label: 'In Production' },
    in_drying: { variant: 'secondary', label: 'Drying' },
    in_coating: { variant: 'secondary', label: 'Coating' },
    packaging: { variant: 'default', label: 'Packaging' },
    ready_to_ship: { variant: 'default', label: 'Ready to Ship' },
    partially_shipped: { variant: 'secondary', label: '📦 Partial' },
    completed: { variant: 'default', label: 'Completed' },
    shipped: { variant: 'default', label: '✅ Shipped' },
    cancelled: { variant: 'destructive', label: 'Cancelled' },
  };

  const config = statusConfig[status] || { variant: 'outline', label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getDueDateColor = (dueDate: string) => {
  const days = differenceInDays(new Date(dueDate), new Date());
  if (days < 0) return 'text-destructive';
  if (days <= 3) return 'text-destructive';
  if (days <= 7) return 'text-amber-600';
  return 'text-muted-foreground';
};

const Orders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { orders, isLoading: ordersLoading } = useOrderHeaders();
  const { customers, isLoading: customersLoading } = useCustomers();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.company_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.company_code.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [customers, customerSearch]);

  // Get orders for selected customer
  const customerOrders = useMemo(() => {
    if (!selectedCustomerId) return [];
    return orders.filter(o => o.customer_id === selectedCustomerId);
  }, [orders, selectedCustomerId]);

  // Filter orders by search
  const filteredOrders = useMemo(() => {
    if (!orderSearch) return customerOrders;
    const search = orderSearch.toLowerCase();
    return customerOrders.filter(o => 
      o.order_number?.toLowerCase().includes(search) ||
      o.po_number?.toLowerCase().includes(search) ||
      o.line_items.some(li => 
        li.formula_name?.toLowerCase().includes(search) ||
        li.formula_code?.toLowerCase().includes(search)
      )
    );
  }, [customerOrders, orderSearch]);

  // Calculate customer metrics
  const customerMetrics = useMemo(() => {
    if (!selectedCustomerId || customerOrders.length === 0) {
      return { totalOrders: 0, totalBottles: 0, firstOrder: null, lastOrder: null, completedOrders: 0 };
    }

    const totalBottles = customerOrders.reduce((sum, order) => {
      return sum + order.line_items.reduce((lineSum, li) => lineSum + (li.bottles_ordered || 0), 0);
    }, 0);

    const sortedByDate = [...customerOrders].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const completedOrders = customerOrders.filter(o => 
      ['completed', 'shipped'].includes(o.status)
    ).length;

    return {
      totalOrders: customerOrders.length,
      totalBottles,
      firstOrder: sortedByDate[0]?.created_at,
      lastOrder: sortedByDate[sortedByDate.length - 1]?.created_at,
      completedOrders,
    };
  }, [customerOrders, selectedCustomerId]);

  // Get customer order stats for the list
  const customerOrderStats = useMemo(() => {
    const stats: Record<string, { count: number; totalBottles: number }> = {};
    orders.forEach(order => {
      if (!order.customer_id) return;
      if (!stats[order.customer_id]) {
        stats[order.customer_id] = { count: 0, totalBottles: 0 };
      }
      stats[order.customer_id].count++;
      stats[order.customer_id].totalBottles += order.line_items.reduce(
        (sum, li) => sum + (li.bottles_ordered || 0), 0
      );
    });
    return stats;
  }, [orders]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const handleExport = () => {
    if (!selectedCustomerId || filteredOrders.length === 0) {
      toast({ title: 'No orders to export', variant: 'destructive' });
      return;
    }

    const exportData = filteredOrders.flatMap(order => 
      order.line_items.map(line => ({
        id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        formula_id: line.formula_id,
        formula_name: line.formula_name,
        formula_code: line.formula_code,
        order_type: line.order_type,
        bottles_ordered: line.bottles_ordered,
        bottle_size: line.bottle_size,
        due_date: order.due_date,
        status: order.status,
        priority: order.priority,
        created_at: order.created_at,
        notes: order.notes,
        special_instructions: order.special_instructions,
        progress_percent: Math.round((line.bottles_shipped / line.bottles_ordered) * 100),
        bottles_shipped: line.bottles_shipped,
        bottles_remaining: line.bottles_remaining,
      }))
    );
    exportCustomerOrders(exportData as any);
    toast({
      title: 'Export Complete',
      description: `Exported ${exportData.length} order lines for ${selectedCustomer?.company_name}`,
    });
  };

  const isLoading = ordersLoading || customersLoading;

  return (
    <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customer Order History</h1>
            <p className="text-muted-foreground">
              View order history by customer
            </p>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Customer List - Left Panel */}
          <Card className="w-60 shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Customers
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {isLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading customers...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No customers found</div>
                ) : (
                  <div className="space-y-1 p-2">
                    {filteredCustomers.map((customer) => {
                      const stats = customerOrderStats[customer.id];
                      const isSelected = customer.id === selectedCustomerId;
                      return (
                        <button
                          key={customer.id}
                          onClick={() => setSelectedCustomerId(customer.id)}
                          className={cn(
                            "w-full text-left px-3 py-3 rounded-md transition-colors",
                            isSelected 
                              ? "bg-primary text-primary-foreground" 
                              : "hover:bg-muted"
                          )}
                        >
                          <div className="font-medium">{customer.company_name}</div>
                          <div className={cn(
                            "text-sm",
                            isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            {stats ? `${stats.count} orders • ${stats.totalBottles.toLocaleString()} bottles` : 'No orders'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Order History - Right Panel */}
          <div className="flex-1 space-y-4">
            {!selectedCustomerId ? (
              <Card className="h-[700px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Select a Customer</p>
                  <p className="text-sm">Choose a customer from the list to view their order history</p>
                </div>
              </Card>
            ) : (
              <>
                {/* Customer Header & Metrics */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedCustomer?.company_name}</CardTitle>
                        <CardDescription>{selectedCustomer?.company_code}</CardDescription>
                      </div>
                      <Button variant="outline" onClick={handleExport} disabled={filteredOrders.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Orders
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold">{customerMetrics.totalOrders}</div>
                        <div className="text-sm text-muted-foreground">Total Orders</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold">{customerMetrics.totalBottles.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">Total Bottles</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold">{customerMetrics.completedOrders}</div>
                        <div className="text-sm text-muted-foreground">Completed</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm font-medium">
                          {customerMetrics.firstOrder ? formatET(customerMetrics.firstOrder, 'MMM yyyy') : '-'}
                        </div>
                        <div className="text-xs text-muted-foreground">First Order</div>
                        <div className="text-sm font-medium mt-1">
                          {customerMetrics.lastOrder ? formatET(customerMetrics.lastOrder, 'MMM yyyy') : '-'}
                        </div>
                        <div className="text-xs text-muted-foreground">Last Order</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Order History Table */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Order History</CardTitle>
                      <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search orders..."
                          value={orderSearch}
                          onChange={(e) => setOrderSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredOrders.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        No orders found for this customer
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>PO Number</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead>Bottle Qty</TableHead>
                              <TableHead>Bottle Type</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead>Created</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredOrders.flatMap((order) => {
                              if (!order.line_items || order.line_items.length === 0) {
                                return (
                                  <TableRow
                                    key={order.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => navigate(`/orders/${order.id}`)}
                                  >
                                    <TableCell className="font-medium">{order.po_number || '—'}</TableCell>
                                    <TableCell className="text-muted-foreground italic" colSpan={3}>
                                      No products
                                    </TableCell>
                                    <TableCell>-</TableCell>
                                    <TableCell className={getDueDateColor(order.due_date)}>
                                      {formatET(order.due_date, 'MMM dd, yyyy')}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {formatET(order.created_at, 'MMM dd, yyyy')}
                                    </TableCell>
                                  </TableRow>
                                );
                              }

                              return order.line_items.map((line, idx) => (
                                <TableRow
                                  key={`${order.id}-${line.id}`}
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => navigate(`/orders/${order.id}`)}
                                >
                                  <TableCell className="font-medium">
                                    {idx === 0 ? (order.po_number || '—') : ''}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium">{line.formula_name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {line.bottle_size} ct
                                    </div>
                                  </TableCell>
                                  <TableCell>{line.bottles_ordered.toLocaleString()}</TableCell>
                                  <TableCell>{line.bottle_type_name || '-'}</TableCell>
                                  <TableCell className={idx === 0 ? getDueDateColor(order.due_date) : ''}>
                                    {idx === 0 ? formatET(order.due_date, 'MMM dd, yyyy') : ''}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {idx === 0 ? formatET(order.created_at, 'MMM dd, yyyy') : ''}
                                  </TableCell>
                                </TableRow>
                              ));
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
    </div>
  );
};

export default Orders;
