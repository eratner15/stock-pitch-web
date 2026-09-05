import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
let mf, db, app, validateSnapshot, discover;
async function bundle(entry) {
  const r = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(r.outputFiles[0].text).toString("base64")
  );
}
before(async () => {
  mf = new Miniflare({
    workers: [
      {
        name: "tests",
        modules: true,
        script: 'export default {fetch(){return new Response("test")}}',
        compatibilityDate: "2026-04-15",
        d1Databases: ["DB"],
      },
    ],
  });
  db = await mf.getD1Database("DB");
  for (const file of ["005_research_desk.sql", "006_research_workspace.sql"]) {
    const sql = readFileSync("src/db/migrations/" + file, "utf8").replace(
      /--[^\n]*/g,
      "",
    );
    for (const statement of sql.split(";").filter((s) => s.trim()))
      await db.prepare(statement).run();
  }
  await db
    .prepare(
      "INSERT INTO research_members (user_id,role) VALUES ('author','analyst'),('reviewer','reviewer')",
    )
    .run();
  const mod = await bundle("src/routes/research-workspace.ts");
  const { Hono } = await import("hono");
  app = new Hono();
  app.use("*", async (c, next) => {
    const who = c.req.header("x-test-user");
    c.set("user", who ? { id: who, email: who + "@example.test" } : null);
    await next();
  });
  app.route("/research/workspace", mod.workspace);
  ({ validateSnapshot, discover } = await bundle("src/lib/etf-discovery.ts"));
});
after(async () => {
  await mf?.dispose();
});
const env = () => ({
  DB: db,
  RESEARCH_CATALOG: {
    fetch: async () =>
      Response.json({ documents: [], currentViews: [], scope: "test fixture" }),
  },
});
function req(path, body, user = "author", extra = {}) {
  return app.request(
    "https://test.local/research/workspace" + path,
    {
      method: body ? "POST" : "GET",
      headers: {
        ...(user ? { "x-test-user": user } : {}),
        origin: "https://test.local",
        "content-type": "application/json",
        ...extra.headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
    { ...env(), ...extra.env },
  );
}
const snapshot = {
  etf: "TEST",
  asOf: "2026-01-01",
  sourceUrl: "https://example.test/holdings",
  provider: "SYNTHETIC TEST FIXTURE",
  completeness: "partial",
  holdings: [
    {
      ticker: "ATRO",
      company: "Synthetic holding",
      weight: 2,
      currency: "USD",
      assetType: "equity",
    },
    {
      ticker: null,
      company: "Cash",
      weight: null,
      currency: "USD",
      assetType: "cash",
    },
  ],
};
test("team access, alternate host-independent guard and no-store", async () => {
  assert.equal((await req("/", null, null)).status, 401);
  assert.equal((await req("/", null, "outsider")).status, 403);
  const r = await req("");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.equal(
    (
      await req("/api/etfs", snapshot, "author", {
        headers: { origin: "https://evil.test" },
      })
    ).status,
    403,
  );
});
test("ETF dates, types, weights and source URLs are validated", () => {
  assert.equal(validateSnapshot(snapshot).holdings.length, 2);
  for (const patch of [
    { asOf: "2099-01-01" },
    { asOf: "2026-02-30" },
    { sourceUrl: "javascript:alert(1)" },
    { etf: "' OR 1=1" },
    { holdings: [{ ...snapshot.holdings[0], weight: 101 }] },
  ])
    assert.throws(() => validateSnapshot({ ...snapshot, ...patch }));
  const candidates = discover(snapshot, new Set(["ATRO"]));
  assert.equal(candidates[0].coverage, "Existing coverage");
  assert.equal(candidates[1].eligible, false);
});
test("snapshot imports are durable and idempotent", async () => {
  const one = await (await req("/api/etfs", snapshot)).json(),
    two = await (await req("/api/etfs", snapshot)).json();
  assert.equal(one.id, two.id);
  const data = await (await req("/api/etfs?etf=TEST")).json();
  assert.equal(data.snapshots.length, 1);
  assert.equal(data.snapshots[0].as_of, "2026-01-01");
});
test("draft → independent review → gated publication; edits invalidate approval; withdrawals remove catalog entry", async () => {
  const payload = {
    ticker: "ATRO",
    title: "SYNTHETIC TEST earnings",
    sources: ["https://example.test/earnings"],
    sourceText: "Synthetic source, not investment research.",
    idempotencyKey: "test-draft-0001",
  };
  const { id } = await (await req("/api/revisions", payload)).json();
  assert.ok(id);
  assert.equal((await (await req("/api/revisions", payload)).json()).id, id);
  assert.equal(
    (await req("/api/revisions/" + id + "/generate", { version: 1 })).status,
    503,
  );
  assert.equal(
    (
      await req("/api/revisions/" + id + "/edit", {
        version: 1,
        body: "SYNTHETIC draft",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/api/revisions/" + id + "/edit", {
        version: 1,
        body: "Stale overwrite",
      })
    ).status,
    409,
  );
  assert.equal(
    (await req("/api/revisions/" + id + "/submit", { version: 2 })).status,
    200,
  );
  assert.equal(
    (await req("/api/revisions/" + id + "/approve", { version: 3 })).status,
    403,
  );
  assert.equal(
    (await req("/api/revisions/" + id + "/approve", { version: 3 }, "reviewer"))
      .status,
    200,
  );
  assert.equal(
    (
      await req(
        "/api/revisions/" + id + "/publish",
        { version: 4, confirmPublic: true },
        "reviewer",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/api/revisions/" + id + "/edit", {
        version: 4,
        body: "Edited SYNTHETIC draft",
      })
    ).status,
    200,
  );
  let row = (await (await req("/api/revisions/" + id)).json()).revision;
  assert.equal(row.reviewed_at, null);
  assert.equal(row.status, "draft");
  await req("/api/revisions/" + id + "/submit", { version: 5 });
  await req("/api/revisions/" + id + "/approve", { version: 6 }, "reviewer");
  const published = await req(
    "/api/revisions/" + id + "/publish",
    { version: 7, confirmPublic: true },
    "reviewer",
    { env: { RESEARCH_PUBLICATION_ENABLED: "true" } },
  );
  assert.equal(published.status, 200);
  const cat = await (await req("/api/catalog")).json();
  assert.equal(cat.documents.length, 1);
  assert.equal(cat.documents[0].canonicalUrl, "/research/published/" + id);
  assert.equal(
    (
      await req("/api/revisions/" + id + "/edit", {
        version: 8,
        body: "Mutate published",
      })
    ).status,
    400,
  );
  await req("/api/revisions/" + id + "/withdraw", { version: 8 }, "reviewer");
  assert.equal((await (await req("/api/catalog")).json()).documents.length, 0);
});
test("generation failure is visible and retries reuse the revision", async () => {
  const { id } = await (
    await req("/api/revisions", {
      ticker: "BWA",
      title: "TEST generation",
      sources: ["https://example.test/source"],
      sourceText: "SYNTHETIC evidence",
      idempotencyKey: "test-generation-1",
    })
  ).json();
  const base = {
    ANTHROPIC_API_KEY: "fixture-only-not-a-secret",
    WorkflowAgent: {
      idFromName: (x) => x,
      get: () => ({
        fetch: async () => new Response("fixture failure", { status: 502 }),
      }),
    },
  };
  assert.equal(
    (
      await req(
        "/api/revisions/" + id + "/generate",
        { version: 1 },
        "author",
        { env: base },
      )
    ).status,
    502,
  );
  let row = (await (await req("/api/revisions/" + id)).json()).revision;
  assert.equal(row.status, "failed");
  assert.equal(row.version, 3);
  base.WorkflowAgent.get = () => ({
    fetch: async () =>
      Response.json({
        analysis: "SYNTHETIC generated draft — not live generation",
      }),
  });
  assert.equal(
    (
      await req(
        "/api/revisions/" + id + "/generate",
        { version: 3 },
        "author",
        { env: base },
      )
    ).status,
    200,
  );
  row = (await (await req("/api/revisions/" + id)).json()).revision;
  assert.equal(row.status, "draft");
  assert.equal(row.reviewed_at, null);
  assert.equal(row.version, 5);
});
