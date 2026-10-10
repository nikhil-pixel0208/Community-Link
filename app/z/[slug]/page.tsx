"use client";

import { useMemo, useState } from "react";
import { usePoll } from "@/lib/client";
import { TEMPLATES, TEMPLATE_ORDER, type TemplateId } from "@/lib/templates";
import type { PostDTO } from "@/lib/types";
import { Composer } from "@/components/composer";
import { PostCard } from "@/components/post-card";
import { useZone } from "@/components/zone-shell";
import { Button, EmptyState, Icon, Spinner, TextInput } from "@/components/ui";

export default function FeedPage() {
  const { zone, refreshZone } = useZone();
  const [template, setTemplate] = useState<TemplateId | "all">("all");
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const params = new URLSearchParams();
  if (template !== "all") params.set("template", template);
  if (mine) params.set("mine", "1");
  const qs = params.toString();

  const { data, loading, refresh } = usePoll<{
    posts: PostDTO[];
    votes: Record<string, Record<number, number>>;
  }>(`/api/zones/${zone.slug}/posts${qs ? `?${qs}` : ""}`, { intervalMs: 4000 });

  const all = data?.posts ?? [];
  const posts = useMemo(() => {
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((p) => `${p.title} ${p.body} ${JSON.stringify(p.payload)}`.toLowerCase().includes(q));
  }, [all, query]);

  const live = posts.filter((p) => p.status === "open");
  const settled = posts.filter((p) => p.status !== "open");

  const onChanged = () => {
    void refresh();
    void refreshZone();
  };

  return (
    <div className="space-y-4">
      {/* filter rail */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={template === "all"} onClick={() => setTemplate("all")} icon="feed">
          Everything
        </Chip>
        {TEMPLATE_ORDER.map((id) => {
          const def = TEMPLATES[id];
          const count = all.filter((p) => p.template === id && p.status === "open").length;
          return (
            <Chip key={id} active={template === id} onClick={() => setTemplate(id)} icon={def.icon} count={count}>
              {def.label}
            </Chip>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this zone…"
            className="pl-9"
          />
        </div>
        <Button variant={mine ? "subtle" : "ghost"} size="md" icon="eye" onClick={() => setMine((v) => !v)}>
          {mine ? "My posts" : "All posts"}
        </Button>
        <Button icon="plus" onClick={() => setComposerOpen(true)}>
          Post
        </Button>
      </div>

      {/* feed */}
      {loading && all.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-ink-400" />
        </div>
      ) : live.length === 0 && settled.length === 0 ? (
        <EmptyState
          icon="ghost"
          title={mine ? "You haven't posted here" : "Nothing live in this zone"}
          detail="An empty feed is the system working. Every post here left because somebody's problem got solved."
          action={
            <Button size="sm" icon="plus" onClick={() => setComposerOpen(true)}>
              Start something
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {live.map((p) => (
            <PostCard key={p.id} post={p} zoneSlug={zone.slug} votes={data?.votes?.[p.id]} onChanged={onChanged} />
          ))}

          {settled.length > 0 ? (
            <section className="pt-3">
              <h2 className="mb-2 flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-wider text-ink-500">
                <Icon name="ghost" className="h-3.5 w-3.5" />
                On their way out — only you can see these
              </h2>
              <div className="space-y-2">
                {settled.map((p) => (
                  <PostCard key={p.id} post={p} zoneSlug={zone.slug} onChanged={onChanged} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        zoneSlug={zone.slug}
        myRole={zone.role ?? "member"}
        onCreated={onChanged}
        initialTemplate={template === "all" ? null : template}
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${
        active
          ? "border-brand-500/50 bg-brand-500/15 text-brand-400"
          : "border-ink-600 bg-ink-900/50 text-ink-300 hover:border-ink-500 hover:text-ink-100"
      }`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {children}
      {count ? (
        <span className={`rounded-full px-1.5 text-[10.5px] tabular-nums ${active ? "bg-brand-500/25" : "bg-ink-700"}`}>
          {count}
        </span>
      ) : null}
    </button>
  );
}
