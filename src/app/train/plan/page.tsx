"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { useSettings } from "@/components/AppShell";
import { PlanSheet } from "@/components/PlanSheet";
import { SplitEditor } from "@/components/SplitEditor";
import { TodaySuggestion } from "@/components/TodayCard";
import { Button, EmptyState, Field, Page, PageHeader, Pill, Section, Segmented, inputClass } from "@/components/ui";
import { CalendarIcon } from "@/components/icons";
import { setActivePlan, updateSplit } from "@/db/actions";
import { db } from "@/db/db";
import type { ProgressionMode } from "@/db/types";
import { suggestToday } from "@/lib/schedule";
import { formatLocalDate, localDate } from "@/lib/util";

// Plans live at /train/plan/?id=<uuid>. A query parameter (instead of a
// dynamic route) keeps the app a fully static export.
export default function PlanPageWrapper() {
  return (
    <Suspense fallback={<Page><div className="mt-16 h-48 animate-pulse rounded-3xl bg-surface" /></Page>}>
      <PlanPage />
    </Suspense>
  );
}

function PlanPage() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const settings = useSettings();
  const plan = useLiveQuery(async () => (await db.trainingPlans.get(id)) ?? null, [id]);
  const split = useLiveQuery(async () => (await db.trainingSplits.where("planId").equals(id).first()) ?? null, [id]);
  const sessions = useLiveQuery(() => db.workoutSessions.where("planId").equals(id).toArray(), [id]);
  const [editing, setEditing] = useState(false);
  const close = useCallback(() => setEditing(false), []);

  if (plan === undefined || split === undefined || sessions === undefined || !settings) {
    return (
      <Page>
        <div className="mt-16 h-48 animate-pulse rounded-3xl bg-surface" />
      </Page>
    );
  }

  if (plan === null) {
    return (
      <Page>
        <PageHeader back={{ href: "/train/", label: "Train" }} title="Plan" />
        <EmptyState icon={<CalendarIcon size={28} />} title="Plan not found" body="It may have been deleted." />
      </Page>
    );
  }

  const isActive = settings.activePlanId === plan.id;
  const today = localDate();
  const effectiveSplit = split ?? { mode: "sequence" as const, anchorDate: today, days: [] };
  const suggestion = suggestToday(effectiveSplit, sessions, today);
  const dates =
    plan.startDate || plan.endDate
      ? `${plan.startDate ? formatLocalDate(plan.startDate) : "Open"} to ${plan.endDate ? formatLocalDate(plan.endDate) : "ongoing"}`
      : undefined;

  return (
    <Page>
      <PageHeader
        back={{ href: "/train/", label: "Train" }}
        title={plan.name}
        action={
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        }
      />

      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2 px-1">
        {isActive ? (
          <Pill>Active plan</Pill>
        ) : (
          <button
            type="button"
            onClick={() => setActivePlan(plan.id)}
            className="rounded-full bg-surface-2 px-3 py-1 text-[13px] font-semibold text-accent active:opacity-60"
          >
            Make active
          </button>
        )}
        {dates && <span className="text-[14px] text-muted">{dates}</span>}
      </div>
      {plan.description && <p className="-mt-2 mb-5 px-1 text-[15px] text-muted">{plan.description}</p>}

      <Section title="Today">
        <div className="rounded-2xl bg-surface p-4">
          <TodaySuggestion suggestion={suggestion} totalDays={effectiveSplit.days.length} />
        </div>
      </Section>

      {split && <SplitEditor split={split} planId={plan.id} />}

      <Section
        title="Schedule"
        footer={
          effectiveSplit.mode === "sequence"
            ? "Each workout follows the last one you did. A day off counts as a Rest day, so missing a day never skips a workout."
            : "Days follow the calendar. Pick the date that counts as Day 1 and the cycle repeats from there."
        }
      >
        <div className="space-y-4 rounded-2xl bg-surface p-4">
          <Segmented<ProgressionMode>
            ariaLabel="Schedule mode"
            value={effectiveSplit.mode}
            onChange={(mode) => updateSplit(plan.id, { mode })}
            options={[
              { value: "sequence", label: "In order" },
              { value: "calendar", label: "By calendar" },
            ]}
          />
          {effectiveSplit.mode === "calendar" && (
            <Field label="Day 1 falls on">
              <input
                type="date"
                className={inputClass}
                value={effectiveSplit.anchorDate}
                onChange={(e) => e.target.value && updateSplit(plan.id, { anchorDate: e.target.value })}
              />
            </Field>
          )}
        </div>
      </Section>

      <p className="px-4 text-[13px] leading-snug text-muted">
        Next build: attach a workout template (the exercises) to each day and start logging.
      </p>

      {editing && (
        <PlanSheet plan={plan} isActive={isActive} onClose={close} onDeleted={() => router.replace("/train/")} />
      )}
    </Page>
  );
}
