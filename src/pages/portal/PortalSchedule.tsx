import { CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function PortalSchedule() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upcoming production and shipment dates for your orders.
        </p>
      </div>
      <Card>
        <CardContent className="py-16 flex flex-col items-center text-center gap-3 text-muted-foreground">
          <CalendarDays className="h-10 w-10" />
          <div className="text-sm">Your schedule view is coming soon.</div>
        </CardContent>
      </Card>
    </div>
  );
}
