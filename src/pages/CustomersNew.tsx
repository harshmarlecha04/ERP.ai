import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Users, Package, Beaker, TrendingUp, Eye, Pencil, FileText, Trash2 } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { AddCustomerModal } from '@/components/orders/AddCustomerModal';
import { DeleteConfirmationModal } from '@/components/inventory/DeleteConfirmationModal';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CustomerOrderStats {
  total_orders: number;
  pending_orders: number;
  last_order_date: string | null;
  total_bottles_ordered: number;
}

const CustomersNew = () => {
  const navigate = useNavigate();
  const { customers, isLoading, deleteCustomer } = useCustomers();
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; name: string } | null>(null);

  // Fetch order stats for all customers
  const { data: customerStats = [] } = useQuery({
    queryKey: ['customer-order-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_headers')
        .select(`
          customer_id,
          status,
          created_at,
          order_line_items!inner(bottles_ordered)
        `);

      if (error) throw error;

      // Aggregate stats by customer
      const statsMap = new Map<string, CustomerOrderStats>();

      data?.forEach((order: any) => {
        const existing = statsMap.get(order.customer_id) || {
          total_orders: 0,
          pending_orders: 0,
          last_order_date: null,
          total_bottles_ordered: 0,
        };

        existing.total_orders += 1;
        if (!['completed', 'shipped', 'cancelled'].includes(order.status)) {
          existing.pending_orders += 1;
        }
        if (!existing.last_order_date || new Date(order.created_at) > new Date(existing.last_order_date)) {
          existing.last_order_date = order.created_at;
        }
        existing.total_bottles_ordered += order.order_line_items.reduce((sum: number, item: any) => 
          sum + (item.bottles_ordered || 0), 0
        );

        statsMap.set(order.customer_id, existing);
      });

      return Array.from(statsMap.entries()).map(([customer_id, stats]) => ({
        customer_id,
        ...stats,
      }));
    },
  });

  const getCustomerStats = (customerId: string) => {
    return customerStats?.find((s: any) => s.customer_id === customerId) || {
      total_orders: 0,
      pending_orders: 0,
      last_order_date: null,
      total_bottles_ordered: 0,
    };
  };

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.company_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = 
      customerTypeFilter === 'all' || 
      (customerTypeFilter === 'production' && !customer.is_rd_customer) ||
      (customerTypeFilter === 'rd' && customer.is_rd_customer);

    const stats = getCustomerStats(customer.id);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && stats.pending_orders > 0) ||
      (statusFilter === 'inactive' && stats.pending_orders === 0);

    return matchesSearch && matchesType && matchesStatus;
  });

  const summaryStats = {
    total: customers.length,
    active: customers.filter(c => getCustomerStats(c.id).pending_orders > 0).length,
    rdCustomers: customers.filter(c => c.is_rd_customer).length,
    totalOrders: customerStats?.reduce((sum: number, s: any) => sum + s.total_orders, 0) || 0,
  };

  const handleDeleteClick = (customerId: string, customerName: string) => {
    setCustomerToDelete({ id: customerId, name: customerName });
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (customerToDelete) {
      await deleteCustomer.mutateAsync(customerToDelete.id);
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customers</h1>
            <p className="text-muted-foreground">
              Manage customer information and order history
            </p>
          </div>
          <Button onClick={() => setShowNewCustomer(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Customer
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.active}</div>
              <p className="text-xs text-muted-foreground">With pending orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">R&D Customers</CardTitle>
              <Beaker className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.rdCustomers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.totalOrders}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers by name, code, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>

              <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="rd">R&D</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customers Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Customer</TableHead>
                    <TableHead className="w-[100px] text-center">Code</TableHead>
                    <TableHead className="w-[300px]">Contact</TableHead>
                    <TableHead className="w-[140px] text-center">Pending Orders</TableHead>
                    <TableHead className="w-[140px] text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Loading customers...
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        No customers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => {
                      const stats = getCustomerStats(customer.id);
                      return (
                        <TableRow
                          key={customer.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/customers/${customer.id}`)}
                        >
                          <TableCell className="font-medium">
                            {customer.company_name}
                          </TableCell>
                          <TableCell className="text-center">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {customer.company_code}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {customer.contact_person ? (
                                <>
                                  <div className="font-medium">
                                    {customer.contact_person}
                                    {customer.contact_title && (
                                      <span className="text-muted-foreground font-normal">
                                        {' '}({customer.contact_title})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {customer.email && <span>{customer.email}</span>}
                                    {customer.email && customer.phone && <span> | </span>}
                                    {customer.phone && <span>{customer.phone}</span>}
                                  </div>
                                </>
                              ) : (
                                <>
                                  {customer.email && (
                                    <div className="text-muted-foreground">{customer.email}</div>
                                  )}
                                  {customer.phone && (
                                    <div className="text-muted-foreground">{customer.phone}</div>
                                  )}
                                  {!customer.email && !customer.phone && (
                                    <div className="text-muted-foreground italic">No contact info</div>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {stats.pending_orders > 0 ? (
                              <span className="font-medium text-primary">
                                {stats.pending_orders}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/customers/${customer.id}`);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCustomer(customer);
                                  setShowNewCustomer(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/orders?customer=${customer.id}`);
                                }}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(customer.id, customer.company_name);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <AddCustomerModal
          open={showNewCustomer}
          onOpenChange={(open) => {
            setShowNewCustomer(open);
            if (!open) setEditingCustomer(null);
          }}
          customer={editingCustomer}
        />

        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setCustomerToDelete(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete Customer"
          description={`Are you sure you want to delete "${customerToDelete?.name}"? This action cannot be undone.`}
        />
      </div>
    );
};

export default CustomersNew;
