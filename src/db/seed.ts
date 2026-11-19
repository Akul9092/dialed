import { db } from "./db";
import {
  SETTINGS_ID,
  type AppSettings,
  type EquipmentFieldDef,
  type EquipmentType,
  type FieldValueType,
  type Gym,
} from "./types";
import { LIBRARY_EXERCISES, LIBRARY_FAMILIES } from "@/lib/exerciseLibrary";
import { nowISO } from "@/lib/util";

export const ANYWHERE_GYM_ID = "anywhere";

export function defaultSettings(): AppSettings {
  return {
    id: SETTINGS_ID,
    theme: "system",
    accent: "blue",
    defaultUnit: "lb",
    restTimer: { enabled: false, mode: "auto", defaultSeconds: 120 },
    updatedAt: nowISO(),
  };
}

type BuiltInField = {
  id: string;
  type: EquipmentType;
  label: string;
  valueType: FieldValueType;
  options?: string[];
  step?: number;
};

/** Predefined fields per equipment category (spec 7.3). IDs are stable. */
const BUILT_IN_FIELDS: BuiltInField[] = [
  { id: "f-cable-attachment", type: "cable", label: "Attachment", valueType: "select",
    options: ["Rope", "Straight bar", "V-bar", "D-handle", "Wrist cuff", "EZ bar", "Ankle strap"] },
  { id: "f-cable-pulley", type: "cable", label: "Pulley", valueType: "select", options: ["Single", "Double"] },
  { id: "f-cable-height", type: "cable", label: "Height", valueType: "number", step: 1 },
  { id: "f-cable-position", type: "cable", label: "Position", valueType: "text" },

  { id: "f-machine-seat", type: "machine", label: "Seat", valueType: "number", step: 1 },
  { id: "f-machine-backrest", type: "machine", label: "Backrest", valueType: "number", step: 1 },
  { id: "f-machine-handle", type: "machine", label: "Handle", valueType: "number", step: 1 },

  { id: "f-dumbbell-bench", type: "dumbbell", label: "Bench notch", valueType: "number", step: 1 },

  { id: "f-barbell-bar", type: "barbell", label: "Bar", valueType: "select",
    options: ["Olympic", "EZ bar", "Trap bar", "Safety squat bar", "Fixed"] },
  { id: "f-barbell-bench", type: "barbell", label: "Bench notch", valueType: "number", step: 1 },
  { id: "f-barbell-rack", type: "barbell", label: "Rack height", valueType: "number", step: 1 },

  { id: "f-bench-notch", type: "bench", label: "Notch", valueType: "number", step: 1 },
];

/**
 * Idempotent first-launch setup. Safe to call on every app start.
 */
export async function ensureSeed(): Promise<void> {
  const tables = [db.settings, db.gyms, db.equipmentFieldDefs, db.exerciseFamilies, db.exerciseVariations];
  await db.transaction("rw", tables, async () => {
    const t = nowISO();

    if (!(await db.settings.get(SETTINGS_ID))) {
      await db.settings.add(defaultSettings());
    }

    if (!(await db.gyms.get(ANYWHERE_GYM_ID))) {
      const anywhere: Gym = {
        id: ANYWHERE_GYM_ID,
        name: "Anywhere",
        description: "For workouts outside a gym",
        isBuiltIn: true,
        createdAt: t,
        updatedAt: t,
      };
      await db.gyms.add(anywhere);
    }

    // Built-in equipment fields, then the built-in exercise library. Only
    // missing entries are added, so library updates reach existing installs
    // without touching anything the user created or edited.
    const haveFields = new Set(await db.equipmentFieldDefs.toCollection().primaryKeys());
    const newFields: EquipmentFieldDef[] = BUILT_IN_FIELDS.filter((f) => !haveFields.has(f.id)).map((f, i) => ({
      id: f.id,
      label: f.label,
      valueType: f.valueType,
      equipmentType: f.type,
      options: f.options,
      step: f.step,
      order: i,
      isBuiltIn: true,
      createdAt: t,
      updatedAt: t,
    }));
    if (newFields.length) await db.equipmentFieldDefs.bulkAdd(newFields);

    const haveFamilies = new Set(await db.exerciseFamilies.toCollection().primaryKeys());
    const newFamilies = LIBRARY_FAMILIES.filter((f) => !haveFamilies.has(f.id)).map((f) => ({
      ...f,
      createdAt: t,
      updatedAt: t,
    }));
    if (newFamilies.length) await db.exerciseFamilies.bulkAdd(newFamilies);

    const haveExercises = new Set(await db.exerciseVariations.toCollection().primaryKeys());
    const newExercises = LIBRARY_EXERCISES.filter((e) => !haveExercises.has(e.id)).map((e) => ({
      ...e,
      isCustom: false,
      createdAt: t,
      updatedAt: t,
    }));
    if (newExercises.length) await db.exerciseVariations.bulkAdd(newExercises);
  });
}
