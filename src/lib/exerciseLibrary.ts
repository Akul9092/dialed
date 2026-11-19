import type { EquipmentType, LoadType, WeightInterpretation } from "@/db/types";

/**
 * Built-in exercise library (spec section 8). IDs are stable so the seed
 * can run on every launch and only adds what's missing. Users add their
 * own exercises on top of these.
 */

export interface LibraryFamily {
  id: string;
  name: string;
}

export interface LibraryExercise {
  id: string;
  name: string;
  familyId: string;
  equipmentType: EquipmentType;
  loadType: LoadType;
  defaultWeightInterpretation: WeightInterpretation;
  unilateral: boolean;
}

type Row = [name: string, equipment: EquipmentType, opts?: { uni?: boolean; wi?: WeightInterpretation }];

const GROUPS: Array<[familyId: string, familyName: string, rows: Row[]]> = [
  ["fam-chest-press", "Chest Press", [
    ["Flat Barbell Bench Press", "barbell"],
    ["Incline Barbell Bench Press", "barbell"],
    ["Decline Barbell Bench Press", "barbell"],
    ["Flat Dumbbell Press", "dumbbell"],
    ["Incline Dumbbell Press", "dumbbell"],
    ["Chest Press Machine", "machine"],
    ["Incline Chest Press Machine", "machine"],
    ["Smith Machine Bench Press", "machine"],
    ["Smith Machine Incline Press", "machine"],
  ]],
  ["fam-chest-fly", "Chest Fly", [
    ["Cable Chest Fly", "cable"],
    ["Low-to-High Cable Fly", "cable"],
    ["High-to-Low Cable Fly", "cable"],
    ["Pec Deck", "machine"],
    ["Dumbbell Fly", "dumbbell"],
  ]],
  ["fam-dip-pushup", "Dip & Push-up", [
    ["Dip", "bodyweight"],
    ["Push-up", "bodyweight"],
  ]],
  ["fam-shoulder-press", "Shoulder Press", [
    ["Overhead Barbell Press", "barbell"],
    ["Seated Dumbbell Shoulder Press", "dumbbell"],
    ["Shoulder Press Machine", "machine"],
  ]],
  ["fam-lateral-raise", "Lateral Raise", [
    ["Dumbbell Lateral Raise", "dumbbell"],
    ["Cable Lateral Raise", "cable", { uni: true }],
    ["Lateral Raise Machine", "machine"],
  ]],
  ["fam-rear-delt", "Rear Delt", [
    ["Reverse Pec Deck", "machine"],
    ["Cable Rear Delt Fly", "cable"],
    ["Face Pull", "cable"],
    ["Dumbbell Rear Delt Fly", "dumbbell"],
  ]],
  ["fam-vertical-pull", "Vertical Pull", [
    ["Pull-up", "bodyweight"],
    ["Chin-up", "bodyweight"],
    ["Lat Pulldown", "cable"],
    ["Close-Grip Lat Pulldown", "cable"],
    ["Single-Arm Lat Pulldown", "cable", { uni: true }],
    ["Machine Pulldown", "machine"],
  ]],
  ["fam-row", "Row", [
    ["Barbell Row", "barbell"],
    ["Seated Cable Row", "cable"],
    ["Single-Arm Cable Row", "cable", { uni: true }],
    ["Single-Arm Dumbbell Row", "dumbbell", { uni: true }],
    ["Chest-Supported Dumbbell Row", "dumbbell"],
    ["Chest-Supported Row Machine", "machine"],
    ["T-Bar Row", "machine"],
  ]],
  ["fam-pullover", "Pullover", [
    ["Cable Pullover", "cable"],
    ["Dumbbell Pullover", "dumbbell", { wi: "total" }],
  ]],
  ["fam-shrug", "Shrug", [
    ["Dumbbell Shrug", "dumbbell"],
    ["Barbell Shrug", "barbell"],
  ]],
  ["fam-biceps", "Biceps Curl", [
    ["Barbell Curl", "barbell"],
    ["EZ-Bar Curl", "barbell"],
    ["Dumbbell Curl", "dumbbell"],
    ["Incline Dumbbell Curl", "dumbbell"],
    ["Hammer Curl", "dumbbell"],
    ["Preacher Curl Machine", "machine"],
    ["Cable Curl", "cable"],
    ["Bayesian Cable Curl", "cable", { uni: true }],
  ]],
  ["fam-triceps", "Triceps Extension", [
    ["Triceps Pushdown", "cable"],
    ["Single-Arm Cable Pushdown", "cable", { uni: true }],
    ["Overhead Cable Triceps Extension", "cable"],
    ["Skull Crusher", "barbell"],
    ["Close-Grip Bench Press", "barbell"],
    ["Triceps Extension Machine", "machine"],
  ]],
  ["fam-squat", "Squat", [
    ["Barbell Back Squat", "barbell"],
    ["Front Squat", "barbell"],
    ["Hack Squat", "machine"],
    ["Pendulum Squat", "machine"],
    ["Smith Machine Squat", "machine"],
    ["Goblet Squat", "dumbbell", { wi: "total" }],
  ]],
  ["fam-leg-press", "Leg Press", [
    ["Leg Press", "machine"],
    ["Single-Leg Leg Press", "machine", { uni: true }],
  ]],
  ["fam-hinge", "Hinge", [
    ["Deadlift", "barbell"],
    ["Romanian Deadlift", "barbell"],
    ["Dumbbell Romanian Deadlift", "dumbbell"],
    ["Back Extension", "bodyweight"],
  ]],
  ["fam-lunge", "Lunge", [
    ["Bulgarian Split Squat", "dumbbell", { uni: true }],
    ["Walking Lunge", "dumbbell"],
  ]],
  ["fam-leg-extension", "Leg Extension", [
    ["Leg Extension", "machine"],
    ["Single-Leg Extension", "machine", { uni: true }],
  ]],
  ["fam-leg-curl", "Leg Curl", [
    ["Seated Leg Curl", "machine"],
    ["Lying Leg Curl", "machine"],
  ]],
  ["fam-glutes", "Glutes & Hips", [
    ["Hip Thrust", "barbell"],
    ["Hip Thrust Machine", "machine"],
    ["Hip Abduction Machine", "machine"],
    ["Hip Adduction Machine", "machine"],
  ]],
  ["fam-calves", "Calf Raise", [
    ["Standing Calf Raise Machine", "machine"],
    ["Seated Calf Raise", "machine"],
    ["Leg Press Calf Raise", "machine"],
  ]],
  ["fam-abs", "Abs", [
    ["Cable Crunch", "cable"],
    ["Ab Crunch Machine", "machine"],
    ["Hanging Leg Raise", "bodyweight"],
  ]],
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const LIBRARY_FAMILIES: LibraryFamily[] = GROUPS.map(([id, name]) => ({ id, name }));

export const LIBRARY_EXERCISES: LibraryExercise[] = GROUPS.flatMap(([familyId, , rows]) =>
  rows.map(([name, equipmentType, opts]) => ({
    id: `ex-${slug(name)}`,
    name,
    familyId,
    equipmentType,
    loadType: equipmentType === "bodyweight" ? "bodyweight" : "weighted",
    defaultWeightInterpretation: opts?.wi ?? (equipmentType === "dumbbell" ? "per_dumbbell" : "total"),
    unilateral: !!opts?.uni,
  })),
);

export const EQUIPMENT_LABEL: Record<EquipmentType, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  cable: "Cable",
  machine: "Machine",
  bodyweight: "Bodyweight",
  bench: "Bench",
  other: "Other",
};

const WI_LABEL: Record<WeightInterpretation, string> = {
  total: "Total",
  per_dumbbell: "Per dumbbell",
  per_side: "Per side",
};

/** Weight entry modes that make sense for each kind of equipment (spec 9.4). */
export function weightOptions(equipment: EquipmentType): { value: WeightInterpretation; label: string }[] {
  const modes: WeightInterpretation[] =
    equipment === "dumbbell"
      ? ["per_dumbbell", "total"]
      : equipment === "barbell" || equipment === "machine"
        ? ["total", "per_side"]
        : ["total"];
  return modes.map((value) => ({ value, label: WI_LABEL[value] }));
}

export function weightLabel(wi: WeightInterpretation): string {
  return WI_LABEL[wi];
}

export const CUSTOM_EQUIPMENT: EquipmentType[] = ["barbell", "dumbbell", "cable", "machine", "bodyweight", "other"];
