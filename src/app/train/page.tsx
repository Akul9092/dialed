"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState } from "react";
import { useSettings } from "@/components/AppShell";
import { CalendarIcon, PlusIcon } from "@/components/icons";
import { PlanSheet } from "@/components/PlanSheet";
import { Button, EmptyState, IconButton, List, Page, PageHeader, Pill, Row, Section } from "@/components/ui";
import { db } from "@/db/db";
import type { TrainingPlan } from "@/db/types";
import { patternLabel } from "@/lib/splits";
import { formatLocalDate } from "@/lib/util";

function dateRange(p: TrainingPlan): string | undefined {
  if (!p.startDate && !p.endDate) return undefined;
  return `${p.startDate ? formatLocalDate(p.startDate) : "Open"} to ${p.endDate ? formatLocalDate(p.endDate) : "ongoing"}`;
}

export default function TrainPage() {
  const settings = useSettings();
  const plans = useLiveQuery(() => db.trainingPlans.orderBy("createdAt").reverse().toArray(), []);
  const splits = useLiveQuery(() => db.trainingSplits.toArray(), []);
  const [creating, setCreating] = useState(false);
  const close = useCallback(() => setCreating(false), []);

  // Home links here with ?new=1 to open the new-plan sheet directly.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new")) {
      setCreating(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const activeId = settings?.activePlanId;
  const sorted = plans
    ? [...plans].sort((a, b) => Number(b.id === activeId) - Number(a.id === activeId))
    : undefined;
  const splitFor = (planId: string) => splits?.find((s) => s.planId === planId);

  return (
    <Page>
      <PageHeader
        title="Train"
        action={
          <IconButton label="New plan" onClick={() => setCreating(true)}>
            <PlusIcon size={22} />
          </IconButton>
        }
      />

      {sorted === undefined ? (
        <div className="h-32 animate-pulse rounded-2xl bg-surface" />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon size={28} />}
          title="No plans yet"
          body="Create a plan for this training block, then set up its split, like Push, Pull, Legs, Rest."
          action={<Button onClick={() => setCreating(true)}>New plan</Button>}
        />
      ) : (
        <Section title="Training plans">
          <List>
            {sorted.map((p) => {
              const split = splitFor(p.id);
              const pattern = split?.days.length ? patternLabel(split.days) : "No split yet";
              return (
                <Row
                  key={p.id}
                  title={p.name}
                  subtitle={dateRange(p) ? `${pattern} · ${dateRange(p)}` : pattern}
                  trailing={p.id === activeId ? <Pill>Active</Pill> : undefined}
                  chevron
                  href={`/train/plan/?id=${p.id}`}
                />
              );
            })}
          </List>
        </Section>
      )}

      {creating && <PlanSheet onClose={close} />}
    </Page>
  );
}
