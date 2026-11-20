import { db } from "./db";
import { effectiveUnit, getSettings, updateSettings } from "./actions";
import {
  GYM_SPECIFIC_EQUIPMENT,
  type EquipmentType,
  type ExerciseSet,
  type ExerciseVariation,
  type ID,
  type LocalDate,
  type SetSide,
  type SetType,
  type SettingsSnapshot,
  type UnilateralMode,
  type WeightInterpretation,
  type WeightUnit,
  type WorkoutExercise,
  type WorkoutSession,
} from "./types";
import { buildConfigKey } from "@/lib/configKey";
import { DEFAULT_SET_STRUCTURE } from "@/lib/sets";
import { newId, nowISO } from "@/lib/util";

/*
 * Workout logging (spec 6, 8.3, 9, 20.1 to 20.3).
 *
 * The rules that matter most:
 * - One session per calendar day. Starting again opens the existing one.
 * - A logged exercise snapshots its gym, machine and settings, and gets a
 *   configuration key. History, defaults and (later) PRs only ever match
 *   on that key, so numbers never leak between setups.
 * - Defaults come from the most recent completed performance with the same
 *   key: same set structure, same weights and reps. With no match, sets
 *   start empty rather than borrowing another setup's numbers.
 * - Every change is written immediately.
 */

const ALL_TABLES = () => [
  db.workoutSessions,
  db.workoutExercises,
  db.exerciseSets,
  db.exerciseVariations,
  db.templateExercises,
  db.workoutTemplates,
  db.trainingSplits,
  db.gyms,
  db.equipment,
  db.settings,
];

const isGymSpecific = (t: EquipmentType) => GYM_SPECIFIC_EQUIPMENT.includes(t);

/* ------------------------------- Lookups ------------------------------- */

export async function sessionForDate(date: LocalDate): Promise<WorkoutSession | undefined> {
  return db.workoutSessions.where("date").equals(date).first();
}

