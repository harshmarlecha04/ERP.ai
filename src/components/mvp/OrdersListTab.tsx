import { useState, useMemo } from 'react';
import { useOrderHeaders, OrderWithLines } from '@/hooks/useOrderHeaders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Search, MoreHorizontal, Eye, Pencil, CheckCircle, ArrowUpDown, X } from 'lucide-react';
import { format, differenceInDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { EditOrderModal } from './EditOrderModal';
import { CloseOrderDialog } from './CloseOrderDialog';
import { BatchActionToolbar } from './BatchActionToolbar';
import { AdvancedOrderFilters, OrderFilters, defaultFilters } from './AdvancedOrderFilters';
import { formatET } from "@/utils/dateUtils";

interface OrdersListTabProps {
  onSelectOrder: (orderId: string) => void;
}

// --- Status mapping ---
type StatusDisplay = { label: string; color: string };

const STATUS_MAP: Record<string, StatusDisplay> = {
  pending: { label: 'Pending', color: 'bg-muted text-muted-foreground' },
  materials_checked: { label: 'Pending', color: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  materials_reserved: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  in_production: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  in_drying: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  in_coating: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  packaging: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  ready_to_ship: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  partially_shipped: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  shipped: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  closed: { label: 'Closed', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  cancelled: { label: 'Closed', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

function getStatusDisplay(status: string | undefined): StatusDisplay {
  return STATUS_MAP[(status || 'pending').toLowerCase()] || STATUS_MAP.pending;
}

function getStatusGroup(status: string | undefined): string {
  return getStatusDisplay(status).label.toLowerCase().replace(' ', '_');
}

// --- Due date helpers ---
function getDaysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  return differenceInDays(new Date(dueDate), new Date());
}

export function OrdersListTab({ onSelectOrder }: OrdersListTabProps) {
  const { orders, isLoading } = useOrderHeaders();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingOrder, setEditingOrder] = useState<OrderWithLines | null>(null);
  const [closingOrder, setClosingOrder] = useState<OrderWithLines | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<OrderFilters>(defaultFilters);
  const [dueDateSort, setDueDateSort] = useState<'asc' | 'desc' | null>(null);

  // Build customer options for filter
  const customerOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders?.forEach(o => {
      if (o.customer_id && o.customer_name) map.set(o.customer_id, o.customer_name);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    let result = orders || [];

    // Search — also match product/formula names in line_items
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.po_number?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        (o as any).line_items?.some?.((li: any) =>
          li.formula_name?.toLowerCase().includes(q) ||
          li.formula_code?.toLowerCase().includes(q)
        )
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter(o => getStatusGroup(o.header_status) === filters.status);
    } else {
      // Default: show active only (exclude closed/completed)
      const activeStatuses = ['pending', 'materials_checked', 'scheduled', 'materials_reserved',
        'in_production', 'in_drying', 'in_coating', 'packaging', 'ready_to_ship', 'partially_shipped'];
      result = result.filter(o => activeStatuses.includes((o.header_status || 'pending').toLowerCase()));
    }

    // Due date range
    if (filters.dueDateRange !== 'all') {
      const now = new Date();
      result = result.filter(o => {
        if (!o.due_date) return false;
        const due = new Date(o.due_date);
        if (filters.dueDateRange === 'overdue') return due < now;
        if (filters.dueDateRange === 'this_week') return due >= startOfWeek(now) && due <= endOfWeek(now);
        if (filters.dueDateRange === 'this_month') return due >= startOfMonth(now) && due <= endOfMonth(now);
        return true;
      });
    }

    // Created date range
    if (filters.createdFrom) {
      result = result.filter(o => o.created_at && new Date(o.created_at) >= filters.createdFrom!);
    }
    if (filters.createdTo) {
      const endOfDay = new Date(filters.createdTo);
      endOfDay.setHours(23, 59, 59, 999);
      result = result.filter(o => o.created_at && new Date(o.created_at) <= endOfDay);
    }

    // Customer filter
    if (filters.customers.length > 0) {
      result = result.filter(o => filters.customers.includes(o.customer_id));
    }

    // Due date sorting
    if (dueDateSort) {
      result = [...result].sort((a, b) => {
        const dA = getDaysUntilDue(a.due_date) ?? 999;
        const dB = getDaysUntilDue(b.due_date) ?? 999;
        return dueDateSort === 'asc' ? dA - dB : dB - dA;
      });
    }

    return result;
  }, [orders, searchQuery, filters, dueDateSort]);

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const toggleDueDateSort = () => {
    setDueDateSort(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Batch action toolbar */}
      {selectedOrders.size > 0 && (
        <BatchActionToolbar
          selectedOrders={selectedOrders}
          orders={filteredOrders}
          onClearSelection={() => setSelectedOrders(new Set())}
          onScheduleSelected={() => {
            // Could open a batch schedule modal — for now, toast
          }}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Orders</CardTitle>
              <CardDescription>Current, pending, and in-progress orders</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <AdvancedOrderFilters filters={filters} onChange={setFilters} customerOptions={customerOptions} />
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search PO, customer, or product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery ? 'No orders found matching your search.' : 'No orders yet. Create your first order!'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Total Bottles</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={toggleDueDateSort}>
                        Due Date <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TooltipProvider delayDuration={300}>
                    {filteredOrders.map((order) => {
                      const statusDisplay = getStatusDisplay(order.header_status);
                      const daysUntil = getDaysUntilDue(order.due_date);
                      const customerName = order.customer_name || 'N/A';
                      const productText = `${order.total_line_items || 0} ${(order.total_line_items || 0) === 1 ? 'product' : 'products'}`;
                      const scheduledText = order.earliest_scheduled_date
                        ? formatET(order.earliest_scheduled_date, 'MMM dd, yyyy')
                        : '—';

                      return (
                        <TableRow
                          key={order.id}
                          className={cn(
                            "cursor-pointer transition-colors duration-150 hover:bg-muted/70",
                            selectedOrders.has(order.id) && "bg-muted/50"
                          )}
                          onClick={() => onSelectOrder(order.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedOrders.has(order.id)}
                              onCheckedChange={() => toggleSelect(order.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="link"
                              className="h-auto p-0 font-semibold"
                              onClick={(e) => { e.stopPropagation(); onSelectOrder(order.id); }}
                            >
                              {order.po_number || order.order_number}
                            </Button>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {order.created_at ? formatET(order.created_at, 'MMM dd, yyyy') : '—'}
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate max-w-[150px]">{customerName}</span>
                              </TooltipTrigger>
                              <TooltipContent><p>{customerName}</p></TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", statusDisplay.color)}>
                              {statusDisplay.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate max-w-[120px]">{productText}</span>
                              </TooltipTrigger>
                              <TooltipContent><p>{productText}</p></TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{(order.total_bottles_ordered || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            {order.due_date ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-sm">{formatET(order.due_date, 'MMM dd, yyyy')}</span>
                                    {daysUntil !== null && daysUntil < 0 && (
                                      <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-800 dark:text-red-300 w-fit">
                                        {Math.abs(daysUntil)}d overdue
                                      </span>
                                    )}
                                    {daysUntil !== null && daysUntil >= 0 && daysUntil <= 7 && (
                                      <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/40 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-300 w-fit">
                                        Due in {daysUntil}d
                                      </span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Due: {formatET(order.due_date, 'EEEE, MMMM dd, yyyy')}</p>
                                  {daysUntil !== null && (
                                    <p className="text-xs">{daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` : daysUntil === 0 ? 'Due today' : `${daysUntil} days remaining`}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground">Not set</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate max-w-[100px]">{scheduledText}</span>
                              </TooltipTrigger>
                              <TooltipContent><p>{scheduledText}</p></TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onSelectOrder(order.id)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditingOrder(order)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit Order
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setClosingOrder(order)}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Close PO
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TooltipProvider>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EditOrderModal
        open={!!editingOrder}
        onOpenChange={(open) => !open && setEditingOrder(null)}
        order={editingOrder}
      />
      <CloseOrderDialog
        open={!!closingOrder}
        onOpenChange={(open) => !open && setClosingOrder(null)}
        order={closingOrder}
      />
    </div>
  );
}
