import { getDb, getMeta, nowMs, setMeta } from "./db";
import { newId } from "./ids";
import { createUser, type UserRow } from "./auth";
import { logEvent } from "./lifecycle";
import { joinZone, seedDefaultChannels } from "./zones";
import type { MemberRole } from "./types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const SEED_VERSION = "2026-10-10.1";

/**
 * Demo world. Centred on Kakinada so "zones near me" is believable on the day,
 * and pre-loaded with posts mid-lifecycle so a judge sees a living zone rather
 * than an empty state.
 */
export function ensureSeed(): void {
  if (getMeta("seed_version") === SEED_VERSION) return;
  const db = getDb();
  const existing = db.prepare("SELECT COUNT(*) AS n FROM zones").get() as { n: number };
  if (existing.n > 0) {
    setMeta("seed_version", SEED_VERSION);
    return;
  }

  const now = nowMs();

  const people: Record<string, UserRow> = {};
  const mk = (handle: string, name: string, bio: string, skills: string[], trust: number) => {
    const u = createUser({ handle, displayName: name, bio, skills });
    db.prepare("UPDATE users SET trust_score = ? WHERE id = ?").run(trust, u.id);
    people[handle] = { ...u, trust_score: trust };
    return people[handle];
  };

  mk("meera", "Meera Rao", "Lead organiser, Samartha 2026", ["logistics", "judging"], 94);
  mk("arjun", "Arjun Teja", "Ops desk — Gate 2", ["ops", "av"], 88);
  mk("sana", "Sana Fatima", "Community moderator", ["moderation"], 91);
  mk("nikhil", "Nikhil", "Building Community Link this weekend", ["react", "node", "design"], 72);
  mk("divya", "Divya Prasad", "ML track, Team Vector", ["python", "pytorch"], 68);
  mk("kiran", "Kiran Kumar", "Volunteer, floor 2", ["support"], 77);
  mk("rahul", "Rahul Varma", "Brew Corner — campus cafe", ["coffee"], 64);
  mk("preeti", "Preeti Nair", "Design track", ["figma", "ux"], 70);
  mk("vikram", "Vikram S", "Team Nimbus", ["go", "infra"], 66);

  /* ---------------------------- zones ---------------------------- */
  const zones = [
    {
      slug: "samartha-hackathon-2026",
      name: "Samartha Hackathon 2026",
      kind: "hackathon",
      description:
        "36 hours, 9 tracks, one hall. Organisers, mentors and 400 participants sharing the same floor.",
      lat: 16.9725,
      lng: 82.2375,
      radius: 300,
      code: "SMRT-2026",
      endsIn: 2 * DAY,
    },
    {
      slug: "jntu-kakinada-campus",
      name: "JNTU Kakinada Campus",
      kind: "campus",
      description: "Day-to-day campus zone: lost items, rides, mess updates, printer hunts.",
      lat: 16.9735,
      lng: 82.2388,
      radius: 1200,
      code: "JNTU-KKD1",
      endsIn: 30 * DAY,
    },
    {
      slug: "kakinada-port-transit",
      name: "Kakinada Port Transit Hub",
      kind: "transit",
      description: "Buses, autos and the 6:40 ferry. Share delays, split rides, flag lost bags.",
      lat: 16.9608,
      lng: 82.2649,
      radius: 800,
      code: "KKD-PORT",
      endsIn: 14 * DAY,
    },
  ];

  const zoneIds: Record<string, string> = {};
  for (const z of zones) {
    const id = newId("zon");
    zoneIds[z.slug] = id;
    const endsAt = now + z.endsIn;
    db.prepare(
      `INSERT INTO zones (id, slug, name, kind, description, lat, lng, radius_m, join_code,
                          starts_at, ends_at, purge_at, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      z.slug,
      z.name,
      z.kind,
      z.description,
      z.lat,
      z.lng,
      z.radius,
      z.code,
      now - 3 * HOUR,
      endsAt,
      endsAt + DAY,
      people.meera.id,
      now - 3 * HOUR,
    );
    seedDefaultChannels(id);
  }

  const hack = zoneIds["samartha-hackathon-2026"];
  const campus = zoneIds["jntu-kakinada-campus"];
  const transit = zoneIds["kakinada-port-transit"];

  const members: [string, string, MemberRole][] = [
    [hack, "meera", "organizer"],
    [hack, "arjun", "organizer"],
    [hack, "sana", "moderator"],
    [hack, "nikhil", "member"],
    [hack, "divya", "member"],
    [hack, "kiran", "member"],
    [hack, "rahul", "member"],
    [hack, "preeti", "member"],
    [hack, "vikram", "member"],
    [campus, "meera", "organizer"],
    [campus, "sana", "moderator"],
    [campus, "nikhil", "member"],
    [campus, "preeti", "member"],
    [campus, "kiran", "member"],
    [transit, "arjun", "organizer"],
    [transit, "vikram", "member"],
    [transit, "nikhil", "member"],
  ];
  for (const [zoneId, handle, role] of members) {
    joinZone(zoneId, people[handle].id, role);
  }

  /* ---------------------------- posts ---------------------------- */
  interface SeedPost {
    zone: string;
    author: string;
    template: string;
    payload: Record<string, unknown>;
    createdAgo: number;
    expiresIn: number;
    slots?: number;
    urgency?: string;
    responses?: { user: string; kind: string; body: string; status?: string; meta?: Record<string, unknown> }[];
  }

  const seedPosts: SeedPost[] = [
    {
      zone: hack,
      author: "nikhil",
      template: "lost_found",
      payload: {
        item: "Black Casio watch",
        identifiers: "Resin strap, scratched buckle, dead battery so the hands are stuck at 4:20.",
        last_seen: "Washroom near the food court, Block C",
        secret_check: "There is a faded sticker inside the strap.",
      },
      createdAgo: 95 * MIN,
      expiresIn: 20 * HOUR,
      urgency: "high",
      responses: [{ user: "kiran", kind: "claim", body: "I picked up a black watch near the Block C sinks around 2pm — it's at the volunteer desk." }],
    },
    {
      zone: hack,
      author: "divya",
      template: "requirement",
      payload: {
        role: "A Python developer for our ML pipeline",
        skills: ["python", "pandas", "fastapi"],
        commitment: "Until Sunday 6pm — just for the rest of the hackathon",
        where: "Table 14, main hall",
        perks: "Equal credit, equal prize split, infinite coffee",
      },
      createdAgo: 40 * MIN,
      expiresIn: 10 * HOUR,
      slots: 2,
      urgency: "high",
      responses: [
        { user: "vikram", kind: "offer", body: "I've shipped FastAPI services before. Free from 8pm tonight.", status: "accepted" },
        { user: "preeti", kind: "offer", body: "Not Python, but I can take the dashboard off your plate." },
      ],
    },
    {
      zone: hack,
      author: "rahul",
      template: "promotion",
      payload: {
        offer: "Filter coffee at ₹30 — half price for Samartha badges",
        vendor: "Brew Corner, Gate 2",
        terms: "Show this screen at the counter. One per badge. Till stock lasts.",
        code: "SAMARTHA30",
      },
      createdAgo: 70 * MIN,
      expiresIn: 5 * HOUR,
      slots: 25,
      responses: [
        { user: "nikhil", kind: "claim", body: "", status: "accepted" },
        { user: "preeti", kind: "claim", body: "", status: "accepted" },
        { user: "vikram", kind: "claim", body: "", status: "accepted" },
        { user: "kiran", kind: "claim", body: "", status: "accepted" },
      ],
    },
    {
      zone: hack,
      author: "meera",
      template: "announcement",
      payload: {
        headline: "Pitch decks due in 30 minutes",
        details:
          "Upload the PDF to the portal before 4:30pm sharp. Late uploads are not judged. Mentors are on the floor if you're stuck.",
        where: "Main stage / portal",
        ack: "Yes — track who has seen it",
      },
      createdAgo: 6 * MIN,
      expiresIn: 30 * MIN,
      urgency: "critical",
      responses: [
        { user: "vikram", kind: "ack", body: "" },
        { user: "preeti", kind: "ack", body: "" },
      ],
    },
    {
      zone: hack,
      author: "arjun",
      template: "announcement",
      payload: {
        headline: "Dinner opens at 8:30pm, Block D",
        details: "Veg and non-veg counters. Carry your badge.",
        where: "Block D canteen",
        ack: "No",
      },
      createdAgo: 25 * MIN,
      expiresIn: 4 * HOUR,
    },
    {
      zone: hack,
      author: "preeti",
      template: "question",
      payload: {
        question: "Is there a working colour printer anywhere on campus right now?",
        options: ["Library, 1st floor", "Admin block", "Nowhere — I gave up"],
        context: "Need one consent form printed before 5pm.",
      },
      createdAgo: 18 * MIN,
      expiresIn: 3 * HOUR,
      responses: [
        { user: "kiran", kind: "vote", body: "", meta: { option: 0 } },
        { user: "vikram", kind: "vote", body: "", meta: { option: 2 } },
        { user: "divya", kind: "vote", body: "", meta: { option: 0 } },
      ],
    },
    {
      zone: hack,
      author: "vikram",
      template: "found_item",
      payload: {
        item: "A bunch of keys on a blue lanyard",
        where: "Row 4, auditorium",
        held_at: "Handed to the registration desk",
        withheld: "There is a small bottle-opener on the ring.",
      },
      createdAgo: 2 * HOUR,
      expiresIn: 22 * HOUR,
    },
    {
      zone: campus,
      author: "preeti",
      template: "requirement",
      payload: {
        role: "Someone heading to Kakinada bus stand around 7pm to split an auto",
        skills: ["carpool"],
        commitment: "Tonight only",
        where: "Main gate",
      },
      createdAgo: 55 * MIN,
      expiresIn: 4 * HOUR,
      slots: 2,
    },
    {
      zone: campus,
      author: "kiran",
      template: "lost_found",
      payload: {
        item: "Grey Wildcraft backpack",
        identifiers: "Has a Rubik's cube keychain and a broken left zip.",
        last_seen: "Library reading hall, second floor",
      },
      createdAgo: 5 * HOUR,
      expiresIn: 30 * HOUR,
    },
    {
      zone: transit,
      author: "vikram",
      template: "announcement",
      payload: {
        headline: "6:40 ferry delayed by 25 minutes",
        details: "Port staff confirmed. Next update at 7pm.",
        where: "Jetty 2",
      },
      createdAgo: 12 * MIN,
      expiresIn: 90 * MIN,
      urgency: "high",
    },
  ];

  const resolveModeFor: Record<string, string> = {
    lost_found: "claim_confirm",
    found_item: "claim_confirm",
    requirement: "fill_slots",
    promotion: "quota",
    announcement: "deadline",
    question: "manual",
  };
  const titleKey: Record<string, string> = {
    lost_found: "item",
    found_item: "item",
    requirement: "role",
    promotion: "offer",
    announcement: "headline",
    question: "question",
  };
  const bodyKey: Record<string, string> = {
    lost_found: "identifiers",
    found_item: "",
    requirement: "",
    promotion: "terms",
    announcement: "details",
    question: "context",
  };

  for (const p of seedPosts) {
    const id = newId("pst");
    const createdAt = now - p.createdAgo;
    const title = String(p.payload[titleKey[p.template]] ?? "Untitled");
    const body = bodyKey[p.template] ? String(p.payload[bodyKey[p.template]] ?? "") : "";
    const accepted = (p.responses ?? []).filter((r) => r.status === "accepted").length;

    db.prepare(
      `INSERT INTO posts (id, zone_id, author_id, template, title, body, payload, created_at, expires_at,
                          resolve_mode, slots_needed, slots_filled, status, is_anonymous, urgency)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'open',0,?)`,
    ).run(
      id,
      p.zone,
      people[p.author].id,
      p.template,
      title,
      body,
      JSON.stringify(p.payload),
      createdAt,
      now + p.expiresIn,
      resolveModeFor[p.template],
      p.slots ?? 1,
      accepted,
      p.urgency ?? "normal",
    );

    logEvent(db, {
      zoneId: p.zone,
      subjectType: "post",
      subjectId: id,
      type: "created",
      actorId: people[p.author].id,
      detail: { template: p.template, title },
    });

    for (const [i, r] of (p.responses ?? []).entries()) {
      db.prepare(
        "INSERT INTO responses (id, post_id, user_id, kind, body, meta, status, created_at, decided_at) VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(
        newId("rsp"),
        id,
        people[r.user].id,
        r.kind,
        r.body,
        JSON.stringify(r.meta ?? {}),
        r.status ?? "pending",
        createdAt + (i + 1) * 4 * MIN,
        r.status ? createdAt + (i + 1) * 5 * MIN : null,
      );
      logEvent(db, {
        zoneId: p.zone,
        subjectType: "post",
        subjectId: id,
        type: "responded",
        actorId: people[r.user].id,
        detail: { kind: r.kind },
      });
    }
  }

  /* --------------------------- channels -------------------------- */
  const chan = (zoneId: string, slug: string) =>
    (db.prepare("SELECT id FROM channels WHERE zone_id = ? AND slug = ?").get(zoneId, slug) as { id: string }).id;

  const chatter: [string, string, string, number][] = [
    [chan(hack, "general"), "divya", "Anyone else's wifi dropping on the 5GHz band?", 52 * MIN],
    [chan(hack, "general"), "kiran", "Yeah, switch to Samartha-2.4 — much steadier near the stage.", 50 * MIN],
    [chan(hack, "general"), "vikram", "Mentor for the infra track is at table 3 till 6.", 33 * MIN],
    [chan(hack, "general"), "preeti", "Printer hunt continues. Posting a poll.", 19 * MIN],
    [chan(hack, "announcements"), "meera", "Judging rubric is up on the portal. Read the weightage before you build the deck.", 2 * HOUR],
    [chan(hack, "announcements"), "arjun", "Power strips are at the ops desk. Return them before you leave.", 44 * MIN],
    [chan(campus, "general"), "preeti", "Mess menu today is actually decent. Go early.", 3 * HOUR],
  ];
  for (const [channelId, handle, body, ago] of chatter) {
    db.prepare(
      "INSERT INTO channel_messages (id, channel_id, user_id, body, created_at, expires_at) VALUES (?,?,?,?,?,?)",
    ).run(newId("msg"), channelId, people[handle].id, body, now - ago, now - ago + 12 * HOUR);
  }

  /* ------------------------- private threads --------------------- */
  // The exact scenario from the brief: ask the organisers quietly, not in public.
  const t1 = newId("thr");
  const [lo1, hi1] =
    people.nikhil.id < people.meera.id ? [people.nikhil.id, people.meera.id] : [people.meera.id, people.nikhil.id];
  db.prepare(
    "INSERT INTO dm_threads (id, zone_id, user_lo, user_hi, topic, post_id, created_at) VALUES (?,?,?,?,?,NULL,?)",
  ).run(t1, hack, lo1, hi1, "Deck deadline", now - 9 * MIN);
  const dm: [string, string, number][] = [
    ["nikhil", "Hi Meera — about the 4:30 deck deadline. We're 20 minutes behind on the demo build. Is there any grace, or should we submit what we have?", 9 * MIN],
    ["meera", "Submit what you have at 4:30 — you can replace the file until 4:45. Don't miss the first upload.", 6 * MIN],
    ["nikhil", "Perfect, thank you. We'll have the first version up by 4:25.", 5 * MIN],
  ];
  for (const [handle, body, ago] of dm) {
    db.prepare("INSERT INTO dm_messages (id, thread_id, user_id, body, created_at, read_at) VALUES (?,?,?,?,?,?)").run(
      newId("dmm"),
      t1,
      people[handle].id,
      body,
      now - ago,
      now - ago + MIN,
    );
  }

  /* ----------------------------- a report ------------------------ */
  const spamPost = db
    .prepare("SELECT id FROM posts WHERE zone_id = ? AND template = 'promotion' LIMIT 1")
    .get(hack) as { id: string } | undefined;
  if (spamPost) {
    db.prepare(
      "INSERT INTO reports (id, zone_id, reporter_id, target_type, target_id, reason, note, created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run(
      newId("rep"),
      hack,
      people.divya.id,
      "post",
      spamPost.id,
      "Spam or advertising",
      "Third coffee promo today from the same stall.",
      now - 20 * MIN,
    );
  }

  setMeta("seed_version", SEED_VERSION);
}
