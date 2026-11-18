"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, type ReactNode } from "react";
import { db } from "@/db/db";
import { ensureSeed } from "@/db/seed";
import { SETTINGS_ID } from "@/db/types";
import { applyTheme } from "@/lib/theme";
import { TabBar } from "./TabBar";

export function useSettings() {
  return useLiveQuery(() => db.settings.get(SETTINGS_ID), []);
}

export function AppShell({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  // First-launch seed and storage protection.
  useEffect(() => {
    ensureSeed().catch((err) => console.error("Seeding failed", err));
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  // Keep the theme in sync with settings and with the system appearance.
  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.theme, settings.accent);
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(settings.theme, settings.accent);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings]);

  // Offline support. The worker is only registered in production builds.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        const hadController = !!navigator.serviceWorker.controller;
        if (reg.waiting && hadController) setWaitingWorker(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaitingWorker(sw);
          });
        });
      })
      .catch((err) => console.error("Service worker registration failed", err));

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return (
    <>
      {waitingWorker && (
        <div className="pt-safe fixed inset-x-0 top-0 z-50 flex justify-center px-4">
          <button
            type="button"
            onClick={() => waitingWorker.postMessage({ type: "SKIP_WAITING" })}
            className="animate-fade-in mt-2 rounded-full bg-ink px-4 py-2.5 text-[14px] font-semibold text-bg shadow-lg"
          >
            Update ready. Tap to reload.
          </button>
        </div>
      )}
      {children}
      <TabBar />
    </>
  );
}
