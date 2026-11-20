"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { DumbbellIcon, PlusIcon } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { Button, EmptyState, Page, PageHeader, Pill, Toggle } from "@/components/ui";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { useSettings } from "@/components/AppShell";
import { effectiveUnit } from "@/db/actions";
import { db } from "@/db/db";
import {
  addExerciseToSession,
  discardSession,
  finishSession,
  reopenSession,
  setSessionBodyweight,
  templateDiffers,
} from "@/db/sessions";
import type { ExerciseVariation } from "@/db/types";
import { fmtNum, parseNum } from "@/lib/format";
import { displayWeight } from "@/lib/units";
import { formatLocalDate, localDate } from "@/lib/util";

// A logged workout lives at /workout/?id=<sessionId>, in progress or not.
export default function WorkoutPageWrapper() {
  return (
    <Suspense fallback={<Page><div className="mt-16 h-48 animate-pulse rounded-3xl bg-surface" /></Page>}>
      <WorkoutPage />
    </Suspense>
  );
}

function WorkoutPage() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const settings = useSettings();

  const session = useLiveQuery(async () => (await db.workoutSessions.get(id)) ?? null, [id]);
  const exercises = useLiveQuery(() => db.workoutExercises.where("sessionId").equals(id).sortBy("order"), [id]);
  const variations = useLiveQuery(async () => {
    const list = await db.exerciseVariations.bulkGet((exercises ?? []).map((e) => e.variationId));
    return new Map(list.filter((v): v is ExerciseVariation => !!v).map((v) => [v.id, v]));
  }, [exercises]);
  const gym = useLiveQuery(async () => (session ? db.gyms.get(session.gymId) : undefined), [session?.gymId]);
  const progress = useLiveQuery(async () => {
    const ids = (exercises ?? []).map((e) => e.id);
    const sets = await db.exerciseSets.where("workoutExerciseId").anyOf(ids).toArray();
    const main = sets.filter((s) => s.type !== "drop");
    return { done: main.filter((s) => s.completed).length, total: main.length };
  }, [exercises]);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Open the first unfinished exercise when the workout loads.
  useEffect(() => {
    if (expanded !== null || !exercises?.length) return;
    (async () => {
      for (const e of exercises) {
        const open = await db.exerciseSets
          .where("workoutExerciseId")
          .equals(e.id)
          .filter((s) => s.type !== "drop" && !s.completed)
          .count();
        if (open) return setExpanded(e.id);
      }
      setExpanded("");
    })();
  }, [exercises, expanded]);

  if (session === undefined || exercises === undefined || variations === undefined) {
    return (
      <Page>
        <div className="mt-16 h-48 animate-pulse rounded-3xl bg-surface" />
      </Page>
    );
  }
  if (session === null) {
    return (
      <Page>
        <PageHeader back={{ href: "/", label: "Home" }} title="Workout" />
        <EmptyState icon={<DumbbellIcon size={28} />} title="Workout not found" body="It may have been discarded." />
      </Page>
    );
  }

  const inProgress = session.status === "in_progress";
  const needsBodyweight = exercises.some((e) => variations.get(e.variationId)?.loadType === "bodyweight");
  const unit = settings ? effectiveUnit(gym, settings) : (session.bodyweightUnit ?? "lb");
  const shownBodyweight = displayWeight(session.bodyweight, session.bodyweightUnit ?? unit, unit);

  function openNext(afterId: string) {
    const i = exercises!.findIndex((e) => e.id === afterId);
    setExpanded(exercises![i + 1]?.id ?? "");
  }

  return (
    <Page>
      <PageHeader
        back={{ href: "/", label: "Home" }}
        eyebrow={`${formatLocalDate(session.date, { weekday: "short", month: "short", day: "numeric" })}${gym ? ` · ${gym.name}` : ""}`}
        title={session.name}
        action={
          inProgress ? (
            <Button onClick={() => setFinishing(true)}>Finish</Button>
          ) : (
            <Pill>Done</Pill>
          )
        }
      />

      {progress && progress.total > 0 && (
        <div className="-mt-2 mb-4 px-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-muted">
            {progress.done} of {progress.total} sets done
          </p>
        </div>
      )}

      {needsBodyweight && (
        <label className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
          <span>
            <span className="block text-[16px] font-medium">Bodyweight today</span>
            <span className="block text-[13px] text-muted">Used for pull-ups, dips and other bodyweight lifts</span>
          </span>
          <span className="flex items-center gap-1.5">
            <input
              key={unit}
              inputMode="decimal"
              aria-label="Bodyweight"
              defaultValue={fmtNum(shownBodyweight)}
              placeholder="–"
              onChange={(e) => setSessionBodyweight(session.id, parseNum(e.target.value) ?? undefined, unit)}
              className="tnum h-11 w-20 rounded-xl bg-surface-2 text-center text-[18px] font-semibold outline-none ring-accent focus:ring-2"
            />
            <span className="text-[15px] text-muted">{unit}</span>
          </span>
        </label>
      )}

      {exercises.length === 0 ? (
        <EmptyState
          icon={<DumbbellIcon size={28} />}
          title="No exercises yet"
          body="Add the exercises you're doing today. Numbers fill in from your last session with the same setup."
        />
      ) : (
        <div className="space-y-3">
          {exercises.map((e, i) => {
            const v = variations.get(e.variationId);
            if (!v) return null;
            return (
              <ExerciseCard
                key={e.id}
                exercise={e}
                variation={v}
                sessionGymId={session.gymId}
                index={i}
                count={exercises.length}
                expanded={expanded === e.id}
                onToggle={() => setExpanded((x) => (x === e.id ? "" : e.id))}
                onDone={() => openNext(e.id)}
              />
            );
          })}
        </div>
      )}

      <Button variant="secondary" size="lg" className="mt-4 w-full" onClick={() => setPicking(true)}>
        <PlusIcon size={20} /> Add exercise
      </Button>

      <div className="mt-8 space-y-3">
        {inProgress ? (
          <Button size="lg" className="w-full" onClick={() => setFinishing(true)}>
            Finish workout
          </Button>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => reopenSession(session.id)}>
            Mark as in progress
          </Button>
        )}
        {confirmDiscard ? (
          <div className="rounded-2xl bg-danger/8 p-4">
            <p className="text-[15px]">Delete this workout and every set in it? This can’t be undone.</p>
            <div className="mt-3 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDiscard(false)}>
                Keep
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  await discardSession(session.id);
                  router.replace("/");
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="plain" className="w-full text-danger" onClick={() => setConfirmDiscard(true)}>
            {inProgress ? "Discard workout" : "Delete workout"}
          </Button>
        )}
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onAdd={async (ids) => {
            await addExerciseToSession(session.id, ids);
            setPicking(false);
            const added = await db.workoutExercises.where("sessionId").equals(session.id).sortBy("order");
            setExpanded(added[added.length - ids.length]?.id ?? null);
          }}
          alreadyAdded={exercises.map((e) => e.variationId)}
        />
      )}

      {finishing && (
        <FinishSheet
          sessionId={session.id}
          dayName={session.name}
          done={progress?.done ?? 0}
          total={progress?.total ?? 0}
          isToday={session.date === localDate()}
          onClose={() => setFinishing(false)}
          onFinished={() => router.replace("/")}
        />
      )}
    </Page>
  );
}

