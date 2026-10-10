"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, formatClock, formatCountdown, useNow, usePoll } from "@/lib/client";
import type { ChannelDTO, ChannelMessageDTO, MemberRole } from "@/lib/types";
import { useZone } from "@/components/zone-shell";
import { useToast } from "@/components/toast";
import { Avatar, Badge, Button, EmptyState, Icon, Spinner } from "@/components/ui";

export default function ZoneChatPage() {
  const { zone } = useZone();
  const [active, setActive] = useState<string>("general");

  const { data: meta } = usePoll<{ channels: ChannelDTO[]; myRole: MemberRole }>(
    `/api/zones/${zone.slug}/channels`,
    { intervalMs: 20000 },
  );
  const channels = meta?.channels ?? [];
  const myRole = meta?.myRole ?? "member";
  const channel = channels.find((c) => c.slug === active) ?? channels[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[210px_1fr]">
      <aside className="space-y-3">
        <div>
          <h2 className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-500">Channels</h2>
          <div className="space-y-1">
            {channels.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c.slug)}
                className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                  c.slug === active
                    ? "border-brand-500/45 bg-brand-500/10 text-ink-100"
                    : "border-transparent text-ink-300 hover:bg-ink-800/60 hover:text-ink-100"
                }`}
              >
                <Icon name={c.kind === "announce" ? "megaphone" : "chat"} className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{c.name}</span>
                  <span className="block truncate text-[11px] text-ink-500">{c.messageCount} messages</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-brand-400">
            <Icon name="lock" className="h-3.5 w-3.5" />
            Not everyone&apos;s business?
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-400">
            Asking for an extension in front of 400 people is a bad look. Take it to a private thread.
          </p>
          <Link
            href={`/z/${zone.slug}/direct`}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-brand-400 hover:underline"
          >
            Message an organiser <Icon name="arrowRight" className="h-3 w-3" />
          </Link>
        </div>
      </aside>

      {channel ? (
        <ChannelView zoneSlug={zone.slug} channel={channel} myRole={myRole} />
      ) : (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-ink-400" />
        </div>
      )}
    </div>
  );
}

function ChannelView({
  zoneSlug,
  channel,
  myRole,
}: {
  zoneSlug: string;
  channel: ChannelDTO;
  myRole: MemberRole;
}) {
  const { data, refresh } = usePoll<{ messages: ChannelMessageDTO[] }>(
    `/api/zones/${zoneSlug}/channels/${channel.slug}/messages`,
    { intervalMs: 3000 },
  );
  const messages = data?.messages ?? [];
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const bottom = useRef<HTMLDivElement>(null);
  const now = useNow(10_000);

  const readOnly = channel.kind === "announce" && myRole === "member";

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setBody("");
    try {
      await api(`/api/zones/${zoneSlug}/channels/${channel.slug}/messages`, {
        method: "POST",
        json: { body: text },
      });
      await refresh();
    } catch (err) {
      setBody(text);
      toast({ tone: "error", title: err instanceof Error ? err.message : "Message didn't send" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel flex min-h-[70vh] flex-col overflow-hidden rounded-2xl">
      <header className="flex items-center justify-between gap-3 border-b hairline px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-100">
            <Icon name={channel.kind === "announce" ? "megaphone" : "chat"} className="h-4 w-4 text-ink-400" />
            {channel.name}
          </h2>
          <p className="mt-0.5 truncate text-[12px] text-ink-400">{channel.description}</p>
        </div>
        <Badge tone="neutral">
          <Icon name="clock" className="h-3 w-3" />
          12h memory
        </Badge>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState icon="chat" title="Quiet in here" detail="Messages in zone channels fade after 12 hours." />
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const grouped = prev && prev.user.id === m.user.id && m.createdAt - prev.createdAt < 5 * 60_000;
            return (
              <div key={m.id} className={`flex gap-2.5 ${grouped ? "mt-1" : "mt-3"}`}>
                <div className="w-8 shrink-0">
                  {!grouped ? <Avatar user={m.user} size={32} /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  {!grouped ? (
                    <p className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium text-ink-100">{m.user.displayName}</span>
                      <span className="text-[11px] text-ink-500">{formatClock(m.createdAt)}</span>
                      {m.expiresAt ? (
                        <span className="text-[10.5px] text-ink-600" title="This message auto-deletes">
                          fades in {formatCountdown(m.expiresAt - now)}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-ink-200">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>

      <footer className="border-t hairline p-3">
        {readOnly ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border hairline bg-ink-900/60 px-3.5 py-3">
            <Icon name="lock" className="h-4 w-4 text-ink-400" />
            <p className="flex-1 text-[12.5px] text-ink-400">
              Organisers broadcast here. Need something from them?
            </p>
            <Link href={`/z/${zoneSlug}/direct`}>
              <Button size="sm" variant="subtle" icon="lock">
                Ask privately
              </Button>
            </Link>
          </div>
        ) : (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={`Message ${channel.name} — everyone in the zone sees this`}
              className="max-h-32 min-h-[44px] w-full resize-none rounded-xl border border-ink-600 bg-ink-900/70 px-3.5 py-3 text-[13.5px] text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
            />
            <Button type="submit" icon="send" loading={busy} disabled={!body.trim()}>
              Send
            </Button>
          </form>
        )}
      </footer>
    </section>
  );
}
