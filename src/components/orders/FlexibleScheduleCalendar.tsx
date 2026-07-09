import React from 'react';
import { Calendar, Package, Truck } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { formatET } from "@/utils/dateUtils";

interface FlexibleScheduleCalendarProps {
  schedule: any;
  onScheduleChange?: (schedule: any) => void;
}

export const FlexibleScheduleCalendar: React.FC<FlexibleScheduleCalendarProps> = ({
  schedule,
  onScheduleChange,
}) => {
  if (!schedule) {
    return (
      <div className="bg-muted/30 border border-dashed rounded-lg p-6 text-center">
        <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Production schedule will appear here after calculations
        </p>
      </div>
    );
  }

  const getBatchColor = (batches: number) => {
    if (batches >= 12) return 'bg-red-100 border-red-300 text-red-700';
    if (batches >= 10) return 'bg-yellow-100 border-yellow-300 text-yellow-700';
    return 'bg-green-100 border-green-300 text-green-700';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Production Schedule</h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {schedule.productionDays.map((day: any, index: number) => (
          <div
            key={index}
            className={`border-2 rounded-lg p-4 ${getBatchColor(day.batches)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium opacity-70">
                {formatET(day.date, 'EEE')}
              </p>
              <Badge variant="secondary" className="text-xs">
                Day {index + 1}
              </Badge>
            </div>
            <p className="text-lg font-bold">
              {formatET(day.date, 'MMM dd')}
            </p>
            <div className="mt-2 flex items-center gap-1">
              <Package className="h-3 w-3" />
              <span className="text-sm font-semibold">{day.batches} batches</span>
            </div>
            {day.isWeekend && (
              <p className="text-xs mt-1 opacity-70">Weekend</p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Production Start</p>
              <p className="font-semibold">
                {format(schedule.startDate, 'MMM dd, yyyy')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-blue-500/10 rounded-lg p-2">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Packaging Ready</p>
              <p className="font-semibold">
                {format(schedule.packagingReadyDate, 'MMM dd, yyyy')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-green-500/10 rounded-lg p-2">
              <Truck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ready to Ship</p>
              <p className="font-semibold">
                {format(addDays(schedule.packagingReadyDate, 2), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {schedule.productionDays.some((day: any) => day.batches >= 12) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            ⚠️ Some days are at maximum capacity (12 batches/day). Consider extending the schedule.
          </p>
        </div>
      )}
    </div>
  );
};
