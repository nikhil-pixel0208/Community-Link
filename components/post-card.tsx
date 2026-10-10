"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, formatCountdown, formatRelative, useNow } from "@/lib/client";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import type { PostDTO, ResponseDTO } from "@/lib/types";
import { useToast } from "./toast";
import { LifetimeBar, LifetimeRing, PurgeCountdown } from "./lifetime";
import { Avatar, Badge, Button, Field, Icon, Modal, Select, TextArea } from "./ui";
import { REPORT_REASON_LIST } from "@/lib/report-reasons";

type Tone = "amber" | "emerald" | "violet" | "rose" | "sky" | "cyan";

const ACCENT: Record<string, { tone: Tone; bar: string; glow: string; text: string }> = {
  amber: { tone: "amber", bar: "bg-amber-400", glow: "shadow-amber-500/10", text: "text-amber-300" },
  emerald: { tone: "emerald", bar: "bg-emerald-400", glow: "shadow-emerald-500/10", text: "text-emerald-300" },
  violet: { tone: "violet", bar: "bg-violet-400", glow: "shadow-violet-500/10", text: "text-violet-300" },
  rose: { tone: "rose", bar: "bg-rose-400", glow: "shadow-rose-500/10", text: "text-rose-300" },
  sky: { tone: "sky", bar: "bg-sky-400", glow: "shadow-sky-500/10", text: "text-sky-300" },
  cyan: { tone: "cyan", bar: "bg-cyan-400", glow: "shadow-cyan-500/10", text: "text-cyan-300" },
};

