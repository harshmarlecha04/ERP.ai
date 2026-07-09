import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Upload } from 'lucide-react';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import UploadPOModal from '@/components/portal/UploadPOModal';
import { formatET } from "@/utils/dateUtils";

type Filter = 'open' | 'closed' | 'all';

const isClosed = (o: any) => {
  const s = `${o.fulfillment_status || ''} ${o.status || ''} ${o.header_status || ''}`.toLowerCase();
  return s.includes('closed') || s.includes('complete') || s.includes('cancelled');
};

const statusVariant = (o: any) => (isClosed(o) ? 'secondary' : 'default');

export default function PortalPurchaseOrders() {
  const { data: orders, isLoading } = useCustomerOrders();
  const [filter, setFilter] = useState<Filter>('open');
  const [uploadOpen, setUploadOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!orders) return [];
    if (filter === 'all') return orders;
    return orders.filter((o: any) => (filter === 'closed' ? isClosed(o) : !isClosed(o)));
  }, [orders, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Submit new POs, track open ones, and review your closed orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload PO
          </Button>
          <Button asChild>
            <Link to="/portal/purchase-orders/new">
              <Plus className="h-4 w-4 mr-2" />
              New PO
            </Link>
          </Button>
        </div>
      </div>

      <UploadPOModal open={uploadOpen} onOpenChange={setUploadOpen} />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground text-center">Loading…</div>
          ) : !filtered.length ? (
            <div className="p-12 text-center space-y-3">
              <div className="text-sm text-muted-foreground">
                {filter === 'closed'
                  ? 'No closed purchase orders.'
                  : filter === 'open'
                  ? 'No open purchase orders. Create your first PO to get started.'
                  : 'No purchase orders yet.'}
              </div>
              {filter !== 'closed' && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/portal/purchase-orders/new">
                    <Plus className="h-4 w-4 mr-2" />
                    New PO
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Bottles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.po_number || '—'}</TableCell>
                    <TableCell>{o.order_number || '—'}</TableCell>
                    <TableCell>
                      {o.due_date ? formatET(o.due_date, 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      {(o.total_bottles_shipped ?? 0)} / {(o.total_bottles_ordered ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(o) as any}>
                        {o.fulfillment_status || o.status || 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/portal/purchase-orders/${o.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
