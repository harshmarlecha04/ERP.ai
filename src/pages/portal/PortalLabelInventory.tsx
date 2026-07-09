import { Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function PortalLabelInventory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Label Inventory</h1>
        <p className="text-muted-foreground text-sm mt-1">
          On-hand label stock for your SKUs.
        </p>
      </div>
      <Card>
        <CardContent className="py-16 flex flex-col items-center text-center gap-3 text-muted-foreground">
          <Tag className="h-10 w-10" />
          <div className="text-sm">Label inventory will appear here soon.</div>
        </CardContent>
      </Card>
    </div>
  );
}
