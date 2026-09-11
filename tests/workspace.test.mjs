import { createHash, randomUUID } from 'node:crypto';
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
  for (const file of ["005_research_desk.sql", "006_research_workspace.sql", "007_research_evidence.sql", "008_reviewed_package.sql", "010_research_identities.sql"]) {
    const sql = readFileSync("src/db/migrations/" + file, "utf8").replace(
      /--[^\n]*/g,
      "",
    );
    for (const statement of sql.split(/^(007|010)/.test(file)?"\n":";").filter((s) => s.trim()))
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
  const {registerResearchIdentity}=await bundle('src/lib/research-identities.ts');
  for(const ticker of ['ATRO','BWA'])await registerResearchIdentity(db,{company:{company_id:'fixture-company-'+ticker,name:'Synthetic '+ticker,regulator_ids:[]},security:{security_id:'security-'+ticker,company_id:'fixture-company-'+ticker,exchange:'XNYS',share_class:'common',currency:'USD',reporting_currency:'USD',adr_ratio:null,aliases:[{ticker,valid_from:null,valid_to:null}]}},'author');
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
const selectedPackages=new Map();
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
      ...(body ? { body: JSON.stringify({...body,packageSnapshotId:body.packageSnapshotId??selectedPackages.get(path.split('/')[3])}) } : {}),
    },
    { ...env(), ...extra.env },
  );
}
async function attachPackage(revisionId) {
 const row=await db.prepare('SELECT * FROM research_revisions WHERE id=?').bind(revisionId).first();
 const p=JSON.parse(readFileSync('tests/fixtures/research-package.json','utf8'));
 p.revision_id=revisionId;p.security_id=row.security_id;p.securities[0].security_id=row.security_id;p.facts[0].security_id=row.security_id;p.company_id=row.company_id;p.companies[0].company_id=row.company_id;p.securities[0].company_id=row.company_id;p.facts[0].company_id=row.company_id;
 p.judgment={...p.judgment,portfolio_action:'not_assessed',limitations:'Synthetic fixture only',differentiated:false,consensus_unavailable_reason:'No consensus supplied',
 decision_summary:{text:'Unrated synthetic fixture',fact_ids:['fact-revenue']},bear_case:{text:'Revenue durability is unproven',fact_ids:['fact-revenue']},expectations:{text:'Expectations unresolved',fact_ids:['fact-revenue']},variant_view:{text:'No differentiated view established',fact_ids:['fact-revenue']},
 thesis_pillars:[{id:'demand',claim:{text:'Test revenue durability',fact_ids:['fact-revenue']},counter_evidence:{text:'Only one period available',fact_ids:['fact-revenue']},falsifier:'Two declines'}],dated_tests:[{id:'test',metric:'Revenue',fact_ids:['fact-revenue'],owner:'author',next_check:'2026-04-01',falsifier:'Two declines'}]};
 p.owner=row.created_by;p.workspace_version=row.version;p.body_checksum=createHash('sha256').update(row.body).digest('hex');
 const snapshotId=randomUUID();
 await db.prepare('INSERT INTO research_package_snapshots(snapshot_id,package_id,revision_id,workspace_version,body_checksum,package_json,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(snapshotId,p.package_id,revisionId,row.version,p.body_checksum,JSON.stringify(p),p.owner,p.created_at).run();
 selectedPackages.set(revisionId,snapshotId);return snapshotId;
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
  assert.equal((await req('/api/revisions/'+id+'/submit',{version:2})).status,409);
  assert.equal((await req("/api/delivery/"+id)).status,409);
  await attachPackage(id);
  assert.equal((await req('/api/revisions/'+id+'/submit',{version:2,body:'Unsaved text'})).status,409);
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
  assert.equal((await req('/api/delivery/'+id,undefined,null)).status,401);
  assert.equal((await req('/api/delivery/'+id,undefined,'outsider')).status,403);
  const exported=await req('/api/delivery/'+id);
  assert.equal(exported.status,200);
  assert.equal(exported.headers.get('cache-control'),'private, no-store');
  const envelope=await exported.json();
  assert.equal(envelope.snapshot_id,selectedPackages.get(id));
  assert.equal(envelope.package_checksum,createHash('sha256').update(envelope.package_json).digest('hex'));
  assert.equal(envelope.reviewed_by,'reviewer');
  assert.equal(JSON.parse(envelope.package_json).status,'draft'); // original is immutable
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
  assert.equal((await req("/api/delivery/"+id)).status,409);
  assert.equal((await req('/api/revisions/'+id+'/submit',{version:5})).status,409);
  await attachPackage(id);
  await req("/api/revisions/" + id + "/submit", { version: 5 });
  await req("/api/revisions/" + id + "/approve", { version: 6 }, "reviewer");
  const published = await req(
    "/api/revisions/" + id + "/publish",
    { version: 7, confirmPublic: true },
    "reviewer",
    { env: { RESEARCH_PUBLICATION_ENABLED: "true" } },
  );
  assert.equal(published.status, 200);
  assert.equal((await req("/api/revisions/"+id+"/resolve-identity",{version:8,exchange:"XNYS"})).status,403);
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
  assert.equal((await req("/api/delivery/"+id)).status,409);
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

test('ambiguous aliases save unique provisional drafts and require author resolution',async()=>{
 for(const [market,shareClass] of [['XNYS','common'],['XLON','ADR']]){
  const registration={company:{company_id:'company-dual',name:'Synthetic Dual',regulator_ids:[]},security:{security_id:'dual-'+market,company_id:'company-dual',exchange:market,share_class:shareClass,currency:'USD',reporting_currency:'USD',adr_ratio:shareClass==='ADR'?2:null,aliases:[{ticker:'DUAL',valid_from:null,valid_to:null}]}};
  assert.equal((await req('/api/identities/register',registration)).status,201);
 }
 const draft=key=>req('/api/revisions',{ticker:'DUAL',title:'Synthetic ambiguity',sources:['https://example.test/identity'],sourceText:'Synthetic only',idempotencyKey:key});
 const first=await (await draft('ambiguous-draft-1')).json(),second=await (await draft('ambiguous-draft-2')).json();
 assert.equal(first.resolution.status,'ambiguous');assert.equal(first.securityId,null);
 const row1=(await (await req('/api/revisions/'+first.id)).json()).revision,row2=(await (await req('/api/revisions/'+second.id)).json()).revision;
 assert.notEqual(row1.company_id,row2.company_id);assert.match(row1.company_id,/^provisional-company:/);assert.notEqual(row1.document_id,row2.document_id);
 await req('/api/revisions/'+first.id+'/edit',{version:1,body:'Preserved synthetic body'});
 assert.equal((await req('/api/revisions/'+first.id+'/submit',{version:2})).status,409);
 assert.equal((await req('/api/revisions/'+first.id+'/resolve-identity',{version:2,exchange:'XLON'},'reviewer')).status,403);
 assert.equal((await req('/api/revisions/'+first.id+'/resolve-identity',{version:2,exchange:'XLON',securityId:'dual-XNYS'})).status,409);
 assert.equal((await req('/api/revisions/'+first.id+'/resolve-identity',{version:2,exchange:'XLON'})).status,200);
 const resolved=(await (await req('/api/revisions/'+first.id)).json()).revision;
 assert.equal(resolved.security_id,'dual-XLON');assert.equal(resolved.company_id,'company-dual');assert.equal(resolved.body,'Preserved synthetic body');assert.equal(resolved.version,3);assert.equal(resolved.reviewed_at,null);assert.equal(resolved.status,'draft');
 assert.equal((await req('/api/revisions/'+first.id+'/resolve-identity',{version:2,exchange:'XNYS'})).status,409);
 const explicit=await (await req('/api/revisions',{ticker:'DUAL',securityId:'dual-XNYS',title:'Synthetic class',sources:['https://example.test/identity'],sourceText:'Synthetic only',idempotencyKey:'explicit-class-draft'})).json();
 assert.equal(explicit.securityId,'dual-XNYS');
});
