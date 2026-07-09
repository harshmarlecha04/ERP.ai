// Unit conversion utilities for purchase orders to inventory

export interface ConversionResult {
  originalValue: number;
  convertedValue: number;
  fromUnit: string;
  toUnit: string;
  conversionFactor: number;
  isConverted: boolean;
}

// Conversion factors to base units (kg for weight, L for volume)
const WEIGHT_CONVERSIONS: Record<string, number> = {
  // Weight conversions (to kg)
  'kg': 1,
  'kgs': 1,
  'kilogram': 1,
  'kilograms': 1,
  'lb': 0.453592,
  'lbs': 0.453592,
  'pound': 0.453592,
  'pounds': 0.453592,
  'oz': 0.0283495,
  'ounce': 0.0283495,
  'ounces': 0.0283495,
  'g': 0.001,
  'gram': 0.001,
  'grams': 0.001,
  'ton': 1000,
  'tons': 1000,
  'tonne': 1000,
  'tonnes': 1000,
  'mt': 1000,
};

const VOLUME_CONVERSIONS: Record<string, number> = {
  // Volume conversions (to L)
  'l': 1,
  'liter': 1,
  'litre': 1,
  'liters': 1,
  'litres': 1,
  'gal': 3.78541,
  'gallon': 3.78541,
  'gallons': 3.78541,
  'qt': 0.946353,
  'quart': 0.946353,
  'quarts': 0.946353,
  'fl oz': 0.0295735,
  'floz': 0.0295735,
  'fluid ounce': 0.0295735,
  'fluid ounces': 0.0295735,
  'ml': 0.001,
  'milliliter': 0.001,
  'millilitre': 0.001,
  'milliliters': 0.001,
  'millilitres': 0.001,
};

// Default density for volume-to-weight conversions when material density is not specified
// Using water density (1.0 kg/L) as a reasonable default
const DEFAULT_DENSITY_KG_PER_L = 1.0;

/**
 * Normalizes a unit string for comparison
 */
function normalizeUnit(unit: string): string {
  return unit.toLowerCase().trim();
}

/**
 * Determines if a unit is a weight unit
 */
function isWeightUnit(unit: string): boolean {
  return normalizeUnit(unit) in WEIGHT_CONVERSIONS;
}

/**
 * Determines if a unit is a volume unit
 */
function isVolumeUnit(unit: string): boolean {
  return normalizeUnit(unit) in VOLUME_CONVERSIONS;
}

/**
 * Gets the conversion factor for a unit within its type (weight or volume)
 */
function getConversionFactor(fromUnit: string, toUnit: string): number | null {
  const fromNorm = normalizeUnit(fromUnit);
  const toNorm = normalizeUnit(toUnit);
  
  // Check if both are weight units
  if (isWeightUnit(fromNorm) && isWeightUnit(toNorm)) {
    const fromFactor = WEIGHT_CONVERSIONS[fromNorm];
    const toFactor = WEIGHT_CONVERSIONS[toNorm];
    return fromFactor / toFactor;
  }
  
  // Check if both are volume units
  if (isVolumeUnit(fromNorm) && isVolumeUnit(toNorm)) {
    const fromFactor = VOLUME_CONVERSIONS[fromNorm];
    const toFactor = VOLUME_CONVERSIONS[toNorm];
    return fromFactor / toFactor;
  }
  
  return null; // Cannot convert between different unit types
}

/**
 * Converts quantity from one unit to another
 */
