"use client";

import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button, Field, Segmented, Stepper } from "@/components/ui";
import { removeTemplateExercise, updateTemplateExercise } from "@/db/templates";
import type { ExerciseVariation, TemplateExercise, UnilateralMode, WeightInterpretation } from "@/db/types";
import { EQUIPMENT_LABEL, weightOptions } from "@/lib/exerciseLibrary";
import { countSets, setSummary, setsFromCounts, type SetCounts } from "@/lib/sets";

/** Planned sets and weight entry for one exercise in a day's list. */
export function TemplateExerciseSheet({
  row,
  variation,
  onClose,
}: {
  row: TemplateExercise;
  variation: ExerciseVariation;
  onClose: () => void;
}) {
  const [counts, setCounts] = useState<SetCounts>(countSets(row.defaultSets));
  const [wi, setWi] = useState<WeightInterpretation>(row.weightInterpretation);
  const [uni, setUni] = useState<UnilateralMode>(row.unilateralMode);
  const options = weightOptions(variation.equipmentType);
  const sets = setsFromCounts(counts);
  const set = (k: keyof SetCounts) => (v: number) => setCounts((c) => ({ ...c, [k]: v }));

  async function save() {
    await updateTemplateExercise(row.id, { defaultSets: sets, weightInterpretation: wi, unilateralMode: uni });
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={variation.name}
      footer={
        <Button size="lg" className="w-full" disabled={sets.length === 0} onClick={save}>
          Save
        </Button>
      }
    >
      <p className="-mt-1 mb-4 px-1 text-[14px] text-muted">
        {EQUIPMENT_LABEL[variation.equipmentType]} · {setSummary(sets)}
      </p>

      <h3 className="mb-1.5 px-1 text-[13px] font-semibold text-muted">Planned sets</h3>
      <div className="overflow-hidden rounded-2xl bg-surface-2 [&>*+*]:border-t [&>*+*]:border-line">
        <Stepper label="Warm-up" value={counts.warmup} onChange={set("warmup")} max={6} />
        <Stepper label="Working" value={counts.working} onChange={set("working")} max={10} />
      </div>
      <p className="mt-1.5 px-1 text-[13px] text-muted">
        Drop sets are added while you log. Once you've done this exercise, new workouts copy your last set structure.
      </p>

      {options.length > 1 && (
        <div className="mt-5">
          <Field label="Weight entry">
            <Segmented<WeightInterpretation> ariaLabel="Weight entry" value={wi} onChange={setWi} options={options} />
          </Field>
        </div>
      )}

      {variation.unilateral && (
        <div className="mt-5">
          <Field label="Logging" hint="Separate rows let you track left and right on their own.">
            <Segmented<UnilateralMode>
              ariaLabel="Unilateral logging"
              value={uni === "none" ? "per_side" : uni}
              onChange={setUni}
              options={[
                { value: "per_side", label: "Per side" },
                { value: "split", label: "Left and right" },
              ]}
            />
          </Field>
        </div>
      )}

      <Button
        variant="danger"
        className="mt-7 w-full"
        onClick={async () => {
          await removeTemplateExercise(row.id);
          onClose();
        }}
      >
        Remove from this day
      </Button>
    </Sheet>
  );
}
