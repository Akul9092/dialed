"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useState } from "react";
import { useSettings } from "@/components/AppShell";
import { PinIcon, PlusIcon } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { Button, Field, IconButton, List, Page, PageHeader, Pill, Row, Section, Segmented, inputClass } from "@/components/ui";
import { createGym, deleteGym, effectiveUnit, updateGym, type GymInput } from "@/db/actions";
import { db } from "@/db/db";
import type { AppSettings, Gym, WeightUnit } from "@/db/types";

type Editing = { mode: "new" } | { mode: "edit"; gym: Gym } | null;
type UnitChoice = "default" | WeightUnit;

export default function GymsPage() {
  const settings = useSettings();
  const gyms = useLiveQuery(() => db.gyms.orderBy("name").toArray(), []);
  const [editing, setEditing] = useState<Editing>(null);
  const close = useCallback(() => setEditing(null), []);

  // Built-in "Anywhere" always sits at the bottom.
  const sorted = gyms ? [...gyms].sort((a, b) => Number(!!a.isBuiltIn) - Number(!!b.isBuiltIn)) : undefined;

  return (
    <Page>
      <PageHeader
        back={{ href: "/settings/", label: "Settings" }}
        title="Gyms"
        action={
          <IconButton label="New gym" onClick={() => setEditing({ mode: "new" })}>
            <PlusIcon size={22} />
          </IconButton>
        }
      />

      {!sorted || !settings ? (
        <div className="h-32 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <Section footer="Machines and cables belong to a gym. Dumbbell, barbell and bodyweight history is shared across gyms. Named machines arrive with workout logging.">
          <List>
            {sorted.map((g) => (
              <Row
                key={g.id}
                leading={
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
                    <PinIcon size={20} />
                  </span>
                }
                title={g.name}
                subtitle={g.description}
                trailing={
                  <span className="flex items-center gap-2">
                    {g.isBuiltIn && <Pill tone="muted">Built-in</Pill>}
                    <span className="tnum">{effectiveUnit(g, settings)}</span>
                  </span>
                }
                chevron
                onClick={() => setEditing({ mode: "edit", gym: g })}
              />
            ))}
          </List>
        </Section>
      )}

      {editing && settings && (
        <GymSheet
          key={editing.mode === "edit" ? editing.gym.id : "new"}
          editing={editing}
          settings={settings}
          onClose={close}
        />
      )}
    </Page>
  );
}

function GymSheet({
  editing,
  settings,
  onClose,
}: {
  editing: NonNullable<Editing>;
  settings: AppSettings;
  onClose: () => void;
}) {
  const initial = editing.mode === "edit" ? editing.gym : undefined;
  const builtIn = !!initial?.isBuiltIn;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [unit, setUnit] = useState<UnitChoice>(initial?.defaultUnit ?? "default");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canSave = name.trim().length > 0;

  async function save() {
    if (!canSave) return;
    const input: GymInput = {
      name,
      description,
      defaultUnit: unit === "default" ? undefined : unit,
    };
    if (initial) await updateGym(initial.id, input);
    else await createGym(input);
    onClose();
  }

  async function remove() {
    if (!initial) return;
    try {
      await deleteGym(initial.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this gym.");
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={initial ? "Edit gym" : "New gym"}
      footer={
        <Button size="lg" className="w-full" disabled={!canSave} onClick={save}>
          {initial ? "Save" : "Add gym"}
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
        <Field label="Name" hint={builtIn ? "The built-in location can't be renamed." : undefined}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cornell Gym"
            autoFocus={!initial}
            disabled={builtIn}
            maxLength={60}
            enterKeyHint="done"
          />
        </Field>
        <Field label="Description" hint="Optional">
          <input
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Helen Newman, second floor"
            maxLength={120}
          />
        </Field>
        <Field label="Weight unit">
          <Segmented<UnitChoice>
            ariaLabel="Weight unit for this gym"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "default", label: `Default (${settings.defaultUnit})` },
              { value: "lb", label: "lb" },
              { value: "kg", label: "kg" },
            ]}
          />
        </Field>
      </form>

      {initial && !builtIn && (
        <div className="mt-7">
          {confirmDelete ? (
            <div className="rounded-2xl bg-danger/8 p-4">
              <p className="text-[15px]">Delete “{initial.name}”? This can’t be undone.</p>
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
              Delete gym
            </Button>
          )}
          {error && <p className="mt-3 px-1 text-[13px] text-danger">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}
