"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button, Field, Segmented, Toggle, inputClass } from "@/components/ui";
import { db } from "@/db/db";
import { createEquipment, lastSettingsFor, updateExerciseSetup } from "@/db/sessions";
import {
  GYM_SPECIFIC_EQUIPMENT,
  type EquipmentFieldDef,
  type ExerciseVariation,
  type FieldValue,
  type SettingsSnapshot,
  type UnilateralMode,
  type WeightInterpretation,
  type WorkoutExercise,
} from "@/db/types";
import { EQUIPMENT_LABEL, weightOptions } from "@/lib/exerciseLibrary";
import { fmtNum, parseNum } from "@/lib/format";
import { cx } from "@/lib/util";

/**
 * Where and how an exercise was done: gym, machine, settings and weight
 * entry. Together these decide which history the numbers are compared to.
 */
export function SetupSheet({
  exercise,
  variation,
  started,
  onClose,
}: {
  exercise: WorkoutExercise;
  variation: ExerciseVariation;
  /** Some sets are already done, so the numbers won't be refilled. */
  started: boolean;
  onClose: () => void;
}) {
  const gymSpecific = GYM_SPECIFIC_EQUIPMENT.includes(variation.equipmentType);
  const [gymId, setGymId] = useState(exercise.gymId);
  const [equipmentId, setEquipmentId] = useState<string | undefined>(exercise.equipmentId);
  const [settings, setSettings] = useState<SettingsSnapshot>({ ...exercise.settings });
  const [wi, setWi] = useState<WeightInterpretation>(exercise.weightInterpretation);
  const [uni, setUni] = useState<UnilateralMode>(exercise.unilateralMode);
  const [newMachine, setNewMachine] = useState<string | null>(null);
  // After switching gyms (machines and cables), the gym's usual setup is
  // loaded on save unless a machine or setting is picked here first.
  const [touched, setTouched] = useState(false);
  const autoSetup = gymSpecific && gymId !== exercise.gymId && !touched;

  // Each machine keeps its own settings. Edits made here are remembered per
  // machine while the sheet is open, so switching A -> B -> A loses nothing.
  const draftKey = (g: string, m: string | undefined) => `${g}:${m ?? "none"}`;
  const drafts = useRef<Record<string, SettingsSnapshot>>({
    [draftKey(exercise.gymId, exercise.equipmentId)]: { ...exercise.settings },
  });
  const selection = useRef(draftKey(exercise.gymId, exercise.equipmentId));

  async function selectMachine(next: string | undefined) {
    drafts.current[draftKey(gymId, equipmentId)] = settings;
    const key = draftKey(gymId, next);
    selection.current = key;
    setTouched(true);
    setEquipmentId(next);
    if (drafts.current[key]) {
      setSettings({ ...drafts.current[key] });
      return;
    }
    setSettings({});
    const remembered = await lastSettingsFor(variation.id, next, gymId, exercise.sessionId);
    if (selection.current === key) setSettings(remembered ?? {});
  }

  const gyms = useLiveQuery(() => db.gyms.orderBy("name").toArray(), []);
  const machines = useLiveQuery(
    () => db.equipment.where("gymId").equals(gymId).filter((e) => e.type === variation.equipmentType).sortBy("name"),
    [gymId, variation.equipmentType],
  );
  const fields = useLiveQuery(
    () =>
      db.equipmentFieldDefs
        .filter((f) => f.equipmentType === variation.equipmentType || (!!equipmentId && f.equipmentId === equipmentId))
        .sortBy("order"),
    [variation.equipmentType, equipmentId],
  );
  const options = weightOptions(variation.equipmentType);

  const setField = (id: string, v: FieldValue | undefined) => {
    setTouched(true);
    setSettings((s) => {
      const next = { ...s };
      if (v === undefined || v === "") delete next[id];
      else next[id] = v;
      return next;
    });
  };

  async function addMachine() {
    const name = newMachine?.trim();
    if (!name) return;
    const id = await createEquipment(gymId, name, variation.equipmentType);
    await selectMachine(id);
    setNewMachine(null);
  }

  async function save() {
    await updateExerciseSetup(exercise.id, {
      gymId,
      equipmentId: autoSetup ? undefined : (equipmentId ?? null),
      settings: autoSetup ? undefined : settings,
      weightInterpretation: wi,
      unilateralMode: uni,
    });
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Setup"
      footer={
        <Button size="lg" className="w-full" onClick={save}>
          Save setup
        </Button>
      }
    >
      <p className="-mt-1 mb-5 px-1 text-[14px] text-muted">
        {variation.name} · {EQUIPMENT_LABEL[variation.equipmentType]}.{" "}
        {started
          ? "Sets already done keep their numbers."
          : "Numbers refill from the last time you used this exact setup."}
      </p>

      <div className="space-y-5">
        <div>
          <span className="mb-1.5 block px-1 text-[13px] font-semibold text-muted">Gym</span>
          <div className="flex flex-wrap gap-2">
            {gyms?.map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={g.id === gymId}
                onClick={() => {
                  drafts.current[draftKey(gymId, equipmentId)] = settings;
                  setGymId(g.id);
                  setTouched(false);
                  if (!gymSpecific) return;
                  selection.current = draftKey(g.id, g.id === exercise.gymId ? exercise.equipmentId : undefined);
                  setEquipmentId(g.id === exercise.gymId ? exercise.equipmentId : undefined);
                  setSettings(g.id === exercise.gymId ? { ...exercise.settings } : {});
                }}
                className={cx(
                  "min-h-10 rounded-full px-4 text-[15px] font-medium transition active:scale-95",
                  g.id === gymId ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink",
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
          {!gymSpecific && (
            <p className="mt-1.5 px-1 text-[13px] text-muted">
              {EQUIPMENT_LABEL[variation.equipmentType]} history is shared across gyms.
            </p>
          )}
        </div>

        {gymSpecific && (
          <div>
            <span className="mb-1.5 block px-1 text-[13px] font-semibold text-muted">Machine</span>
            <div className="flex flex-wrap gap-2">
              {machines?.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={m.id === equipmentId}
                  onClick={() => selectMachine(m.id === equipmentId ? undefined : m.id)}
                  className={cx(
                    "min-h-10 rounded-full px-4 text-[15px] font-medium transition active:scale-95",
                    m.id === equipmentId ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink",
                  )}
                >
                  {m.name}
                </button>
              ))}
              {newMachine === null && (
                <button
                  type="button"
                  onClick={() => setNewMachine("")}
                  className="min-h-10 rounded-full border border-dashed border-accent/60 px-4 text-[15px] font-medium text-accent"
                >
                  + New machine
                </button>
              )}
            </div>
            {newMachine !== null && (
              <form
                className="mt-2.5 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addMachine();
                }}
              >
                <input
                  className={inputClass}
                  value={newMachine}
                  onChange={(e) => setNewMachine(e.target.value)}
                  placeholder={variation.equipmentType === "cable" ? "Cable Station 1" : "Machine name"}
                  autoFocus
                  maxLength={40}
                  aria-label="New machine name"
                />
                <Button type="submit" variant="secondary" disabled={!newMachine.trim()}>
                  Add
                </Button>
              </form>
            )}
            {autoSetup ? (
              <p className="mt-1.5 px-1 text-[13px] text-muted">Your usual machine and settings at this gym load when you save.</p>
            ) : (
              newMachine === null && (
                <p className="mt-1.5 px-1 text-[13px] text-muted">
                  {equipmentId
                    ? "Each machine remembers its own settings and history."
                    : "Pick the machine so its history stays separate from others."}
                </p>
              )
            )}
          </div>
        )}

        {fields && fields.length > 0 && (
          <div>
            <span className="mb-1.5 block px-1 text-[13px] font-semibold text-muted">Settings</span>
            <div className="overflow-hidden rounded-2xl bg-surface-2 [&>*+*]:border-t [&>*+*]:border-line">
              {fields.map((f) => (
                <FieldInput key={f.id} def={f} value={settings[f.id]} onChange={(v) => setField(f.id, v)} />
              ))}
            </div>
            <p className="mt-1.5 px-1 text-[13px] text-muted">Leave a setting blank if it doesn't apply.</p>
          </div>
        )}

        {options.length > 1 && (
          <Field label="Weight entry">
            <Segmented<WeightInterpretation> ariaLabel="Weight entry" value={wi} onChange={setWi} options={options} />
          </Field>
        )}

        {variation.unilateral && (
          <Toggle
            label="Log left and right separately"
            hint="Otherwise one row per set, same for both sides"
            checked={uni === "split"}
            onChange={(on) => setUni(on ? "split" : "per_side")}
          />
        )}
      </div>
    </Sheet>
  );
}