/** Most recent session (other than today's) that trained this split day. */
export async function lastSessionForDay(planId: ID, splitDayId: ID, before: LocalDate): Promise<WorkoutSession | undefined> {
  const sessions = await db.workoutSessions.where("planId").equals(planId).toArray();
  return sessions
    .filter((s) => s.splitDayId === splitDayId && s.date < before)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

async function sessionDates(ids: ID[]): Promise<Map<ID, LocalDate>> {
  const sessions = await db.workoutSessions.bulkGet([...new Set(ids)]);
  return new Map(sessions.filter((s): s is WorkoutSession => !!s).map((s) => [s.id, s.date]));
}

async function sortedSets(workoutExerciseId: ID): Promise<ExerciseSet[]> {
  return db.exerciseSets.where("workoutExerciseId").equals(workoutExerciseId).sortBy("order");
}

export interface PreviousPerformance {
  date: LocalDate;
  sessionId: ID;
  exercise: WorkoutExercise;
  /** Completed sets in order, drops included. */
  sets: ExerciseSet[];
}

/**
 * The most recent performance with exactly this configuration key that has
 * at least one completed set, excluding the given session.
 */
export async function previousPerformance(configKey: string, excludeSessionId?: ID): Promise<PreviousPerformance | undefined> {
  const candidates = (await db.workoutExercises.where("configKey").equals(configKey).toArray()).filter(
    (we) => we.sessionId !== excludeSessionId,
  );
  if (!candidates.length) return undefined;
  const dates = await sessionDates(candidates.map((c) => c.sessionId));
  const ordered = candidates
    .filter((c) => dates.has(c.sessionId))
    .sort((a, b) => {
      const da = dates.get(a.sessionId)!;
      const dbb = dates.get(b.sessionId)!;
      return da === dbb ? (a.createdAt < b.createdAt ? 1 : -1) : da < dbb ? 1 : -1;
    });
  for (const exercise of ordered) {
    const sets = (await sortedSets(exercise.id)).filter((s) => s.completed);
    if (sets.length) return { date: dates.get(exercise.sessionId)!, sessionId: exercise.sessionId, exercise, sets };
  }
  return undefined;
}

/**
 * Last machine and settings used for this exercise (at this gym, for
 * machines and cables), so a new log starts from your usual setup.
 */
async function lastSetup(
  variation: ExerciseVariation,
  weightInterpretation: WeightInterpretation,
  gymId: ID,
  excludeSessionId: ID,
): Promise<{ equipmentId?: ID; settings: SettingsSnapshot } | undefined> {
  const gymSpecific = isGymSpecific(variation.equipmentType);
  const candidates = (await db.workoutExercises.where("variationId").equals(variation.id).toArray()).filter(
    (we) =>
      we.sessionId !== excludeSessionId &&
      we.weightInterpretation === weightInterpretation &&
      (!gymSpecific || we.gymId === gymId),
  );
  if (!candidates.length) return undefined;
  const dates = await sessionDates(candidates.map((c) => c.sessionId));
  const latest = candidates
    .filter((c) => dates.has(c.sessionId))
    .sort((a, b) => ((dates.get(a.sessionId) ?? "") < (dates.get(b.sessionId) ?? "") ? 1 : -1))[0];
  return latest ? { equipmentId: latest.equipmentId, settings: { ...latest.settings } } : undefined;
}

/**
 * Settings last used for this exercise on this exact machine (spec 20.1 #2),
 * so each machine remembers its own setup.
 */
export async function lastSettingsFor(
  variationId: ID,
  equipmentId: ID | undefined,
  gymId: ID,
  excludeSessionId?: ID,
): Promise<SettingsSnapshot | undefined> {
  const candidates = (await db.workoutExercises.where("variationId").equals(variationId).toArray()).filter(
    (we) => we.sessionId !== excludeSessionId && we.equipmentId === equipmentId && we.gymId === gymId,
  );
  if (!candidates.length) return undefined;
  const dates = await sessionDates(candidates.map((c) => c.sessionId));
  const latest = candidates
    .filter((c) => dates.has(c.sessionId))
    .sort((a, b) => ((dates.get(a.sessionId) ?? "") < (dates.get(b.sessionId) ?? "") ? 1 : -1))[0];
  return latest ? { ...latest.settings } : undefined;
}

async function unitForGym(gymId: ID): Promise<WeightUnit> {
  return effectiveUnit(await db.gyms.get(gymId), await getSettings());
}

/* --------------------------- Building sets --------------------------- */

/** A set to create. unit is kept when copying, so history is never rounded by a conversion. */
type SetSeed = Pick<ExerciseSet, "type" | "weight" | "reps" | "side"> & { unit?: WeightUnit };

/** Planned set types to rows. In L/R split mode each set becomes a left and a right row. */
function seedsFromPlan(plan: SetType[], unilateralMode: UnilateralMode): SetSeed[] {
  return plan.flatMap((type) =>
    unilateralMode === "split"
      ? (["left", "right"] as SetSide[]).map((side) => ({ type, weight: null, reps: null, side }))
      : [{ type, weight: null, reps: null }],
  );
}

/** Copies last time's completed sets (drops are added live, so they're skipped). */
function seedsFromPrevious(prev: PreviousPerformance): SetSeed[] {
  return prev.sets
    .filter((s) => s.type !== "drop")
    .map((s) => ({ type: s.type, weight: s.weight, reps: s.reps, side: s.side, unit: s.unit }));
}

async function writeSets(workoutExerciseId: ID, seeds: SetSeed[], unit: WeightUnit): Promise<void> {
  const t = nowISO();
  await db.exerciseSets.bulkAdd(
    seeds.map((s, i) => ({
      id: newId(),
      workoutExerciseId,
      order: i,
      type: s.type,
      weight: s.weight,
      reps: s.reps,
      side: s.side,
      unit: s.unit ?? unit,
      completed: false,
      createdAt: t,
      updatedAt: t,
    })),
  );
}

interface ExerciseOptions {
  weightInterpretation?: WeightInterpretation;
  unilateralMode?: UnilateralMode;
  plannedSets?: SetType[];
  equipmentId?: ID;
  settings?: SettingsSnapshot;
}

async function createLoggedExercise(
  sessionId: ID,
  order: number,
  gymId: ID,
  variation: ExerciseVariation,
  opts: ExerciseOptions = {},
): Promise<ID> {
  const weightInterpretation = opts.weightInterpretation ?? variation.defaultWeightInterpretation ?? "total";
  const unilateralMode = opts.unilateralMode ?? (variation.unilateral ? "per_side" : "none");
  const setup =
    opts.settings !== undefined
      ? { equipmentId: opts.equipmentId, settings: opts.settings }
      : ((await lastSetup(variation, weightInterpretation, gymId, sessionId)) ?? { settings: {} });
  const equipmentId = isGymSpecific(variation.equipmentType) ? setup.equipmentId : undefined;

  const configKey = buildConfigKey({
    variationId: variation.id,
    equipmentType: variation.equipmentType,
    weightInterpretation,
    gymId,
    equipmentId,
    settings: setup.settings,
  });
  const prev = await previousPerformance(configKey, sessionId);
  const t = nowISO();
  const id = newId();
  await db.workoutExercises.add({
    id,
    sessionId,
    order,
    variationId: variation.id,
    gymId,
    equipmentId,
    weightInterpretation,
    unilateralMode,
    settings: setup.settings,
    configKey,
    createdAt: t,
    updatedAt: t,
  });
  const seeds = prev ? seedsFromPrevious(prev) : seedsFromPlan(opts.plannedSets ?? DEFAULT_SET_STRUCTURE, unilateralMode);
  await writeSets(id, seeds, await unitForGym(gymId));
  return id;
}

/* ------------------------------ Sessions ------------------------------ */

export type StartSource = "template" | "previous" | "empty";

export interface StartInput {
  planId: ID;
  date: LocalDate;
  gymId: ID;
  splitDayId?: ID;
  /** Shown as the workout name. Defaults to the split day's name. */
  name?: string;
  source: StartSource;
}

/** Starts a workout, or returns the existing session for that date. */
export async function startSession(input: StartInput): Promise<ID> {
  return db.transaction("rw", ALL_TABLES(), async () => {
    const existing = await sessionForDate(input.date);
    if (existing) return existing.id;

    const split = await db.trainingSplits.where("planId").equals(input.planId).first();
    const day = split?.days.find((d) => d.id === input.splitDayId);
    const lastBw = (await db.workoutSessions.orderBy("date").reverse().toArray()).find((s) => s.bodyweight != null);
    const t = nowISO();
    const sessionId = newId();
    await db.workoutSessions.add({
      id: sessionId,
      planId: input.planId,
      date: input.date,
      name: input.name?.trim() || day?.name || "Workout",
      splitDayId: day?.id,
      templateId: day?.templateId,
      gymId: input.gymId,
      status: "in_progress",
      startedAt: t,
      bodyweight: lastBw?.bodyweight,
      bodyweightUnit: lastBw?.bodyweightUnit ?? (await unitForGym(input.gymId)),
      createdAt: t,
      updatedAt: t,
    });
    await updateSettings({ lastGymId: input.gymId });

    if (input.source === "template" && day?.templateId) {
      const rows = await db.templateExercises.where("templateId").equals(day.templateId).sortBy("order");
      const variations = await db.exerciseVariations.bulkGet(rows.map((r) => r.variationId));
      for (const [i, r] of rows.entries()) {
        const v = variations[i];
        if (!v) continue;
        await createLoggedExercise(sessionId, i, input.gymId, v, {
          weightInterpretation: r.weightInterpretation,
          unilateralMode: r.unilateralMode,
          plannedSets: r.defaultSets,
        });
      }
    } else if (input.source === "previous" && day) {
      const last = await lastSessionForDay(input.planId, day.id, input.date);
      if (last) {
        const rows = await db.workoutExercises.where("sessionId").equals(last.id).sortBy("order");
        const variations = await db.exerciseVariations.bulkGet(rows.map((r) => r.variationId));
        for (const [i, r] of rows.entries()) {
          const v = variations[i];
          if (!v) continue;
          // Same gym as last time: keep the exact setup. New gym: start from that gym's usual setup.
          const sameGym = r.gymId === input.gymId;
          await createLoggedExercise(sessionId, i, input.gymId, v, {
            weightInterpretation: r.weightInterpretation,
            unilateralMode: r.unilateralMode,
            ...(sameGym ? { equipmentId: r.equipmentId, settings: r.settings } : {}),
          });
        }
      }
    }
    return sessionId;
  });
}

export async function addExerciseToSession(sessionId: ID, variationIds: ID[]): Promise<void> {
  await db.transaction("rw", ALL_TABLES(), async () => {
    const session = await db.workoutSessions.get(sessionId);
    if (!session) throw new Error("Workout not found.");
    const existing = await db.workoutExercises.where("sessionId").equals(sessionId).toArray();
    let order = existing.reduce((m, e) => Math.max(m, e.order), -1) + 1;
    const variations = await db.exerciseVariations.bulkGet(variationIds);
    for (const v of variations) if (v) await createLoggedExercise(sessionId, order++, session.gymId, v);
    await touch(sessionId);
  });
}

async function touch(sessionId: ID) {
  await db.workoutSessions.update(sessionId, { updatedAt: nowISO() });
}

export async function setSessionBodyweight(sessionId: ID, bodyweight: number | undefined, unit: WeightUnit): Promise<void> {
  await db.workoutSessions.update(sessionId, { bodyweight, bodyweightUnit: unit, updatedAt: nowISO() });
}

/** True when the session's exercises no longer match its saved template. */
export async function templateDiffers(sessionId: ID): Promise<boolean> {
  const session = await db.workoutSessions.get(sessionId);
  if (!session?.templateId) return false;
  const [logged, planned] = await Promise.all([
    db.workoutExercises.where("sessionId").equals(sessionId).sortBy("order"),
    db.templateExercises.where("templateId").equals(session.templateId).sortBy("order"),
  ]);
  return logged.map((e) => e.variationId).join() !== planned.map((e) => e.variationId).join();
}

/**
 * Marks a workout done. With updateTemplate, the day's saved list is replaced
 * by this workout's exercises and set counts (spec 20.3 #12, default off).
 */
export async function finishSession(sessionId: ID, opts: { updateTemplate?: boolean } = {}): Promise<void> {
  await db.transaction("rw", ALL_TABLES(), async () => {
    const session = await db.workoutSessions.get(sessionId);
    if (!session) return;
    const t = nowISO();
    await db.workoutSessions.update(sessionId, { status: "completed", completedAt: t, updatedAt: t });

    if (opts.updateTemplate && session.templateId) {
      const templateId = session.templateId;
      const logged = await db.workoutExercises.where("sessionId").equals(sessionId).sortBy("order");
      await db.templateExercises.where("templateId").equals(templateId).delete();
      for (const [i, we] of logged.entries()) {
        const sets = (await sortedSets(we.id)).filter((s) => s.type !== "drop" && s.side !== "right");
        await db.templateExercises.add({
          id: newId(),
          templateId,
          order: i,
          variationId: we.variationId,
          weightInterpretation: we.weightInterpretation,
          unilateralMode: we.unilateralMode,
          defaultSettings: {},
          defaultSets: sets.length ? sets.map((s) => s.type) : [...DEFAULT_SET_STRUCTURE],
          createdAt: t,
          updatedAt: t,
        });
      }
    }
  });
}

export async function reopenSession(sessionId: ID): Promise<void> {
  await db.workoutSessions.update(sessionId, { status: "in_progress", completedAt: undefined, updatedAt: nowISO() });
}

/** Deletes a workout and everything logged in it. */
export async function discardSession(sessionId: ID): Promise<void> {
  await db.transaction("rw", [db.workoutSessions, db.workoutExercises, db.exerciseSets], async () => {
    const exerciseIds = await db.workoutExercises.where("sessionId").equals(sessionId).primaryKeys();
    await db.exerciseSets.where("workoutExerciseId").anyOf(exerciseIds).delete();
    await db.workoutExercises.bulkDelete(exerciseIds);
    await db.workoutSessions.delete(sessionId);
  });
}

/* ------------------------------ Exercises ------------------------------ */

export interface SetupPatch {
  gymId?: ID;
  equipmentId?: ID | null;
  settings?: SettingsSnapshot;
  weightInterpretation?: WeightInterpretation;
  unilateralMode?: UnilateralMode;
}

/**
 * Changes an exercise's gym, machine, settings or weight entry. The
 * configuration key is recomputed. If no set is done yet, the sets are
 * re-filled from the new setup's history (or emptied when it has none).
 */
export async function updateExerciseSetup(workoutExerciseId: ID, patch: SetupPatch): Promise<void> {
  await db.transaction("rw", ALL_TABLES(), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we) return;
    const variation = await db.exerciseVariations.get(we.variationId);
    if (!variation) return;
    const gymSpecific = isGymSpecific(variation.equipmentType);

    const gymId = patch.gymId ?? we.gymId;
    const gymChanged = gymId !== we.gymId;
    let equipmentId = patch.equipmentId === null ? undefined : (patch.equipmentId ?? we.equipmentId);
    let settings = patch.settings ?? we.settings;
    const weightInterpretation = patch.weightInterpretation ?? we.weightInterpretation;
    const unilateralMode = patch.unilateralMode ?? we.unilateralMode;

    // Machines belong to a gym, so a gym change starts from that gym's usual setup.
    if (gymChanged && gymSpecific && patch.equipmentId === undefined) {
      const setup = await lastSetup(variation, weightInterpretation, gymId, we.sessionId);
      equipmentId = setup?.equipmentId;
      settings = patch.settings ?? setup?.settings ?? {};
    }
    // A different machine with no settings given: use that machine's own last settings.
    if (gymSpecific && patch.settings === undefined && equipmentId !== we.equipmentId && !(gymChanged && patch.equipmentId === undefined)) {
      settings = (await lastSettingsFor(variation.id, equipmentId, gymId, we.sessionId)) ?? {};
    }
    if (!gymSpecific) equipmentId = undefined;

    const configKey = buildConfigKey({
      variationId: variation.id,
      equipmentType: variation.equipmentType,
      weightInterpretation,
      gymId,
      equipmentId,
      settings,
    });
    await db.workoutExercises.put({
      ...we,
      gymId,
      equipmentId,
      settings,
      weightInterpretation,
      unilateralMode,
      configKey,
      updatedAt: nowISO(),
    });

    const sets = await sortedSets(we.id);
    const started = sets.some((s) => s.completed);
    const structureChanged = unilateralMode !== we.unilateralMode;
    if (!started && (configKey !== we.configKey || structureChanged || gymChanged)) {
      const prev = await previousPerformance(configKey, we.sessionId);
      const plan = sets.filter((s) => s.type !== "drop" && s.side !== "right").map((s) => s.type);
      await db.exerciseSets.bulkDelete(sets.map((s) => s.id));
      await writeSets(
        we.id,
        prev ? seedsFromPrevious(prev) : seedsFromPlan(plan.length ? plan : DEFAULT_SET_STRUCTURE, unilateralMode),
        await unitForGym(gymId),
      );
    }
    await touch(we.sessionId);
  });
}

