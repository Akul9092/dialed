"use client";

import { ChartIcon } from "@/components/icons";
import { EmptyState, Page, PageHeader } from "@/components/ui";

export default function ProgressPage() {
  return (
    <Page>
      <PageHeader title="Progress" />
      <EmptyState
        icon={<ChartIcon size={28} />}
        title="Nothing to chart yet"
        body="Once you log workouts, your PRs, estimated 1RM and volume graphs show up here, one line per exact setup."
      />
    </Page>
  );
}
