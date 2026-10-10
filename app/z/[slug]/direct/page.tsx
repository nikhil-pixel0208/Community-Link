"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, formatClock, formatRelative, usePoll, useNow } from "@/lib/client";
import type { MemberRole, PublicUser, ThreadDTO, ThreadMessageDTO } from "@/lib/types";
import { useZone } from "@/components/zone-shell";
import { useToast } from "@/components/toast";
import { Avatar, Badge, Button, EmptyState, Icon, Spinner } from "@/components/ui";

export default function DirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-ink-400" />
        </div>
      }
    >
      <DirectInner />
    </Suspense>
  );
}

function DirectInner() {
  const { zone } = useZone();
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get("thread");

  const { data, refresh } = usePoll<{ threads: ThreadDTO[] }>(`/api/zones/${zone.slug}/threads`, {
    intervalMs: 4000,
  });
  const threads = data?.threads ?? [];

  const select = (id: string | null) => {
    const url = id ? `/z/${zone.slug}/direct?thread=${id}` : `/z/${zone.slug}/direct`;
    router.replace(url);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[290px_1fr]">
      <aside className={`space-y-4 ${activeId ? "hidden lg:block" : ""}`}>
        <StaffDirectory zoneSlug={zone.slug} onOpened={(id) => { void refresh(); select(id); }} />

        <div>
          <h2 className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-500">
            Private threads
          </h2>
          {threads.length === 0 ? (
            <p className="rounded-xl border border-dashed hairline px-3.5 py-6 text-center text-[12.5px] leading-relaxed text-ink-500">
              Nothing private yet. One-to-one threads are for the things that shouldn&apos;t be said in front of the
              whole zone.
            </p>
          ) : (
            <div className="space-y-1.5">
              {threads.map((t) => (
                <ThreadRow key={t.id} thread={t} active={t.id === activeId} onClick={() => select(t.id)} />
              ))}
            </div>
          )}
        </div>
      </aside>

      <section className={activeId ? "" : "hidden lg:block"}>
        {activeId ? (
          <ThreadView threadId={activeId} onBack={() => select(null)} onChanged={refresh} />
        ) : (
          <EmptyState
            icon="lock"
            title="Pick a conversation"
            detail="Or start one with an organiser. Threads tied to a post close themselves the moment that post is resolved."
          />
        )}
      </section>
    </div>
  );
}

/* ---------------------------- staff directory --------------------------- */

