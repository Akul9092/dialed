"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/util";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

/* ------------------------------ Page chrome ----------------------------- */

export function Page({ children }: { children: ReactNode }) {
  return <main className="pt-safe pb-tabbar mx-auto w-full max-w-lg px-4">{children}</main>;
}

export function PageHeader({
  title,
  eyebrow,
  action,
  back,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-5 pt-2">
      {back && (
        <Link
          href={back.href}
          className="-ml-1.5 mb-1 inline-flex min-h-11 items-center gap-0.5 text-[17px] text-accent active:opacity-60"
        >
          <ChevronLeftIcon size={22} />
          {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-0.5 text-[13px] font-semibold uppercase tracking-wide text-muted">{eyebrow}</p>
          )}
          <h1 className="truncate text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}

/* -------------------------------- Buttons ------------------------------- */

type Variant = "primary" | "secondary" | "danger" | "plain";
type Size = "md" | "lg";

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] active:opacity-80 disabled:pointer-events-none disabled:opacity-40",
    size === "lg" ? "min-h-14 px-6 text-[17px]" : "min-h-11 px-4 text-[15px]",
    variant === "primary" && "bg-accent text-accent-ink",
    variant === "secondary" && "bg-accent/12 text-accent",
    variant === "danger" && "bg-danger/12 text-danger",
    variant === "plain" && "text-accent",
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} {...props} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      {...props}
      className={cx(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent transition active:scale-95 active:opacity-70",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* --------------------------------- Lists -------------------------------- */

export function Section({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-7">
      {title && <h2 className="mb-2 px-4 text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h2>}
      {children}
      {footer && <p className="mt-2 px-4 text-[13px] leading-snug text-muted">{footer}</p>}
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface [&>*+*]:border-t [&>*+*]:border-line">{children}</div>
  );
}

type RowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
};

export function Row({ title, subtitle, leading, trailing, chevron, onClick, href, disabled }: RowProps) {
  const inner = (
    <>
      {leading}
      <div className="min-w-0 flex-1 py-3">
        <div className="truncate text-[17px]">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-[14px] text-muted">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 text-[15px] text-muted">{trailing}</div>}
      {chevron && <ChevronRightIcon size={18} className="shrink-0 text-muted/70" />}
    </>
  );
  const cls = cx(
    "flex min-h-14 w-full items-center gap-3 px-4 text-left",
    (onClick || href) && !disabled && "active:bg-surface-2",
    disabled && "opacity-50",
  );
  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cls}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function Pill({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "muted" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
        tone === "accent" ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted",
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------- Inputs ------------------------------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cx(
              "min-h-9 flex-1 rounded-[9px] px-3 text-[15px] font-medium transition",
              selected ? "bg-surface text-ink shadow-sm dark:bg-[#3a3a3e]" : "text-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block px-1 text-[13px] text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "block w-full rounded-xl bg-surface-2 px-3.5 py-3 text-[16px] text-ink placeholder:text-muted/70 outline-none ring-accent focus:ring-2 disabled:opacity-55";

/* ------------------------------ Empty states ----------------------------- */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-surface px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent">{icon}</div>
      <h3 className="text-[19px] font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[15px] leading-snug text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
