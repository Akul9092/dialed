"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useSettings } from "@/components/AppShell";
import { CheckIcon } from "@/components/icons";
import { List, Page, PageHeader, Row, Section, Segmented } from "@/components/ui";
import { updateSettings } from "@/db/actions";
import { db } from "@/db/db";
import type { ThemeMode, WeightUnit } from "@/db/types";
import { ACCENTS, ACCENT_ORDER } from "@/lib/theme";
import { cx } from "@/lib/util";

export default function SettingsPage() {
  const settings = useSettings();
  const gymCount = useLiveQuery(() => db.gyms.count(), []);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  if (!settings) {
    return (
      <Page>
        <PageHeader title="Settings" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Settings" />

      <Section title="Appearance">
        <div className="space-y-5 rounded-2xl bg-surface p-4">
          <Segmented<ThemeMode>
            ariaLabel="Theme"
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <div>
            <p className="mb-3 text-[13px] font-semibold text-muted">Accent color</p>
            <div role="radiogroup" aria-label="Accent color" className="grid grid-cols-8 gap-2">
              {ACCENT_ORDER.map((id) => {
                const a = ACCENTS[id];
                const selected = settings.accent === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={a.label}
                    onClick={() => updateSettings({ accent: id })}
                    className={cx(
                      "flex aspect-square items-center justify-center rounded-full transition active:scale-90",
                      selected && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
                    )}
                    style={{ background: a.light }}
                  >
                    {selected && <CheckIcon size={16} strokeWidth={3} style={{ color: a.ink }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Units" footer="Each gym can override this, for example a gym with kg plates.">
        <div className="rounded-2xl bg-surface p-4">
          <Segmented<WeightUnit>
            ariaLabel="Default weight unit"
            value={settings.defaultUnit}
            onChange={(defaultUnit) => updateSettings({ defaultUnit })}
            options={[
              { value: "lb", label: "Pounds (lb)" },
              { value: "kg", label: "Kilograms (kg)" },
            ]}
          />
        </div>
      </Section>

      <Section title="Training">
        <List>
          <Row
            title="Gyms"
            href="/settings/gyms/"
            trailing={gymCount === undefined ? "" : String(gymCount)}
            chevron
          />
          <Row title="Rest timer" subtitle="Coming soon" disabled />
        </List>
      </Section>

      <Section
        title="Data"
        footer="Everything is stored on this iPhone only. Export and import arrive in a later build."
      >
        <List>
          <Row
            title="Storage"
            trailing={persisted === null ? "Checking" : persisted ? "Protected" : "Standard"}
          />
          <Row
            title="Last backup"
            trailing={
              settings.lastBackupAt
                ? new Date(settings.lastBackupAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                : "Never"
            }
          />
          <Row title="Export backup" disabled />
        </List>
      </Section>

      <Section title="About">
        <List>
          <Row title="Dialed" trailing="Version 0.1.0" />
        </List>
      </Section>
    </Page>
  );
}
