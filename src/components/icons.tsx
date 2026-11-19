import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function HomeIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9v10.5h13V9" />
      <path d="M10 19.5v-5h4v5" />
    </svg>
  );
}

export function DumbbellIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M8 12h8" />
      <rect x="4.5" y="7" width="3.5" height="10" rx="1.2" />
      <rect x="16" y="7" width="3.5" height="10" rx="1.2" />
      <path d="M2.5 10v4M21.5 10v4" />
    </svg>
  );
}

export function ChartIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 19.5h16" />
      <path d="M5 15.5l4.5-4.5 3.5 3 6-6.5" />
      <path d="M15 7.5h4v4" />
    </svg>
  );
}

export function GearIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.7 7.7 0 0 0-2.6-1.5L14.2 2.5h-4l-.3 2.6a7.7 7.7 0 0 0-2.6 1.5l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.7 7.7 0 0 0 2.6 1.5l.3 2.6h4l.3-2.6a7.7 7.7 0 0 0 2.6-1.5l2.3 1 2-3.4z" />
    </svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m9.5 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m14.5 6-6 6 6 6" />
    </svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PinIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

export function ChevronUpIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m6 14.5 6-6 6 6" />
    </svg>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m6 9.5 6 6 6-6" />
    </svg>
  );
}

export function MinusCircleIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

export function ListIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </svg>
  );
}