function StaffDirectory({ zoneSlug, onOpened }: { zoneSlug: string; onOpened: (threadId: string) => void }) {
  const { data } = usePoll<{ staff: { user: PublicUser; role: MemberRole }[] }>(
    `/api/zones/${zoneSlug}/channels`,
    { intervalMs: 60000 },
  );
  const staff = data?.staff ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const open = async (partnerId: string) => {
    setBusy(partnerId);
    try {
      const res = await api<{ thread: ThreadDTO }>(`/api/zones/${zoneSlug}/threads`, {
        method: "POST",
        json: { partnerId, topic: "Direct to organiser" },
      });
      onOpened(res.thread.id);
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "Couldn't open that thread" });
    } finally {
      setBusy(null);
    }
  };

  if (staff.length === 0) return null;

  return (
    <div className="rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-3">
      <h2 className="flex items-center gap-1.5 text-[12px] font-medium text-brand-400">
        <Icon name="shield" className="h-3.5 w-3.5" />
        Reach an organiser directly
      </h2>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
        One tap, no audience. They see your name; nobody else sees the conversation.
      </p>
      <div className="mt-2.5 space-y-1">
        {staff.map((s) => (
          <button
            key={s.user.id}
            disabled={busy !== null}
            onClick={() => void open(s.user.id)}
            className="flex w-full items-center gap-2 rounded-lg bg-ink-900/60 p-1.5 text-left transition hover:bg-ink-800 disabled:opacity-50"
          >
            <Avatar user={s.user} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] text-ink-100">{s.user.displayName}</span>
              <span className="block truncate text-[11px] text-ink-500">{s.role}</span>
            </span>
            {busy === s.user.id ? (
              <Spinner className="h-3.5 w-3.5 text-ink-400" />
            ) : (
              <Icon name="send" className="h-3.5 w-3.5 text-ink-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ thread row ------------------------------ */

function ThreadRow({ thread, active, onClick }: { thread: ThreadDTO; active: boolean; onClick: () => void }) {
  const now = useNow(30_000);
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
        active ? "border-brand-500/45 bg-brand-500/10" : "border-transparent hover:bg-ink-800/60"
      }`}
    >
      <Avatar user={thread.partner} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-ink-100">{thread.partner.displayName}</span>
          {thread.partnerRole !== "member" ? <Badge tone="brand">{thread.partnerRole}</Badge> : null}
        </div>
        {thread.postTitle ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-ink-500">
            <Icon name="tag" className="h-3 w-3 shrink-0" />
            {thread.postTitle}
          </p>
        ) : null}
        <p className="mt-0.5 truncate text-[12px] text-ink-400">{thread.lastMessagePreview || "No messages yet"}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {thread.lastMessageAt ? (
          <span className="text-[10.5px] text-ink-500">{formatRelative(thread.lastMessageAt, now)}</span>
        ) : null}
        {thread.unreadCount > 0 ? (
          <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
            {thread.unreadCount}
          </span>
        ) : null}
        {thread.closedAt ? <Icon name="ghost" className="h-3.5 w-3.5 text-ink-600" /> : null}
      </div>
    </button>
  );
}

/* ------------------------------ thread view ----------------------------- */

function ThreadView({
  threadId,
  onBack,
  onChanged,
}: {
  threadId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { data, refresh } = usePoll<{ thread: ThreadDTO; messages: ThreadMessageDTO[] }>(
    `/api/threads/${threadId}/messages`,
    { intervalMs: 2500 },
  );
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const bottom = useRef<HTMLDivElement>(null);

  const thread = data?.thread;
  const messages = data?.messages ?? [];

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setBody("");
    try {
      await api(`/api/threads/${threadId}/messages`, { method: "POST", json: { body: text } });
      await refresh();
      onChanged();
    } catch (err) {
      setBody(text);
      toast({ tone: "error", title: err instanceof Error ? err.message : "Message didn't send" });
    } finally {
      setBusy(false);
    }
  };

  if (!thread) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-ink-400" />
      </div>
    );
  }

  const closed = Boolean(thread.closedAt);

  return (
    <div className="panel flex min-h-[70vh] flex-col overflow-hidden rounded-2xl">
      <header className="flex items-center gap-2.5 border-b hairline px-4 py-3">
        <button onClick={onBack} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 lg:hidden">
          <Icon name="arrowLeft" className="h-4 w-4" />
        </button>
        <Avatar user={thread.partner} size={34} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-ink-100">
            {thread.partner.displayName}
            {thread.partnerRole !== "member" ? <Badge tone="brand">{thread.partnerRole}</Badge> : null}
          </p>
          <p className="truncate text-[11.5px] text-ink-400">
            {thread.postTitle ? `about “${thread.postTitle}”` : "private · 1-to-1"}
          </p>
        </div>
        <Badge tone="neutral">
          <Icon name="lock" className="h-3 w-3" />
          private
        </Badge>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState
            icon="lock"
            title="Say what you need"
            detail="This is between the two of you. Nobody in the zone can see it."
          />
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
                  m.isMine
                    ? "rounded-br-md bg-brand-500 text-white"
                    : "rounded-bl-md border hairline bg-ink-800/80 text-ink-100"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-right text-[10.5px] ${m.isMine ? "text-white/60" : "text-ink-500"}`}>
                  {formatClock(m.createdAt)}
                  {m.isMine && m.readAt ? " · read" : ""}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottom} />
      </div>

      <footer className="border-t hairline p-3">
        {closed ? (
          <div className="flex items-start gap-2.5 rounded-xl border hairline bg-ink-900/60 px-3.5 py-3">
            <Icon name="ghost" className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            <div>
              <p className="text-[13px] font-medium text-ink-200">This thread closed itself</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-400">
                {thread.closeReason ?? "Its purpose was served."} Conversations don&apos;t outlive the thing they were
                about.
              </p>
            </div>
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
              placeholder={`Message ${thread.partner.displayName} privately`}
              className="max-h-32 min-h-[44px] w-full resize-none rounded-xl border border-ink-600 bg-ink-900/70 px-3.5 py-3 text-[13.5px] text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
              autoFocus
            />
            <Button type="submit" icon="send" loading={busy} disabled={!body.trim()}>
              Send
            </Button>
          </form>
        )}
      </footer>
    </div>
  );
}
