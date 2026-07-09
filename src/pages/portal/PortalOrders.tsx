import { Link } from 'react-router-dom';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { formatET } from "@/utils/dateUtils";

const statusVariant = (status?: string | null) => {
  const s = (status || '').toLowerCase();
  if (s.includes('complete') || s.includes('shipped') || s.includes('closed')) return 'secondary';
  if (s.includes('progress') || s.includes('production') || s.includes('packaging')) return 'default';
  return 'outline';
};

export default function PortalOrders() {
  const { data: orders, isLoading } = useCustomerOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Orders</h1>
        <p className="text-muted-foreground">All purchase orders and their current status.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !orders?.length ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No orders yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>PO #</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Bottles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.order_number || '—'}</TableCell>
                    <TableCell>{o.po_number || '—'}</TableCell>
                    <TableCell>{o.due_date ? formatET(o.due_date, 'MMM d, yyyy') : '—'}</TableCell>
                    <TableCell>
                      {(o.total_bottles_shipped ?? 0)} / {(o.total_bottles_ordered ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(o.fulfillment_status || o.status) as any}>
                        {o.fulfillment_status || o.status || 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link to={`/portal/orders/${o.id}`} className="text-sm text-primary hover:underline">
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
