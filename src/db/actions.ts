import { db } from "./db";
import { ANYWHERE_GYM_ID, defaultSettings } from "./seed";
import {
  SETTINGS_ID,
  type AppSettings,
  type Gym,
  type SplitDay,
  type TrainingPlan,
  type TrainingSplit,
  type WeightUnit,
} from "./types";
import { localDate, newId, nowISO } from "@/lib/util";

/* ------------------------------ Settings ------------------------------ */

export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get(SETTINGS_ID)) ?? defaultSettings();
}

export async function updateSettings(patch: Partial<Omit<AppSettings, "id">>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: SETTINGS_ID, updatedAt: nowISO() });
}

/* ---------------------------- Training plans --------------------------- */

export type PlanInput = Pick<TrainingPlan, "name" | "description" | "startDate" | "endDate">;

function cleanPlan(input: PlanInput): PlanInput {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    startDate: input.startDate || undefined,
    endDate: input.endDate || undefined,
  };
}

/** Creates a plan and its split. The first plan becomes active. */
export async function createPlan(input: PlanInput, days: SplitDay[] = []): Promise<string> {
  const t = nowISO();
  const id = newId();
  await db.transaction("rw", [db.trainingPlans, db.trainingSplits, db.settings], async () => {
    await db.trainingPlans.add({ id, ...cleanPlan(input), createdAt: t, updatedAt: t });
    await db.trainingSplits.add({
      id: newId(),
      planId: id,
      mode: "sequence",
      anchorDate: input.startDate || localDate(),
      days,
      createdAt: t,
      updatedAt: t,
    });
    const settings = await getSettings();
    if (!settings.activePlanId) await updateSettings({ activePlanId: id });
  });
  return id;
}

export async function updatePlan(id: string, input: PlanInput): Promise<void> {
  await db.trainingPlans.update(id, { ...cleanPlan(input), updatedAt: nowISO() });
}

export type SplitPatch = Partial<Pick<TrainingSplit, "mode" | "anchorDate" | "days">>;

export async function updateSplit(planId: string, patch: SplitPatch): Promise<void> {
  const split = await db.trainingSplits.where("planId").equals(planId).first();
  if (!split) {
    const t = nowISO();
    await db.trainingSplits.add({
      id: newId(),
      planId,
      mode: "sequence",
      anchorDate: localDate(),
      days: [],
      ...patch,
      createdAt: t,
      updatedAt: t,
    });
    return;
  }
  await db.trainingSplits.update(split.id, { ...patch, updatedAt: nowISO() });
}

export async function setActivePlan(id: string): Promise<void> {
  await updateSettings({ activePlanId: id });
}

export async function planSessionCount(planId: string): Promise<number> {
  return db.workoutSessions.where("planId").equals(planId).count();
}

/**
 * Plans with logged workouts cannot be deleted, so history is never lost.
 * Deleting the active plan hands "active" to the most recently created plan.
 */
export async function deletePlan(id: string): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.trainingPlans,
      db.trainingSplits,
      db.workoutTemplates,
      db.templateExercises,
      db.recurringExtras,
      db.workoutSessions,
      db.settings,
    ],
    async () => {
      if ((await planSessionCount(id)) > 0) {
        throw new Error("This plan has logged workouts and can't be deleted.");
      }
      await db.trainingSplits.where("planId").equals(id).delete();
      const templateIds = await db.workoutTemplates.where("planId").equals(id).primaryKeys();
      await db.templateExercises.where("templateId").anyOf(templateIds).delete();
      await db.workoutTemplates.bulkDelete(templateIds);
      await db.recurringExtras.where("planId").equals(id).delete();
      await db.trainingPlans.delete(id);

      const settings = await getSettings();
      if (settings.activePlanId === id) {
        const next = await db.trainingPlans.orderBy("createdAt").last();
        await updateSettings({ activePlanId: next?.id });
      }
    },
  );
}

/* --------------------------------- Gyms -------------------------------- */

export type GymInput = { name: string; description?: string; defaultUnit?: WeightUnit };

export async function createGym(input: GymInput): Promise<string> {
  const t = nowISO();
  const id = newId();
  const gym: Gym = {
    id,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    defaultUnit: input.defaultUnit,
    createdAt: t,
    updatedAt: t,
  };
  await db.gyms.add(gym);
  return id;
}

export async function updateGym(id: string, input: GymInput): Promise<void> {
  const gym = await db.gyms.get(id);
  if (!gym) return;
  await db.gyms.put({
    ...gym,
    // The built-in location keeps its name so it is always recognizable.
    name: gym.isBuiltIn ? gym.name : input.name.trim(),
    description: input.description?.trim() || undefined,
    defaultUnit: input.defaultUnit,
    updatedAt: nowISO(),
  });
}

export async function gymUsageCount(gymId: string): Promise<number> {
  const [exercises, sessions] = await Promise.all([
    db.workoutExercises.where("gymId").equals(gymId).count(),
    db.workoutSessions.filter((s) => s.gymId === gymId).count(),
  ]);
  return exercises + sessions;
}

/** Gyms used in any workout, and the built-in location, cannot be deleted. */
export async function deleteGym(id: string): Promise<void> {
  if (id === ANYWHERE_GYM_ID) throw new Error("The Anywhere location can't be deleted.");
  await db.transaction("rw", [db.gyms, db.equipment, db.workoutExercises, db.workoutSessions, db.settings], async () => {
    if ((await gymUsageCount(id)) > 0) {
      throw new Error("This gym is used in logged workouts and can't be deleted.");
    }
    await db.equipment.where("gymId").equals(id).delete();
    await db.gyms.delete(id);
    const settings = await getSettings();
    if (settings.lastGymId === id) await updateSettings({ lastGymId: undefined });
  });
}

/** Effective unit for a gym: its override, else the app-wide default. */
export function effectiveUnit(gym: Pick<Gym, "defaultUnit"> | undefined, settings: AppSettings): WeightUnit {
  return gym?.defaultUnit ?? settings.defaultUnit;
}
