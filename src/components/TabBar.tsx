"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/util";
import { ChartIcon, DumbbellIcon, GearIcon, HomeIcon } from "./icons";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/train/", label: "Train", Icon: DumbbellIcon },
  { href: "/progress/", label: "Progress", Icon: ChartIcon },
  { href: "/settings/", label: "Settings", Icon: GearIcon },
] as const;

export function TabBar() {
  const pathname = usePathname() ?? "/";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/80 backdrop-blur-xl backdrop-saturate-150"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition active:scale-95",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon size={25} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