export async function removeExercise(workoutExerciseId: ID): Promise<void> {
  await db.transaction("rw", [db.workoutExercises, db.exerciseSets, db.workoutSessions], async () => {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we) return;
    await db.exerciseSets.where("workoutExerciseId").equals(workoutExerciseId).delete();
    await db.workoutExercises.delete(workoutExerciseId);
    const rest = await db.workoutExercises.where("sessionId").equals(we.sessionId).sortBy("order");
    await Promise.all(rest.map((r, i) => (r.order === i ? null : db.workoutExercises.update(r.id, { order: i }))));
    await touch(we.sessionId);
  });
}

export async function moveExercise(workoutExerciseId: ID, dir: -1 | 1): Promise<void> {
  await db.transaction("rw", db.workoutExercises, async () => {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we) return;
    const rows = await db.workoutExercises.where("sessionId").equals(we.sessionId).sortBy("order");
    const i = rows.findIndex((r) => r.id === workoutExerciseId);
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    await Promise.all(rows.map((r, k) => (r.order === k ? null : db.workoutExercises.update(r.id, { order: k }))));
  });
}

/* -------------------------------- Sets -------------------------------- */

async function renumber(sets: ExerciseSet[]) {
  const t = nowISO();
  await Promise.all(sets.map((s, i) => (s.order === i ? null : db.exerciseSets.update(s.id, { order: i, updatedAt: t }))));
}

