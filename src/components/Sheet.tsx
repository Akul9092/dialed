"use client";

import { useEffect, useId, type ReactNode } from "react";

/**
 * iOS-style bottom sheet. Buttons sit at the bottom edge so they are
 * reachable one-handed.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <button
        type="button"
        aria-label="Close"
        className="animate-fade-in absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-sheet-in relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-surface shadow-2xl"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-muted/30" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 id={titleId} className="text-[20px] font-bold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-1 text-[17px] text-accent active:opacity-60"
          >
            Cancel
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">{children}</div>
        {footer && (
          <div className="border-t border-line px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
