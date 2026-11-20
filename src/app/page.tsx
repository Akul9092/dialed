"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useSettings } from "@/components/AppShell";
import { DumbbellIcon, PinIcon } from "@/components/icons";
import { TodaySuggestion } from "@/components/TodayCard";
import { Button, ButtonLink, EmptyState, List, Page, PageHeader, Section } from "@/components/ui";
import { SessionRow } from "@/components/workout/SessionRow";
import { StartWorkoutSheet } from "@/components/workout/StartWorkoutSheet";
import { db } from "@/db/db";
import { discardSession, finishSession } from "@/db/sessions";
import { suggestToday } from "@/lib/schedule";
import { formatLocalDate, localDate } from "@/lib/util";

export default function HomePage() {
  const settings = useSettings();
  const todayDate = localDate();
  const planId = settings?.activePlanId ?? "";

  const activePlan = useLiveQuery(
    () => (settings?.activePlanId ? db.trainingPlans.get(settings.activePlanId) : undefined),
    [settings?.activePlanId],
  );
  const split = useLiveQuery(
    async () => (planId ? ((await db.trainingSplits.where("planId").equals(planId).first()) ?? null) : null),
    [planId],
  );
  const sessions = useLiveQuery(() => db.workoutSessions.where("planId").equals(planId).toArray(), [planId]);
  const all = useLiveQuery(async () => {
    const list = await db.workoutSessions.orderBy("date").reverse().toArray();
    return {
      today: list.find((s) => s.date === todayDate),
      stale: list.filter((s) => s.status === "in_progress" && s.date < todayDate),
      last: list.find((s) => s.status === "completed" && s.date < todayDate),
    };
  }, [todayDate]);
  const gymCount = useLiveQuery(() => db.gyms.count(), []);
  const [starting, setStarting] = useState(false);

  // Set after mount: the page is pre-rendered at build time, so a date
  // rendered on the server would never match the real day.
  const [todayLabel, setTodayLabel] = useState("\u00a0");
  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
  }, []);
  const loading =
    settings === undefined ||
    all === undefined ||
    (settings.activePlanId && (activePlan === undefined || split === undefined || sessions === undefined));
  const suggestion = split ? suggestToday(split, sessions ?? [], todayDate) : ({ kind: "empty" } as const);

  return (
    <Page>
      <PageHeader eyebrow={todayLabel} title="Today" />

      {all?.stale.map((s) => (
        <div key={s.id} className="mb-4 rounded-2xl bg-[#FF9500]/12 p-4">
          <p className="text-[15px]">
            <span className="font-semibold">{s.name}</span> from{" "}
            {formatLocalDate(s.date, { weekday: "long", month: "short", day: "numeric" })} was never finished.
          </p>
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={() => finishSession(s.id)}>
              Finish it
            </Button>
            <ButtonLink href={`/workout/?id=${s.id}`} variant="secondary" className="flex-1">
              Open
            </ButtonLink>
            <Button variant="danger" onClick={() => discardSession(s.id)}>
              Discard
            </Button>
          </div>
        </div>
      ))}

      {loading ? (
        <div className="h-48 animate-pulse rounded-3xl bg-surface" />
      ) : activePlan ? (
        <section className="rounded-3xl bg-surface p-5">
          <Link href={`/train/plan/?id=${activePlan.id}`} className="mb-5 flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold uppercase tracking-wide text-muted">Active plan</span>
              <span className="block truncate text-[17px] font-semibold">{activePlan.name}</span>
            </span>
            <span className="shrink-0 text-[15px] text-accent">View</span>
          </Link>
          <TodaySuggestion suggestion={suggestion} totalDays={split?.days.length ?? 0} />
          {suggestion.kind === "empty" && (
            <ButtonLink href={`/train/plan/?id=${activePlan.id}`} variant="secondary" className="mt-4 w-full">
              Set up your split
            </ButtonLink>
          )}
          {all?.today ? (
            <ButtonLink href={`/workout/?id=${all.today.id}`} size="lg" className="mt-6 w-full">
              {all.today.status === "in_progress" ? `Resume ${all.today.name}` : `View today's ${all.today.name}`}
            </ButtonLink>
          ) : (
            <Button size="lg" className="mt-6 w-full" onClick={() => setStarting(true)}>
              Start workout
            </Button>
          )}
        </section>
      ) : (
        <EmptyState
          icon={<DumbbellIcon size={28} />}
          title="Set up your first plan"
          body="A plan holds your split, templates and workout history, like Fall 2026 or Hypertrophy Phase."
          action={
            <ButtonLink href="/train/?new=1" size="lg">
              Create a plan
            </ButtonLink>
          }
        />
      )}

      {all?.last && (
        <div className="mt-6">
          <Section title="Last workout">
            <List>
              <SessionRow session={all.last} />
            </List>
          </Section>
        </div>
      )}

      <Link
        href="/settings/gyms/"
        className="mt-4 flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 active:bg-surface-2"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/12 text-accent">
          <PinIcon size={20} />
        </span>
        <span className="flex-1">
          <span className="block text-[16px] font-medium">Gyms</span>
          <span className="block text-[14px] text-muted">
            {gymCount === undefined ? " " : `${gymCount} location${gymCount === 1 ? "" : "s"}`}
          </span>
        </span>
        <span className="text-[15px] text-accent">Manage</span>
      </Link>

      {starting && activePlan && <StartWorkoutSheet planId={activePlan.id} onClose={() => setStarting(false)} />}
    </Page>
  );
}
