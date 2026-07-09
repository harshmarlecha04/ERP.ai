import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerPortalLinkCard } from '@/components/customers/CustomerPortalLinkCard';
import { ArrowLeft, Mail, Phone, Package, Beaker, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import type { Customer } from '@/hooks/useCustomers';
import { formatET } from "@/utils/dateUtils";

interface CustomerOrder {
  id: string;
  order_number: string;
  due_date: string;
  status: string;
  created_at: string;
  total_bottles: number;
  shipped_bottles: number;
}

interface CustomerFormula {
  formula_id: string;
  formula_name: string;
  formula_code: string;
  order_count: number;
}

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
    pending: { variant: 'outline', label: 'Pending' },
    scheduled: { variant: 'default', label: 'Scheduled' },
    in_production: { variant: 'default', label: 'In Production' },
    packaging: { variant: 'default', label: 'Packaging' },
    partially_shipped: { variant: 'secondary', label: 'Partially Shipped' },
    completed: { variant: 'default', label: 'Completed' },
    shipped: { variant: 'default', label: 'Shipped' },
  };

  const config = statusConfig[status] || { variant: 'outline', label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const CustomerDetail = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();

  // Fetch customer details
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      return data as Customer;
    },
    enabled: !!customerId,
  });

  // Fetch customer orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_headers')
        .select(`
          id,
          order_number,
          due_date,
          status,
          created_at,
          order_line_items!inner(bottles_ordered, bottles_shipped)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        due_date: order.due_date,
        status: order.status,
        created_at: order.created_at,
        total_bottles: order.order_line_items.reduce((sum: number, item: any) => 
          sum + (item.bottles_ordered || 0), 0
        ),
        shipped_bottles: order.order_line_items.reduce((sum: number, item: any) => 
          sum + (item.bottles_shipped || 0), 0
        ),
      })) as CustomerOrder[];
    },
    enabled: !!customerId,
  });

  // Fetch customer formulas
  const { data: formulas = [] } = useQuery({
    queryKey: ['customer-formulas', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_line_items')
        .select(`
          formula_id,
          formula_name,
          formula_code,
          order_headers!inner(customer_id)
        `)
        .eq('order_headers.customer_id', customerId);

      if (error) throw error;

      // Group by formula and count orders
      const formulaMap = new Map<string, CustomerFormula>();
      data.forEach((item: any) => {
        const existing = formulaMap.get(item.formula_id);
        if (existing) {
          existing.order_count += 1;
        } else {
          formulaMap.set(item.formula_id, {
            formula_id: item.formula_id,
            formula_name: item.formula_name,
            formula_code: item.formula_code,
            order_count: 1,
          });
        }
      });

      return Array.from(formulaMap.values());
    },
    enabled: !!customerId,
  });

  if (customerLoading) {
    return (
      <div className="flex items-center justify-center h-96 p-6">
        <p className="text-muted-foreground">Loading customer details...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-96 p-6">
        <p className="text-muted-foreground">Customer not found</p>
      </div>
    );
  }

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => !['completed', 'shipped', 'cancelled'].includes(o.status)).length;
  const totalBottlesOrdered = orders.reduce((sum, o) => sum + o.total_bottles, 0);
  const totalBottlesShipped = orders.reduce((sum, o) => sum + o.shipped_bottles, 0);
  const fulfillmentRate = totalBottlesOrdered > 0 
    ? Math.round((totalBottlesShipped / totalBottlesOrdered) * 100) 
    : 0;

  return (
    <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{customer.company_name}</h1>
              {customer.is_rd_customer ? (
                <Badge variant="secondary">
                  <Beaker className="mr-1 h-3 w-3" />
                  R&D Customer
                </Badge>
              ) : (
                <Badge variant="outline">
                  <Package className="mr-1 h-3 w-3" />
                  Production Customer
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Customer Code: <code className="text-xs bg-muted px-2 py-1 rounded">{customer.company_code}</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/orders')}>
              <Package className="mr-2 h-4 w-4" />
              New Order
            </Button>
          </div>
        </div>

        <CustomerPortalLinkCard
          signupCode={(customer as any).signup_short_code}
          customerName={customer.company_name}
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bottles</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBottlesOrdered.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {totalBottlesShipped.toLocaleString()} shipped
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fulfillment Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fulfillmentRate}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Orders ({totalOrders})</TabsTrigger>
            <TabsTrigger value="formulas">Formulas ({formulas.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
                      {customer.email}
                    </a>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${customer.phone}`} className="text-primary hover:underline">
                      {customer.phone}
                    </a>
                  </div>
                )}
                {!customer.email && !customer.phone && (
                  <p className="text-muted-foreground italic">No contact information available</p>
                )}
              </CardContent>
            </Card>

            {customer.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{customer.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
                <CardDescription>All orders from this customer</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Total Bottles</TableHead>
                        <TableHead className="text-right">Shipped</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordersLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            Loading orders...
                          </TableCell>
                        </TableRow>
                      ) : orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            No orders found
                          </TableCell>
                        </TableRow>
                      ) : (
                        orders.map((order) => (
                          <TableRow
                            key={order.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/orders/${order.id}`)}
                          >
                            <TableCell className="font-medium">{order.order_number}</TableCell>
                            <TableCell>{formatET(order.created_at, 'MMM dd, yyyy')}</TableCell>
                            <TableCell>{formatET(order.due_date, 'MMM dd, yyyy')}</TableCell>
                            <TableCell className="text-right">{order.total_bottles.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{order.shipped_bottles.toLocaleString()}</TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="formulas">
            <Card>
              <CardHeader>
                <CardTitle>Associated Formulas</CardTitle>
                <CardDescription>Products ordered by this customer</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Formula Code</TableHead>
                        <TableHead>Formula Name</TableHead>
                        <TableHead className="text-right">Times Ordered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formulas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8">
                            No formulas found
                          </TableCell>
                        </TableRow>
                      ) : (
                        formulas.map((formula) => (
                          <TableRow key={formula.formula_id}>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {formula.formula_code}
                              </code>
                            </TableCell>
                            <TableCell className="font-medium">{formula.formula_name}</TableCell>
                            <TableCell className="text-right">{formula.order_count}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
};

export default CustomerDetail;
