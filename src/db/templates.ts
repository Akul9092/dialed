import { db } from "./db";
import type {
  EquipmentType,
  ExerciseVariation,
  LoadType,
  TemplateExercise,
  UnilateralMode,
  WeightInterpretation,
  WorkoutTemplate,
} from "./types";
import { DEFAULT_SET_STRUCTURE } from "@/lib/sets";
import { newId, nowISO } from "@/lib/util";

/*
 * Workout templates (spec 11): the exercises and set structure for a day.
 * Split days point at a template through SplitDay.templateId, so two days
 * can share one template (both Push days in PPL x2) or have their own.
 */

async function getSplit(planId: string) {
  const split = await db.trainingSplits.where("planId").equals(planId).first();
  if (!split) throw new Error("This plan has no split.");
  return split;
}

/** Returns the day's template, creating one named after the day if needed. */
export async function ensureDayTemplate(planId: string, dayId: string): Promise<string> {
  return db.transaction("rw", [db.trainingSplits, db.workoutTemplates], async () => {
    const split = await getSplit(planId);
    const day = split.days.find((d) => d.id === dayId);
    if (!day) throw new Error("Day not found.");
    if (day.templateId && (await db.workoutTemplates.get(day.templateId))) return day.templateId;

    const t = nowISO();
    const template: WorkoutTemplate = { id: newId(), planId, name: day.name, createdAt: t, updatedAt: t };
    await db.workoutTemplates.add(template);
    await db.trainingSplits.update(split.id, {
      days: split.days.map((d) => (d.id === dayId ? { ...d, templateId: template.id } : d)),
      updatedAt: t,
    });
    return template.id;
  });
}

/** Points a day at another template (shared), or at a new empty one. */
export async function setDayTemplate(planId: string, dayId: string, templateId: string | "new"): Promise<string> {
  return db.transaction("rw", [db.trainingSplits, db.workoutTemplates], async () => {
    const split = await getSplit(planId);
    const day = split.days.find((d) => d.id === dayId);
    if (!day) throw new Error("Day not found.");
    const t = nowISO();
    let id = templateId;
    if (id === "new") {
      id = newId();
      await db.workoutTemplates.add({ id, planId, name: day.name, createdAt: t, updatedAt: t });
    }
    await db.trainingSplits.update(split.id, {
      days: split.days.map((d) => (d.id === dayId ? { ...d, templateId: id } : d)),
      updatedAt: t,
    });
    return id;
  });
}

/** Copies another template's exercises into a new template for this day. */
export async function copyTemplateToDay(planId: string, dayId: string, sourceTemplateId: string): Promise<string> {
  return db.transaction("rw", [db.trainingSplits, db.workoutTemplates, db.templateExercises], async () => {
    const source = await db.workoutTemplates.get(sourceTemplateId);
    if (!source) throw new Error("Template not found.");
    const id = await setDayTemplate(planId, dayId, "new");
    const t = nowISO();
    const rows = await db.templateExercises.where("templateId").equals(sourceTemplateId).sortBy("order");
    await db.templateExercises.bulkAdd(rows.map((r) => ({ ...r, id: newId(), templateId: id, createdAt: t, updatedAt: t })));
    return id;
  });
}

export async function renameTemplate(templateId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.workoutTemplates.update(templateId, { name: trimmed, updatedAt: nowISO() });
}

/* ------------------------------ Exercises ------------------------------ */

export function defaultsFor(v: Pick<ExerciseVariation, "defaultWeightInterpretation" | "unilateral">): {
  weightInterpretation: WeightInterpretation;
  unilateralMode: UnilateralMode;
} {
  return {
    weightInterpretation: v.defaultWeightInterpretation ?? "total",
    unilateralMode: v.unilateral ? "per_side" : "none",
  };
}

export async function addExercisesToTemplate(templateId: string, variationIds: string[]): Promise<void> {
  await db.transaction("rw", [db.templateExercises, db.exerciseVariations], async () => {
    const existing = await db.templateExercises.where("templateId").equals(templateId).toArray();
    let order = existing.reduce((m, e) => Math.max(m, e.order), -1) + 1;
    const variations = await db.exerciseVariations.bulkGet(variationIds);
    const t = nowISO();
    const rows: TemplateExercise[] = [];
    variations.forEach((v) => {
      if (!v) return;
      rows.push({
        id: newId(),
        templateId,
        order: order++,
        variationId: v.id,
        ...defaultsFor(v),
        defaultSettings: {},
        defaultSets: [...DEFAULT_SET_STRUCTURE],
        createdAt: t,
        updatedAt: t,
      });
    });
    if (rows.length) await db.templateExercises.bulkAdd(rows);
  });
}

