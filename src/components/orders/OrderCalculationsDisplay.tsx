import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Calculator, Beaker, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface OrderCalculationsDisplayProps {
  calculations: any;
  isCalculating: boolean;
}

export const OrderCalculationsDisplay: React.FC<OrderCalculationsDisplayProps> = ({
  calculations,
  isCalculating,
}) => {
  if (isCalculating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auto-Calculations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!calculations) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auto-Calculations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 border border-dashed rounded-lg p-6 text-center">
            <Calculator className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Enter order details to see automatic calculations
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-Calculations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Calculation Breakdown */}
        <div className="bg-muted/50 p-4 rounded-lg space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Gummies:</span>
            <span className="font-semibold">{calculations.totalGummies.toLocaleString()} gummies</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gummy Weight:</span>
            <span className="font-semibold text-primary">{calculations.gummyWeightG}g each</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Batch Size:</span>
            <span className="font-medium">{calculations.batchSizeKg} kg ({calculations.gummiesPerBatch.toLocaleString()} gummies/batch)</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Batches Needed:</span>
            <span className="font-bold text-lg">{calculations.batchesNeeded} batches</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Production Days:</span>
            <span className="font-semibold">{calculations.productionDays} days (max 12 batches/day)</span>
          </div>
        </div>

        {/* Visual Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col items-center p-4 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg">
            <Beaker className="h-8 w-8 mb-2 text-primary" />
            <p className="text-sm text-muted-foreground mb-1">Batches Needed</p>
            <p className="text-2xl font-bold">{calculations.batchesNeeded}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {calculations.gummiesPerBatch.toLocaleString()}/batch at {calculations.gummyWeightG}g
            </p>
          </div>

          <div className="flex flex-col items-center p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg">
            <Calendar className="h-8 w-8 mb-2 text-blue-600" />
            <p className="text-sm text-muted-foreground mb-1">Production Days</p>
            <p className="text-2xl font-bold text-blue-600">{calculations.productionDays}</p>
            <p className="text-xs text-muted-foreground mt-1">
              12 batches max per day
            </p>
          </div>

          <div className="flex flex-col items-center p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-lg">
            <Clock className="h-8 w-8 mb-2 text-green-600" />
            <p className="text-sm text-muted-foreground mb-1">Suggested Start</p>
            <p className="text-lg font-bold text-green-600">
              {format(calculations.schedule.startDate, 'MMM d, yyyy')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {calculations.schedule.daysUntilStart} days until start
            </p>
          </div>
        </div>

        {/* Production Breakdown */}
        {calculations.productionDays > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Production Breakdown:</p>
            <div className="space-y-2">
              {calculations.schedule.productionDays.map((day: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium min-w-[140px]">
                    Day {idx + 1}: {day.batches} batches
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {(day.batches * calculations.gummiesPerBatch).toLocaleString()} gummies
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
