"use client";

import { formatRelative, usePoll, useNow } from "@/lib/client";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import type { LifecycleEventDTO } from "@/lib/types";
import { useZone } from "@/components/zone-shell";
import { Badge, EmptyState, Icon, Spinner } from "@/components/ui";

const EVENT_META: Record<
  string,
  { icon: string; tone: "neutral" | "brand" | "emerald" | "rose" | "amber" | "sky"; verb: string }
> = {
  created: { icon: "plus", tone: "brand", verb: "opened" },
  responded: { icon: "send", tone: "sky", verb: "responded to" },
  withdrawn: { icon: "x", tone: "neutral", verb: "withdrew from" },
  accepted: { icon: "check", tone: "emerald", verb: "accepted a response on" },
  declined: { icon: "x", tone: "neutral", verb: "declined a response on" },
  resolved: { icon: "check", tone: "emerald", verb: "fulfilled" },
  expired: { icon: "clock", tone: "amber", verb: "ran out of time:" },
  removed: { icon: "shield", tone: "rose", verb: "was removed:" },
  purged: { icon: "ghost", tone: "neutral", verb: "was erased" },
  extended: { icon: "clock", tone: "sky", verb: "extended" },
  thread_closed: { icon: "lock", tone: "neutral", verb: "closed a private thread" },
  zone_archived: { icon: "globe", tone: "amber", verb: "archived the zone" },
};

export default function ActivityPage() {
  const { zone } = useZone();
  const { data, loading } = usePoll<{ events: LifecycleEventDTO[] }>(`/api/zones/${zone.slug}/lifecycle`, {
    intervalMs: 6000,
  });
  const events = data?.events ?? [];
  const now = useNow(15_000);

  const purged = events.filter((e) => e.type === "purged").length;
  const resolved = events.filter((e) => e.type === "resolved").length;

  return (
    <div className="space-y-4">
      <div className="panel rounded-2xl p-4">
        <h1 className="text-[15px] font-semibold text-ink-100">What this zone remembers</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-400">
          The content is gone, but the shape of what happened stays. This trail is how a disappearing network stays
          accountable — you can always see that a post was fulfilled, expired or moderated, without the post itself
          hanging around.
        </p>
        <div className="mt-3.5 flex flex-wrap gap-4 border-t hairline pt-3">
          <Stat label="Fulfilled" value={resolved} tone="text-emerald-300" />
          <Stat label="Erased for good" value={purged} tone="text-ink-200" />
          <Stat label="Live right now" value={zone.openPostCount} tone="text-brand-400" />
        </div>
      </div>

      {loading && events.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-ink-400" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState icon="activity" title="Nothing has happened yet" />
      ) : (
        <ol className="relative space-y-1 border-l hairline pl-5">
          {events.map((e) => {
            const meta = EVENT_META[e.type] ?? EVENT_META.created;
            const template = e.detail.template as TemplateId | undefined;
            const title = (e.detail.title as string | undefined) ?? null;
            return (
              <li key={e.id} className="relative py-2">
                <span className="absolute -left-[26px] top-3 grid h-5 w-5 place-items-center rounded-full border hairline bg-ink-900 text-ink-400">
                  <Icon name={meta.icon} className="h-3 w-3" />
                </span>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
                  <span className="font-medium text-ink-200">{e.actor?.displayName ?? "The system"}</span>
                  <span className="text-ink-400">{meta.verb}</span>
                  {title ? <span className="text-ink-100">“{title}”</span> : <span className="text-ink-500">a {e.subjectType}</span>}
                  {template ? <Badge tone={meta.tone}>{TEMPLATES[template]?.label ?? template}</Badge> : null}
                  <span className="text-[11px] text-ink-500">{formatRelative(e.createdAt, now)}</span>
                </div>
                {typeof e.detail.reason === "string" ? (
                  <p className="mt-0.5 text-[12px] text-ink-500">{e.detail.reason}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className={`mt-0.5 font-mono text-[18px] tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
