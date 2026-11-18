import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SplitDay } from "@/db/types";
import { daysBetween, suggestToday, type Suggestion } from "./schedule";

const day = (name: string): SplitDay => ({ id: `id-${name}-${Math.random()}`, name, kind: name === "Rest" ? "rest" : "workout" });
const ppl = ["Push", "Pull", "Legs", "Rest"].map(day);
const [push, pull, legs] = ppl;

function label(s: Suggestion): string {
  if (s.kind !== "day") return s.kind;
  return s.day.name + (s.alternative ? ` (alt ${s.alternative.day.name})` : "") + (s.done ? " (done)" : "");
}

describe("sequence mode", () => {
  const seq = { mode: "sequence" as const, anchorDate: "2026-11-01", days: ppl };

  it("starts at Day 1 with no history", () => {
    assert.equal(label(suggestToday(seq, [], "2026-11-18")), "Push");
  });
  it("follows the last workout", () => {
    assert.equal(label(suggestToday(seq, [{ date: "2026-11-17", splitDayId: push.id }], "2026-11-18")), "Pull");
  });
  it("suggests Rest after Legs, with Push as the alternative", () => {
    assert.equal(label(suggestToday(seq, [{ date: "2026-11-17", splitDayId: legs.id }], "2026-11-18")), "Rest (alt Push)");
  });
  it("a day off uses up the Rest day", () => {
    assert.equal(label(suggestToday(seq, [{ date: "2026-11-16", splitDayId: legs.id }], "2026-11-18")), "Push");
  });
  it("missed days never skip a workout", () => {
    assert.equal(label(suggestToday(seq, [{ date: "2026-11-15", splitDayId: pull.id }], "2026-11-18")), "Legs");
  });
  it("shows today's day as done once trained", () => {
    assert.equal(label(suggestToday(seq, [{ date: "2026-11-18", splitDayId: pull.id }], "2026-11-18")), "Pull (done)");
  });
  it("one day off only uses up one of two rest days", () => {
    const days = ["Push", "Rest", "Rest"].map(day);
    const s = suggestToday({ ...seq, days }, [{ date: "2026-11-16", splitDayId: days[0].id }], "2026-11-18");
    assert.equal(label(s), "Rest (alt Push)");
  });
  it("handles an empty split", () => {
    assert.equal(label(suggestToday({ ...seq, days: [] }, [], "2026-11-18")), "empty");
  });
});

describe("calendar mode", () => {
  const cal = { mode: "calendar" as const, anchorDate: "2026-11-16", days: ppl };

  it("puts Day 1 on the anchor date and wraps around", () => {
    assert.equal(label(suggestToday(cal, [], "2026-11-16")), "Push");
    assert.equal(label(suggestToday(cal, [], "2026-11-18")), "Legs");
    assert.equal(label(suggestToday(cal, [], "2026-11-19")), "Rest");
    assert.equal(label(suggestToday(cal, [], "2026-11-20")), "Push");
  });
  it("reports a plan that hasn't started", () => {
    assert.equal(label(suggestToday(cal, [], "2026-11-10")), "not_started");
  });
});

describe("daysBetween", () => {
  it("is unaffected by daylight saving changes", () => {
    assert.equal(daysBetween("2026-03-08", "2026-03-09"), 1);
    assert.equal(daysBetween("2026-11-01", "2026-11-02"), 1);
  });
});
