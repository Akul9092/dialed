"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ChartIcon, ListIcon } from "@/components/icons";
import { EmptyState, List, Page, PageHeader, Row, Section } from "@/components/ui";
import { db } from "@/db/db";

export default function ProgressPage() {
  const total = useLiveQuery(() => db.exerciseVariations.count(), []);
  const custom = useLiveQuery(() => db.exerciseVariations.filter((v) => v.isCustom).count(), []);

  return (
    <Page>
      <PageHeader title="Progress" />
      <Section>
        <List>
          <Row
            leading={
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
                <ListIcon size={20} />
              </span>
            }
            title="Exercise library"
            subtitle={
              total === undefined ? " " : `${total} exercises${custom ? `, ${custom} of your own` : ""}`
            }
            href="/progress/library/"
            chevron
          />
        </List>
      </Section>
      <EmptyState
        icon={<ChartIcon size={28} />}
        title="Nothing to chart yet"
        body="Once you log workouts, your PRs, estimated 1RM and volume graphs show up here, one line per exact setup."
      />
    </Page>
  );
}
