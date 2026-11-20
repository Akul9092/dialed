"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Pill, Row } from "@/components/ui";
import { db } from "@/db/db";
import type { WorkoutSession } from "@/db/types";
import { formatLocalDate } from "@/lib/util";

/** One workout in a history list: date, name, gym and sets done. */
export function SessionRow({ session }: { session: WorkoutSession }) {
  const info = useLiveQuery(async () => {
    const [gym, exercises] = await Promise.all([
      db.gyms.get(session.gymId),
      db.workoutExercises.where("sessionId").equals(session.id).primaryKeys(),
    ]);
    const done = await db.exerciseSets
      .where("workoutExerciseId")
      .anyOf(exercises)
      .filter((s) => s.completed && s.type !== "drop")
      .count();
    return { gym: gym?.name, exercises: exercises.length, done };
  }, [session.id, session.gymId, session.updatedAt]);

  return (
    <Row
      href={`/workout/?id=${session.id}`}
      title={session.name}
      subtitle={[
        formatLocalDate(session.date, { weekday: "short", month: "short", day: "numeric" }),
        info?.gym,
        info ? `${info.done} set${info.done === 1 ? "" : "s"}` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      trailing={session.status === "in_progress" ? <Pill>In progress</Pill> : undefined}
      chevron
    />
  );
}
