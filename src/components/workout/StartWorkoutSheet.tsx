"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button, Segmented, inputClass } from "@/components/ui";
import { createGym } from "@/db/actions";
import { db } from "@/db/db";
import { ANYWHERE_GYM_ID } from "@/db/seed";
import { lastSessionForDay, startSession, type StartSource } from "@/db/sessions";
import { SETTINGS_ID, type SplitDay } from "@/db/types";
import { suggestToday } from "@/lib/schedule";
import { cx, formatLocalDate, localDate } from "@/lib/util";

type Choice = { day: SplitDay; index: number; tag?: string };

/** Spec 6.1: pick the workout, the gym, and what to start from. */
export function StartWorkoutSheet({ planId, onClose }: { planId: string; onClose: () => void }) {
  const router = useRouter();
  const today = localDate();

  const data = useLiveQuery(async () => {
    const [split, sessions, gyms, settings, templates] = await Promise.all([
      db.trainingSplits.where("planId").equals(planId).first(),
      db.workoutSessions.where("planId").equals(planId).toArray(),
      db.gyms.orderBy("name").toArray(),
      db.settings.get(SETTINGS_ID),
      db.workoutTemplates.where("planId").equals(planId).toArray(),
    ]);
    const counts: Record<string, number> = {};
    const rows = await db.templateExercises.where("templateId").anyOf(templates.map((t) => t.id)).toArray();
    rows.forEach((r) => (counts[r.templateId] = (counts[r.templateId] ?? 0) + 1));
    return { split, sessions, gyms, settings, counts };
  }, [planId]);

  const [dayId, setDayId] = useState<string | null>(null);
  const [gymId, setGymId] = useState<string | null>(null);
  const [source, setSource] = useState<StartSource | null>(null);
  const [newGym, setNewGym] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const days = data?.split?.days ?? [];
  const workoutDays = days.map((day, index) => ({ day, index })).filter((c) => c.day.kind === "workout");

  // Suggested day first. In calendar mode, if the calendar and the order
  // disagree (a day was missed), offer both (spec 5.3).
  const choices: Choice[] = [];
  if (data?.split) {
    const s = suggestToday(data.split, data.sessions, today);
    const pick = s.kind === "day" ? (s.day.kind === "workout" ? s : s.alternative) : undefined;
    if (pick) {
      choices.push({
        day: pick.day,
        index: pick.index,
        tag: data.split.mode === "calendar" ? "On the calendar" : s.kind === "day" && s.day.kind === "rest" ? "Next up" : "Suggested",
      });
    }
    if (data.split.mode === "calendar") {
      const seq = suggestToday({ ...data.split, mode: "sequence" }, data.sessions, today);
      const next = seq.kind === "day" ? (seq.day.kind === "workout" ? seq : seq.alternative) : undefined;
      if (next && next.day.id !== pick?.day.id && data.sessions.length) {
        choices.push({ day: next.day, index: next.index, tag: "Next in order" });
      }
    }
    workoutDays.forEach((c) => {
      if (!choices.some((x) => x.day.id === c.day.id)) choices.push(c);
    });
  }

  const selected = choices.find((c) => c.day.id === dayId)?.day;
  const lastForDay = useLiveQuery(
    async () => (selected ? ((await lastSessionForDay(planId, selected.id, today)) ?? null) : null),
    [planId, selected?.id, today],
  );
  const templateCount = selected?.templateId ? (data?.counts[selected.templateId] ?? 0) : 0;

  // Defaults once data arrives: suggested day, last gym, template if it has exercises.
  useEffect(() => {
    if (!data) return;
    if (dayId === null && choices[0]) setDayId(choices[0].day.id);
    if (gymId === null) {
      const remembered = data.gyms.find((g) => g.id === data.settings?.lastGymId);
      setGymId((remembered ?? data.gyms.find((g) => !g.isBuiltIn) ?? data.gyms[0])?.id ?? ANYWHERE_GYM_ID);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const sourceOptions: { value: StartSource; label: string }[] = [
    ...(templateCount > 0 ? [{ value: "template" as const, label: "Saved list" }] : []),
    ...(lastForDay ? [{ value: "previous" as const, label: "Last session" }] : []),
    { value: "empty" as const, label: "Empty" },
  ];
  const effectiveSource = sourceOptions.some((o) => o.value === source) ? source! : sourceOptions[0].value;

  async function addGym() {
    if (!newGym?.trim()) return;
    setGymId(await createGym({ name: newGym }));
    setNewGym(null);
  }

  async function start() {
    if (!gymId) return;
    setStarting(true);
    const id = await startSession({
      planId,
      date: today,
      gymId,
      splitDayId: selected?.id,
      name: selected ? undefined : "Workout",
      source: selected ? effectiveSource : "empty",
    });
    onClose();
    router.push(`/workout/?id=${id}`);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Start workout"
      footer={
        <Button size="lg" className="w-full" disabled={!data || !gymId || starting} onClick={start}>
          {selected ? `Start ${selected.name}` : "Start workout"}
        </Button>
      }
    >
      {!data ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      ) : (
        <div className="space-y-6">
          <div>
            <span className="mb-1.5 block px-1 text-[13px] font-semibold text-muted">Workout</span>
            {choices.length ? (
              <ul className="space-y-2">
                {choices.map((c) => {
                  const count = c.day.templateId ? (data.counts[c.day.templateId] ?? 0) : 0;
                  const on = c.day.id === dayId;
                  return (
                    <li key={c.day.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setDayId(c.day.id)}
                        className={cx(
                          "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition active:scale-[0.99]",
                          on ? "bg-accent text-accent-ink" : "bg-surface-2",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[17px] font-semibold">{c.day.name}</span>
                          <span className={cx("block text-[13px]", on ? "opacity-85" : "text-muted")}>
                            Day {c.index + 1} · {count ? `${count} exercise${count === 1 ? "" : "s"}` : "No saved exercises"}
                          </span>
                        </span>
                        {c.tag && (
                          <span
                            className={cx(
                              "shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                              on ? "bg-white/25" : "bg-accent/15 text-accent",
                            )}
                          >
                            {c.tag}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-1 text-[15px] text-muted">This plan has no workout days yet. You can still start an empty workout.</p>
            )}
            {choices.some((c) => c.tag === "Next in order") && (
              <p className="mt-2 px-1 text-[13px] text-muted">
                You missed a day. Follow the calendar, or pick up where you left off.
              </p>
            )}
          </div>

          <div>
            <span className="mb-1.5 block px-1 text-[13px] font-semibold text-muted">Gym</span>
            <div className="flex flex-wrap gap-2">
              {data.gyms.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={g.id === gymId}
                  onClick={() => setGymId(g.id)}
                  className={cx(
                    "min-h-10 rounded-full px-4 text-[15px] font-medium transition active:scale-95",
                    g.id === gymId ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink",
                  )}
                >
                  {g.name}
                </button>
              ))}
              {newGym === null && (
                <button
                  type="button"
                  onClick={() => setNewGym("")}
                  className="min-h-10 rounded-full border border-dashed border-accent/60 px-4 text-[15px] font-medium text-accent"
                >
                  + New gym
                </button>
              )}
            </div>
            {newGym !== null && (
              <form
                className="mt-2.5 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addGym();
                }}
              >
                <input
                  className={inputClass}
                  value={newGym}
                  onChange={(e) => setNewGym(e.target.value)}
                  placeholder="Cornell Gym"
                  autoFocus
                  maxLength={60}
                  aria-label="New gym name"
                />
                <Button type="submit" variant="secondary" disabled={!newGym.trim()}>
                  Add
                </Button>
              </form>
            )}
          </div>

          {selected && sourceOptions.length > 1 && (
            <div>
              <span className="mb-1.5 block px-1 text-[13px] font-semibold text-muted">Start from</span>
              <Segmented<StartSource> ariaLabel="Start from" value={effectiveSource} onChange={setSource} options={sourceOptions} />
              <p className="mt-1.5 px-1 text-[13px] text-muted">
                {effectiveSource === "template"
                  ? `The exercises saved for ${selected.name}.`
                  : effectiveSource === "previous" && lastForDay
                    ? `The same exercises as ${formatLocalDate(lastForDay.date, { weekday: "short", month: "short", day: "numeric" })}.`
                    : "Add exercises as you go."}{" "}
                {effectiveSource !== "empty" && "Weights and reps fill in from last time."}
              </p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