export function convertUnits(
  value: number,
  fromUnit: string,
  toUnit: string
): ConversionResult {
  const fromNorm = normalizeUnit(fromUnit);
  const toNorm = normalizeUnit(toUnit);
  
  // If units are the same, no conversion needed
  if (fromNorm === toNorm) {
    return {
      originalValue: value,
      convertedValue: value,
      fromUnit,
      toUnit,
      conversionFactor: 1,
      isConverted: false,
    };
  }
  
  const conversionFactor = getConversionFactor(fromUnit, toUnit);
  
  if (conversionFactor === null) {
    throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}. Conversion not supported or units are incompatible.`);
  }
  
  const convertedValue = value * conversionFactor;
  
  return {
    originalValue: value,
    convertedValue: Math.round(convertedValue * 10000) / 10000, // Round to 4 decimal places
    fromUnit,
    toUnit,
    conversionFactor,
    isConverted: true,
  };
}

/**
 * Converts quantity using material density for volume-to-weight or weight-to-volume conversions
 * @param value - The quantity to convert
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @param densityKgPerL - Material density in kg per liter (required for volume/weight conversions)
 */
export function convertUnitsWithDensity(
  value: number,
  fromUnit: string,
  toUnit: string,
  densityKgPerL?: number | null
): ConversionResult {
  const fromNorm = normalizeUnit(fromUnit);
  const toNorm = normalizeUnit(toUnit);
  
  // If units are the same, no conversion needed
  if (fromNorm === toNorm) {
    return {
      originalValue: value,
      convertedValue: value,
      fromUnit,
      toUnit,
      conversionFactor: 1,
      isConverted: false,
    };
  }
  
  const fromIsWeight = isWeightUnit(fromNorm);
  const toIsWeight = isWeightUnit(toNorm);
  const fromIsVolume = isVolumeUnit(fromNorm);
  const toIsVolume = isVolumeUnit(toNorm);
  
  // If converting between same type (weight-to-weight or volume-to-volume), use standard conversion
  if ((fromIsWeight && toIsWeight) || (fromIsVolume && toIsVolume)) {
    return convertUnits(value, fromUnit, toUnit);
  }
  
  // For volume-to-weight or weight-to-volume conversions, use provided density or default
  if ((fromIsVolume && toIsWeight) || (fromIsWeight && toIsVolume)) {
    // Use provided density or default to 1.0 kg/L (water density)
    const effectiveDensity = (densityKgPerL && densityKgPerL > 0) ? densityKgPerL : DEFAULT_DENSITY_KG_PER_L;
    
    let convertedValue: number;
    let conversionFactor: number;
    
    if (fromIsVolume && toIsWeight) {
      // Volume to Weight: Convert volume to liters, then multiply by density to get kg, then convert to target weight unit
      const volumeInLiters = convertUnits(value, fromUnit, 'L').convertedValue;
      const weightInKg = volumeInLiters * effectiveDensity;
      const result = convertUnits(weightInKg, 'kg', toUnit);
      convertedValue = result.convertedValue;
      conversionFactor = convertedValue / value;
    } else {
      // Weight to Volume: Convert weight to kg, divide by density to get liters, then convert to target volume unit
      const weightInKg = convertUnits(value, fromUnit, 'kg').convertedValue;
      const volumeInLiters = weightInKg / effectiveDensity;
      const result = convertUnits(volumeInLiters, 'L', toUnit);
      convertedValue = result.convertedValue;
      conversionFactor = convertedValue / value;
    }
    
    return {
      originalValue: value,
      convertedValue: Math.round(convertedValue * 10000) / 10000,
      fromUnit,
      toUnit,
      conversionFactor,
      isConverted: true,
    };
  }
  
  // If we get here, units are incompatible
  throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}. Units are incompatible.`);
}

/**
 * Checks if conversion is possible between two units
 */
export function canConvert(fromUnit: string, toUnit: string): boolean {
  try {
    const fromNorm = normalizeUnit(fromUnit);
    const toNorm = normalizeUnit(toUnit);
    
    if (fromNorm === toNorm) return true;
    
    // Check same-type conversions (weight-to-weight or volume-to-volume)
    const conversionFactor = getConversionFactor(fromUnit, toUnit);
    if (conversionFactor !== null) return true;
    
    // Check cross-type conversions (volume-to-weight or weight-to-volume)
    // These are now supported with default density
    const fromIsWeight = isWeightUnit(fromNorm);
    const toIsWeight = isWeightUnit(toNorm);
    const fromIsVolume = isVolumeUnit(fromNorm);
    const toIsVolume = isVolumeUnit(toNorm);
    
    if ((fromIsVolume && toIsWeight) || (fromIsWeight && toIsVolume)) {
      return true; // Volume-to-weight conversions supported with default density
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Gets a user-friendly description of the conversion
 */
export function getConversionDescription(result: ConversionResult): string {
  if (!result.isConverted) {
    return `No conversion needed (both in ${result.toUnit})`;
  }
  
  return `1 ${result.fromUnit} = ${result.conversionFactor} ${result.toUnit}`;
}