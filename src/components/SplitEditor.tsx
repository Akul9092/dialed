"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button, Field, Segmented, inputClass } from "@/components/ui";
import { updateSplit } from "@/db/actions";
import type { SplitDay, SplitDayKind, TrainingSplit } from "@/db/types";
import { DAY_NAME_SUGGESTIONS, SPLIT_TEMPLATES, daysFromTemplate, kindForName, patternLabel } from "@/lib/splits";
import { cx, newId } from "@/lib/util";
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, MinusCircleIcon, PlusIcon } from "./icons";

const KIND_LABEL: Record<SplitDayKind, string> = { workout: "Workout", rest: "Rest day", cardio: "Cardio" };

const exerciseLabel = (n: number) => (n === 0 ? "Add exercises" : `${n} exercise${n === 1 ? "" : "s"}`);

export function DayBadge({ n, kind, size = "md" }: { n: number; kind: SplitDayKind; size?: "md" | "lg" }) {
  return (
    <span
      className={cx(
        "tnum flex shrink-0 items-center justify-center rounded-full font-bold",
        size === "lg" ? "h-12 w-12 text-[19px]" : "h-9 w-9 text-[15px]",
        kind === "workout" && "bg-accent text-accent-ink",
        kind === "rest" && "bg-surface-2 text-muted",
        kind === "cardio" && "bg-[#30B0C7]/18 text-[#1f8fa3] dark:text-[#40C8E0]",
      )}
    >
      {n}
    </span>
  );
}

type DayEditing = { mode: "new" } | { mode: "edit"; index: number } | null;