function FieldInput({
  def,
  value,
  onChange,
}: {
  def: EquipmentFieldDef;
  value: FieldValue | undefined;
  onChange: (v: FieldValue | undefined) => void;
}) {
  const row = "flex min-h-14 items-center justify-between gap-3 px-4 py-2";
  if (def.valueType === "number") {
    const n = typeof value === "number" ? value : parseNum(String(value ?? ""));
    const step = def.step ?? 1;
    const btn =
      "flex h-10 w-10 items-center justify-center rounded-full bg-surface text-[22px] font-medium text-accent active:scale-90 dark:bg-[#3a3a3e]";
    return (
      <div className={row}>
        <span className="text-[16px]">{def.label}</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label={`Lower ${def.label}`} className={btn} onClick={() => onChange(n == null ? undefined : Math.max(0, n - step) || undefined)}>
            −
          </button>
          <input
            inputMode="decimal"
            aria-label={def.label}
            value={fmtNum(n)}
            placeholder="–"
            onChange={(e) => onChange(parseNum(e.target.value) ?? undefined)}
            className="tnum h-10 w-14 rounded-lg bg-surface text-center text-[17px] font-semibold outline-none ring-accent focus:ring-2 dark:bg-[#3a3a3e]"
          />
          <button type="button" aria-label={`Raise ${def.label}`} className={btn} onClick={() => onChange((n ?? 0) + step)}>
            +
          </button>
        </div>
      </div>
    );
  }
  if (def.valueType === "select") {
    return (
      <div className="px-4 py-3">
        <span className="mb-2 block text-[16px]">{def.label}</span>
        <div className="flex flex-wrap gap-2">
          {def.options?.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={value === o}
              onClick={() => onChange(value === o ? undefined : o)}
              className={cx(
                "min-h-9 rounded-full px-3.5 text-[14px] font-medium transition active:scale-95",
                value === o ? "bg-accent text-accent-ink" : "bg-surface text-ink dark:bg-[#3a3a3e]",
              )}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (def.valueType === "boolean") {
    return (
      <div className={row}>
        <span className="text-[16px]">{def.label}</span>
        <Segmented<"yes" | "no" | "unset">
          ariaLabel={def.label}
          value={value === true ? "yes" : value === false ? "no" : "unset"}
          onChange={(v) => onChange(v === "yes" ? true : v === "no" ? false : undefined)}
          options={[
            { value: "unset", label: "–" },
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
        />
      </div>
    );
  }
  return (
    <div className={row}>
      <span className="shrink-0 text-[16px]">{def.label}</span>
      <input
        aria-label={def.label}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder="–"
        className="h-10 min-w-0 flex-1 rounded-lg bg-surface px-3 text-right text-[16px] outline-none ring-accent focus:ring-2 dark:bg-[#3a3a3e]"
      />
    </div>
  );
}
