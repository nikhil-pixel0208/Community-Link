"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, formatCountdown, formatDistance, usePoll } from "@/lib/client";
import type { PublicUser, ZoneSummary } from "@/lib/types";
import { useSession } from "@/components/session";
import { useToast } from "@/components/toast";
import { Avatar, Badge, Button, EmptyState, Field, Icon, Modal, Select, Spinner, TextArea, TextInput } from "@/components/ui";

const KIND_META: Record<string, { label: string; icon: string; tone: "brand" | "sky" | "violet" | "emerald" | "amber" | "rose" }> = {
  hackathon: { label: "Hackathon", icon: "sparkle", tone: "violet" },
  campus: { label: "Campus", icon: "globe", tone: "sky" },
  event: { label: "Event", icon: "megaphone", tone: "rose" },
  transit: { label: "Transit hub", icon: "pin", tone: "amber" },
  techpark: { label: "Tech park", icon: "users", tone: "emerald" },
  neighbourhood: { label: "Neighbourhood", icon: "globe", tone: "brand" },
};

export default function Landing() {
  const { user, loading, coords, locationState, requestLocation } = useSession();

  const query = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : "";
  const { data, refresh } = usePoll<{ zones: ZoneSummary[] }>(`/api/zones${query}`, { intervalMs: 15000 });
  const zones = data?.zones ?? [];

  const mine = zones.filter((z) => z.isMember);
  const others = zones.filter((z) => !z.isMember);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-14">
      <Hero />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-ink-400" />
        </div>
      ) : !user ? (
        <IdentityGate />
      ) : (
        <>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink-100">Zones</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={locationState === "granted" ? "subtle" : "outline"}
                icon="pin"
                onClick={() => void requestLocation()}
                loading={locationState === "asking"}
              >
                {locationState === "granted" ? "Using your location" : "Find zones near me"}
              </Button>
              <JoinByCode onJoined={refresh} />
              <CreateZone onCreated={refresh} coords={coords} />
            </div>
          </div>

          {locationState === "denied" ? (
            <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3.5 py-2.5 text-[12.5px] text-amber-200">
              Location is off — that&apos;s fine. Zones are still joinable with a code, and we never store your
              coordinates either way.
            </p>
          ) : null}

          {mine.length > 0 ? (
            <section className="mt-5">
              <h3 className="mb-2.5 text-[11.5px] font-medium uppercase tracking-wider text-ink-500">You&apos;re in</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {mine.map((z) => (
                  <ZoneCard key={z.id} zone={z} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <h3 className="mb-2.5 text-[11.5px] font-medium uppercase tracking-wider text-ink-500">
              {coords ? "Around you" : "Open zones"}
            </h3>
            {others.length === 0 ? (
              <EmptyState
                icon="globe"
                title="No other zones right now"
                detail="Zones are temporary by design — when an event ends, its zone and everything in it is deleted."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {others.map((z) => (
                  <ZoneCard key={z.id} zone={z} onJoined={refresh} />
                ))}
              </div>
            )}
          </section>

          {others.length > 0 ? <DemoCodes /> : null}

          <Principles />
        </>
      )}
    </div>
  );
}

/* ---------------------------------- hero --------------------------------- */

function Hero() {
  return (
    <header>
      <div className="flex items-center gap-2.5">
        <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white">
          <Icon name="pin" className="h-5 w-5" strokeWidth={2} />
          <span className="animate-ping-ring absolute inset-0 rounded-xl" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-ink-100">Community Link</span>
        <Badge tone="brand" className="ml-1">
          Samartha · PS-05
        </Badge>
      </div>

      <h1 className="mt-7 max-w-2xl text-[30px] font-semibold leading-[1.15] tracking-tight text-ink-100 sm:text-[42px]">
        A community that <span className="text-brand-400">deletes itself</span> when the job is done.
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-300">
        Zone-based social for people who already share a place — a hackathon hall, a campus, a platform at the port.
        Every post is a template with a contract attached: lost item returned, slot filled, offer claimed, deadline
        passed. The moment that contract is met, the post is gone. Nothing accumulates.
      </p>
    </header>
  );
}

/* ------------------------------ identity gate ---------------------------- */

function IdentityGate() {
  const { signIn } = useSession();
  const toast = useToast();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [roster, setRoster] = useState<(PublicUser & { roles: { zone: string; role: string }[] })[]>([]);

  useEffect(() => {
    api<{ users: (PublicUser & { roles: { zone: string; role: string }[] })[] }>("/api/users")
      .then((r) => setRoster(r.users))
      .catch(() => setRoster([]));
  }, []);

  const go = async (input: { handle?: string; userId?: string }) => {
    setBusy(true);
    try {
      await signIn(input);
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "Couldn't sign in" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="panel rounded-2xl p-5">
        <h2 className="text-[15px] font-semibold text-ink-100">Claim a handle</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-400">
          No email, no phone number, no profile to maintain. A handle is enough to be useful to the people standing
          around you.
        </p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (handle.trim()) void go({ handle: handle.trim() });
          }}
        >
          <TextInput
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="your_handle"
            aria-label="Handle"
          />
          <Button type="submit" loading={busy} disabled={!handle.trim()} icon="arrowRight">
            Enter
          </Button>
        </form>
      </div>

      <div className="panel rounded-2xl p-5">
        <h2 className="text-[15px] font-semibold text-ink-100">Or take a seat in the demo</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-400">
          The Samartha zone is already running. Switch between an organiser and a participant to see both ends of a
          private conversation.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {roster.slice(0, 6).map((u) => {
            const top = u.roles[0];
            return (
              <button
                key={u.id}
                disabled={busy}
                onClick={() => void go({ userId: u.id })}
                className="flex items-center gap-2.5 rounded-xl border hairline bg-ink-900/60 p-2.5 text-left transition hover:border-brand-500/50 hover:bg-brand-500/5 disabled:opacity-50"
              >
                <Avatar user={u} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink-100">{u.displayName}</span>
                  <span className="block truncate text-[11.5px] text-ink-400">
                    {top ? `${top.role} · ${top.zone}` : `@${u.handle}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- zone card ------------------------------ */

function ZoneCard({ zone, onJoined }: { zone: ZoneSummary; onJoined?: () => void }) {
  const meta = KIND_META[zone.kind] ?? KIND_META.event;
  const { coords } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const endsIn = zone.endsAt - Date.now();

  const join = async () => {
    setBusy(true);
    try {
      await api(`/api/zones/${zone.slug}/join`, {
        method: "POST",
        json: coords ? { lat: coords.lat, lng: coords.lng } : {},
      });
      toast({ tone: "success", title: `You're in ${zone.name}` });
      onJoined?.();
      router.push(`/z/${zone.slug}`);
    } catch (err) {
      toast({
        tone: "error",
        title: err instanceof Error ? err.message : "Couldn't join",
        detail: "Zones check that you're actually there — or that you have the code.",
      });
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={meta.tone}>
              <Icon name={meta.icon} className="h-3 w-3" />
              {meta.label}
            </Badge>
            {zone.inRange ? <Badge tone="emerald">you&apos;re inside</Badge> : null}
            {zone.role && zone.role !== "member" ? <Badge tone="brand">{zone.role}</Badge> : null}
          </div>
          <h3 className="mt-2 truncate text-[15px] font-semibold text-ink-100">{zone.name}</h3>
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-400">{zone.description}</p>
        </div>
      </div>

      <dl className="mt-3.5 grid grid-cols-3 gap-2 border-t hairline pt-3">
        <Stat label="People" value={String(zone.memberCount)} />
        <Stat label="Live posts" value={String(zone.openPostCount)} />
        <Stat
          label={zone.distanceM !== null ? "Distance" : "Closes in"}
          value={zone.distanceM !== null ? formatDistance(zone.distanceM) : formatCountdown(endsIn)}
        />
      </dl>
    </>
  );

  if (zone.isMember) {
    return (
      <Link
        href={`/z/${zone.slug}`}
        className="panel block rounded-2xl p-4 transition hover:border-brand-500/45 hover:bg-brand-500/[0.04]"
      >
        {body}
        <span className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-400">
          Open zone <Icon name="arrowRight" className="h-3.5 w-3.5" />
        </span>
      </Link>
    );
  }

  return (
    <div className="panel rounded-2xl p-4">
      {body}
      <div className="mt-3 flex items-center gap-2">
        {zone.inRange ? (
          <Button size="sm" onClick={join} loading={busy} icon="pin">
            You&apos;re here — join
          </Button>
        ) : (
          <Link href={`/z/${zone.slug}`}>
            <Button size="sm" variant="subtle" icon="arrowRight">
              Join
            </Button>
          </Link>
        )}
        <span className="text-[11.5px] text-ink-500">
          {zone.distanceM !== null && !zone.inRange
            ? `${formatDistance(zone.distanceM)} away — needs a code`
            : "Verify by location or code"}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="mt-0.5 font-mono text-[13px] tabular-nums text-ink-200">{value}</dd>
    </div>
  );
}

/* ------------------------------ join by code ----------------------------- */

function JoinByCode({ onJoined }: { onJoined: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const submit = async () => {
    setBusy(true);
    try {
      const { zone } = await api<{ zone: ZoneSummary }>("/api/zones/join-by-code", {
        method: "POST",
        json: { code },
      });
      toast({ tone: "success", title: `You're in ${zone.name}` });
      setOpen(false);
      onJoined();
      router.push(`/z/${zone.slug}`);
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "That code didn't work" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" icon="lock" onClick={() => setOpen(true)}>
        Join with a code
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Join with a code"
        subtitle="For when you're in the building but GPS says otherwise."
        width="max-w-md"
      >
        <div className="space-y-4">
          <Field label="Zone code" help="Try SMRT-2026 for the Samartha hackathon zone.">
            <TextInput
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SMRT-2026"
              className="font-mono tracking-widest"
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy} disabled={!code.trim()} icon="arrowRight">
              Join
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------ create zone ------------------------------ */

function CreateZone({ onCreated, coords }: { onCreated: () => void; coords: { lat: number; lng: number } | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("event");
  const [description, setDescription] = useState("");
  const [radiusM, setRadiusM] = useState(400);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const { requestLocation } = useSession();

  const center = useMemo(() => coords ?? { lat: 16.9891, lng: 82.2475 }, [coords]);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api<{ zone: ZoneSummary }>("/api/zones", {
        method: "POST",
        json: {
          name,
          kind,
          description,
          lat: center.lat,
          lng: center.lng,
          radiusM,
          durationMs: hours * 60 * 60 * 1000,
        },
      });
      toast({
        tone: "success",
        title: "Zone is live",
        detail: `It deletes itself ${hours}h from now, along with everything posted inside it.`,
      });
      setOpen(false);
      onCreated();
      router.push(`/z/${res.zone.slug}`);
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "Couldn't create that zone" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" icon="plus" onClick={() => setOpen(true)}>
        Start a zone
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Start a zone"
        subtitle="A zone is a place plus a deadline. Both are mandatory."
      >
        <div className="space-y-4">
          <Field label="Name" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Samartha Hackathon 2026" />
          </Field>
          <Field label="What kind of place is it?">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="hackathon">Hackathon</option>
              <option value="campus">Campus</option>
              <option value="event">Event</option>
              <option value="transit">Transit hub</option>
              <option value="techpark">Tech park</option>
              <option value="neighbourhood">Neighbourhood</option>
            </Select>
          </Field>
          <Field label="Describe it" help="People decide whether to join from this line.">
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="36 hours, 9 tracks, one hall."
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Radius (metres)" help="How close you must be to walk in.">
              <TextInput
                type="number"
                min={50}
                max={20000}
                value={radiusM}
                onChange={(e) => setRadiusM(Number(e.target.value) || 400)}
              />
            </Field>
            <Field label="Lifetime (hours)" help="Then the zone and its contents are erased.">
              <TextInput
                type="number"
                min={1}
                max={720}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value) || 24)}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border hairline bg-ink-900/60 px-3 py-2.5">
            <span className="flex items-center gap-2 text-[12.5px] text-ink-300">
              <Icon name="pin" className="h-4 w-4 text-ink-400" />
              Centre: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
              {!coords ? <span className="text-ink-500">(default)</span> : null}
            </span>
            <button
              onClick={() => void requestLocation()}
              className="text-[12px] text-brand-400 underline-offset-2 hover:underline"
            >
              use my location
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy} disabled={name.trim().length < 3} icon="sparkle">
              Create zone
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------- demo codes ------------------------------ */

/**
 * Scaffolding for reviewers. In the real thing these codes live on a badge, a
 * poster at the gate, or nowhere at all — you just walk into the radius.
 */
function DemoCodes() {
  const codes = [
    { code: "SMRT-2026", zone: "Samartha Hackathon 2026" },
    { code: "JNTU-KKD1", zone: "JNTU Kakinada Campus" },
    { code: "KKD-PORT", zone: "Kakinada Port Transit Hub" },
  ];
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-dashed hairline px-3.5 py-3">
      <span className="text-[11.5px] uppercase tracking-wider text-ink-500">Demo codes</span>
      {codes.map((c) => (
        <span key={c.code} className="flex items-center gap-1.5 text-[12px] text-ink-400">
          <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[11.5px] text-ink-200">{c.code}</code>
          {c.zone}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------- principles ------------------------------ */

function Principles() {
  const items = [
    {
      icon: "ghost",
      title: "Resolution, not retention",
      body: "A found watch, a filled slot, a claimed offer — each one is a trigger that deletes the post that asked for it.",
    },
    {
      icon: "lock",
      title: "Two ways to talk",
      body: "Broadcast to the zone when it's everyone's business. Open a private 1:1 with an organiser when it isn't.",
    },
    {
      icon: "pin",
      title: "Presence, not profiles",
      body: "Location is opt-in and never stored. We check you're inside the radius, then forget the coordinates.",
    },
    {
      icon: "shield",
      title: "Moderation that scales down",
      body: "Report, block, auto-hide on three flags, and a visible trail of every lifecycle decision in the zone.",
    },
  ];
  return (
    <section className="mt-12 border-t hairline pt-8">
      <h2 className="text-[11.5px] font-medium uppercase tracking-wider text-ink-500">How it works</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => (
          <div key={i.title}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-800 text-brand-400">
              <Icon name={i.icon} className="h-4 w-4" />
            </span>
            <h3 className="mt-2.5 text-[13.5px] font-semibold text-ink-100">{i.title}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-400">{i.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