export function SplitEditor({
  split,
  planId,
  exerciseCounts = {},
}: {
  split: TrainingSplit;
  planId: string;
  /** Exercises in each workout day's list, keyed by day id. */
  exerciseCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const [reordering, setReordering] = useState(false);
  const [editing, setEditing] = useState<DayEditing>(null);
  const [picking, setPicking] = useState(false);
  const days = split.days;

  const save = (next: SplitDay[]) => updateSplit(planId, { days: next });

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= days.length) return;
    const next = [...days];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };

  const remove = (i: number) => save(days.filter((_, k) => k !== i));

  return (
    <section className="mb-7">
      <div className="mb-2 flex items-center justify-between px-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          Split · {days.length} day{days.length === 1 ? "" : "s"}
        </h2>
        {days.length > 1 && (
          <button
            type="button"
            onClick={() => setReordering((r) => !r)}
            className="min-h-9 px-1 text-[15px] font-semibold text-accent active:opacity-60"
          >
            {reordering ? "Done" : "Reorder"}
          </button>
        )}
      </div>

      {days.length > 0 ? (
        <ol className="overflow-hidden rounded-2xl bg-surface [&>*+*]:border-t [&>*+*]:border-line">
          {days.map((d, i) => (
            <li key={d.id} className="flex min-h-15 items-center gap-3 px-4">
              {reordering && (
                <button
                  type="button"
                  aria-label={`Remove ${d.name}`}
                  onClick={() => remove(i)}
                  className="-ml-1 flex h-11 w-9 items-center justify-center text-danger active:opacity-60"
                >
                  <MinusCircleIcon size={22} />
                </button>
              )}
              <button
                type="button"
                disabled={reordering}
                onClick={() =>
                  d.kind === "workout"
                    ? router.push(`/train/day/?plan=${planId}&day=${d.id}`)
                    : setEditing({ mode: "edit", index: i })
                }
                className="flex min-h-15 flex-1 items-center gap-3 text-left disabled:cursor-default"
              >
                <DayBadge n={i + 1} kind={d.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-medium">{d.name}</span>
                  <span className="block text-[13px] text-muted">
                    Day {i + 1} · {d.kind === "workout" ? exerciseLabel(exerciseCounts[d.id] ?? 0) : KIND_LABEL[d.kind]}
                  </span>
                </span>
                {!reordering && d.kind === "workout" && <ChevronRightIcon size={18} className="shrink-0 text-muted/70" />}
              </button>
              {reordering && (
                <span className="flex">
                  <button
                    type="button"
                    aria-label={`Move ${d.name} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="flex h-11 w-10 items-center justify-center text-muted active:text-ink disabled:opacity-25"
                  >
                    <ChevronUpIcon size={22} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${d.name} down`}
                    disabled={i === days.length - 1}
                    onClick={() => move(i, 1)}
                    className="flex h-11 w-10 items-center justify-center text-muted active:text-ink disabled:opacity-25"
                  >
                    <ChevronDownIcon size={22} />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-2xl bg-surface px-5 py-6 text-center">
          <p className="text-[16px] font-medium">No days yet</p>
          <p className="mt-1 text-[14px] text-muted">Add days one by one or start from a template.</p>
        </div>
      )}

      <div className="mt-3 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => setEditing({ mode: "new" })}>
          <PlusIcon size={18} /> Add day
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setPicking(true)}>
          Use a template
        </Button>
      </div>

      {editing && (
        <DaySheet
          key={editing.mode === "edit" ? days[editing.index]?.id : "new"}
          day={editing.mode === "edit" ? days[editing.index] : undefined}
          dayNumber={editing.mode === "edit" ? editing.index + 1 : days.length + 1}
          onClose={() => setEditing(null)}
          onSave={(day) => {
            if (editing.mode === "edit") save(days.map((d, k) => (k === editing.index ? day : d)));
            else save([...days, day]);
            setEditing(null);
          }}
          onDelete={
            editing.mode === "edit"
              ? () => {
                  remove(editing.index);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}

      {picking && (
        <TemplateSheet
          hasDays={days.length > 0}
          onClose={() => setPicking(false)}
          onPick={(next) => {
            save(next);
            setPicking(false);
            setReordering(false);
          }}
        />
      )}
    </section>
  );
}

export function DaySheet({
  day,
  dayNumber,
  onClose,
  onSave,
  onDelete,
}: {
  day?: SplitDay;
  dayNumber: number;
  onClose: () => void;
  onSave: (d: SplitDay) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(day?.name ?? "");
  const [kind, setKind] = useState<SplitDayKind>(day?.kind ?? "workout");
  const canSave = name.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    onSave({ ...(day ?? { id: newId() }), name: name.trim(), kind });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={day ? `Edit day ${dayNumber}` : `Add day ${dayNumber}`}
      footer={
        <Button size="lg" className="w-full" disabled={!canSave} onClick={submit}>
          {day ? "Save" : "Add day"}
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {DAY_NAME_SUGGESTIONS.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => {
              setName(s.name);
              setKind(s.kind);
            }}
            className={cx(
              "min-h-10 rounded-full px-4 text-[15px] font-medium transition active:scale-95",
              name === s.name ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Name" hint="Pick one above or type your own, like Push A or Muay Thai.">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!day) setKind(kindForName(e.target.value));
            }}
            placeholder="Push"
            maxLength={40}
            enterKeyHint="done"
          />
        </Field>
        <Field label="Type">
          <Segmented<SplitDayKind>
            ariaLabel="Day type"
            value={kind}
            onChange={setKind}
            options={[
              { value: "workout", label: "Workout" },
              { value: "rest", label: "Rest" },
              { value: "cardio", label: "Cardio" },
            ]}
          />
        </Field>
      </form>
      {onDelete && (
        <Button variant="danger" className="mt-7 w-full" onClick={onDelete}>
          Remove day
        </Button>
      )}
    </Sheet>
  );
}

function TemplateSheet({
  hasDays,
  onClose,
  onPick,
}: {
  hasDays: boolean;
  onClose: () => void;
  onPick: (days: SplitDay[]) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const choose = (id: string) => {
    const t = SPLIT_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    if (hasDays && pending !== id) {
      setPending(id);
      return;
    }
    onPick(daysFromTemplate(t));
  };

  return (
    <Sheet open onClose={onClose} title="Split templates">
      <ul className="space-y-2.5 pb-2">
        {SPLIT_TEMPLATES.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => choose(t.id)}
              className={cx(
                "w-full rounded-2xl px-4 py-3.5 text-left transition active:scale-[0.99]",
                pending === t.id ? "bg-accent text-accent-ink" : "bg-surface-2",
              )}
            >
              <span className="block text-[17px] font-semibold">{t.name}</span>
              <span className={cx("mt-0.5 block text-[14px]", pending === t.id ? "opacity-90" : "text-muted")}>
                {pending === t.id
                  ? "Tap again to replace your current days"
                  : t.days.length
                    ? patternLabel(t.days.map((name) => ({ name })))
                    : "Start from scratch"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
