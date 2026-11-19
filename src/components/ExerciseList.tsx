"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState, type ReactNode } from "react";
import { db } from "@/db/db";
import type { EquipmentType, ExerciseVariation } from "@/db/types";
import { EQUIPMENT_LABEL } from "@/lib/exerciseLibrary";
import { cx } from "@/lib/util";
import { SearchIcon } from "./icons";

const FILTERS: Array<EquipmentType | "all"> = ["all", "barbell", "dumbbell", "cable", "machine", "bodyweight"];

/** Gym shorthand, so "incline db" finds Incline Dumbbell Press. */
const ABBREVIATIONS: Record<string, string> = {
  db: "dumbbell",
  bb: "barbell",
  ez: "ez-bar",
  rdl: "romanian deadlift",
  ohp: "overhead press",
  bss: "bulgarian split squat",
  sa: "single-arm",
  ext: "extension",
  ham: "leg curl",
  quad: "leg extension",
  tri: "triceps",
  bi: "curl",
  delt: "delt",
  pec: "pec",
};

export function matchesQuery(haystack: string, query: string): boolean {
  const text = haystack.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word) || (ABBREVIATIONS[word] ?? "").split(" ").every((w) => w && text.includes(w)));
}

/**
 * Searchable exercise library, grouped by family. Used by the picker
 * (with checkmarks) and by the library screen (tap to edit).
 */
export function ExerciseList({
  renderTrailing,
  onSelect,
  footer,
  query,
  setQuery,
  autoFocus,
}: {
  renderTrailing?: (v: ExerciseVariation) => ReactNode;
  onSelect: (v: ExerciseVariation) => void;
  footer?: (query: string, hasExactMatch: boolean) => ReactNode;
  query: string;
  setQuery: (q: string) => void;
  autoFocus?: boolean;
}) {
  const variations = useLiveQuery(() => db.exerciseVariations.orderBy("name").toArray(), []);
  const families = useLiveQuery(() => db.exerciseFamilies.toArray(), []);
  const [filter, setFilter] = useState<EquipmentType | "all">("all");

  const familyName = useMemo(() => new Map(families?.map((f) => [f.id, f.name])), [families]);

  const q = query.trim().toLowerCase();
  const visible = (variations ?? []).filter((v) => {
    if (filter !== "all" && v.equipmentType !== filter) return false;
    if (!q) return true;
    const fam = v.familyId ? (familyName.get(v.familyId) ?? "") : "";
    return matchesQuery(`${v.name} ${fam} ${EQUIPMENT_LABEL[v.equipmentType]}`, q);
  });
  const hasExactMatch = !!variations?.some((v) => v.name.toLowerCase() === q);

  // Group by family unless searching, where a flat list reads faster.
  const groups: Array<[string, ExerciseVariation[]]> = q
    ? [["Results", visible]]
    : Object.entries(
        visible.reduce<Record<string, ExerciseVariation[]>>((acc, v) => {
          const key = (v.familyId && familyName.get(v.familyId)) || "Other";
          (acc[key] ??= []).push(v);
          return acc;
        }, {}),
      ).sort(([a], [b]) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)));

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
        <label className="flex items-center gap-2 rounded-xl bg-surface-2 px-3">
          <SearchIcon size={18} className="shrink-0 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises"
            autoFocus={autoFocus}
            className="min-h-11 w-full bg-transparent text-[16px] outline-none placeholder:text-muted/70"
            aria-label="Search exercises"
          />
        </label>
        <div className="-mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cx(
                "min-h-9 shrink-0 rounded-full px-3.5 text-[14px] font-medium transition active:scale-95",
                filter === f ? "bg-ink text-bg" : "bg-surface-2 text-ink",
              )}
            >
              {f === "all" ? "All" : EQUIPMENT_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {variations === undefined ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      ) : (
        groups.map(([title, items]) => (
          <section key={title} className="mb-4">
            {!q && <h3 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h3>}
            <ul className="overflow-hidden rounded-2xl bg-surface-2 [&>*+*]:border-t [&>*+*]:border-line">
              {items.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(v)}
                    className="flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left active:bg-black/5 dark:active:bg-white/5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px]">{v.name}</span>
                      <span className="block text-[13px] text-muted">
                        {EQUIPMENT_LABEL[v.equipmentType]}
                        {q && v.familyId && familyName.get(v.familyId) ? ` · ${familyName.get(v.familyId)}` : ""}
                        {v.isCustom ? " · Custom" : ""}
                      </span>
                    </span>
                    {renderTrailing?.(v)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {variations && visible.length === 0 && !q && (
        <p className="py-6 text-center text-[15px] text-muted">No exercises for this filter yet.</p>
      )}
      {footer?.(query.trim(), hasExactMatch)}
    </div>
  );
}
