import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesQuery } from "./ExerciseList";

describe("exercise search", () => {
  it("understands gym shorthand", () => {
    assert.ok(matchesQuery("Incline Dumbbell Press Chest Press Dumbbell", "incline db"));
    assert.ok(matchesQuery("Romanian Deadlift Hinge Barbell", "rdl"));
    assert.ok(matchesQuery("Single-Arm Cable Row Row Cable", "sa row"));
  });
  it("matches family and equipment words, in any order", () => {
    assert.ok(matchesQuery("Pec Deck Chest Fly Machine", "fly machine"));
    assert.ok(!matchesQuery("Pec Deck Chest Fly Machine", "cable fly"));
  });
});
