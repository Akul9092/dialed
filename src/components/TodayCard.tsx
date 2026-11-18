"use client";

import type { Suggestion } from "@/lib/schedule";
import { formatLocalDate } from "@/lib/util";
import { DayBadge } from "./SplitEditor";

/** Shows the split day suggested for today. */
export function TodaySuggestion({ suggestion, totalDays }: { suggestion: Suggestion; totalDays: number }) {
  if (suggestion.kind === "empty") {
    return <p className="text-[15px] text-muted">Add days to your split to get a daily suggestion.</p>;
  }
  if (suggestion.kind === "not_started") {
    return (
      <p className="text-[15px] text-muted">
        Day 1 starts on {formatLocalDate(suggestion.startsOn, { weekday: "long", month: "short", day: "numeric" })}.
      </p>
    );
  }
  const { day, index, done, alternative } = suggestion;
  return (
    <div className="flex items-center gap-4">
      <DayBadge n={index + 1} kind={day.kind} size="lg" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-muted">
          Day {index + 1} of {totalDays}
          {done && " · Done today"}
        </p>
        <p className="truncate text-[24px] font-bold leading-tight tracking-tight">
          {day.kind === "rest" ? "Rest day" : day.name}
        </p>
        {alternative && (
          <p className="mt-0.5 text-[14px] text-muted">
            Training anyway? Next up is Day {alternative.index + 1}: {alternative.day.name}
          </p>
        )}
      </div>
    </div>
  );
}
