/**
 * Dialed data model (spec v1.1, sections 17 and 20.6).
 *
 * Conventions
 * - Every record has a stable string `id` (random UUID) plus ISO timestamps,
 *   so the same shapes can later sync to Supabase without a rewrite.
 * - Calendar dates are local "YYYY-MM-DD" strings, never UTC timestamps,
 *   so a late-night workout lands on the day it was actually done.
 * - PRs and graphs are never stored. They are always derived from sets.
 */

export type ID = string;
export type ISODateTime = string; // e.g. "2026-11-13T18:42:10.123Z"
export type LocalDate = string; // e.g. "2026-11-13"

export type WeightUnit = "lb" | "kg";
export type ThemeMode = "system" | "light" | "dark";
export type AccentId =
  | "blue"
  | "indigo"
  | "violet"
  | "pink"
  | "red"
  | "orange"
  | "green"
  | "teal";

interface Timestamped {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* ------------------------------------------------------------------ */
/* Plans, splits, templates                                            */
/* ------------------------------------------------------------------ */

export interface TrainingPlan extends Timestamped {
  id: ID;
  name: string;
  description?: string;
  startDate?: LocalDate;
  endDate?: LocalDate;
  // The active plan is stored once in AppSettings.activePlanId, which
  // guarantees exactly one active plan at a time.
}

export type SplitDayKind = "workout" | "rest" | "cardio";

export interface SplitDay {
  id: ID;
  name: string; // "Push", "Rest", "Run"
  kind: SplitDayKind;
  templateId?: ID; // default WorkoutTemplate for this day
}

export type ProgressionMode = "calendar" | "sequence";

export interface TrainingSplit extends Timestamped {
  id: ID;
  planId: ID;
  mode: ProgressionMode;
  /** Calendar mode: the date that counts as day 1 of the cycle. */
  anchorDate: LocalDate;
  /** Ordered days in the repeating cycle. */
  days: SplitDay[];
}

export interface WorkoutTemplate extends Timestamped {
  id: ID;
  planId: ID;
  name: string; // "Push A"
}

export interface TemplateExercise extends Timestamped {
  id: ID;
  templateId: ID;
  order: number;
  variationId: ID;
  equipmentId?: ID;
  weightInterpretation: WeightInterpretation;
  unilateralMode: UnilateralMode;
  defaultSettings: SettingsSnapshot;
  defaultSets: SetType[]; // e.g. ["warmup", "working"]
}

/* ------------------------------------------------------------------ */
/* Exercise library                                                    */
/* ------------------------------------------------------------------ */

export type EquipmentType =
  | "cable"
  | "machine"
  | "dumbbell"
  | "barbell"
  | "bench"
  | "bodyweight"
  | "other";

/**
 * Free weights share history across gyms (spec 20.1). Machines and cables
 * are tied to a specific gym and named machine.
 */
export const GYM_SPECIFIC_EQUIPMENT: readonly EquipmentType[] = [
  "cable",
  "machine",
  "other",
];

export type LoadType = "weighted" | "bodyweight";

export interface ExerciseFamily extends Timestamped {
  id: ID;
  name: string; // "Chest Press"
}

export interface ExerciseVariation extends Timestamped {
  id: ID;
  familyId?: ID;
  name: string; // "Incline Dumbbell Press"
  equipmentType: EquipmentType;
  loadType: LoadType;
  isCustom: boolean;
}

/* ------------------------------------------------------------------ */
/* Gyms and equipment                                                  */
/* ------------------------------------------------------------------ */

export interface Gym extends Timestamped {
  id: ID;
  name: string;
  description?: string;
  /** Overrides AppSettings.defaultUnit when set. */
  defaultUnit?: WeightUnit;
  /** The seeded "Anywhere" location cannot be deleted. */
  isBuiltIn?: boolean;
}

export interface Equipment extends Timestamped {
  id: ID;
  gymId: ID;
  name: string; // "Cable Station 1"
  type: EquipmentType;
  description?: string;
}

export type FieldValueType = "number" | "text" | "select" | "boolean";

/**
 * A configurable setting such as "Seat position" or "Pulley".
 * Built-in fields apply to every piece of equipment of a type.
 * Custom fields can target one type or one specific machine.
 */
export interface EquipmentFieldDef extends Timestamped {
  id: ID;
  label: string;
  valueType: FieldValueType;
  equipmentType?: EquipmentType;
  equipmentId?: ID;
  options?: string[]; // select fields
  step?: number; // number fields, for +/- steppers
  order: number;
  isBuiltIn: boolean;
}

export type FieldValue = string | number | boolean;

/** fieldId -> value, captured at the time the exercise was performed. */
export type SettingsSnapshot = Record<ID, FieldValue>;

/* ------------------------------------------------------------------ */
/* Sessions, exercises, sets                                           */
/* ------------------------------------------------------------------ */

export type SessionStatus = "in_progress" | "completed";

export interface WorkoutSession extends Timestamped {
  id: ID;
  planId: ID;
  /** Unique: one session per calendar day. */
  date: LocalDate;
  name: string; // "Push"
  templateId?: ID;
  splitDayId?: ID;
  /** Default gym for exercises added to this session. */
  gymId: ID;
  status: SessionStatus;
  notes?: string;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  /** Entered once per session for bodyweight exercises. */
  bodyweight?: number;
  bodyweightUnit?: WeightUnit;
}

export type WeightInterpretation = "total" | "per_dumbbell" | "per_side";
export type UnilateralMode = "none" | "per_side" | "split";

export interface WorkoutExercise extends Timestamped {
  id: ID;
  sessionId: ID;
  order: number;
  variationId: ID;
  /** Each exercise stores its own gym. Defaults to the session gym. */
  gymId: ID;
  equipmentId?: ID;
  weightInterpretation: WeightInterpretation;
  unilateralMode: UnilateralMode;
  /** Settings exactly as they were when performed (historical snapshot). */
  settings: SettingsSnapshot;
  /** Canonical identity used for PRs, history and defaults. */
  configKey: string;
  notes?: string;
}

export type SetType = "warmup" | "working" | "top" | "backoff" | "drop";

export const PR_ELIGIBLE_SET_TYPES: readonly SetType[] = [
  "working",
  "top",
  "backoff",
];

export type SetSide = "left" | "right";

export interface ExerciseSet extends Timestamped {
  id: ID;
  workoutExerciseId: ID;
  order: number;
  type: SetType;
  /** For bodyweight exercises this is the ADDED weight only. */
  weight: number;
  unit: WeightUnit;
  reps: number;
  completed: boolean;
  /** Drop sets point at the set they dropped from. */
  parentSetId?: ID;
  /** Only used when the exercise is in L/R split mode. */
  side?: SetSide;
}

/* ------------------------------------------------------------------ */
/* Extras and cardio                                                   */
/* ------------------------------------------------------------------ */

export type RecurrenceBasis = "calendar_days" | "completed_workouts";

export interface RecurringExtra extends Timestamped {
  id: ID;
  planId: ID;
  name: string; // "Abs"
  templateId?: ID;
  interval: number; // every N days or N workouts
  basis: RecurrenceBasis;
  /** Last time it was actually done. Skips never update these. */
  lastDoneDate?: LocalDate;
  lastDoneWorkoutCount?: number;
}

export interface CardioEntry extends Timestamped {
  id: ID;
  sessionId?: ID;
  date: LocalDate;
  activity: string; // "Outdoor Run"
  durationSeconds?: number;
  distance?: number;
  distanceUnit?: "mi" | "km";
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const SETTINGS_ID = "app";

export interface AppSettings {
  id: typeof SETTINGS_ID;
  theme: ThemeMode;
  accent: AccentId;
  defaultUnit: WeightUnit;
  activePlanId?: ID;
  /** Remembered as the default gym suggestion when starting a workout. */
  lastGymId?: ID;
  restTimer: {
    enabled: boolean;
    mode: "manual" | "auto";
    defaultSeconds: number;
  };
  lastBackupAt?: ISODateTime;
  updatedAt: ISODateTime;
}
