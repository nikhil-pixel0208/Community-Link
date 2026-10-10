"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { api, formatCountdown, usePoll, useNow } from "@/lib/client";
import type { PublicUser, ZoneSummary } from "@/lib/types";
import { useSession } from "./session";
import { useToast } from "./toast";
import { Avatar, Badge, Button, Icon, Modal, Spinner } from "./ui";

interface ZoneContext {
  zone: ZoneSummary;
  refreshZone: () => Promise<void>;
}

const Ctx = createContext<ZoneContext | null>(null);

export function useZone(): ZoneContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useZone must be used inside <ZoneShell>");
  return ctx;
}

const NAV = [
  { key: "", label: "Feed", icon: "feed" },
  { key: "chat", label: "Zone chat", icon: "chat" },
  { key: "direct", label: "Direct", icon: "lock" },
  { key: "people", label: "People", icon: "users" },
  { key: "activity", label: "Activity", icon: "activity" },
];

export function ZoneShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { data, refresh } = usePoll<{ zone: ZoneSummary }>(`/api/zones/${slug}`, { intervalMs: 20000 });
  const zone = data?.zone ?? null;

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (!zone || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6 text-ink-400" />
      </div>
    );
  }

  if (!zone.isMember) {
    return <NotAMember zone={zone} onJoined={refresh} />;
  }

  const base = `/z/${zone.slug}`;
  const current = pathname === base ? "" : pathname.slice(base.length + 1).split("/")[0];

  return (
    <Ctx.Provider value={{ zone, refreshZone: refresh }}>
      <div className="flex min-h-screen flex-col">
        <ZoneHeader zone={zone} user={user} />

        <nav className="sticky top-0 z-30 border-b hairline bg-ink-950/85 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-5xl gap-0.5 overflow-x-auto px-2 sm:px-4">
            {NAV.map((item) => {
              const href = item.key ? `${base}/${item.key}` : base;
              const active = current === item.key;
              return (
                <Link
                  key={item.key}
                  href={href}
                  className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-[13px] font-medium transition ${
                    active ? "text-ink-100" : "text-ink-400 hover:text-ink-200"
                  }`}
                >
                  <Icon name={item.icon} className="h-4 w-4" />
                  {item.label}
                  {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-500" /> : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-5 sm:px-6">{children}</main>
      </div>
    </Ctx.Provider>
  );
}

function ZoneHeader({ zone, user }: { zone: ZoneSummary; user: PublicUser }) {
  const now = useNow(1000);
  const endsIn = Math.max(0, zone.endsAt - now);
  const ending = endsIn < 60 * 60 * 1000;

  return (
    <header className="border-b hairline">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-ink-300 transition hover:text-ink-100">
          <Icon name="arrowLeft" className="h-4 w-4" />
          <span className="sr-only">All zones</span>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold text-ink-100">{zone.name}</h1>
            {zone.role && zone.role !== "member" ? <Badge tone="brand">{zone.role}</Badge> : null}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-ink-400">
            <span>{zone.memberCount} here</span>
            <span className="text-ink-600">·</span>
            <span>{zone.openPostCount} live</span>
            <span className="text-ink-600">·</span>
            <span className={ending ? "text-amber-300" : ""}>zone ends in {formatCountdown(endsIn)}</span>
            {zone.joinCode ? (
              <>
                <span className="text-ink-600">·</span>
                <span className="font-mono text-ink-300">{zone.joinCode}</span>
              </>
            ) : null}
          </p>
        </div>

        <UserMenu user={user} />
      </div>
    </header>
  );
}

function UserMenu({ user }: { user: PublicUser }) {
  const { signOut, signIn } = useSession();
  const [open, setOpen] = useState(false);
  const [roster, setRoster] = useState<PublicUser[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    api<{ users: PublicUser[] }>("/api/users")
      .then((r) => setRoster(r.users))
      .catch(() => setRoster([]));
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border hairline bg-ink-900/60 py-1 pl-1 pr-2.5 transition hover:border-ink-500"
      >
        <Avatar user={user} size={28} />
        <span className="hidden text-[12.5px] font-medium text-ink-200 sm:block">{user.displayName}</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Your seat" width="max-w-md">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border hairline bg-ink-900/60 p-3">
            <Avatar user={user} size={40} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-ink-100">{user.displayName}</p>
              <p className="truncate text-[12px] text-ink-400">
                @{user.handle} · trust {user.trustScore}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-500">
              Switch seat (demo)
            </p>
            <div className="grid max-h-56 gap-1.5 overflow-y-auto">
              {roster
                .filter((u) => u.id !== user.id)
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={async () => {
                      await signIn({ userId: u.id });
                      setOpen(false);
                      router.refresh();
                    }}
                    className="flex items-center gap-2.5 rounded-lg border hairline bg-ink-900/40 p-2 text-left transition hover:border-brand-500/50"
                  >
                    <Avatar user={u} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-ink-200">{u.displayName}</span>
                    </span>
                    <Icon name="arrowRight" className="h-3.5 w-3.5 text-ink-500" />
                  </button>
                ))}
            </div>
          </div>

          <Button
            variant="outline"
            icon="logout"
            className="w-full"
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
          >
            Sign out
          </Button>
        </div>
      </Modal>
    </>
  );
}

function NotAMember({ zone, onJoined }: { zone: ZoneSummary; onJoined: () => Promise<void> }) {
  const { coords, requestLocation, locationState } = useSession();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const join = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api(`/api/zones/${zone.slug}/join`, { method: "POST", json: payload });
      await onJoined();
      toast({ tone: "success", title: `You're in ${zone.name}` });
    } catch (err) {
      toast({ tone: "error", title: err instanceof Error ? err.message : "Couldn't join" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5">
      <div className="panel rounded-2xl p-6">
        <Badge tone="brand">{zone.kind}</Badge>
        <h1 className="mt-3 text-[20px] font-semibold text-ink-100">{zone.name}</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-400">{zone.description}</p>

        <div className="mt-5 space-y-2.5">
          <Button
            className="w-full"
            icon="pin"
            loading={busy || locationState === "asking"}
            onClick={async () => {
              const c = coords ?? (await requestLocation());
              if (!c) {
                toast({ tone: "error", title: "Location unavailable — use the code instead." });
                return;
              }
              await join({ lat: c.lat, lng: c.lng });
            }}
          >
            I&apos;m here — verify by location
          </Button>

          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-ink-700" />
            <span className="text-[11px] uppercase tracking-wider text-ink-500">or</span>
            <span className="h-px flex-1 bg-ink-700" />
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void join({ code });
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ZONE-CODE"
              className="w-full rounded-xl border border-ink-600 bg-ink-900/70 px-3.5 py-2.5 font-mono text-sm tracking-widest text-ink-100 placeholder:text-ink-500 outline-none focus:border-brand-500"
            />
            <Button type="submit" variant="subtle" loading={busy} disabled={!code.trim()}>
              Join
            </Button>
          </form>
        </div>

        <p className="mt-5 text-[12px] leading-relaxed text-ink-500">
          We compare your position to the zone radius and then discard it. Nothing about where you are is written to
          the database.
        </p>
      </div>
      <Link href="/" className="mt-4 text-center text-[12.5px] text-ink-400 hover:text-ink-200">
        ← all zones
      </Link>
    </div>
  );
}
