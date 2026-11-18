"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button, Field, inputClass } from "@/components/ui";
import { createPlan, deletePlan, setActivePlan, updatePlan, type PlanInput } from "@/db/actions";
import type { TrainingPlan } from "@/db/types";
import { SPLIT_TEMPLATES, daysFromTemplate, patternLabel } from "@/lib/splits";
import { cx } from "@/lib/util";

/**
 * Create or edit a plan. New plans also pick a starting split, then open
 * the plan page so the days can be adjusted right away.
 */
export function PlanSheet({
  plan,
  isActive = false,
  onClose,
  onDeleted,
}: {
  plan?: TrainingPlan;
  isActive?: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<PlanInput>({
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    startDate: plan?.startDate ?? "",
    endDate: plan?.endDate ?? "",
  });
  const [templateId, setTemplateId] = useState("ppl");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k: keyof PlanInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const datesInvalid = !!form.startDate && !!form.endDate && form.endDate < form.startDate;
  const canSave = form.name.trim().length > 0 && !datesInvalid;
  const template = SPLIT_TEMPLATES.find((t) => t.id === templateId) ?? SPLIT_TEMPLATES[0];

  async function save() {
    if (!canSave) return;
    if (plan) {
      await updatePlan(plan.id, form);
      onClose();
    } else {
      const id = await createPlan(form, daysFromTemplate(template));
      onClose();
      router.push(`/train/plan/?id=${id}`);
    }
  }

  async function remove() {
    if (!plan) return;
    try {
      await deletePlan(plan.id);
      onClose();
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this plan.");
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={plan ? "Edit plan" : "New plan"}
      footer={
        <Button size="lg" className="w-full" disabled={!canSave} onClick={save}>
          {plan ? "Save" : "Create plan"}
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Name">
          <input
            className={inputClass}
            value={form.name}
            onChange={set("name")}
            placeholder="Fall 2026"
            autoFocus={!plan}
            maxLength={60}
            enterKeyHint="done"
          />
        </Field>

        {!plan && (
          <div>
            <span className="mb-1.5 block px-1 text-[13px] font-semibold text-muted">Split</span>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {SPLIT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={t.id === templateId}
                  onClick={() => setTemplateId(t.id)}
                  className={cx(
                    "min-h-10 shrink-0 rounded-full px-4 text-[15px] font-medium transition active:scale-95",
                    t.id === templateId ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink",
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <p className="mt-2 px-1 text-[14px] text-muted">
              {template.days.length
                ? `${patternLabel(template.days.map((name) => ({ name })))}. You can edit the days next.`
                : "Start empty and add your own days next."}
            </p>
          </div>
        )}

        <Field label="Description" hint="Optional">
          <textarea
            className={`${inputClass} min-h-20 resize-none`}
            value={form.description}
            onChange={set("description")}
            placeholder="Hypertrophy focus, 5 days a week"
            maxLength={300}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" className={inputClass} value={form.startDate} onChange={set("startDate")} />
          </Field>
          <Field label="End date">
            <input type="date" className={inputClass} value={form.endDate} onChange={set("endDate")} />
          </Field>
        </div>
        {datesInvalid && <p className="px-1 text-[13px] text-danger">End date is before the start date.</p>}
      </form>

      {plan && (
        <div className="mt-7 space-y-3">
          {!isActive && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                await setActivePlan(plan.id);
                onClose();
              }}
            >
              Make active plan
            </Button>
          )}
          {confirmDelete ? (
            <div className="rounded-2xl bg-danger/8 p-4">
              <p className="text-[15px]">Delete “{plan.name}”? This can’t be undone.</p>
              <div className="mt-3 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
                <Button variant="danger" className="flex-1" onClick={remove}>
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
              Delete plan
            </Button>
          )}
          {error && <p className="px-1 text-[13px] text-danger">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}