/** Adds a working set (a left and right pair in L/R mode), copying the last set's numbers. */
export async function addSet(workoutExerciseId: ID): Promise<void> {
  await db.transaction("rw", [db.workoutExercises, db.exerciseSets, db.gyms, db.settings], async () => {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we) return;
    const sets = await sortedSets(workoutExerciseId);
    const main = sets.filter((s) => s.type !== "drop");
    const sides: Array<SetSide | undefined> = we.unilateralMode === "split" ? ["left", "right"] : [undefined];
    const t = nowISO();
    let order = sets.length;
    for (const side of sides) {
      const like = [...main].reverse().find((s) => s.side === side) ?? main[main.length - 1];
      await db.exerciseSets.add({
        id: newId(),
        workoutExerciseId,
        order: order++,
        type: "working",
        weight: like?.weight ?? null,
        reps: like?.reps ?? null,
        unit: like?.unit ?? (await unitForGym(we.gymId)),
        side,
        completed: false,
        createdAt: t,
        updatedAt: t,
      });
    }
  });
}

/** Adds a drop set right after its parent (and any drops already under it). */
export async function addDropSet(parentSetId: ID): Promise<void> {
  await db.transaction("rw", db.exerciseSets, async () => {
    const parent = await db.exerciseSets.get(parentSetId);
    if (!parent) return;
    const sets = await sortedSets(parent.workoutExerciseId);
    let at = sets.findIndex((s) => s.id === parentSetId) + 1;
    while (at < sets.length && sets[at].parentSetId === parentSetId) at++;
    const lastInChain = sets[at - 1];
    const t = nowISO();
    const drop: ExerciseSet = {
      id: newId(),
      workoutExerciseId: parent.workoutExerciseId,
      order: at,
      type: "drop",
      parentSetId,
      side: parent.side,
      weight: lastInChain.weight,
      reps: null,
      unit: parent.unit,
      completed: false,
      createdAt: t,
      updatedAt: t,
    };
    sets.splice(at, 0, drop);
    await db.exerciseSets.add(drop);
    await renumber(sets);
  });
}

