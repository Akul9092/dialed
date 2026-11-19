import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Dexie from "dexie";
import { db } from "./db";

describe("schema v2 migration", () => {
  it("turns top and back-off sets into working sets", async () => {
    // Build a database exactly as schema v1 left it.
    const old = new Dexie("dialed");
    old.version(1).stores({
      templateExercises: "id, templateId, [templateId+order], variationId",
      exerciseSets: "id, workoutExerciseId, [workoutExerciseId+order], parentSetId",
    });
    await old.table("templateExercises").add({ id: "te1", templateId: "t1", order: 0, variationId: "v1", defaultSets: ["warmup", "top", "working", "backoff"] });
    await old.table("exerciseSets").bulkAdd([
      { id: "s1", workoutExerciseId: "we1", order: 0, type: "top" },
      { id: "s2", workoutExerciseId: "we1", order: 1, type: "backoff" },
      { id: "s3", workoutExerciseId: "we1", order: 2, type: "drop" },
    ]);
    old.close();

    await db.open();
    assert.deepEqual((await db.templateExercises.get("te1"))!.defaultSets, ["warmup", "working", "working", "working"]);
    assert.deepEqual((await db.exerciseSets.orderBy("id").toArray()).map((s) => s.type), ["working", "working", "drop"]);
  });
});
