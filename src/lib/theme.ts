import type { AccentId, ThemeMode } from "@/db/types";

/** iOS system colors, tuned separately for light and dark backgrounds. */
export const ACCENTS: Record<AccentId, { label: string; light: string; dark: string; ink: string }> = {
  blue: { label: "Blue", light: "#007AFF", dark: "#0A84FF", ink: "#FFFFFF" },
  indigo: { label: "Indigo", light: "#5856D6", dark: "#5E5CE6", ink: "#FFFFFF" },
  violet: { label: "Violet", light: "#AF52DE", dark: "#BF5AF2", ink: "#FFFFFF" },
  pink: { label: "Pink", light: "#FF2D55", dark: "#FF375F", ink: "#FFFFFF" },
  red: { label: "Red", light: "#FF3B30", dark: "#FF453A", ink: "#FFFFFF" },
  orange: { label: "Orange", light: "#FF9500", dark: "#FF9F0A", ink: "#1A1000" },
  green: { label: "Green", light: "#34C759", dark: "#30D158", ink: "#03200C" },
  teal: { label: "Teal", light: "#30B0C7", dark: "#40C8E0", ink: "#021A1F" },
};

export const ACCENT_ORDER: AccentId[] = ["blue", "indigo", "violet", "pink", "red", "orange", "green", "teal"];

/** Cached in localStorage so the first paint already has the right theme. */
export const THEME_CACHE_KEY = "dialed-theme";

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode, accent: AccentId): void {
  const resolved = resolveTheme(mode);
  const a = ACCENTS[accent] ?? ACCENTS.blue;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.setProperty("--accent", resolved === "dark" ? a.dark : a.light);
  root.style.setProperty("--accent-ink", a.ink);
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", resolved === "dark" ? "#000000" : "#F2F2F7"));
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ mode, accent }));
  } catch {
    // Storage can be unavailable (private mode). The theme still applies.
  }
}

/**
 * Inline script run before React hydrates, to avoid a flash of the wrong
 * theme. Kept dependency-free and wrapped in try/catch.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var A=${JSON.stringify(ACCENTS)};
var c=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_CACHE_KEY)})||"{}");
var m=c.mode||"system";var a=A[c.accent]||A.blue;
var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
var r=document.documentElement;r.dataset.theme=d?"dark":"light";
r.style.setProperty("--accent",d?a.dark:a.light);r.style.setProperty("--accent-ink",a.ink);
}catch(e){}})();`;