function FinishSheet({
  sessionId,
  dayName,
  done,
  total,
  isToday,
  onClose,
  onFinished,
}: {
  sessionId: string;
  dayName: string;
  done: number;
  total: number;
  isToday: boolean;
  onClose: () => void;
  onFinished: () => void;
}) {
  const differs = useLiveQuery(() => templateDiffers(sessionId), [sessionId]);
  const [updateTemplate, setUpdateTemplate] = useState(false);
  const unfinished = total - done;

  return (
    <Sheet
      open
      onClose={onClose}
      title="Finish workout"
      footer={
        <Button
          size="lg"
          className="w-full"
          onClick={async () => {
            await finishSession(sessionId, { updateTemplate: differs && updateTemplate });
            onFinished();
          }}
        >
          Finish
        </Button>
      }
    >
      <p className="text-[17px]">
        {done} set{done === 1 ? "" : "s"} done{isToday ? " today" : ""}.
      </p>
      {unfinished > 0 && (
        <p className="mt-1 text-[15px] text-muted">
          {unfinished} planned set{unfinished === 1 ? " isn't" : "s aren't"} checked off. They'll stay in the log but won't count.
        </p>
      )}
      {differs && (
        <div className="mt-5">
          <Toggle
            label={`Save changes to ${dayName}`}
            hint="Use today's exercises and sets next time. Off keeps the saved list."
            checked={updateTemplate}
            onChange={setUpdateTemplate}
          />
        </div>
      )}
    </Sheet>
  );
}
