import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createGym, createPlan } from "./actions";
import { db } from "./db";
import { ensureSeed } from "./seed";
import {
  addDropSet,
  addExerciseToSession,
  addSet,
  createEquipment,
  deleteSet,
  discardSession,
  finishSession,
  lastSettingsFor,
  startSession,
  templateDiffers,
  toggleSetComplete,
  updateExerciseSetup,
  updateSet,
} from "./sessions";
import { addExercisesToTemplate, ensureDayTemplate, updateTemplateExercise } from "./templates";
import { daysFromTemplate, SPLIT_TEMPLATES } from "@/lib/splits";

let planId: string;
let pushDayId: string;
let cornell: string;
let home: string;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeed();
  planId = await createPlan({ name: "Fall" }, daysFromTemplate(SPLIT_TEMPLATES[0]));
  const split = (await db.trainingSplits.where("planId").equals(planId).first())!;
  pushDayId = split.days[0].id;
  const t = await ensureDayTemplate(planId, pushDayId);
  await addExercisesToTemplate(t, ["ex-incline-dumbbell-press", "ex-cable-lateral-raise"]);
  const first = (await db.templateExercises.where("templateId").equals(t).sortBy("order"))[0];
  await updateTemplateExercise(first.id, { defaultSets: ["warmup", "working", "working", "working"] });
  cornell = await createGym({ name: "Cornell" });
  home = await createGym({ name: "Home", defaultUnit: "kg" });
});

const exercises = (sessionId: string) => db.workoutExercises.where("sessionId").equals(sessionId).sortBy("order");
const sets = (weId: string) => db.exerciseSets.where("workoutExerciseId").equals(weId).sortBy("order");
const show = async (weId: string) =>
  (await sets(weId)).map((s) => `${s.type[0]}${s.side ? s.side[0] : ""}:${s.weight ?? "_"}x${s.reps ?? "_"}${s.completed ? "✓" : ""}`).join(" ");

async function logAll(weId: string, weight: number, reps: number) {
  for (const s of await sets(weId)) {
    await updateSet(s.id, { weight, reps });
    await toggleSetComplete(s.id);
  }
}

