import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Factory, Package, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  calculateProductionDates,
  calculateBatchesNeeded,
  calculateTotalGummies,
  type ProductionSchedule,
} from '@/hooks/useSmartScheduling';

interface ProductionDateSuggestionProps {
  targetDate: Date | undefined;
  bottlesOrdered: number;
  bottleSize: number;
  onScheduleCalculated?: (schedule: ProductionSchedule | null) => void;
}

export const ProductionDateSuggestion = ({
  targetDate,
  bottlesOrdered,
  bottleSize,
  onScheduleCalculated,
}: ProductionDateSuggestionProps) => {
  const [schedule, setSchedule] = useState<ProductionSchedule | null>(null);

  useEffect(() => {
    if (!targetDate || !bottlesOrdered || bottlesOrdered <= 0) {
      setSchedule(null);
      onScheduleCalculated?.(null);
      return;
    }

    const totalGummies = calculateTotalGummies(bottlesOrdered, bottleSize);
    const batchesNeeded = calculateBatchesNeeded(totalGummies);
    const calculatedSchedule = calculateProductionDates(targetDate, batchesNeeded);
    
    setSchedule(calculatedSchedule);
    onScheduleCalculated?.(calculatedSchedule);
  }, [targetDate, bottlesOrdered, bottleSize, onScheduleCalculated]);

  if (!schedule) {
    return null;
  }

  const totalGummies = calculateTotalGummies(bottlesOrdered, bottleSize);
  const isUrgent = schedule.productionDaysCount <= 2;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-primary" />
          Suggested Production Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Gummies</p>
            <p className="text-xl font-bold">{totalGummies.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Batches Needed</p>
            <p className="text-xl font-bold text-primary">{schedule.totalBatches}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Production Days</p>
            <p className="text-xl font-bold">{schedule.productionDaysCount}</p>
          </div>
        </div>

        {/* Timeline Alert */}
        {isUrgent && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Urgent timeline: Only {schedule.productionDaysCount} production day{schedule.productionDaysCount > 1 ? 's' : ''} available before target date
            </AlertDescription>
          </Alert>
        )}

        {/* Production Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Production Phase</span>
            </div>
            <Badge variant="outline">
              {format(schedule.startDate, 'MMM dd')} - {format(schedule.endDate, 'MMM dd')}
            </Badge>
          </div>

          {/* Daily Breakdown */}
          <div className="space-y-2 pl-6">
            {schedule.productionDays.map((day, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      Day {index + 1}: {format(day.date, 'EEE, MMM dd')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(day.date, { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={day.batches >= 12 ? "destructive" : "secondary"}>
                    {day.batches} batch{day.batches !== 1 ? 'es' : ''}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ~{((day.batches * 43000) / bottleSize).toLocaleString()} bottles
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Packaging Phase */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Packaging Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{format(schedule.packagingReadyDate, 'EEE, MMM dd')}</Badge>
              <span className="text-xs text-muted-foreground">
                (3 days lead time)
              </span>
            </div>
          </div>

          {/* Ship Date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Ready to Ship</span>
            </div>
            <Badge className="bg-green-600">
              {format(targetDate!, 'EEE, MMM dd')}
            </Badge>
          </div>
        </div>

        {/* Production Capacity Warning */}
        {schedule.productionDays.some(day => day.batches >= 12) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Some days are at maximum capacity (12 batches). Consider adjusting target date if materials or resources are constrained.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
