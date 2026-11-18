import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildConfigKey, normalizeValue } from "./configKey";

const cable = {
  variationId: "lateral-raise",
  equipmentType: "cable" as const,
  weightInterpretation: "total" as const,
  gymId: "cornell",
  equipmentId: "cable-1",
  settings: { height: 2, attachment: "Wrist Cuff" },
};

describe("buildConfigKey", () => {
  it("matches the same setup regardless of formatting and field order", () => {
    assert.equal(buildConfigKey(cable), buildConfigKey({ ...cable, settings: { attachment: " wrist  cuff", height: "2.0" } }));
  });
  it("treats a different setting as a different setup", () => {
    assert.notEqual(buildConfigKey(cable), buildConfigKey({ ...cable, settings: { ...cable.settings, height: 3 } }));
  });
  it("keeps cables gym-specific", () => {
    assert.notEqual(buildConfigKey(cable), buildConfigKey({ ...cable, gymId: "home" }));
  });
  it("shares dumbbell history across gyms", () => {
    const db = { ...cable, equipmentType: "dumbbell" as const, equipmentId: undefined, settings: { notch: 3 } };
    assert.equal(buildConfigKey(db), buildConfigKey({ ...db, gymId: "home" }));
  });
  it("separates weight interpretations", () => {
    assert.notEqual(buildConfigKey(cable), buildConfigKey({ ...cable, weightInterpretation: "per_side" }));
  });
  it("ignores empty values", () => {
    assert.equal(buildConfigKey({ ...cable, settings: { ...cable.settings, note: "" } }), buildConfigKey(cable));
  });
});

describe("normalizeValue", () => {
  it("normalizes booleans and numbers", () => {
    assert.equal(normalizeValue(true), "1");
    assert.equal(normalizeValue("02"), "2");
  });
});
