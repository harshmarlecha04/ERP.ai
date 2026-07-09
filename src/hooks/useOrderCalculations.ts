import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateProductionDates } from './useSmartScheduling';

export interface OrderCalculations {
  totalGummies: number;
  batchesNeeded: number;
  productionDays: number;
  schedule: any;
  hasConflicts: boolean;
  conflicts: any[];
  gummiesPerBatch: number;
  gummyWeightG: number;
  batchSizeKg: number;
}

export const useOrderCalculations = (
  formulaId: string | undefined,
  bottlesOrdered: number,
  bottleSize: number,
  dueDate: Date | undefined,
  overrideGummyWeight?: number
) => {
  const [calculations, setCalculations] = useState<OrderCalculations | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    if (!formulaId || !bottlesOrdered || !dueDate || bottleSize <= 0) {
      setCalculations(null);
      return;
    }

    const calculate = async () => {
      setIsCalculating(true);
      try {
        // Calculate total gummies
        const totalGummies = bottlesOrdered * bottleSize;

        // Get formula details for dynamic batch calculation
        const { data: formula } = await supabase
          .from('formulas')
          .select('default_batch_size_kg, average_piece_weight')
          .eq('id', formulaId)
          .single();

        // Calculate gummies per batch dynamically
        // Formula: (batch_size_kg * 1000) / gummy_weight_g = gummies_per_batch
        // Example: (150.5 kg * 1000) / 3.5g = 43,000 gummies/batch
        const batchSizeKg = formula?.default_batch_size_kg || 150.5;
        const gummyWeightG = overrideGummyWeight || formula?.average_piece_weight || 3.5;
        const gummiesPerBatch = Math.floor((batchSizeKg * 1000) / gummyWeightG);

        // Calculate batches needed
        const batchesNeeded = Math.ceil(totalGummies / gummiesPerBatch);

        // Calculate production days (max 12 batches/day)
        const productionDays = Math.ceil(batchesNeeded / 12);

        // Get suggested dates from smart scheduling
        const schedule = calculateProductionDates(dueDate, batchesNeeded);

        // Check for capacity conflicts
        const { data: existingSchedule } = await supabase
          .from('production_schedule_items')
          .select('schedule_date, batches')
          .gte('schedule_date', schedule.startDate.toISOString())
          .lte('schedule_date', schedule.endDate.toISOString());

        const capacityMap = new Map<string, number>();
        existingSchedule?.forEach((item: any) => {
          const dateKey = item.schedule_date;
          capacityMap.set(dateKey, (capacityMap.get(dateKey) || 0) + item.batches);
        });

        const conflicts: any[] = [];
        schedule.productionDays.forEach((day: any) => {
          const existing = capacityMap.get(day.date) || 0;
          const total = existing + day.batches;
          if (total > 12) {
            conflicts.push({
              date: day.date,
              available: 12 - existing,
              needed: day.batches,
            });
          }
        });

        setCalculations({
          totalGummies,
          batchesNeeded,
          productionDays,
          schedule,
          hasConflicts: conflicts.length > 0,
          conflicts,
          gummiesPerBatch,
          gummyWeightG,
          batchSizeKg,
        });
      } catch (error) {
        console.error('Calculation error:', error);
        setCalculations(null);
      } finally {
        setIsCalculating(false);
      }
    };

    calculate();
  }, [formulaId, bottlesOrdered, bottleSize, dueDate, overrideGummyWeight]);

  return { calculations, isCalculating };
};
