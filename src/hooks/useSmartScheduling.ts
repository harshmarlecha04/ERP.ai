import { addDays, subDays, format, isWeekend, addWeeks } from 'date-fns';

export interface ProductionDay {
  date: Date;
  batches: number;
  isWeekend: boolean;
}

export interface ProductionSchedule {
  startDate: Date;
  endDate: Date;
  productionDays: ProductionDay[];
  totalBatches: number;
  productionDaysCount: number;
  packagingReadyDate: Date;
}

const MAX_BATCHES_PER_DAY = 12;
const PRODUCTION_TO_PACKAGING_DAYS = 3;

/**
 * Calculate production dates backwards from target date
 * considering max batches per day and production-to-packaging lead time
 */
export const calculateProductionDates = (
  targetDate: Date,
  batchesNeeded: number
): ProductionSchedule => {
  // Packaging ready date is 3 days before target (ship date)
  const packagingReadyDate = subDays(targetDate, PRODUCTION_TO_PACKAGING_DAYS);
  
  // Calculate number of production days needed
  const productionDaysNeeded = Math.ceil(batchesNeeded / MAX_BATCHES_PER_DAY);
  
  // Find production dates working backwards from packaging ready date
  const productionDays: ProductionDay[] = [];
  let remainingBatches = batchesNeeded;
  let currentDate = packagingReadyDate;
  
  for (let i = 0; i < productionDaysNeeded; i++) {
    // Skip weekends
    while (isWeekend(currentDate)) {
      currentDate = subDays(currentDate, 1);
    }
    
    const batchesForDay = Math.min(remainingBatches, MAX_BATCHES_PER_DAY);
    
    productionDays.unshift({
      date: currentDate,
      batches: batchesForDay,
      isWeekend: false,
    });
    
    remainingBatches -= batchesForDay;
    currentDate = subDays(currentDate, 1);
  }
  
  return {
    startDate: productionDays[0].date,
    endDate: productionDays[productionDays.length - 1].date,
    productionDays,
    totalBatches: batchesNeeded,
    productionDaysCount: productionDaysNeeded,
    packagingReadyDate,
  };
};

/**
 * Optimize batch allocation across production days
 * Distributes batches as evenly as possible
 */
export const optimizeBatchAllocation = (
  totalBatches: number,
  productionDays: number
): number[] => {
  const batchesPerDay = Math.floor(totalBatches / productionDays);
  const remainder = totalBatches % productionDays;
  
  const allocation: number[] = [];
  
  for (let i = 0; i < productionDays; i++) {
    // Distribute remainder across first few days
    allocation.push(batchesPerDay + (i < remainder ? 1 : 0));
  }
  
  return allocation;
};

/**
 * Get next available production slot considering capacity
 */
export const getNextAvailableSlot = (
  startDate: Date,
  existingCapacity: Map<string, number>
): Date => {
  let checkDate = startDate;
  const maxAttempts = 30; // Check up to 30 days ahead
  
  for (let i = 0; i < maxAttempts; i++) {
    // Skip weekends
    if (!isWeekend(checkDate)) {
      const dateKey = format(checkDate, 'yyyy-MM-dd');
      const usedCapacity = existingCapacity.get(dateKey) || 0;
      
      if (usedCapacity < MAX_BATCHES_PER_DAY) {
        return checkDate;
      }
    }
    checkDate = addDays(checkDate, 1);
  }
  
  // If no slot found in 30 days, return date 30 days out
  return addWeeks(startDate, 4);
};

/**
 * Check if proposed dates have capacity conflicts
 */
export const checkDateConflicts = (
  proposedDates: ProductionDay[],
  existingCapacity: Map<string, number>
): { hasConflicts: boolean; conflicts: Array<{ date: string; available: number; needed: number }> } => {
  const conflicts: Array<{ date: string; available: number; needed: number }> = [];
  
  proposedDates.forEach(day => {
    const dateKey = format(day.date, 'yyyy-MM-dd');
    const usedCapacity = existingCapacity.get(dateKey) || 0;
    const availableCapacity = MAX_BATCHES_PER_DAY - usedCapacity;
    
    if (day.batches > availableCapacity) {
      conflicts.push({
        date: dateKey,
        available: availableCapacity,
        needed: day.batches,
      });
    }
  });
  
  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
};

/**
 * Suggest alternative dates when conflicts are detected
 */
export const suggestAlternativeDates = (
  targetDate: Date,
  batchesNeeded: number,
  existingCapacity: Map<string, number>
): ProductionSchedule | null => {
  // Start from target date and work backwards, skipping conflict dates
  const packagingReadyDate = subDays(targetDate, PRODUCTION_TO_PACKAGING_DAYS);
  const productionDaysNeeded = Math.ceil(batchesNeeded / MAX_BATCHES_PER_DAY);
  
  const productionDays: ProductionDay[] = [];
  let remainingBatches = batchesNeeded;
  let currentDate = packagingReadyDate;
  let attempts = 0;
  const maxAttempts = 60; // Check up to 60 days back
  
  while (productionDays.length < productionDaysNeeded && attempts < maxAttempts) {
    // Skip weekends
    while (isWeekend(currentDate) && attempts < maxAttempts) {
      currentDate = subDays(currentDate, 1);
      attempts++;
    }
    
    if (attempts >= maxAttempts) break;
    
    // Check capacity for this date
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const usedCapacity = existingCapacity.get(dateKey) || 0;
    const availableCapacity = MAX_BATCHES_PER_DAY - usedCapacity;
    
    // If there's available capacity, use this date
    if (availableCapacity > 0) {
      const batchesForDay = Math.min(remainingBatches, availableCapacity);
      
      productionDays.unshift({
        date: currentDate,
        batches: batchesForDay,
        isWeekend: false,
      });
      
      remainingBatches -= batchesForDay;
    }
    
    currentDate = subDays(currentDate, 1);
    attempts++;
  }
  
  // If we couldn't fit all batches, return null
  if (remainingBatches > 0) {
    return null;
  }
  
  return {
    startDate: productionDays[0].date,
    endDate: productionDays[productionDays.length - 1].date,
    productionDays,
    totalBatches: batchesNeeded,
    productionDaysCount: productionDays.length,
    packagingReadyDate,
  };
};

/**
 * Format production schedule for database
 */
export const formatScheduleForDatabase = (schedule: ProductionSchedule) => {
  return schedule.productionDays.map(day => ({
    date: format(day.date, 'yyyy-MM-dd'),
    batches: day.batches,
  }));
};

/**
 * Calculate total gummies needed
 */
export const calculateTotalGummies = (bottles: number, bottleSize: number): number => {
  return bottles * bottleSize;
};

/**
 * Calculate batches needed (43,000 gummies per batch)
 */
export const calculateBatchesNeeded = (totalGummies: number): number => {
  const GUMMIES_PER_BATCH = 43000;
  return Math.ceil(totalGummies / GUMMIES_PER_BATCH);
};
