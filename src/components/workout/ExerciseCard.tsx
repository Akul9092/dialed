"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { Button, Segmented } from "@/components/ui";
import { useSettings } from "@/components/AppShell";
import { effectiveUnit } from "@/db/actions";
import { db } from "@/db/db";
import {
  addDropSet,
  addSet,
  canComplete,
  deleteSet,
  moveExercise,
  previousPerformance,
  removeExercise,
  toggleSetComplete,
  updateSet,
} from "@/db/sessions";
import type { ExerciseSet, ExerciseVariation, WeightUnit, WorkoutExercise } from "@/db/types";
import { EQUIPMENT_LABEL } from "@/lib/exerciseLibrary";
import { fmtNum, fmtSet, parseNum, settingsSummary, weightSuffix } from "@/lib/format";
import { displayWeight } from "@/lib/units";
import { cx, formatLocalDate } from "@/lib/util";
import { SetupSheet } from "./SetupSheet";

type Props = {
  exercise: WorkoutExercise;
  variation: ExerciseVariation;
  sessionGymId: string;
  index: number;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  /** Called when every planned set has just been checked off. */
  onDone: () => void;
};

export function ExerciseCard({ exercise, variation, sessionGymId, index, count, expanded, onToggle, onDone }: Props) {
  const sets = useLiveQuery(
    () => db.exerciseSets.where("workoutExerciseId").equals(exercise.id).sortBy("order"),
    [exercise.id],
  );
  const prev = useLiveQuery(
    async () => (await previousPerformance(exercise.configKey, exercise.sessionId)) ?? null,
    [exercise.configKey, exercise.sessionId],
  );
  const setup = useLiveQuery(async () => {
    const [machine, gym, defs] = await Promise.all([
      exercise.equipmentId ? db.equipment.get(exercise.equipmentId) : undefined,
      db.gyms.get(exercise.gymId),
      db.equipmentFieldDefs
        .filter((f) => f.equipmentType === variation.equipmentType || f.equipmentId === exercise.equipmentId)
        .sortBy("order"),
    ]);
    return { machine, gym, summary: settingsSummary(exercise.settings, defs) };
  }, [exercise.equipmentId, exercise.gymId, exercise.settings, variation.equipmentType]);

  const [editingSetup, setEditingSetup] = useState(false);
  const [actionsFor, setActionsFor] = useState<ExerciseSet | null>(null);
  const [menu, setMenu] = useState(false);

  const main = sets?.filter((s) => s.type !== "drop") ?? [];
  const done = main.filter((s) => s.completed).length;
  const allDone = main.length > 0 && done === main.length;
  const isBodyweight = variation.loadType === "bodyweight";
  // Weights show in this gym's unit (its override, else the app default),
  // converted from whatever unit each set was logged in.
  const settings = useSettings();
  const unit: WeightUnit = settings && setup ? effectiveUnit(setup.gym, settings) : (sets?.[0]?.unit ?? "lb");
  const needsMachine =
    (variation.equipmentType === "cable" || variation.equipmentType === "machine") && !exercise.equipmentId;

  const setupLine = [
    exercise.gymId !== sessionGymId ? setup?.gym?.name : null,
    setup?.machine?.name,
    setup?.summary,
    weightSuffix(exercise.weightInterpretation),
    exercise.unilateralMode === "split" ? "left and right" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Working sets are numbered 1, 2, 3. In L/R mode a left/right pair shares a number.
  let n = 0;
  const labels = new Map<string, string>();
  sets?.forEach((s) => {
    if (s.type === "warmup") labels.set(s.id, "W");
    else if (s.type === "drop") labels.set(s.id, "D");
    else {
      if (s.side !== "right") n++;
      labels.set(s.id, String(n));
    }
  });

  async function complete(set: ExerciseSet) {
    const ok = await toggleSetComplete(set.id);
    if (!ok || set.completed) return;
    const after = main.map((s) => (s.id === set.id ? { ...s, completed: true } : s));
    if (after.length && after.every((s) => s.completed)) onDone();
  }

  return (
    <section
      className={cx("overflow-hidden rounded-3xl bg-surface transition", allDone && !expanded && "opacity-70")}
      aria-label={variation.name}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span
          className={cx(
            "tnum flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold",
            allDone ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted",
          )}
        >
          {allDone ? <CheckIcon size={20} strokeWidth={2.6} /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold">{variation.name}</span>
          <span className="block truncate text-[13px] text-muted">
            {sets ? `${done} of ${main.length} sets` : " "}
            {!expanded && setupLine ? ` · ${setupLine}` : ""}
          </span>
        </span>
        <ChevronDownIcon size={20} className={cx("shrink-0 text-muted transition", expanded && "rotate-180")} />
      </button>

      {expanded && sets && (
        <div className="px-3 pb-3">
          {(!isBodyweight || variation.unilateral) && (
            <button
              type="button"
              onClick={() => setEditingSetup(true)}
              className={cx(
                "mb-2 flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left",
                needsMachine ? "bg-accent/10" : "bg-surface-2",
              )}
            >
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold uppercase tracking-wide text-muted">
                  {EQUIPMENT_LABEL[variation.equipmentType]} setup
                </span>
                <span className={cx("block truncate text-[15px]", needsMachine && "text-accent")}>
                  {needsMachine ? "Pick the machine" : setupLine || "Default"}
                </span>
              </span>
              <span className="shrink-0 text-[15px] font-medium text-accent">Edit</span>
            </button>
          )}

          <p className="mb-2 px-1.5 text-[13px] text-muted">
            {prev
              ? `Last time, ${formatLocalDate(prev.date, { month: "short", day: "numeric" })}: ${prev.sets
                  .filter((s) => s.type !== "warmup")
                  .map((s) => {
                    const shown = fmtSet({ weight: displayWeight(s.weight, s.unit, unit), reps: s.reps });
                    return s.type === "drop" ? `drop ${shown}` : shown;
                  })
                  .join(", ")}`
              : prev === null
                ? "First time with this setup"
                : " "}
          </p>

          <div className="grid grid-cols-[2.75rem_1fr_1fr_2.75rem] items-center gap-2 px-1 pb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">
            <span className="text-center">Set</span>
            <span className="text-center">{isBodyweight ? `+${unit}` : unit}</span>
            <span className="text-center">Reps</span>
            <span />
          </div>
          <ol className="space-y-1.5">
            {sets.map((s) => (
              <SetRow
                key={s.id}
                set={s}
                unit={unit}
                label={labels.get(s.id) ?? ""}
                onComplete={() => complete(s)}
                onLabel={() => setActionsFor(s)}
              />
            ))}
          </ol>

          <div className="mt-2.5 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => addSet(exercise.id)}>
              <PlusIcon size={18} /> Add set
            </Button>
            <Button variant="secondary" aria-label="Exercise options" onClick={() => setMenu(true)}>
              •••
            </Button>
          </div>
        </div>
      )}

      {editingSetup && (
        <SetupSheet
          exercise={exercise}
          variation={variation}
          started={(sets ?? []).some((s) => s.completed)}
          onClose={() => setEditingSetup(false)}
        />
      )}

      {actionsFor && <SetActionsSheet set={actionsFor} onClose={() => setActionsFor(null)} />}

      {menu && (
        <Sheet open onClose={() => setMenu(false)} title={variation.name}>
          <div className="space-y-2.5 pb-2">
            <Button
              variant="secondary"
              className="w-full"
              disabled={index === 0}
              onClick={() => moveExercise(exercise.id, -1).then(() => setMenu(false))}
            >
              Move up
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={index === count - 1}
              onClick={() => moveExercise(exercise.id, 1).then(() => setMenu(false))}
            >
              Move down
            </Button>
            <Button
              variant="danger"
              className="w-full"
              onClick={() => removeExercise(exercise.id).then(() => setMenu(false))}
            >
              Remove from workout
            </Button>
          </div>
        </Sheet>
      )}
    </section>
  );
}

function SetRow({
  set,
  unit,
  label,
  onComplete,
  onLabel,
}: {
  set: ExerciseSet;
  /** Unit to show and enter weights in. */
  unit: WeightUnit;
  label: string;
  onComplete: () => void;
  onLabel: () => void;
}) {
  // Local text state keeps typing smooth. Every change is still saved right away.
  const shownWeight = displayWeight(set.weight, set.unit, unit);
  const [weight, setWeight] = useState(fmtNum(shownWeight));
  const [reps, setReps] = useState(fmtNum(set.reps));
  const repsRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  // Pick up changes made elsewhere (e.g. a drop set copying its parent).
  // Also re-converts when the unit setting changes.
  useEffect(() => setWeight((w) => (parseNum(w) === shownWeight ? w : fmtNum(shownWeight))), [shownWeight]);
  useEffect(() => setReps((r) => (parseNum(r) === set.reps ? r : fmtNum(set.reps))), [set.reps]);

  const ready = canComplete({ weight: parseNum(weight), reps: parseNum(reps) });
  const input =
    "tnum h-11 w-full min-w-0 rounded-xl text-center text-[18px] font-semibold outline-none ring-accent focus:ring-2";

  return (
    <li
      className={cx(
        "grid grid-cols-[2.75rem_1fr_1fr_2.75rem] items-center gap-2 rounded-2xl px-1 py-0.5 transition",
        set.completed && "bg-accent/10",
        set.type === "drop" && "pl-4",
      )}
    >
      <button
        type="button"
        onClick={onLabel}
        aria-label={`Set ${label} options`}
        className={cx(
          "relative flex h-11 items-center justify-center rounded-xl text-[15px] font-bold active:opacity-60",
          set.type === "warmup" ? "text-[#FF9500]" : set.type === "drop" ? "text-[#AF52DE]" : "text-ink",
        )}
      >
        {label}
        {set.side && (
          <span className="absolute bottom-0.5 right-0.5 text-[10px] font-semibold text-muted">
            {set.side === "left" ? "L" : "R"}
          </span>
        )}
      </button>
      <input
        ref={weightRef}
        inputMode="decimal"
        enterKeyHint="next"
        aria-label={`Set ${label} weight`}
        value={weight}
        placeholder="–"
        onChange={(e) => {
          setWeight(e.target.value);
          updateSet(set.id, { weight: parseNum(e.target.value), unit });
        }}
        onKeyDown={(e) => e.key === "Enter" && repsRef.current?.focus()}
        className={cx(input, set.completed ? "bg-transparent" : "bg-surface-2")}
      />
      <input
        ref={repsRef}
        inputMode="numeric"
        enterKeyHint="done"
        aria-label={`Set ${label} reps`}
        value={reps}
        placeholder="–"
        onChange={(e) => {
          setReps(e.target.value);
          updateSet(set.id, { reps: parseNum(e.target.value) });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && ready && !set.completed) {
            (e.target as HTMLInputElement).blur();
            onComplete();
          }
        }}
        className={cx(input, set.completed ? "bg-transparent" : "bg-surface-2")}
      />
      <button
        type="button"
        aria-label={set.completed ? `Undo set ${label}` : `Complete set ${label}`}
        aria-pressed={set.completed}
        onClick={() => {
          if (!set.completed && !ready) {
            (parseNum(weight) == null ? weightRef : repsRef).current?.focus();
            return;
          }
          onComplete();
        }}
        className={cx(
          "flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-90",
          set.completed
            ? "bg-accent text-accent-ink"
            : ready
              ? "bg-surface-2 text-accent"
              : "bg-surface-2 text-muted/40",
        )}
      >
        <CheckIcon size={22} strokeWidth={2.6} />
      </button>
    </li>
  );
}

function SetActionsSheet({ set, onClose }: { set: ExerciseSet; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title={set.type === "drop" ? "Drop set" : "Set"}>
      <div className="space-y-3 pb-2">
        {set.type !== "drop" && (
          <Segmented<"warmup" | "working">
            ariaLabel="Set type"
            value={set.type}
            onChange={(type) => updateSet(set.id, { type }).then(onClose)}
            options={[
              { value: "warmup", label: "Warm-up" },
              { value: "working", label: "Working" },
            ]}
          />
        )}
        {set.type === "working" && (
          <Button variant="secondary" className="w-full" onClick={() => addDropSet(set.id).then(onClose)}>
            Add drop set
          </Button>
        )}
        <Button variant="danger" className="w-full" onClick={() => deleteSet(set.id).then(onClose)}>
          Delete set
        </Button>
        <p className="px-1 text-[13px] text-muted">
          Warm-ups and drop sets never count toward PRs. Drop sets still add to volume.
        </p>
      </div>
    </Sheet>
  );
}
