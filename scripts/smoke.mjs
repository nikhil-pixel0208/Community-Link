/**
 * End-to-end check of the lifecycle guarantees.
 *
 *   node scripts/smoke.mjs [baseUrl]
 *
 * Verifies the promises the product is built on:
 *   1. A resolved post leaves the public feed immediately.
 *   2. Its author still sees a receipt, with a purge countdown.
 *   3. A private thread bound to that post closes itself.
 *   4. A "needs N people" post survives 1 of 2 and dies at 2 of 2.
 *   5. Membership and privacy boundaries actually hold.
 */

const BASE = process.argv[2] ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(label, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗ ${label}\x1b[0m ${extra}`);
  }
}

function section(name) {
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

/** A browser-ish client that remembers its own session cookie. */
function client() {
  let cookie = "";
  return async function call(path, init = {}) {
    const { json, ...rest } = init;
    const res = await fetch(`${BASE}${path}`, {
      ...rest,
      headers: {
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(rest.headers ?? {}),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      redirect: "manual",
    });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      const [pair] = c.split(";");
      if (pair.startsWith("cl_session=")) cookie = pair;
    }
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body };
  };
}

async function signIn(call, handle) {
  const { body } = await call("/api/auth/signin", { method: "POST", json: { handle } });
  return body.user;
}

const ZONE = "samartha-hackathon-2026";

async function main() {
  console.log(`\x1b[1mCommunity Link — lifecycle smoke test\x1b[0m\n${BASE}`);

  const nikhil = client();
  const kiran = client();
  const divya = client();
  const stranger = client();

  await signIn(nikhil, "nikhil");
  await signIn(kiran, "kiran");
  await signIn(divya, "divya");

  section("Membership boundary");
  await signIn(stranger, `probe_${Date.now().toString(36)}`);
  const blocked = await stranger(`/api/zones/${ZONE}/posts`);
  check("a non-member cannot read the feed", blocked.status === 403, `got ${blocked.status}`);

  const joinNoProof = await stranger(`/api/zones/${ZONE}/join`, { method: "POST", json: {} });
  check("joining needs location or a code", joinNoProof.status === 400, `got ${joinNoProof.status}`);

  const joinFar = await stranger(`/api/zones/${ZONE}/join`, {
    method: "POST",
    json: { lat: 28.6139, lng: 77.209 }, // Delhi
  });
  check("joining from 1500km away is refused", joinFar.status === 403, `got ${joinFar.status}`);

  const joinCode = await stranger(`/api/zones/${ZONE}/join`, { method: "POST", json: { code: "SMRT-2026" } });
  check("joining with the zone code works", joinCode.status === 200, `got ${joinCode.status}`);

  const joinNear = await divya(`/api/zones/${ZONE}/join`, {
    method: "POST",
    json: { lat: 16.9726, lng: 82.2376 },
  });
  check("joining from inside the radius works", joinNear.status === 200, `got ${joinNear.status}`);

  section("Lost & found: resolution deletes the post");
  const feed0 = await nikhil(`/api/zones/${ZONE}/posts`);
  const watch = feed0.body.posts.find((p) => p.template === "lost_found" && p.title.includes("Casio"));
  check("the lost-watch post is live", Boolean(watch) && watch.status === "open");

  const strangerFeed0 = await stranger(`/api/zones/${ZONE}/posts`);
  check(
    "everyone in the zone can see it",
    strangerFeed0.body.posts.some((p) => p.id === watch.id),
  );

  const claim = watch.responses.find((r) => r.status === "pending");
  check("a finder has claimed it", Boolean(claim), JSON.stringify(watch.responses.map((r) => r.status)));

  // Open a private thread tied to the post, the way the UI does.
  const thread = await kiran(`/api/zones/${ZONE}/threads`, {
    method: "POST",
    json: { partnerId: watch.author.id, topic: watch.title, postId: watch.id },
  });
  check("a private thread can be bound to the post", thread.status === 201, `got ${thread.status}`);
  const threadId = thread.body?.thread?.id;

  const accept = await nikhil(`/api/posts/${watch.id}/responses/${claim.id}`, {
    method: "POST",
    json: { decision: "accepted" },
  });
  check("the author can confirm the handover", accept.status === 200, JSON.stringify(accept.body).slice(0, 120));
  check("the post flips to resolved", accept.body?.post?.status === "resolved", accept.body?.post?.status);
  check("a purge deadline is set", typeof accept.body?.post?.purgeAt === "number");

  const strangerFeed1 = await stranger(`/api/zones/${ZONE}/posts`);
  check(
    "it vanishes from an uninvolved member's feed instantly",
    !strangerFeed1.body.posts.some((p) => p.id === watch.id),
  );

  const nikhilFeed1 = await nikhil(`/api/zones/${ZONE}/posts`);
  const receipt = nikhilFeed1.body.posts.find((p) => p.id === watch.id);
  check("the author keeps a short-lived receipt", Boolean(receipt) && receipt.status === "resolved");

  const kiranFeed1 = await kiran(`/api/zones/${ZONE}/posts`);
  check(
    "the finder keeps a receipt too",
    kiranFeed1.body.posts.some((p) => p.id === watch.id),
  );

  if (threadId) {
    const t = await kiran(`/api/threads/${threadId}/messages`);
    check("the bound private thread closed itself", Boolean(t.body?.thread?.closedAt), JSON.stringify(t.body?.thread));
    const blockedSend = await kiran(`/api/threads/${threadId}/messages`, {
      method: "POST",
      json: { body: "still there?" },
    });
    check("you cannot write into a closed thread", blockedSend.status === 410, `got ${blockedSend.status}`);
  }

  const lateResponse = await divya(`/api/posts/${watch.id}/respond`, { method: "POST", json: { body: "I found it!" } });
  check("responding to a settled post is refused", lateResponse.status === 410, `got ${lateResponse.status}`);

  section("Requirement: dies only when every slot is filled");
  const feed1 = await divya(`/api/zones/${ZONE}/posts`);
  const req = feed1.body.posts.find((p) => p.template === "requirement" && p.title.includes("Python"));
  check("the 2-slot requirement is live", Boolean(req) && req.status === "open", req?.status);
  check("one slot is already filled", req?.slotsFilled === 1, String(req?.slotsFilled));

  const offer = await stranger(`/api/posts/${req.id}/respond`, {
    method: "POST",
    json: { body: "I write Python for a living." },
  });
  check("a second person can offer", offer.status === 201, `got ${offer.status}`);
  check("still open at 1 of 2", offer.body?.post?.status === "open", offer.body?.post?.status);

  const reqAfter = (await divya(`/api/posts/${req.id}`)).body.post;
  const pendingOffer = reqAfter.responses?.find((r) => r.status === "pending");
  // The author (divya) accepts, which fills the last slot.
  const fill = await divya(`/api/posts/${req.id}/responses/${pendingOffer.id}`, {
    method: "POST",
    json: { decision: "accepted" },
  });
  check("filling the final slot resolves it", fill.body?.post?.status === "resolved", fill.body?.post?.status);
  check(
    "and it leaves the feed for everyone else",
    !(await kiran(`/api/zones/${ZONE}/posts`)).body.posts.some((p) => p.id === req.id),
  );

  section("Announcements and permissions");
  const memberAnnounce = await kiran(`/api/zones/${ZONE}/posts`, {
    method: "POST",
    json: {
      template: "announcement",
      payload: { headline: "I am not an organiser" },
      ttlMs: 10 * 60_000,
    },
  });
  check("a plain member cannot post an announcement", memberAnnounce.status === 403, `got ${memberAnnounce.status}`);

  const meera = client();
  await signIn(meera, "meera");
  const orgAnnounce = await meera(`/api/zones/${ZONE}/posts`, {
    method: "POST",
    json: {
      template: "announcement",
      payload: { headline: "Smoke-test announcement", details: "Ignore me." },
      ttlMs: 10 * 60_000,
    },
  });
  check("an organiser can", orgAnnounce.status === 201, `got ${orgAnnounce.status}`);

  const memberBroadcast = await kiran(`/api/zones/${ZONE}/channels/announcements/messages`, {
    method: "POST",
    json: { body: "let me in" },
  });
  check("members cannot broadcast in #announcements", memberBroadcast.status === 403, `got ${memberBroadcast.status}`);

  const memberGeneral = await kiran(`/api/zones/${ZONE}/channels/general/messages`, {
    method: "POST",
    json: { body: "smoke test, ignore" },
  });
  check("members can talk in #general", memberGeneral.status === 201, `got ${memberGeneral.status}`);

  section("Private 1:1 reaches an organiser");
  const toOrganiser = await kiran(`/api/zones/${ZONE}/threads`, {
    method: "POST",
    json: { partnerId: (await meera("/api/me")).body.user.id, topic: "Need 20 more minutes" },
  });
  check("a participant can open a line to an organiser", toOrganiser.status === 201, `got ${toOrganiser.status}`);
  const dmId = toOrganiser.body.thread.id;
  const sent = await kiran(`/api/threads/${dmId}/messages`, {
    method: "POST",
    json: { body: "We're 20 minutes behind on the deck — any grace?" },
  });
  check("the message sends", sent.status === 201, `got ${sent.status}`);

  const snoop = await divya(`/api/threads/${dmId}/messages`);
  check("a third party cannot read it", snoop.status === 403, `got ${snoop.status}`);

  const organiserSide = await meera(`/api/threads/${dmId}/messages`);
  check("the organiser sees it", organiserSide.body?.messages?.length === 1, JSON.stringify(organiserSide.body)?.slice(0, 120));

  section("Expiry: the clock alone can end a post");
  const shortLived = await kiran(`/api/zones/${ZONE}/posts`, {
    method: "POST",
    json: {
      template: "question",
      payload: { question: "Does expiry work?" },
      ttlMs: 5 * 60_000, // clamped minimum
    },
  });
  check("a post can be created with a minimum lifetime", shortLived.status === 201, `got ${shortLived.status}`);
  const sid = shortLived.body.post.id;
  check(
    "its expiry is ~5 minutes out",
    Math.abs(shortLived.body.post.expiresAt - Date.now() - 5 * 60_000) < 10_000,
  );
  const extended = await kiran(`/api/posts/${sid}/extend`, { method: "POST", json: { extraMs: 60 * 60_000 } });
  check("the author can extend it", extended.body?.post?.expiresAt > shortLived.body.post.expiresAt);
  const closed = await kiran(`/api/posts/${sid}/close`, { method: "POST", json: { note: "done" } });
  check("and close it by hand", closed.body?.post?.status === "resolved", closed.body?.post?.status);
  const erased = await kiran(`/api/posts/${sid}`, { method: "DELETE" });
  check("erase-now really deletes it", erased.status === 200);
  const gone = await kiran(`/api/posts/${sid}`);
  check("the row is gone", gone.status === 404, `got ${gone.status}`);

  section("Privacy");
  const lf = (await kiran(`/api/zones/${ZONE}/posts?template=found_item`)).body.posts[0];
  if (lf) {
    check("withheld verification details are stripped for non-authors", lf.payload.withheld === undefined);
  }
  const reported = await kiran(`/api/zones/${ZONE}/reports`, {
    method: "POST",
    json: { targetType: "post", targetId: lf?.id ?? "x", reason: "Spam or advertising" },
  });
  check("anyone can file a report", reported.status === 201, `got ${reported.status}`);
  const queue = await kiran(`/api/zones/${ZONE}/reports`);
  check("but only staff can read the queue", queue.status === 403, `got ${queue.status}`);
  const staffQueue = await meera(`/api/zones/${ZONE}/reports`);
  check("staff can", staffQueue.status === 200, `got ${staffQueue.status}`);

  section("Lifecycle trail survives the content");
  const trail = await nikhil(`/api/zones/${ZONE}/lifecycle`);
  const types = new Set((trail.body.events ?? []).map((e) => e.type));
  check("resolution is recorded", types.has("resolved"), [...types].join(","));
  check("creation is recorded", types.has("created"));

  console.log(
    `\n\x1b[1m${passed} passed, ${failed} failed\x1b[0m\n` +
      (failed === 0 ? "\x1b[32mLifecycle guarantees hold.\x1b[0m\n" : "\x1b[31mSomething regressed.\x1b[0m\n"),
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\x1b[31mSmoke test crashed:\x1b[0m", err);
  process.exit(1);
});