export type TemplateExercisePatch = Partial<
  Pick<TemplateExercise, "defaultSets" | "weightInterpretation" | "unilateralMode">
>;

export async function updateTemplateExercise(id: string, patch: TemplateExercisePatch): Promise<void> {
  await db.templateExercises.update(id, { ...patch, updatedAt: nowISO() });
}

export async function removeTemplateExercise(id: string): Promise<void> {
  await db.templateExercises.delete(id);
}

/** Moves an exercise up or down and renumbers the template 0..n-1. */
export async function moveTemplateExercise(templateId: string, id: string, dir: -1 | 1): Promise<void> {
  await db.transaction("rw", db.templateExercises, async () => {
    const rows = await db.templateExercises.where("templateId").equals(templateId).sortBy("order");
    const i = rows.findIndex((r) => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    const t = nowISO();
    await Promise.all(rows.map((r, k) => (r.order === k ? null : db.templateExercises.update(r.id, { order: k, updatedAt: t }))));
  });
}

/* --------------------------- Custom exercises --------------------------- */

export type CustomExerciseInput = {
  name: string;
  familyId?: string;
  newFamilyName?: string;
  equipmentType: EquipmentType;
  defaultWeightInterpretation: WeightInterpretation;
  unilateral: boolean;
};

function loadTypeFor(equipment: EquipmentType): LoadType {
  return equipment === "bodyweight" ? "bodyweight" : "weighted";
}

async function resolveFamily(input: CustomExerciseInput): Promise<string | undefined> {
  const name = input.newFamilyName?.trim();
  if (!name) return input.familyId || undefined;
  const existing = (await db.exerciseFamilies.toArray()).find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const t = nowISO();
  const id = newId();
  await db.exerciseFamilies.add({ id, name, createdAt: t, updatedAt: t });
  return id;
}

export async function findExerciseByName(name: string): Promise<ExerciseVariation | undefined> {
  const n = name.trim().toLowerCase();
  return (await db.exerciseVariations.toArray()).find((v) => v.name.toLowerCase() === n);
}

export async function createCustomExercise(input: CustomExerciseInput): Promise<string> {
  return db.transaction("rw", [db.exerciseVariations, db.exerciseFamilies], async () => {
    const name = input.name.trim();
    if (await findExerciseByName(name)) throw new Error(`"${name}" is already in your library.`);
    const t = nowISO();
    const id = newId();
    await db.exerciseVariations.add({
      id,
      name,
      familyId: await resolveFamily(input),
      equipmentType: input.equipmentType,
      loadType: loadTypeFor(input.equipmentType),
      defaultWeightInterpretation: input.defaultWeightInterpretation,
      unilateral: input.unilateral,
      isCustom: true,
      createdAt: t,
      updatedAt: t,
    });
    return id;
  });
}

/**
 * Renames or edits a custom exercise. Equipment type is locked once the
 * exercise has been logged, since it decides how history is matched.
 */
export async function updateCustomExercise(id: string, input: CustomExerciseInput): Promise<void> {
  await db.transaction("rw", [db.exerciseVariations, db.exerciseFamilies, db.workoutExercises], async () => {
    const current = await db.exerciseVariations.get(id);
    if (!current?.isCustom) throw new Error("Built-in exercises can't be edited.");
    const name = input.name.trim();
    const clash = await findExerciseByName(name);
    if (clash && clash.id !== id) throw new Error(`"${name}" is already in your library.`);
    const logged = (await db.workoutExercises.where("variationId").equals(id).count()) > 0;
    const equipmentType = logged ? current.equipmentType : input.equipmentType;
    await db.exerciseVariations.put({
      ...current,
      name,
      familyId: await resolveFamily(input),
      equipmentType,
      loadType: loadTypeFor(equipmentType),
      defaultWeightInterpretation: input.defaultWeightInterpretation,
      unilateral: input.unilateral,
      updatedAt: nowISO(),
    });
  });
}

export async function exerciseUsage(id: string): Promise<{ templates: number; logged: number }> {
  const [templates, logged] = await Promise.all([
    db.templateExercises.where("variationId").equals(id).count(),
    db.workoutExercises.where("variationId").equals(id).count(),
  ]);
  return { templates, logged };
}

/** Custom exercises can be deleted only while nothing uses them. */
export async function deleteCustomExercise(id: string): Promise<void> {
  const v = await db.exerciseVariations.get(id);
  if (!v?.isCustom) throw new Error("Built-in exercises can't be deleted.");
  const usage = await exerciseUsage(id);
  if (usage.templates || usage.logged) {
    throw new Error("This exercise is used in a template or a logged workout, so it can't be deleted.");
  }
  await db.exerciseVariations.delete(id);
}
