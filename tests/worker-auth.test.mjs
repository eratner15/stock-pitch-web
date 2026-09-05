import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
let mf, db, session;
before(async () => {
  const output = await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    external: ["cloudflare:workers", "node:*"],
    loader: { ".md": "text" },
  });
  mf = new Miniflare({
    modules: true,
    script: output.outputFiles[0].text,
    compatibilityDate: "2026-04-10",
    compatibilityFlags: ["nodejs_compat"],
    bindings: { SESSION_SECRET: "synthetic-auth-test-secret" },
    d1Databases: ["DB"],
  });
  db = await mf.getD1Database("DB");
  for (const file of ["005_research_desk.sql", "006_research_workspace.sql"])
    for (const s of readFileSync("src/db/migrations/" + file, "utf8")
      .replace(/--[^\n]*/g, "")
      .split(";")
      .filter((s) => s.trim()))
      await db.prepare(s).run();
  await db
    .prepare(
      "INSERT INTO research_members(user_id,role) VALUES ('test-user','analyst')",
    )
    .run();
  const authBuild = await build({
    entryPoints: ["src/lib/auth.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  const auth = await import(
    "data:text/javascript;base64," +
      Buffer.from(authBuild.outputFiles[0].text).toString("base64")
  );
  session = await auth.signSession(
    "test-user",
    "synthetic@example.test",
    "synthetic-auth-test-secret",
  );
});
after(async () => {
  await mf?.dispose();
});
test("real Worker dispatch validates signed session, membership and alternate hosts", async () => {
  for (const host of ["research.levincap.com", "test.workers.dev"]) {
    assert.equal(
      (await mf.dispatchFetch("https://" + host + "/research/workspace"))
        .status,
      401,
    );
    const r = await mf.dispatchFetch(
      "https://" + host + "/research/workspace",
      { headers: { cookie: "sp_session=" + session } },
    );
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.equal(
      (
        await mf.dispatchFetch("https://" + host + "/research/workspace", {
          headers: { cookie: "sp_session=" + session + "tampered" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await mf.dispatchFetch(
          "https://" + host + "/agents/workflow-agent/arbitrary",
        )
      ).status,
      404,
    );
  }
});
test("public revision lookup excludes draft/private; withdrawal is immediate", async () => {
  await db
    .prepare(
      "INSERT INTO research_revisions(id,document_id,company_id,ticker,title,source_json,body,status,visibility,created_by,created_at,revised_at,idempotency_key) VALUES ('fixture','doc','company:TEST','TEST','SYNTHETIC','{}','SYNTHETIC confidential draft','draft','private','test-user','2026-01-01','2026-01-01','fixture')",
    )
    .run();
  const url = "https://research.levincap.com/research/published/fixture";
  assert.equal((await mf.dispatchFetch(url)).status, 404);
  await db
    .prepare(
      "UPDATE research_revisions SET status='published',visibility='public',published_at='2026-01-01' WHERE id='fixture'",
    )
    .run();
  const publicResponse = await mf.dispatchFetch(url);
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get("cache-control"), "no-store");
  await db
    .prepare(
      "UPDATE research_revisions SET status='withdrawn',visibility='private' WHERE id='fixture'",
    )
    .run();
  assert.equal((await mf.dispatchFetch(url)).status, 404);
});
