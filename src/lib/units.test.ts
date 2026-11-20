import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { convertWeight, displayWeight } from "./units";

describe("units", () => {
  it("converts both ways and rounds only for display", () => {
    assert.equal(displayWeight(45, "lb", "kg"), 20.4);
    assert.equal(displayWeight(20, "kg", "lb"), 44.1);
    assert.equal(displayWeight(45, "lb", "lb"), 45);
    assert.equal(displayWeight(null, "lb", "kg"), null);
    assert.ok(Math.abs(convertWeight(convertWeight(100, "kg", "lb"), "lb", "kg") - 100) < 1e-9);
  });
});
