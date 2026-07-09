import { Link, useParams } from 'react-router-dom';
import { useCustomerOrderDetail } from '@/hooks/useCustomerOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { OrderStatusTimeline } from '@/components/portal/OrderStatusTimeline';
import { formatET } from "@/utils/dateUtils";

export default function PortalOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useCustomerOrderDetail(id);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data?.header) return <div className="text-sm text-muted-foreground">Order not found.</div>;

  const { header, lines, shipments } = data;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/portal/orders"><ArrowLeft className="h-4 w-4 mr-1" />Back to orders</Link>
        </Button>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold">Order {header.order_number || header.po_number}</h1>
          <Badge>{header.fulfillment_status || header.status || 'Pending'}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="text-muted-foreground">PO #</div><div className="font-medium">{header.po_number || '—'}</div></div>
          <div><div className="text-muted-foreground">Due Date</div><div className="font-medium">{header.due_date ? formatET(header.due_date, 'MMM d, yyyy') : '—'}</div></div>
          <div><div className="text-muted-foreground">Ordered</div><div className="font-medium">{header.total_bottles_ordered ?? 0} bottles</div></div>
          <div><div className="text-muted-foreground">Shipped</div><div className="font-medium">{header.total_bottles_shipped ?? 0} bottles</div></div>
        </CardContent>
      </Card>

      <OrderStatusTimeline orderId={header.id} currentStatus={header.fulfillment_status || header.status} />

      <Card>
        <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
        <CardContent>
          {!lines.length ? (
            <div className="text-sm text-muted-foreground">No line items.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Bottle Size</TableHead>
                  <TableHead className="text-right">Qty Ordered</TableHead>
                  <TableHead className="text-right">Qty Shipped</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.product_name || l.formula_name || '—'}</TableCell>
                    <TableCell>{l.bottle_size ? `${l.bottle_size} ct` : '—'}</TableCell>
                    <TableCell className="text-right">{l.bottles_ordered ?? l.quantity_ordered ?? 0}</TableCell>
                    <TableCell className="text-right">{l.bottles_shipped ?? l.quantity_shipped ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Shipments</CardTitle></CardHeader>
        <CardContent>
          {!shipments.length ? (
            <div className="text-sm text-muted-foreground">No shipments yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="text-right">Bottles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.shipment_date ? formatET(s.shipment_date, 'MMM d, yyyy') : '—'}</TableCell>
                    <TableCell>{s.carrier || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{s.tracking_number || '—'}</TableCell>
                    <TableCell className="text-right">{s.total_bottles ?? 0}</TableCell>
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
