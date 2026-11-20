import type { EquipmentFieldDef, ExerciseSet, FieldValue, SettingsSnapshot, WeightInterpretation } from "@/db/types";

/** 45 -> "45", 22.5 -> "22.5", 22.25 -> "22.25" */
export function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(Math.round(n * 100) / 100);
}

/** Parses a typed number. Empty or invalid input means "not entered". */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function fmtSet(s: Pick<ExerciseSet, "weight" | "reps">): string {
  return `${fmtNum(s.weight) || "–"}×${fmtNum(s.reps) || "–"}`;
}

export function weightSuffix(wi: WeightInterpretation): string {
  return wi === "per_dumbbell" ? "per dumbbell" : wi === "per_side" ? "per side" : "";
}

export function fmtFieldValue(def: Pick<EquipmentFieldDef, "valueType">, v: FieldValue): string {
  if (def.valueType === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/** "Height 2 · Wrist cuff" from the settings that have values. */
export function settingsSummary(settings: SettingsSnapshot, defs: EquipmentFieldDef[]): string {
  return defs
    .filter((d) => settings[d.id] !== undefined && settings[d.id] !== "")
    .map((d) => (d.valueType === "select" ? fmtFieldValue(d, settings[d.id]) : `${d.label} ${fmtFieldValue(d, settings[d.id])}`))
    .join(" · ");
}
