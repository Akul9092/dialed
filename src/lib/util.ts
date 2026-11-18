import type { ISODateTime, LocalDate } from "@/db/types";

export function newId(): string {
  return crypto.randomUUID();
}

export function nowISO(): ISODateTime {
  return new Date().toISOString();
}

/** Local calendar date as "YYYY-MM-DD" (never UTC). */
export function localDate(d: Date = new Date()): LocalDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parses "YYYY-MM-DD" as a local date (new Date("2026-11-13") would be UTC). */
export function parseLocalDate(s: LocalDate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatLocalDate(
  s: LocalDate,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  return parseLocalDate(s).toLocaleDateString(undefined, opts);
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
