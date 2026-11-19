import type { SetType } from "@/db/types";

/** Spec 9.1: new exercises start with one warm-up and one working set. */
export const DEFAULT_SET_STRUCTURE: SetType[] = ["warmup", "working"];

/** Set types a template can plan. Drop sets are added while logging. */
export const PLANNABLE_SET_TYPES = ["warmup", "working"] as const;
export type PlannableSetType = (typeof PLANNABLE_SET_TYPES)[number];

export const SET_TYPE_LABEL: Record<SetType, { one: string; many: string }> = {
  warmup: { one: "warm-up", many: "warm-ups" },
  working: { one: "working", many: "working" },
  drop: { one: "drop", many: "drops" },
};

export type SetCounts = Record<PlannableSetType, number>;

export function countSets(sets: SetType[]): SetCounts {
  const counts: SetCounts = { warmup: 0, working: 0 };
  for (const s of sets) if (s in counts) counts[s as PlannableSetType]++;
  return counts;
}

/** Always ordered warm-ups, then working sets. */
export function setsFromCounts(counts: SetCounts): SetType[] {
  return PLANNABLE_SET_TYPES.flatMap((t) => Array<SetType>(Math.max(0, counts[t])).fill(t));
}

/** "1 warm-up · 3 working" */
export function setSummary(sets: SetType[]): string {
  const counts = countSets(sets);
  const parts = PLANNABLE_SET_TYPES.filter((t) => counts[t] > 0).map(
    (t) => `${counts[t]} ${counts[t] === 1 ? SET_TYPE_LABEL[t].one : SET_TYPE_LABEL[t].many}`,
  );
  return parts.length ? parts.join(" · ") : "No sets";
}
