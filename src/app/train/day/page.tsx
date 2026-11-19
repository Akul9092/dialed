"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { ChevronDownIcon, ChevronUpIcon, DumbbellIcon, MinusCircleIcon, PlusIcon } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { DaySheet } from "@/components/SplitEditor";
import { TemplateExerciseSheet } from "@/components/TemplateExerciseSheet";
import { Button, EmptyState, Field, Page, PageHeader, inputClass } from "@/components/ui";
import { updateSplit } from "@/db/actions";
import { db } from "@/db/db";
import {
  addExercisesToTemplate,
  copyTemplateToDay,
  ensureDayTemplate,
  moveTemplateExercise,
  removeTemplateExercise,
  renameTemplate,
  setDayTemplate,
} from "@/db/templates";
import type { ExerciseVariation, SplitDay, TemplateExercise, WorkoutTemplate } from "@/db/types";
import { EQUIPMENT_LABEL, weightLabel } from "@/lib/exerciseLibrary";
import { setSummary } from "@/lib/sets";

// A workout day lives at /train/day/?plan=<planId>&day=<dayId>.
export default function DayPageWrapper() {
  return (
    <Suspense fallback={<Page><div className="mt-16 h-48 animate-pulse rounded-3xl bg-surface" /></Page>}>
      <DayPage />
    </Suspense>
  );
}

