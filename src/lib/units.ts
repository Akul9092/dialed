import type { WeightUnit } from "@/db/types";

/**
 * Weights are stored in the unit they were entered in and converted for
 * display, so switching lb/kg never rewrites (or rounds away) history.
 */

export const LB_PER_KG = 2.2046226218;

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === "kg" ? value * LB_PER_KG : value / LB_PER_KG;
}

/** Converted values are rounded to 0.1 so 45 lb reads as 20.4 kg, not 20.41166. */
export function displayWeight(value: number | null | undefined, from: WeightUnit, to: WeightUnit): number | null {
  if (value == null) return null;
  if (from === to) return value;
  return Math.round(convertWeight(value, from, to) * 10) / 10;
}
