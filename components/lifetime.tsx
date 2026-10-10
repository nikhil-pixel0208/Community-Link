"use client";

import { formatCountdown, useNow } from "@/lib/client";
import { Icon } from "./ui";

/**
 * Every post wears its remaining life on its face. This is the product's
 * promise made visible: nothing here is permanent.
 */
export function LifetimeRing({
  createdAt,
  expiresAt,
  size = 42,
  showLabel = true,
}: {
  createdAt: number;
  expiresAt: number;
  size?: number;
  showLabel?: boolean;
}) {
  const now = useNow(1000);
  const total = Math.max(1, expiresAt - createdAt);
  const left = Math.max(0, expiresAt - now);
  const frac = Math.max(0, Math.min(1, left / total));

  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const urgent = left < 10 * 60_000;
  const warning = left < 60 * 60_000;
  const stroke = urgent ? "#fb7185" : warning ? "#fbbf24" : "#6c7cff";

  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width: size, height: size }} title={`Vanishes in ${formatCountdown(left)}`}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-ink-700" strokeWidth="3" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - frac)}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s" }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center">
          <Icon name="clock" className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>
      {showLabel ? (
        <span className={`font-mono text-[12px] tabular-nums ${urgent ? "text-rose-300" : warning ? "text-amber-300" : "text-ink-300"}`}>
          {formatCountdown(left)}
        </span>
      ) : null}
    </div>
  );
}

/** Thin bar version for dense lists and tombstones. */
export function LifetimeBar({
  createdAt,
  expiresAt,
  className = "",
}: {
  createdAt: number;
  expiresAt: number;
  className?: string;
}) {
  const now = useNow(1000);
  const total = Math.max(1, expiresAt - createdAt);
  const left = Math.max(0, expiresAt - now);
  const frac = Math.max(0, Math.min(1, left / total));
  const urgent = left < 10 * 60_000;
  const warning = left < 60 * 60_000;

  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-ink-700 ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
          urgent ? "bg-rose-400" : warning ? "bg-amber-400" : "bg-brand-500"
        }`}
        style={{ width: `${frac * 100}%` }}
      />
    </div>
  );
}

/** Countdown to the hard delete of a fulfilled post's receipt. */
export function PurgeCountdown({ purgeAt }: { purgeAt: number }) {
  const now = useNow(500);
  const left = Math.max(0, purgeAt - now);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] tabular-nums text-ink-300">
      <Icon name="ghost" className="h-3.5 w-3.5" />
      erasing in {formatCountdown(left)}
    </span>
  );
}