function DayPage() {
  const params = useSearchParams();
  const planId = params.get("plan") ?? "";
  const dayId = params.get("day") ?? "";
  const router = useRouter();

  const data = useLiveQuery(async () => {
    const [plan, split, templates] = await Promise.all([
      db.trainingPlans.get(planId),
      db.trainingSplits.where("planId").equals(planId).first(),
      db.workoutTemplates.where("planId").equals(planId).toArray(),
    ]);
    const counts: Record<string, number> = {};
    const all = await db.templateExercises.where("templateId").anyOf(templates.map((t) => t.id)).toArray();
    all.forEach((r) => (counts[r.templateId] = (counts[r.templateId] ?? 0) + 1));
    return { plan: plan ?? null, split: split ?? null, templates, counts };
  }, [planId]);

  const day = data?.split?.days.find((d) => d.id === dayId);
  const dayIndex = data?.split?.days.findIndex((d) => d.id === dayId) ?? -1;
  const templateId = day?.templateId && data?.templates.some((t) => t.id === day.templateId) ? day.templateId : undefined;

  const rows = useLiveQuery(
    async () => (templateId ? db.templateExercises.where("templateId").equals(templateId).sortBy("order") : []),
    [templateId],
  );
  const variations = useLiveQuery(async () => {
    const list = await db.exerciseVariations.bulkGet((rows ?? []).map((r) => r.variationId));
    return new Map(list.filter((v): v is ExerciseVariation => !!v).map((v) => [v.id, v]));
  }, [rows]);

  const [picking, setPicking] = useState(false);
  const [editingDay, setEditingDay] = useState(false);
  const [choosingList, setChoosingList] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [editingRow, setEditingRow] = useState<TemplateExercise | null>(null);

  if (!data || rows === undefined || variations === undefined) {
    return (
      <Page>
        <div className="mt-16 h-48 animate-pulse rounded-3xl bg-surface" />
      </Page>
    );
  }

  const planHref = `/train/plan/?id=${planId}`;
  if (!data.plan || !data.split || !day) {
    return (
      <Page>
        <PageHeader back={{ href: data.plan ? planHref : "/train/", label: data.plan?.name ?? "Train" }} title="Day" />
        <EmptyState icon={<DumbbellIcon size={28} />} title="Day not found" body="It may have been removed from the split." />
      </Page>
    );
  }

  const split = data.split;
  const template = data.templates.find((t) => t.id === templateId);
  const sharedWith = split.days
    .map((d, i) => ({ d, n: i + 1 }))
    .filter(({ d }) => d.id !== dayId && templateId && d.templateId === templateId);
  const otherLists = data.templates.filter((t) => t.id !== templateId && (data.counts[t.id] ?? 0) > 0);

  async function addExercises(ids: string[]) {
    const id = templateId ?? (await ensureDayTemplate(planId, dayId));
    await addExercisesToTemplate(id, ids);
    setPicking(false);
  }

  const saveDays = (days: SplitDay[]) => updateSplit(planId, { days });

  return (
    <Page>
      <PageHeader
        back={{ href: planHref, label: data.plan.name }}
        eyebrow={`Day ${dayIndex + 1}`}
        title={day.name}
        action={
          <Button variant="secondary" onClick={() => setEditingDay(true)}>
            Edit
          </Button>
        }
      />

      {day.kind !== "workout" ? (
        <EmptyState
          icon={<DumbbellIcon size={28} />}
          title={day.kind === "rest" ? "Rest day" : "Cardio day"}
          body="Exercise lists are for workout days. Change the type with Edit to add exercises."
        />
      ) : (
        <>
          {(sharedWith.length > 0 || otherLists.length > 0 || (template && template.name !== day.name)) && (
            <button
              type="button"
              onClick={() => setChoosingList(true)}
              className="-mt-2 mb-5 flex w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left active:bg-surface-2"
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-muted">Exercise list</span>
                <span className="block truncate text-[16px]">
                  {template ? template.name : "Not set up yet"}
                  {sharedWith.length > 0 && (
                    <span className="text-muted"> · also on Day {sharedWith.map((s) => s.n).join(", ")}</span>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-[15px] text-accent">Change</span>
            </button>
          )}

          <div className="mb-2 flex items-center justify-between px-4">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              Exercises{rows.length ? ` · ${rows.length}` : ""}
            </h2>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setReordering((r) => !r)}
                className="min-h-9 px-1 text-[15px] font-semibold text-accent active:opacity-60"
              >
                {reordering ? "Done" : "Reorder"}
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="rounded-2xl bg-surface px-5 py-7 text-center">
              <p className="text-[17px] font-semibold">No exercises yet</p>
              <p className="mt-1 text-[14px] text-muted">
                Add the movements you do on {day.name} day, in the order you do them.
              </p>
            </div>
          ) : (
            <ol className="overflow-hidden rounded-2xl bg-surface [&>*+*]:border-t [&>*+*]:border-line">
              {rows.map((r, i) => {
                const v = variations.get(r.variationId);
                if (!v) return null;
                const detail = [
                  EQUIPMENT_LABEL[v.equipmentType],
                  r.weightInterpretation !== "total" ? weightLabel(r.weightInterpretation).toLowerCase() : null,
                  setSummary(r.defaultSets),
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={r.id} className="flex items-center gap-3 px-4">
                    {reordering && (
                      <button
                        type="button"
                        aria-label={`Remove ${v.name}`}
                        onClick={() => removeTemplateExercise(r.id)}
                        className="-ml-1 flex h-11 w-9 items-center justify-center text-danger active:opacity-60"
                      >
                        <MinusCircleIcon size={22} />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={reordering}
                      onClick={() => setEditingRow(r)}
                      className="flex min-h-16 flex-1 items-center gap-3 py-2 text-left"
                    >
                      <span className="tnum w-5 shrink-0 text-center text-[15px] font-semibold text-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] font-medium">{v.name}</span>
                        <span className="block truncate text-[13px] text-muted">{detail}</span>
                      </span>
                    </button>
                    {reordering && (
                      <span className="flex">
                        <button
                          type="button"
                          aria-label={`Move ${v.name} up`}
                          disabled={i === 0}
                          onClick={() => moveTemplateExercise(r.templateId, r.id, -1)}
                          className="flex h-11 w-10 items-center justify-center text-muted active:text-ink disabled:opacity-25"
                        >
                          <ChevronUpIcon size={22} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${v.name} down`}
                          disabled={i === rows.length - 1}
                          onClick={() => moveTemplateExercise(r.templateId, r.id, 1)}
                          className="flex h-11 w-10 items-center justify-center text-muted active:text-ink disabled:opacity-25"
                        >
                          <ChevronDownIcon size={22} />
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          <Button size="lg" className="mt-4 w-full" onClick={() => setPicking(true)}>
            <PlusIcon size={20} /> Add exercises
          </Button>
          {rows.length === 0 && otherLists.length > 0 && (
            <Button variant="plain" className="mt-2 w-full" onClick={() => setChoosingList(true)}>
              Reuse another day's exercises
            </Button>
          )}
          {sharedWith.length > 0 && (
            <p className="mt-3 px-4 text-[13px] text-muted">
              Changes here also apply to Day {sharedWith.map((s) => s.n).join(", ")}, since they share this list.
            </p>
          )}
        </>
      )}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onAdd={addExercises}
          alreadyAdded={rows.map((r) => r.variationId)}
        />
      )}

      {editingRow && variations.get(editingRow.variationId) && (
        <TemplateExerciseSheet
          key={editingRow.id}
          row={editingRow}
          variation={variations.get(editingRow.variationId)!}
          onClose={() => setEditingRow(null)}
        />
      )}

      {editingDay && (
        <DaySheet
          day={day}
          dayNumber={dayIndex + 1}
          onClose={() => setEditingDay(false)}
          onSave={(next) => {
            saveDays(split.days.map((d) => (d.id === dayId ? next : d)));
            setEditingDay(false);
          }}
          onDelete={() => {
            saveDays(split.days.filter((d) => d.id !== dayId));
            router.replace(planHref);
          }}
        />
      )}

      {choosingList && (
        <ListChooser
          planId={planId}
          day={day}
          days={split.days}
          template={template}
          templates={data.templates}
          counts={data.counts}
          onClose={() => setChoosingList(false)}
        />
      )}
    </Page>
  );
}

/** Rename this day's list, share another day's list, or copy one. */
function ListChooser({
  planId,
  day,
  days,
  template,
  templates,
  counts,
  onClose,
}: {
  planId: string;
  day: SplitDay;
  days: SplitDay[];
  template?: WorkoutTemplate;
  templates: WorkoutTemplate[];
  counts: Record<string, number>;
  onClose: () => void;
}) {
  const [name, setName] = useState(template?.name ?? day.name);
  const others = templates.filter((t) => t.id !== template?.id);
  const usedOn = (id: string) =>
    days
      .map((d, i) => (d.templateId === id ? `Day ${i + 1}` : null))
      .filter(Boolean)
      .join(", ");

  return (
    <Sheet open onClose={onClose} title="Exercise list">
      {template && (
        <form
          className="mb-6"
          onSubmit={async (e) => {
            e.preventDefault();
            await renameTemplate(template.id, name);
            onClose();
          }}
        >
          <Field label="List name" hint="Useful for A/B days, like Push A and Push B.">
            <div className="flex gap-2">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
              <Button type="submit" variant="secondary" disabled={!name.trim() || name.trim() === template.name}>
                Save
              </Button>
            </div>
          </Field>
        </form>
      )}

      {others.length > 0 && (
        <>
          <h3 className="mb-1.5 px-1 text-[13px] font-semibold text-muted">Other lists in this plan</h3>
          <ul className="space-y-2.5">
            {others.map((t) => (
              <li key={t.id} className="rounded-2xl bg-surface-2 p-4">
                <p className="text-[17px] font-semibold">{t.name}</p>
                <p className="text-[13px] text-muted">
                  {counts[t.id] ?? 0} exercise{(counts[t.id] ?? 0) === 1 ? "" : "s"}
                  {usedOn(t.id) ? ` · ${usedOn(t.id)}` : " · not used by any day"}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={async () => {
                      await setDayTemplate(planId, day.id, t.id);
                      onClose();
                    }}
                  >
                    Share it
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={async () => {
                      await copyTemplateToDay(planId, day.id, t.id);
                      onClose();
                    }}
                  >
                    Copy it
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1 text-[13px] text-muted">
            Share keeps both days in sync. Copy gives this day its own list to change freely.
          </p>
        </>
      )}

      {template && (
        <Button
          variant="plain"
          className="mt-5 w-full"
          onClick={async () => {
            await setDayTemplate(planId, day.id, "new");
            onClose();
          }}
        >
          Start a new empty list
        </Button>
      )}
    </Sheet>
  );
}