export type SetPatch = Partial<Pick<ExerciseSet, "weight" | "reps" | "type" | "completed" | "unit">>;

export async function updateSet(setId: ID, patch: SetPatch): Promise<void> {
  await db.exerciseSets.update(setId, { ...patch, updatedAt: nowISO() });
}

/** A set can be checked off only once weight and reps are entered (spec 9.3). */
export function canComplete(set: Pick<ExerciseSet, "weight" | "reps">): boolean {
  return set.weight != null && set.reps != null && set.reps > 0;
}

export async function toggleSetComplete(setId: ID): Promise<boolean> {
  const set = await db.exerciseSets.get(setId);
  if (!set) return false;
  if (!set.completed && !canComplete(set)) return false;
  await updateSet(setId, { completed: !set.completed });
  return true;
}

/** Deletes a set along with any drop sets hanging off it. */
export async function deleteSet(setId: ID): Promise<void> {
  await db.transaction("rw", db.exerciseSets, async () => {
    const set = await db.exerciseSets.get(setId);
    if (!set) return;
    const sets = await sortedSets(set.workoutExerciseId);
    const doomed = new Set([setId, ...sets.filter((s) => s.parentSetId === setId).map((s) => s.id)]);
    await db.exerciseSets.bulkDelete([...doomed]);
    await renumber(sets.filter((s) => !doomed.has(s.id)));
  });
}

/* ------------------------------ Equipment ------------------------------ */

export async function createEquipment(gymId: ID, name: string, type: EquipmentType): Promise<ID> {
  const t = nowISO();
  const id = newId();
  await db.equipment.add({ id, gymId, name: name.trim(), type, createdAt: t, updatedAt: t });
  return id;
}
