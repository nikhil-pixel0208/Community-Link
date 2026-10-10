"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, formatRelative, usePoll, useNow } from "@/lib/client";
import type { MemberDTO, MemberRole, ReportDTO } from "@/lib/types";
import { useZone } from "@/components/zone-shell";
import { useSession } from "@/components/session";
import { useToast } from "@/components/toast";
import { Avatar, Badge, Button, EmptyState, Icon, Select, Spinner } from "@/components/ui";

export default function PeoplePage() {
  const { zone } = useZone();
  const isStaff = zone.role === "organizer" || zone.role === "moderator";
  const [tab, setTab] = useState<"people" | "queue">("people");

  return (
    <div className="space-y-4">
      {isStaff ? (
        <div className="flex gap-2">
          <TabButton active={tab === "people"} onClick={() => setTab("people")} icon="users">
            People
          </TabButton>
          <TabButton active={tab === "queue"} onClick={() => setTab("queue")} icon="shield">
            Moderation queue
          </TabButton>
        </div>
      ) : null}

      {tab === "people" ? <MemberList zoneSlug={zone.slug} myRole={zone.role ?? "member"} /> : null}
      {tab === "queue" && isStaff ? <ModerationQueue zoneSlug={zone.slug} /> : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition ${
        active
          ? "border-brand-500/50 bg-brand-500/15 text-brand-400"
          : "border-ink-600 bg-ink-900/50 text-ink-300 hover:text-ink-100"
      }`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function MemberList({ zoneSlug, myRole }: { zoneSlug: string; myRole: MemberRole }) {
  const { data, loading, refresh } = usePoll<{ members: MemberDTO[] }>(`/api/zones/${zoneSlug}/members`, {
    intervalMs: 15000,
  });
  const members = data?.members ?? [];
  const { user } = useSession();
  const now = useNow(30_000);
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const block = async (id: string) => {
    setBusy(id);
    try {
      const res = await api<{ blocked: boolean }>("/api/blocks", { method: "POST", json: { userId: id } });
      toast({
        tone: "success",
        title: res.blocked ? "Blocked" : "Unblocked",
        detail: res.blocked ? "Their posts and messages are hidden from you." : undefined,
      });
      await refresh();
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "Couldn't do that" });
    } finally {
      setBusy(null);
    }
  };

  const message = async (id: string) => {
    setBusy(id);
    try {
      const res = await api<{ thread: { id: string } }>(`/api/zones/${zoneSlug}/threads`, {
        method: "POST",
        json: { partnerId: id },
      });
      router.push(`/z/${zoneSlug}/direct?thread=${res.thread.id}`);
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "Couldn't open a thread" });
    } finally {
      setBusy(null);
    }
  };

  const changeRole = async (id: string, role: string) => {
    try {
      await api(`/api/zones/${zoneSlug}/members`, { method: "PATCH", json: { userId: id, role } });
      toast({ tone: "success", title: "Role updated" });
      await refresh();
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "Couldn't change the role" });
    }
  };

  if (loading && members.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-ink-400" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((m) => {
        const isMe = m.user.id === user?.id;
        return (
          <div key={m.user.id} className="panel flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-3">
            <Avatar user={m.user} size={38} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-[13.5px] font-medium text-ink-100">{m.user.displayName}</span>
                {m.role !== "member" ? <Badge tone="brand">{m.role}</Badge> : null}
                {isMe ? <Badge tone="neutral">you</Badge> : null}
                {m.isBlockedByMe ? <Badge tone="rose">blocked</Badge> : null}
                {m.mutedUntil && m.mutedUntil > now ? <Badge tone="amber">muted</Badge> : null}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] text-ink-400">
                @{m.user.handle} · trust {m.user.trustScore} · seen {formatRelative(m.lastSeenAt, now)}
              </p>
              {m.user.skills.length > 0 ? (
                <p className="mt-1.5 flex flex-wrap gap-1">
                  {m.user.skills.map((s) => (
                    <span key={s} className="rounded-md bg-ink-800 px-1.5 py-0.5 text-[11px] text-ink-300">
                      {s}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>

            {!isMe ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {myRole === "organizer" ? (
                  <Select
                    value={m.role}
                    onChange={(e) => void changeRole(m.user.id, e.target.value)}
                    className="h-8 w-auto py-0 text-[12px]"
                  >
                    <option value="member">member</option>
                    <option value="moderator">moderator</option>
                    <option value="organizer">organiser</option>
                  </Select>
                ) : null}
                <Button size="sm" variant="ghost" icon="lock" onClick={() => void message(m.user.id)} disabled={busy === m.user.id}>
                  Message
                </Button>
                <Button
                  size="sm"
                  variant={m.isBlockedByMe ? "subtle" : "ghost"}
                  onClick={() => void block(m.user.id)}
                  disabled={busy === m.user.id}
                >
                  {m.isBlockedByMe ? "Unblock" : "Block"}
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ModerationQueue({ zoneSlug }: { zoneSlug: string }) {
  const { data, refresh } = usePoll<{ reports: ReportDTO[] }>(`/api/zones/${zoneSlug}/reports`, {
    intervalMs: 10000,
  });
  const reports = data?.reports ?? [];
  const open = reports.filter((r) => r.status === "open");
  const done = reports.filter((r) => r.status !== "open");
  const toast = useToast();
  const now = useNow(30_000);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (reportId: string, action: string) => {
    setBusy(reportId);
    try {
      await api(`/api/zones/${zoneSlug}/reports`, { method: "PATCH", json: { reportId, action } });
      toast({ tone: "success", title: "Handled" });
      await refresh();
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "Couldn't apply that" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {open.length === 0 ? (
        <EmptyState icon="shield" title="Queue is clear" detail="Three open reports on one post auto-hides it until you look." />
      ) : (
        <div className="space-y-2">
          {open.map((r) => (
            <div key={r.id} className="panel rounded-xl p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="rose">{r.reason}</Badge>
                    <Badge tone="neutral">{r.targetType.replace("_", " ")}</Badge>
                    <span className="text-[11px] text-ink-500">{formatRelative(r.createdAt, now)}</span>
                  </div>
                  <p className="mt-1.5 text-[13.5px] text-ink-100">“{r.snippet}”</p>
                  {r.note ? <p className="mt-1 text-[12.5px] text-ink-400">{r.note}</p> : null}
                  <p className="mt-1 text-[11.5px] text-ink-500">reported by @{r.reporter.handle}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => void act(r.id, "dismiss")} disabled={busy === r.id}>
                  Dismiss
                </Button>
                <Button size="sm" variant="subtle" onClick={() => void act(r.id, "remove_content")} disabled={busy === r.id}>
                  Remove content
                </Button>
                <Button size="sm" variant="subtle" onClick={() => void act(r.id, "mute_author")} disabled={busy === r.id}>
                  Mute 1h
                </Button>
                <Button size="sm" variant="danger" onClick={() => void act(r.id, "ban_author")} disabled={busy === r.id}>
                  Remove from zone
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 ? (
        <div>
          <h3 className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-500">Handled</h3>
          <div className="space-y-1.5">
            {done.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border hairline px-3 py-2">
                <Icon name={r.status === "dismissed" ? "x" : "check"} className="h-3.5 w-3.5 text-ink-500" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-400">
                  {r.reason} — “{r.snippet}”
                </span>
                <span className="text-[11px] text-ink-600">{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
