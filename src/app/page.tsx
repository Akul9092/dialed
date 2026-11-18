"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useSettings } from "@/components/AppShell";
import { DumbbellIcon, PinIcon } from "@/components/icons";
import { Button, ButtonLink, EmptyState, Page, PageHeader } from "@/components/ui";
import { db } from "@/db/db";
import { suggestToday } from "@/lib/schedule";
import { localDate } from "@/lib/util";
import { TodaySuggestion } from "@/components/TodayCard";

export default function HomePage() {
  const settings = useSettings();
  const activePlan = useLiveQuery(
    () => (settings?.activePlanId ? db.trainingPlans.get(settings.activePlanId) : undefined),
    [settings?.activePlanId],
  );
  const planId = settings?.activePlanId ?? "";
  const split = useLiveQuery(
    async () => (planId ? ((await db.trainingSplits.where("planId").equals(planId).first()) ?? null) : null),
    [planId],
  );
  const sessions = useLiveQuery(() => db.workoutSessions.where("planId").equals(planId).toArray(), [planId]);
  const gymCount = useLiveQuery(() => db.gyms.count(), []);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const loading =
    settings === undefined ||
    (settings.activePlanId && (activePlan === undefined || split === undefined || sessions === undefined));
  const suggestion = split ? suggestToday(split, sessions ?? [], localDate()) : ({ kind: "empty" } as const);

  return (
    <Page>
      <PageHeader eyebrow={today} title="Today" />

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
          <Button size="lg" className="mt-6 w-full" disabled>
            Start workout
          </Button>
          <p className="mt-2.5 text-center text-[13px] text-muted">Workout logging arrives in the next build.</p>
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
    </Page>
  );
}
