import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createPlan, deletePlan } from "./actions";
import { db } from "./db";
import { ensureSeed } from "./seed";
import {
  addExercisesToTemplate,
  copyTemplateToDay,
  createCustomExercise,
  deleteCustomExercise,
  ensureDayTemplate,
  moveTemplateExercise,
  setDayTemplate,
} from "./templates";
import { daysFromTemplate, SPLIT_TEMPLATES } from "@/lib/splits";

async function freshPlan() {
  const ppl2 = SPLIT_TEMPLATES.find((t) => t.id === "ppl2")!;
  const planId = await createPlan({ name: "Test" }, daysFromTemplate(ppl2));
  const split = (await db.trainingSplits.where("planId").equals(planId).first())!;
  return { planId, days: split.days };
}

const names = async (templateId: string) => {
  const rows = await db.templateExercises.where("templateId").equals(templateId).sortBy("order");
  const vs = await db.exerciseVariations.bulkGet(rows.map((r) => r.variationId));
  return vs.map((v) => v!.name);
};

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeed();
});

describe("seed", () => {
  it("is idempotent", async () => {
    const before = await db.exerciseVariations.count();
    await ensureSeed();
    assert.equal(await db.exerciseVariations.count(), before);
    assert.ok(before >= 80);
  });
});

describe("day templates", () => {
  it("creates a template named after the day on first use, then reuses it", async () => {
    const { planId, days } = await freshPlan();
    const id = await ensureDayTemplate(planId, days[0].id);
    assert.equal((await db.workoutTemplates.get(id))!.name, "Push");
    assert.equal(await ensureDayTemplate(planId, days[0].id), id);
  });

  it("adds exercises in order with the default 1 warm-up + 1 working", async () => {
    const { planId, days } = await freshPlan();
    const id = await ensureDayTemplate(planId, days[0].id);
    await addExercisesToTemplate(id, ["ex-incline-dumbbell-press", "ex-cable-lateral-raise"]);
    await addExercisesToTemplate(id, ["ex-triceps-pushdown"]);
    assert.deepEqual(await names(id), ["Incline Dumbbell Press", "Cable Lateral Raise", "Triceps Pushdown"]);
    const rows = await db.templateExercises.where("templateId").equals(id).sortBy("order");
    assert.deepEqual(rows[0].defaultSets, ["warmup", "working"]);
    assert.equal(rows[0].weightInterpretation, "per_dumbbell");
    assert.equal(rows[1].unilateralMode, "per_side");
  });

  it("reorders exercises", async () => {
    const { planId, days } = await freshPlan();
    const id = await ensureDayTemplate(planId, days[0].id);
    await addExercisesToTemplate(id, ["ex-dip", "ex-pec-deck", "ex-push-up"]);
    const rows = await db.templateExercises.where("templateId").equals(id).sortBy("order");
    await moveTemplateExercise(id, rows[2].id, -1);
    assert.deepEqual(await names(id), ["Dip", "Push-up", "Pec Deck"]);
  });

  it("lets two days share a template, or copy it into their own", async () => {
    const { planId, days } = await freshPlan();
    const push = await ensureDayTemplate(planId, days[0].id);
    await addExercisesToTemplate(push, ["ex-dip"]);
    await setDayTemplate(planId, days[3].id, push);
    assert.equal(await ensureDayTemplate(planId, days[3].id), push);

    const copy = await copyTemplateToDay(planId, days[3].id, push);
    assert.notEqual(copy, push);
    assert.deepEqual(await names(copy), ["Dip"]);
    await addExercisesToTemplate(copy, ["ex-push-up"]);
    assert.deepEqual(await names(push), ["Dip"]);
  });

  it("deleting a plan removes its templates and their exercises", async () => {
    const { planId, days } = await freshPlan();
    const id = await ensureDayTemplate(planId, days[0].id);
    await addExercisesToTemplate(id, ["ex-dip"]);
    await deletePlan(planId);
    assert.equal(await db.workoutTemplates.count(), 0);
    assert.equal(await db.templateExercises.count(), 0);
  });
});

describe("custom exercises", () => {
  it("rejects duplicate names and protects exercises in use", async () => {
    const id = await createCustomExercise({
      name: "Machine Fly Partials",
      newFamilyName: "Chest Fly",
      equipmentType: "machine",
      defaultWeightInterpretation: "total",
      unilateral: false,
    });
    const v = (await db.exerciseVariations.get(id))!;
    assert.equal(v.familyId, "fam-chest-fly");
    await assert.rejects(
      createCustomExercise({ name: "machine fly partials", equipmentType: "machine", defaultWeightInterpretation: "total", unilateral: false }),
    );
    const { planId, days } = await freshPlan();
    const t = await ensureDayTemplate(planId, days[0].id);
    await addExercisesToTemplate(t, [id]);
    await assert.rejects(deleteCustomExercise(id));
  });
});
