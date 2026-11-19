"use client";

import { useState } from "react";
import { ExerciseFormSheet } from "./ExerciseFormSheet";
import { ExerciseList } from "./ExerciseList";
import { CheckIcon, PlusIcon } from "./icons";
import { Sheet } from "./Sheet";
import { Button } from "./ui";
import { cx } from "@/lib/util";

/** Pick one or more exercises, or create a custom one inline. */
export function ExercisePicker({
  onClose,
  onAdd,
  alreadyAdded = [],
}: {
  onClose: () => void;
  onAdd: (variationIds: string[]) => void;
  alreadyAdded?: string[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<string | null>(null);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title="Add exercises"
        footer={
          <Button size="lg" className="w-full" disabled={selected.length === 0} onClick={() => onAdd(selected)}>
            {selected.length === 0
              ? "Select exercises"
              : `Add ${selected.length} exercise${selected.length === 1 ? "" : "s"}`}
          </Button>
        }
      >
        <ExerciseList
          query={query}
          setQuery={setQuery}
          onSelect={(v) => toggle(v.id)}
          renderTrailing={(v) => {
            const on = selected.includes(v.id);
            return (
              <span className="flex items-center gap-2">
                {alreadyAdded.includes(v.id) && !on && <span className="text-[12px] text-muted">Added</span>}
                <span
                  className={cx(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 transition",
                    on ? "border-accent bg-accent text-accent-ink" : "border-muted/40",
                  )}
                >
                  {on && (
                    <span className="tnum text-[13px] font-bold">{selected.indexOf(v.id) + 1}</span>
                  )}
                </span>
              </span>
            );
          }}
          footer={(q, exact) => (
            <button
              type="button"
              onClick={() => setCreating(q)}
              className="mb-2 flex min-h-13 w-full items-center gap-3 rounded-2xl bg-accent/10 px-4 text-left text-accent active:opacity-70"
            >
              <PlusIcon size={20} />
              <span className="text-[16px] font-medium">
                {q && !exact ? `Create “${q}”` : "Create a custom exercise"}
              </span>
            </button>
          )}
        />
        {selected.length > 0 && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[13px] text-muted">
            <CheckIcon size={14} /> Numbers show the order they'll be added in.
          </p>
        )}
      </Sheet>

      {creating !== null && (
        <ExerciseFormSheet
          initialName={creating}
          onClose={() => setCreating(null)}
          onSaved={(id) => {
            setSelected((s) => [...s, id]);
            setQuery("");
          }}
        />
      )}
    </>
  );
}
