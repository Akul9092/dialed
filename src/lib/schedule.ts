import type { LocalDate, SplitDay, TrainingSplit, WorkoutSession } from "@/db/types";

/**
 * Works out which split day is suggested for today (spec 5.3 and 20.3).
 *
 * Calendar mode: day index = days since the anchor date, wrapped around
 * the cycle. Day 1 falls on the anchor date.
 *
 * Sequence mode: the day after the last trained day. Any calendar day
 * without training uses up a Rest day in the split, so after
 * Push, Pull, Legs, Rest a day off after Legs counts as the Rest and the
 * next suggestion is Push. Training on a would-be rest day is offered as
 * an alternative.
 */

export type Suggestion =
  | { kind: "empty" }
  | { kind: "not_started"; startsOn: LocalDate }
  | {
      kind: "day";
      index: number;
      day: SplitDay;
      /** Already trained today on this day. */
      done: boolean;
      /** For rest days in sequence mode: the workout you'd do if you train anyway. */
      alternative?: { index: number; day: SplitDay };
    };

type SessionLike = Pick<WorkoutSession, "date" | "splitDayId">;

/** Whole days from a to b using calendar dates only (DST-safe). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const toUTC = (s: LocalDate) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

function nextNonRest(days: SplitDay[], from: number): { index: number; day: SplitDay } | undefined {
  for (let k = 0; k < days.length; k++) {
    const i = mod(from + k, days.length);
    if (days[i].kind !== "rest") return { index: i, day: days[i] };
  }
  return undefined;
}

export function suggestToday(
  split: Pick<TrainingSplit, "mode" | "anchorDate" | "days">,
  sessions: SessionLike[],
  today: LocalDate,
): Suggestion {
  const { days } = split;
  if (days.length === 0) return { kind: "empty" };

  const todaysSession = sessions.find((s) => s.date === today && s.splitDayId);
  if (todaysSession) {
    const i = days.findIndex((d) => d.id === todaysSession.splitDayId);
    if (i >= 0) return { kind: "day", index: i, day: days[i], done: true };
  }

  if (split.mode === "calendar") {
    const offset = daysBetween(split.anchorDate, today);
    if (offset < 0) return { kind: "not_started", startsOn: split.anchorDate };
    const i = mod(offset, days.length);
    return { kind: "day", index: i, day: days[i], done: false };
  }

  // Sequence mode: find the most recent trained day before today.
  const past = sessions
    .filter((s) => s.date < today && s.splitDayId && days.some((d) => d.id === s.splitDayId))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = past[0];

  let i = 0;
  if (last) {
    i = mod(days.findIndex((d) => d.id === last.splitDayId) + 1, days.length);
    // Days off since the last workout (not counting today) use up rest days.
    let daysOff = daysBetween(last.date, today) - 1;
    let guard = days.length;
    while (daysOff > 0 && days[i].kind === "rest" && guard-- > 0) {
      i = mod(i + 1, days.length);
      daysOff--;
    }
  }

  const day = days[i];
  const alternative = day.kind === "rest" ? nextNonRest(days, i + 1) : undefined;
  return { kind: "day", index: i, day, done: false, alternative };
}
