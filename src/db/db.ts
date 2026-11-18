import Dexie, { type EntityTable } from "dexie";
import type {
  AppSettings,
  CardioEntry,
  Equipment,
  EquipmentFieldDef,
  ExerciseFamily,
  ExerciseSet,
  ExerciseVariation,
  Gym,
  RecurringExtra,
  TemplateExercise,
  TrainingPlan,
  TrainingSplit,
  WorkoutExercise,
  WorkoutSession,
  WorkoutTemplate,
} from "./types";

/**
 * Bump this and add a new `this.version(n)` block (never edit an old one)
 * whenever the schema changes. Dexie upgrades existing data in place.
 * Backups record this number so imports can be migrated too.
 */
export const SCHEMA_VERSION = 1;

export class DialedDB extends Dexie {
  trainingPlans!: EntityTable<TrainingPlan, "id">;
  trainingSplits!: EntityTable<TrainingSplit, "id">;
  workoutTemplates!: EntityTable<WorkoutTemplate, "id">;
  templateExercises!: EntityTable<TemplateExercise, "id">;
  exerciseFamilies!: EntityTable<ExerciseFamily, "id">;
  exerciseVariations!: EntityTable<ExerciseVariation, "id">;
  gyms!: EntityTable<Gym, "id">;
  equipment!: EntityTable<Equipment, "id">;
  equipmentFieldDefs!: EntityTable<EquipmentFieldDef, "id">;
  workoutSessions!: EntityTable<WorkoutSession, "id">;
  workoutExercises!: EntityTable<WorkoutExercise, "id">;
  exerciseSets!: EntityTable<ExerciseSet, "id">;
  recurringExtras!: EntityTable<RecurringExtra, "id">;
  cardioEntries!: EntityTable<CardioEntry, "id">;
  settings!: EntityTable<AppSettings, "id">;

  constructor() {
    super("dialed");

    // Only indexed fields are listed. Every other property is still stored.
    // "&" = unique index, "[a+b]" = compound index.
    this.version(1).stores({
      trainingPlans: "id, name, createdAt",
      trainingSplits: "id, &planId",
      workoutTemplates: "id, planId, name",
      templateExercises: "id, templateId, [templateId+order], variationId",
      exerciseFamilies: "id, name",
      exerciseVariations: "id, familyId, name, equipmentType",
      gyms: "id, name",
      equipment: "id, gymId, type",
      equipmentFieldDefs: "id, equipmentType, equipmentId",
      workoutSessions: "id, &date, planId, status",
      workoutExercises:
        "id, sessionId, [sessionId+order], variationId, configKey, gymId, equipmentId",
      exerciseSets: "id, workoutExerciseId, [workoutExerciseId+order], parentSetId",
      recurringExtras: "id, planId",
      cardioEntries: "id, sessionId, date",
      settings: "id",
    });
  }
}

export const db = new DialedDB();
