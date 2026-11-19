"use client";

import { useState } from "react";
import { ExerciseFormSheet } from "@/components/ExerciseFormSheet";
import { ExerciseList } from "@/components/ExerciseList";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { IconButton, Page, PageHeader } from "@/components/ui";
import type { ExerciseVariation } from "@/db/types";

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ExerciseVariation | "new" | null>(null);

  return (
    <Page>
      <PageHeader
        back={{ href: "/progress/", label: "Progress" }}
        title="Exercises"
        action={
          <IconButton label="New exercise" onClick={() => setEditing("new")}>
            <PlusIcon size={22} />
          </IconButton>
        }
      />
      {/* ExerciseList's sticky search expects a sheet-like surface with side padding. */}
      <div className="rounded-3xl bg-surface px-5 pb-2 pt-4">
        <ExerciseList
          query={query}
          setQuery={setQuery}
          onSelect={(v) => v.isCustom && setEditing(v)}
          renderTrailing={(v) => (v.isCustom ? <ChevronRightIcon size={18} className="text-muted/70" /> : null)}
        />
      </div>
      <p className="mt-3 px-4 text-[13px] text-muted">
        Built-in exercises can't be changed. Tap one of your own to rename or edit it.
      </p>

      {editing && (
        <ExerciseFormSheet
          key={editing === "new" ? "new" : editing.id}
          exercise={editing === "new" ? undefined : editing}
          initialName={editing === "new" ? query : ""}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  );
}
