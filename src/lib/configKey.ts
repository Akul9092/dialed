import {
  GYM_SPECIFIC_EQUIPMENT,
  type EquipmentType,
  type FieldValue,
  type ID,
  type SettingsSnapshot,
  type WeightInterpretation,
} from "@/db/types";

/**
 * Canonical identity for "the same exercise under the same setup"
 * (spec 7.5 and 20.1). Two performances share PR history, previous-session
 * defaults and graphs only when their keys are identical.
 *
 * Key = variation + weight interpretation + every normalized setting
 *       + gym and machine (cable, machine and other equipment only).
 *
 * Everything is keyed by IDs, so renaming a gym, machine or field never
 * breaks history. Units are NOT part of the key: weights are converted.
 */
export function buildConfigKey(input: {
  variationId: ID;
  equipmentType: EquipmentType;
  weightInterpretation: WeightInterpretation;
  gymId: ID;
  equipmentId?: ID;
  settings: SettingsSnapshot;
}): string {
  const gymSpecific = GYM_SPECIFIC_EQUIPMENT.includes(input.equipmentType);
  const settings = Object.keys(input.settings)
    .sort()
    .map((fieldId) => [fieldId, normalizeValue(input.settings[fieldId])] as const)
    .filter(([, v]) => v !== "");

  return JSON.stringify([
    "v1",
    input.variationId,
    input.weightInterpretation,
    gymSpecific ? input.gymId : null,
    gymSpecific ? (input.equipmentId ?? null) : null,
    settings,
  ]);
}

/** 2 and "2.0" match, " Wrist  Cuff" and "wrist cuff" match, true -> "1". */
export function normalizeValue(v: FieldValue | undefined | null): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  const trimmed = v.trim().replace(/\s+/g, " ").toLowerCase();
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return String(Number(trimmed));
  return trimmed;
}
