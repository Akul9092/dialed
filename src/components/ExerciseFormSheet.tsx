"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button, Field, Segmented, Toggle, inputClass } from "@/components/ui";
import { db } from "@/db/db";
import {
  createCustomExercise,
  deleteCustomExercise,
  exerciseUsage,
  updateCustomExercise,
  type CustomExerciseInput,
} from "@/db/templates";
import type { EquipmentType, ExerciseVariation, WeightInterpretation } from "@/db/types";
import { CUSTOM_EQUIPMENT, EQUIPMENT_LABEL, weightOptions } from "@/lib/exerciseLibrary";
import { cx } from "@/lib/util";

const NEW_FAMILY = "__new__";

/** Create or edit a custom exercise. */
export function ExerciseFormSheet({
  exercise,
  initialName = "",
  onClose,
  onSaved,
}: {
  exercise?: ExerciseVariation;
  initialName?: string;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const families = useLiveQuery(() => db.exerciseFamilies.orderBy("name").toArray(), []);
  const [name, setName] = useState(exercise?.name ?? initialName);
  const [equipment, setEquipment] = useState<EquipmentType>(exercise?.equipmentType ?? "machine");
  const [familyId, setFamilyId] = useState(exercise?.familyId ?? "");
  const [newFamily, setNewFamily] = useState("");
  const [wi, setWi] = useState<WeightInterpretation>(exercise?.defaultWeightInterpretation ?? "total");
  const [unilateral, setUnilateral] = useState(!!exercise?.unilateral);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (exercise) exerciseUsage(exercise.id).then((u) => setLogged(u.logged > 0));
  }, [exercise]);

  // Keep the weight entry mode valid for the chosen equipment.
  const options = weightOptions(equipment);
  useEffect(() => {
    if (!options.some((o) => o.value === wi)) setWi(options[0].value);
  }, [equipment]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = name.trim().length > 0 && (familyId !== NEW_FAMILY || newFamily.trim().length > 0);

  async function save() {
    if (!canSave) return;
    const input: CustomExerciseInput = {
      name,
      familyId: familyId === NEW_FAMILY ? undefined : familyId,
      newFamilyName: familyId === NEW_FAMILY ? newFamily : undefined,
      equipmentType: equipment,
      defaultWeightInterpretation: wi,
      unilateral,
    };
    try {
      if (exercise) {
        await updateCustomExercise(exercise.id, input);
        onSaved?.(exercise.id);
      } else {
        onSaved?.(await createCustomExercise(input));
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this exercise.");
    }
  }

  async function remove() {
    if (!exercise) return;
    try {
      await deleteCustomExercise(exercise.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this exercise.");
      setConfirmDelete(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={exercise ? "Edit exercise" : "New exercise"}
      footer={
        <Button size="lg" className="w-full" disabled={!canSave} onClick={save}>
          {exercise ? "Save" : "Create exercise"}
        </Button>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Name">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kneeling Cable Crunch"
            autoFocus={!exercise}
            maxLength={60}
            enterKeyHint="done"
          />
        </Field>

        <div>
          <span className="mb-1.5 block px-1 text-[13px] font-semibold text-muted">Equipment</span>
          <div className="flex flex-wrap gap-2">
            {CUSTOM_EQUIPMENT.map((eq) => (
              <button
                key={eq}
                type="button"
                disabled={logged}
                aria-pressed={equipment === eq}
                onClick={() => setEquipment(eq)}
                className={cx(
                  "min-h-10 rounded-full px-4 text-[15px] font-medium transition active:scale-95 disabled:opacity-50",
                  equipment === eq ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink",
                )}
              >
                {EQUIPMENT_LABEL[eq]}
              </button>
            ))}
          </div>
          {logged && (
            <p className="mt-1.5 px-1 text-[13px] text-muted">Equipment is locked because this exercise has logged history.</p>
          )}
        </div>

        <Field label="Family" hint="Groups related movements, like all chest presses.">
          <select className={inputClass} value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
            <option value="">None</option>
            {families?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value={NEW_FAMILY}>New family…</option>
          </select>
        </Field>
        {familyId === NEW_FAMILY && (
          <input
            className={inputClass}
            value={newFamily}
            onChange={(e) => setNewFamily(e.target.value)}
            placeholder="Family name"
            maxLength={40}
            aria-label="New family name"
          />
        )}

        {options.length > 1 && (
          <Field label="Weight entry">
            <Segmented<WeightInterpretation> ariaLabel="Weight entry" value={wi} onChange={setWi} options={options} />
          </Field>
        )}
        {equipment === "bodyweight" && (
          <p className="px-1 text-[13px] text-muted">You'll log your bodyweight once per workout plus any added weight.</p>
        )}

        <Toggle
          label="Single arm or leg"
          hint="Logged per side by default"
          checked={unilateral}
          onChange={setUnilateral}
        />
      </form>

      {error && <p className="mt-4 px-1 text-[13px] text-danger">{error}</p>}

      {exercise && (
        <div className="mt-7">
          {confirmDelete ? (
            <div className="rounded-2xl bg-danger/8 p-4">
              <p className="text-[15px]">Delete “{exercise.name}”?</p>
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
              Delete exercise
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}
