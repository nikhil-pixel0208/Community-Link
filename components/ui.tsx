"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { PublicUser } from "@/lib/types";

/* ------------------------------- icons ------------------------------- */

const PATHS: Record<string, ReactNode> = {
  search: <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35" />,
  hand: <path d="M18 11V6a2 2 0 0 0-4 0v5m0-1V4a2 2 0 1 0-4 0v7m0-1V5a2 2 0 1 0-4 0v9m-2-3 .7 4.2A6 6 0 0 0 10.6 20H14a6 6 0 0 0 6-6v-3" />,
  users: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  tag: (
    <>
      <path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </>
  ),
  megaphone: <path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1Zm14-3a5 5 0 0 1 0 8M7 14v5" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9a2.7 2.7 0 1 1 3.6 2.5c-.6.3-1 .9-1 1.6v.4" />
      <path d="M12 17.2h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 1.9" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  feed: <path d="M4 6h16M4 12h16M4 18h10" />,
  chat: <path d="M20 13a6 6 0 0 1-6 6H8l-4 3V8a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v5Z" />,
  lock: (
    <>
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 1 1 8 0v3.5" />
    </>
  ),
  shield: <path d="M12 3 5 6v6c0 4.4 3 8.2 7 9 4-.8 7-4.6 7-9V6l-7-3Z" />,
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  send: <path d="m4 12 16-8-6 16-2.5-6.2L4 12Z" />,
  flag: <path d="M5 21V4m0 0 9.5 1.8a1 1 0 0 1 .4 1.8L12 10l2.9 2.4a1 1 0 0 1-.4 1.8L5 16" />,
  sparkle: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />,
  arrowLeft: <path d="M19 12H5m0 0 6-6m-6 6 6 6" />,
  arrowRight: <path d="M5 12h14m0 0-6-6m6 6-6 6" />,
  logout: <path d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  ghost: <path d="M5 21V10a7 7 0 0 1 14 0v11l-2.3-1.8L14.4 21l-2.4-1.9L9.6 21l-2.3-1.8L5 21Z" />,
};

export function Icon({
  name,
  className = "h-4 w-4",
  strokeWidth = 1.7,
}: {
  name: keyof typeof PATHS | string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.help}
    </svg>
  );
}

/* ------------------------------ button ------------------------------- */

type Variant = "primary" | "ghost" | "outline" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-400 border border-brand-400/40 shadow-lg shadow-brand-500/20 disabled:bg-ink-600 disabled:shadow-none disabled:border-ink-600",
  outline: "border border-ink-500 text-ink-100 hover:border-ink-400 hover:bg-ink-800",
  ghost: "text-ink-200 hover:text-ink-100 hover:bg-ink-800 border border-transparent",
  subtle: "bg-ink-800 text-ink-100 border border-ink-600 hover:bg-ink-700",
  danger: "bg-rose-600/90 text-white hover:bg-rose-500 border border-rose-400/40",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: string;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading ? <Spinner className="h-3.5 w-3.5" /> : icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------ avatar ------------------------------- */

export function Avatar({
  user,
  size = 36,
  ring = false,
}: {
  user: Pick<PublicUser, "displayName" | "avatarHue" | "handle">;
  size?: number;
  ring?: boolean;
}) {
  const initials = user.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${ring ? "ring-2 ring-ink-900" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(145deg, hsl(${user.avatarHue} 70% 46%), hsl(${(user.avatarHue + 40) % 360} 65% 32%))`,
        color: "white",
      }}
      title={`@${user.handle}`}
    >
      {initials || "?"}
    </div>
  );
}

/* ------------------------------- badge ------------------------------- */

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "amber" | "emerald" | "rose" | "sky" | "violet" | "cyan";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-800 text-ink-200 border-ink-600",
    brand: "bg-brand-500/15 text-brand-400 border-brand-500/30",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------- modal ------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-rise panel-raised relative z-10 w-full ${width} rounded-t-2xl sm:rounded-2xl`}
      >
        <header className="flex items-start justify-between gap-4 border-b hairline px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-100">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-ink-300">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
            aria-label="Close"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------- inputs ------------------------------ */

const inputBase =
  "w-full rounded-xl border border-ink-600 bg-ink-900/70 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25";

export function Field({
  label,
  help,
  required,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-ink-200">
        {label}
        {required ? <span className="text-brand-400">*</span> : null}
      </span>
      {children}
      {help ? <span className="mt-1 block text-[12px] leading-snug text-ink-400">{help}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} min-h-[84px] resize-y ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputBase} appearance-none pr-9 ${props.className ?? ""}`}>
      {props.children}
    </select>
  );
}

/* ----------------------------- empty state ---------------------------- */

export function EmptyState({
  icon = "ghost",
  title,
  detail,
  action,
}: {
  icon?: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed hairline px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-800 text-ink-400">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-ink-200">{title}</p>
        {detail ? <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-ink-400">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------ misc ---------------------------------- */

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-ink-600 bg-ink-850 px-2 py-1 text-[11px] text-ink-200 opacity-0 shadow-xl transition group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
}