describe("starting a workout", () => {
  it("builds exercises and planned sets from the day's template", async () => {
    const id = await startSession({ planId, date: "2026-11-18", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const s = (await db.workoutSessions.get(id))!;
    assert.equal(s.name, "Push");
    assert.equal(s.status, "in_progress");
    const [press, raise] = await exercises(id);
    assert.deepEqual((await sets(press.id)).map((x) => x.type), ["warmup", "working", "working", "working"]);
    assert.ok((await sets(press.id)).every((x) => x.weight === null && x.reps === null && !x.completed));
    assert.equal(raise.unilateralMode, "per_side");
    assert.equal((await db.settings.get("app"))!.lastGymId, cornell);
  });

  it("opens the existing session instead of creating a second one that day", async () => {
    const a = await startSession({ planId, date: "2026-11-18", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const b = await startSession({ planId, date: "2026-11-18", gymId: home, source: "empty" });
    assert.equal(a, b);
    assert.equal(await db.workoutSessions.count(), 1);
  });

  it("only checks off sets that have weight and reps", async () => {
    const id = await startSession({ planId, date: "2026-11-18", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const [press] = await exercises(id);
    const first = (await sets(press.id))[0];
    assert.equal(await toggleSetComplete(first.id), false);
    await updateSet(first.id, { weight: 25, reps: 12 });
    assert.equal(await toggleSetComplete(first.id), true);
  });
});

describe("history and defaults", () => {
  it("prefills last time's completed sets and setup for the same configuration", async () => {
    const d1 = await startSession({ planId, date: "2026-11-16", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const [press1, raise1] = await exercises(d1);
    await logAll(press1.id, 60, 10);
    const machine = await createEquipment(cornell, "Cable Station 1", "cable");
    await updateExerciseSetup(raise1.id, { equipmentId: machine, settings: { "f-cable-height": 2, "f-cable-attachment": "Wrist cuff" } });
    await logAll(raise1.id, 15, 12);
    await finishSession(d1);

    const d2 = await startSession({ planId, date: "2026-11-19", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const [press2, raise2] = await exercises(d2);
    assert.equal(await show(press2.id), "w:60x10 w:60x10 w:60x10 w:60x10");
    assert.equal(raise2.equipmentId, machine);
    assert.equal(raise2.configKey, (await db.workoutExercises.get(raise1.id))!.configKey);
    assert.equal(await show(raise2.id), "w:15x12 w:15x12");
  });

  it("empties the sets when the setup changes to one with no history", async () => {
    const d1 = await startSession({ planId, date: "2026-11-16", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const [, raise1] = await exercises(d1);
    await updateExerciseSetup(raise1.id, { settings: { "f-cable-height": 2 } });
    await logAll(raise1.id, 15, 12);
    await finishSession(d1);

    const d2 = await startSession({ planId, date: "2026-11-19", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const [, raise2] = await exercises(d2);
    assert.equal(await show(raise2.id), "w:15x12 w:15x12");
    await updateExerciseSetup(raise2.id, { settings: { "f-cable-height": 3 } });
    assert.equal(await show(raise2.id), "w:_x_ w:_x_");
    await updateExerciseSetup(raise2.id, { settings: { "f-cable-height": 2 } });
    assert.equal(await show(raise2.id), "w:15x12 w:15x12");
  });

  it("shares dumbbell history across gyms but not cable history", async () => {
    const d1 = await startSession({ planId, date: "2026-11-16", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const [press1, raise1] = await exercises(d1);
    await logAll(press1.id, 60, 10);
    await logAll(raise1.id, 15, 12);
    await finishSession(d1);

    const d2 = await startSession({ planId, date: "2026-11-19", gymId: home, splitDayId: pushDayId, source: "template" });
    const [press2, raise2] = await exercises(d2);
    assert.equal(press2.configKey, press1.configKey);
    assert.equal(await show(press2.id), "w:60x10 w:60x10 w:60x10 w:60x10");
    // Copied numbers keep the unit they were logged in (lb), so nothing is
    // mislabeled as kg at the kg gym. The screen converts them for display.
    assert.ok((await sets(press2.id)).every((x) => x.unit === "lb"));
    assert.notEqual(raise2.configKey, raise1.configKey);
    assert.equal(await show(raise2.id), "w:_x_ w:_x_");
    assert.equal((await sets(raise2.id))[0].unit, "kg");
  });

  it("can copy the previous session's exercises instead of the template", async () => {
    const d1 = await startSession({ planId, date: "2026-11-16", gymId: cornell, splitDayId: pushDayId, source: "template" });
    await addExerciseToSession(d1, ["ex-dip"]);
    await finishSession(d1);
    const d2 = await startSession({ planId, date: "2026-11-19", gymId: cornell, splitDayId: pushDayId, source: "previous" });
    const names = (await exercises(d2)).map((e) => e.variationId);
    assert.deepEqual(names, ["ex-incline-dumbbell-press", "ex-cable-lateral-raise", "ex-dip"]);
  });
});

describe("machines", () => {
  it("each machine remembers its own settings", async () => {
    const d1 = await startSession({ planId, date: "2026-11-16", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const [, raise1] = await exercises(d1);
    const a = await createEquipment(cornell, "Machine A", "cable");
    const b = await createEquipment(cornell, "Machine B", "cable");
    await updateExerciseSetup(raise1.id, { equipmentId: a, settings: { "f-cable-height": 2 } });
    await logAll(raise1.id, 15, 12);
    await finishSession(d1);

    const d2 = await startSession({ planId, date: "2026-11-18", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const [, raise2] = await exercises(d2);
    await updateExerciseSetup(raise2.id, { equipmentId: b, settings: { "f-cable-height": 7 } });
    await logAll(raise2.id, 20, 10);
    await finishSession(d2);

    assert.deepEqual(await lastSettingsFor("ex-cable-lateral-raise", a, cornell), { "f-cable-height": 2 });
    assert.deepEqual(await lastSettingsFor("ex-cable-lateral-raise", b, cornell), { "f-cable-height": 7 });

    // Switching back to A without giving settings restores A's settings and history.
    const d3 = await startSession({ planId, date: "2026-11-20", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const [, raise3] = await exercises(d3);
    assert.equal(raise3.equipmentId, b);
    await updateExerciseSetup(raise3.id, { equipmentId: a });
    const now = (await db.workoutExercises.get(raise3.id))!;
    assert.deepEqual(now.settings, { "f-cable-height": 2 });
    assert.equal(await show(raise3.id), "w:15x12 w:15x12");
  });
});

describe("sets", () => {
  it("inserts drop sets under their parent and deletes them with it", async () => {
    const id = await startSession({ planId, date: "2026-11-18", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const [press] = await exercises(id);
    const [, w1] = await sets(press.id);
    await updateSet(w1.id, { weight: 60, reps: 10 });
    await addDropSet(w1.id);
    await addDropSet(w1.id);
    assert.equal(await show(press.id), "w:_x_ w:60x10 d:60x_ d:60x_ w:_x_ w:_x_");
    await deleteSet(w1.id);
    assert.equal(await show(press.id), "w:_x_ w:_x_ w:_x_");
  });

  it("adds left and right rows in L/R mode", async () => {
    const id = await startSession({ planId, date: "2026-11-18", gymId: cornell, splitDayId: pushDayId, source: "template" });
    const [, raise] = await exercises(id);
    await updateExerciseSetup(raise.id, { unilateralMode: "split" });
    assert.equal(await show(raise.id), "wl:_x_ wr:_x_ wl:_x_ wr:_x_");
    await addSet(raise.id);
    assert.equal((await sets(raise.id)).length, 6);
  });
});

describe("finishing", () => {
  it("can update the template from the workout, and discard removes everything", async () => {
    const id = await startSession({ planId, date: "2026-11-18", gymId: cornell, splitDayId: pushDayId, source: "template" });
    assert.equal(await templateDiffers(id), false);
    await addExerciseToSession(id, ["ex-dip"]);
    assert.equal(await templateDiffers(id), true);
    await finishSession(id, { updateTemplate: true });
    const s = (await db.workoutSessions.get(id))!;
    assert.equal(s.status, "completed");
    const rows = await db.templateExercises.where("templateId").equals(s.templateId!).sortBy("order");
    assert.deepEqual(rows.map((r) => r.variationId), ["ex-incline-dumbbell-press", "ex-cable-lateral-raise", "ex-dip"]);
    assert.deepEqual(rows[0].defaultSets, ["warmup", "working", "working", "working"]);

    await discardSession(id);
    assert.equal(await db.workoutSessions.count(), 0);
    assert.equal(await db.workoutExercises.count(), 0);
    assert.equal(await db.exerciseSets.count(), 0);
  });
});