export function PostCard({
  post,
  zoneSlug,
  votes,
  onChanged,
}: {
  post: PostDTO;
  zoneSlug: string;
  votes?: Record<number, number>;
  onChanged: () => void;
}) {
  const def = TEMPLATES[post.template as TemplateId];
  const accent = ACCENT[def?.accent ?? "sky"] ?? ACCENT.sky;
  const toast = useToast();
  const router = useRouter();
  const now = useNow(1000);

  const [respondOpen, setRespondOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const settled = post.status !== "open";
  const dissolving = settled && post.purgeAt !== null && post.purgeAt - now < 6000;

  const act = async (key: string, fn: () => Promise<unknown>, successMsg?: string) => {
    setBusy(key);
    try {
      await fn();
      if (successMsg) toast({ tone: "success", title: successMsg });
      onChanged();
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "That didn't work" });
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const messageAuthor = async () => {
    if (!post.author || post.author.id === "anonymous") return;
    setBusy("dm");
    try {
      const res = await api<{ thread: { id: string } }>(`/api/zones/${zoneSlug}/threads`, {
        method: "POST",
        json: { partnerId: post.author.id, topic: post.title, postId: post.id },
      });
      router.push(`/z/${zoneSlug}/direct?thread=${res.thread.id}`);
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "Couldn't open that chat" });
    } finally {
      setBusy(null);
    }
  };

  /* ------------------------------ receipt ------------------------------ */
  if (settled) {
    const resolved = post.status === "resolved";
    return (
      <article
        className={`panel overflow-hidden rounded-2xl ${dissolving ? "animate-dissolve" : "animate-rise"}`}
        aria-live="polite"
      >
        <div className="flex items-start gap-3 px-4 py-3.5">
          <div
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              resolved ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-800 text-ink-400"
            }`}
          >
            <Icon name={resolved ? "check" : "clock"} className="h-4.5 w-4.5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={resolved ? "emerald" : "neutral"}>
                {resolved ? def?.resolvedLabel ?? "Resolved" : post.status === "expired" ? "Timed out" : "Removed"}
              </Badge>
              <span className="text-[12px] text-ink-400">{def?.label}</span>
            </div>
            <p className="mt-1.5 truncate text-sm text-ink-200 line-through decoration-ink-500">{post.title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-400">
              {resolved
                ? post.resolutionNote || "Its purpose was served."
                : "Nobody closed the loop before the clock ran out."}{" "}
              This receipt is visible only to the people involved.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              {post.purgeAt ? <PurgeCountdown purgeAt={post.purgeAt} /> : null}
              {post.isAuthor ? (
                <button
                  onClick={() => act("purge", () => api(`/api/posts/${post.id}`, { method: "DELETE" }), "Erased.")}
                  className="text-[12px] text-ink-400 underline-offset-2 transition hover:text-ink-200 hover:underline"
                >
                  erase now
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    );
  }

  /* -------------------------------- live ------------------------------- */
  const pending = post.responses.filter((r) => r.status === "pending" && r.kind !== "vote");
  const acceptedList = post.responses.filter((r) => r.status === "accepted");
  const pollOptions = (post.payload.options as string[] | undefined) ?? [];
  const isPoll = post.template === "question" && pollOptions.length > 0;
  const myVote = post.responses.find((r) => r.isMine && r.kind === "vote");
  const myVoteIndex = myVote ? Number((myVote.meta as { option?: number }).option ?? -1) : -1;

  const progress =
    def?.resolveMode === "fill_slots" || def?.resolveMode === "quota"
      ? { filled: post.slotsFilled, needed: post.slotsNeeded }
      : null;

  return (
    <article
      className={`panel animate-rise group relative overflow-hidden rounded-2xl shadow-xl ${accent.glow} transition-colors hover:border-ink-500`}
    >
      <div className={`absolute inset-x-0 top-0 h-[3px] ${accent.bar} opacity-70`} />

      <div className="px-4 pt-4 sm:px-5">
        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar user={post.author ?? { displayName: "?", avatarHue: 220, handle: "anon" }} size={34} />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-ink-100">
                {post.author?.displayName ?? "Someone"}
                {post.isAuthor ? <span className="ml-1.5 text-[11px] font-normal text-brand-400">you</span> : null}
              </p>
              <p className="truncate text-[11.5px] text-ink-400">
                {post.isAnonymous ? "anonymous" : `@${post.author?.handle}`} · {formatRelative(post.createdAt, now)}
              </p>
            </div>
          </div>
          <LifetimeRing createdAt={post.createdAt} expiresAt={post.expiresAt} />
        </div>

        {/* template + urgency */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge tone={accent.tone}>
            <Icon name={def?.icon ?? "help"} className="h-3 w-3" />
            {def?.label}
          </Badge>
          {post.urgency !== "normal" ? (
            <Badge tone={post.urgency === "critical" ? "rose" : "amber"}>
              {post.urgency === "critical" ? "urgent" : "time-sensitive"}
            </Badge>
          ) : null}
          {progress ? (
            <Badge tone="neutral">
              {progress.filled}/{progress.needed} {def?.resolveMode === "quota" ? "claimed" : "filled"}
            </Badge>
          ) : null}
        </div>

        {/* body */}
        <h3 className="mt-2.5 text-[15.5px] font-semibold leading-snug text-ink-100">{post.title}</h3>
        {post.body ? (
          <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-200">{post.body}</p>
        ) : null}

        <PayloadDetails post={post} />

        {/* poll */}
        {isPoll ? (
          <div className="mt-3 space-y-1.5">
            {pollOptions.map((opt, i) => {
              const count = votes?.[i] ?? 0;
              const total = Object.values(votes ?? {}).reduce((a, b) => a + b, 0);
              const pct = total ? Math.round((count / total) * 100) : 0;
              const mine = myVoteIndex === i;
              return (
                <button
                  key={i}
                  disabled={post.isAuthor || busy !== null}
                  onClick={() =>
                    act("vote", () =>
                      api(`/api/posts/${post.id}/respond`, {
                        method: "POST",
                        json: { kind: "vote", meta: { option: i } },
                      }),
                    )
                  }
                  className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-[13px] transition disabled:cursor-default ${
                    mine ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-100" : "border-ink-600 bg-ink-900/50 text-ink-200 hover:border-ink-500"
                  }`}
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-cyan-500/10 transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      {mine ? <Icon name="check" className="h-3.5 w-3.5" /> : null}
                      {opt}
                    </span>
                    <span className="font-mono text-[11.5px] tabular-nums text-ink-400">
                      {count} · {pct}%
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* slot progress bar */}
        {progress ? (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
              <div
                className={`h-full rounded-full ${accent.bar} transition-[width] duration-500`}
                style={{ width: `${Math.min(100, (progress.filled / Math.max(1, progress.needed)) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11.5px] text-ink-400">
              {def?.resolveMode === "quota"
                ? `${Math.max(0, progress.needed - progress.filled)} left — the post disappears when they run out`
                : `${Math.max(0, progress.needed - progress.filled)} more and this post disappears`}
            </p>
          </div>
        ) : null}
      </div>

      {/* responses, author view */}
      {post.isAuthor && pending.length > 0 ? (
        <div className="mt-4 border-t hairline bg-ink-900/40 px-4 py-3 sm:px-5">
          <p className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-400">
            {pending.length} waiting on you
          </p>
          <div className="space-y-2">
            {pending.map((r) => (
              <ResponseRow
                key={r.id}
                response={r}
                acceptLabel={def?.acceptLabel ?? "Accept"}
                busy={busy === r.id}
                onDecide={(decision) =>
                  act(
                    r.id,
                    () =>
                      api(`/api/posts/${post.id}/responses/${r.id}`, {
                        method: "POST",
                        json: { decision },
                      }),
                    decision === "accepted" ? "Loop closed — this post is on its way out." : undefined,
                  )
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {acceptedList.length > 0 && !post.isAuthor ? (
        <div className="mt-4 border-t hairline bg-emerald-500/5 px-4 py-2.5 sm:px-5">
          <p className="flex items-center gap-1.5 text-[12.5px] text-emerald-300">
            <Icon name="check" className="h-3.5 w-3.5" />
            {acceptedList.length} {acceptedList.length === 1 ? "person has" : "people have"} stepped in
          </p>
        </div>
      ) : null}

      {/* actions */}
      <footer className="mt-4 flex flex-wrap items-center gap-2 border-t hairline px-4 py-3 sm:px-5">
        {!post.isAuthor ? (
          post.myResponse && post.myResponse.kind !== "vote" ? (
            <Badge tone={post.myResponse.status === "accepted" ? "emerald" : "brand"}>
              {post.myResponse.status === "accepted" ? "accepted — thank you" : "you responded"}
            </Badge>
          ) : (
            <Button size="sm" icon="sparkle" onClick={() => setRespondOpen(true)} disabled={busy !== null}>
              {def?.respondCta ?? "Respond"}
            </Button>
          )
        ) : null}

        {!post.isAuthor && post.author?.id !== "anonymous" ? (
          <Button size="sm" variant="ghost" icon="lock" onClick={messageAuthor} loading={busy === "dm"}>
            Message privately
          </Button>
        ) : null}

        {post.isAuthor ? (
          <>
            <Button
              size="sm"
              variant="subtle"
              icon="check"
              onClick={() =>
                act(
                  "close",
                  () => api(`/api/posts/${post.id}/close`, { method: "POST", json: { note: "Sorted — closed by author" } }),
                  "Closed. It's leaving the feed.",
                )
              }
              loading={busy === "close"}
            >
              {def?.resolveMode === "deadline" ? "Close early" : "Sorted — close it"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="clock"
              onClick={() =>
                act("extend", () =>
                  api(`/api/posts/${post.id}/extend`, { method: "POST", json: { extraMs: 60 * 60 * 1000 } }),
                )
              }
              loading={busy === "extend"}
            >
              +1 hour
            </Button>
          </>
        ) : null}

        <span className="ml-auto flex items-center gap-1">
          {post.responseCount > 0 ? (
            <span className="mr-1 text-[11.5px] text-ink-400">
              {post.responseCount} {post.responseCount === 1 ? "response" : "responses"}
            </span>
          ) : null}
          {!post.isAuthor ? (
            <button
              onClick={() => setReportOpen(true)}
              className="rounded-lg p-1.5 text-ink-500 transition hover:bg-ink-800 hover:text-ink-300"
              aria-label="Report this post"
              title="Report"
            >
              <Icon name="flag" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </span>
      </footer>

      <LifetimeBar createdAt={post.createdAt} expiresAt={post.expiresAt} />

      <RespondModal
        open={respondOpen}
        onClose={() => setRespondOpen(false)}
        post={post}
        onDone={onChanged}
        zoneSlug={zoneSlug}
      />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} postId={post.id} zoneSlug={zoneSlug} />
    </article>
  );
}

/* ------------------------- template payload view ------------------------ */

function PayloadDetails({ post }: { post: PostDTO }) {
  const def = TEMPLATES[post.template as TemplateId];
  const rows = useMemo(() => {
    if (!def) return [];
    const firstText = def.fields.find((f) => f.required && (f.type === "text" || f.type === "textarea"));
    const firstArea = def.fields.find((f) => f.type === "textarea");
    return def.fields
      .filter((f) => f.name !== firstText?.name && f.name !== firstArea?.name && f.type !== "options")
      .map((f) => ({ field: f, value: post.payload[f.name] }))
      .filter((r) => r.value !== undefined && r.value !== null && String(r.value).length > 0);
  }, [def, post.payload]);

  if (rows.length === 0) return null;

  return (
    <dl className="mt-3 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
      {rows.map(({ field, value }) => (
        <div key={field.name} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wider text-ink-500">{field.label}</dt>
          <dd className="mt-0.5 text-[13px] text-ink-200">
            {Array.isArray(value) ? (
              <span className="flex flex-wrap gap-1">
                {value.map((v) => (
                  <span key={String(v)} className="rounded-md bg-ink-800 px-1.5 py-0.5 text-[11.5px] text-ink-200">
                    {String(v)}
                  </span>
                ))}
              </span>
            ) : (
              String(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ----------------------------- response row ----------------------------- */

function ResponseRow({
  response,
  acceptLabel,
  busy,
  onDecide,
}: {
  response: ResponseDTO;
  acceptLabel: string;
  busy: boolean;
  onDecide: (d: "accepted" | "declined") => void;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border hairline bg-ink-900/60 p-2.5">
      <Avatar user={response.user} size={28} />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-ink-100">
          {response.user.displayName}
          <span className="ml-1.5 font-normal text-ink-500">trust {response.user.trustScore}</span>
        </p>
        {response.body ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-300">{response.body}</p> : null}
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" icon="check" onClick={() => onDecide("accepted")} loading={busy}>
            {acceptLabel}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDecide("declined")} disabled={busy}>
            Not this
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ respond modal --------------------------- */

function RespondModal({
  open,
  onClose,
  post,
  onDone,
  zoneSlug,
}: {
  open: boolean;
  onClose: () => void;
  post: PostDTO;
  onDone: () => void;
  zoneSlug: string;
}) {
  const def = TEMPLATES[post.template as TemplateId];
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api<{ threadId: string | null }>(`/api/posts/${post.id}/respond`, {
        method: "POST",
        json: { body },
      });
      onClose();
      setBody("");
      onDone();
      if (res.threadId) {
        toast({
          tone: "success",
          title: "Sent — and a private thread is open",
          detail: "Coordinate there. It closes itself when this post resolves.",
        });
        router.push(`/z/${zoneSlug}/direct?thread=${res.threadId}`);
      } else {
        toast({ tone: "success", title: "Done." });
      }
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "Couldn't send that" });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const needsBody = def?.respondPlaceholder !== "";

  return (
    <Modal open={open} onClose={onClose} title={def?.respondCta ?? "Respond"} subtitle={post.title}>
      <div className="space-y-4">
        {needsBody ? (
          <Field label="Your message" help="This also opens a private 1:1 thread with the author.">
            <TextArea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={def?.respondPlaceholder}
              autoFocus
            />
          </Field>
        ) : (
          <p className="text-[13.5px] leading-relaxed text-ink-300">
            {def?.resolveMode === "quota"
              ? "Claiming takes one of the available slots. When they're gone, this post disappears for everyone."
              : "This marks you as having seen it."}
          </p>
        )}
        <div className="flex items-center gap-2 rounded-xl border hairline bg-ink-900/60 px-3 py-2.5">
          <Icon name="ghost" className="h-4 w-4 shrink-0 text-ink-400" />
          <p className="text-[12.5px] leading-snug text-ink-400">{def?.vanishRule}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon="send" onClick={submit} loading={busy} disabled={needsBody && !body.trim()}>
            {def?.respondCta}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ report modal ---------------------------- */

function ReportModal({
  open,
  onClose,
  postId,
  zoneSlug,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  zoneSlug: string;
}) {
  const [reason, setReason] = useState<string>(REPORT_REASON_LIST[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/api/zones/${zoneSlug}/reports`, {
        method: "POST",
        json: { targetType: "post", targetId: postId, reason, note },
      });
      toast({ tone: "success", title: "Reported", detail: "A moderator will see this in their queue." });
      onClose();
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "Couldn't report that" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Report this post" subtitle="Moderators see the report, not your name.">
      <div className="space-y-4">
        <Field label="Reason" required>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASON_LIST.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Anything else?" help="Optional, but it helps the moderator act faster.">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's wrong with it?" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" icon="flag" onClick={submit} loading={busy}>
            Send report
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function CountdownText({ to }: { to: number }) {
  const now = useNow(1000);
  return <>{formatCountdown(Math.max(0, to - now))}</>;
}
