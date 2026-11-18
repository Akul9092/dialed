import type { SplitDay, SplitDayKind } from "@/db/types";
import { newId } from "./util";

type DaySpec = string; // "Rest" means a rest day, anything else is a workout

export interface SplitTemplate {
  id: string;
  name: string;
  days: DaySpec[];
}

/** Starting points from spec 5.2. Every template is editable after picking it. */
export const SPLIT_TEMPLATES: SplitTemplate[] = [
  { id: "ppl", name: "Push / Pull / Legs", days: ["Push", "Pull", "Legs", "Rest"] },
  { id: "ppl2", name: "Push / Pull / Legs ×2", days: ["Push", "Pull", "Legs", "Push", "Pull", "Legs", "Rest"] },
  { id: "pplul", name: "Push / Pull / Legs / Upper / Lower", days: ["Push", "Pull", "Legs", "Upper", "Lower"] },
  { id: "pplul-rest", name: "PPL + Upper / Lower with rest", days: ["Push", "Pull", "Legs", "Rest", "Upper", "Lower", "Rest"] },
  { id: "ul", name: "Upper / Lower", days: ["Upper", "Lower", "Rest", "Upper", "Lower", "Rest", "Rest"] },
  { id: "fb", name: "Full Body", days: ["Full Body", "Rest", "Full Body", "Rest", "Full Body", "Rest", "Rest"] },
  { id: "bro", name: "Bro Split", days: ["Chest", "Back", "Legs", "Shoulders", "Arms", "Rest", "Rest"] },
  { id: "custom", name: "Custom", days: [] },
];

/** One-tap names offered when adding a day. */
export const DAY_NAME_SUGGESTIONS: { name: string; kind: SplitDayKind }[] = [
  { name: "Push", kind: "workout" },
  { name: "Pull", kind: "workout" },
  { name: "Legs", kind: "workout" },
  { name: "Upper", kind: "workout" },
  { name: "Lower", kind: "workout" },
  { name: "Full Body", kind: "workout" },
  { name: "Arms", kind: "workout" },
  { name: "Run", kind: "cardio" },
  { name: "Rest", kind: "rest" },
];

export function kindForName(name: string): SplitDayKind {
  const n = name.trim().toLowerCase();
  if (n === "rest") return "rest";
  if (["run", "cardio", "cycling", "walk", "swim"].includes(n)) return "cardio";
  return "workout";
}

export function daysFromTemplate(t: SplitTemplate): SplitDay[] {
  return t.days.map((name) => ({ id: newId(), name, kind: kindForName(name) }));
}

export function patternLabel(days: Pick<SplitDay, "name">[]): string {
  return days.map((d) => d.name).join(" · ");
}
