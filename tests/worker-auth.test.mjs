import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { createHmac } from "node:crypto";
import { Miniflare } from "miniflare";
let mf, db, session, auth;
let outboundCalls=0;
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
    outboundService: () => {outboundCalls++;throw new Error("Network forbidden in auth fixture");},
  });
  db = await mf.getD1Database("DB");
  const schema=readFileSync('src/db/schema.sql','utf8').replace(/--[^\n]*/g,'');
  for(const table of ['users','auth_tokens'])await db.prepare(schema.match(new RegExp('CREATE TABLE IF NOT EXISTS '+table+' \\([\\s\\S]*?;'))[0]).run();
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
  auth = await import(
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

function signedPayload(obj){const payload=Buffer.from(JSON.stringify(obj)).toString('base64');return payload+'.'+createHmac('sha256','synthetic-auth-test-secret').update(payload).digest('hex');}
async function seedToken(token,email,expires){await db.prepare('INSERT INTO auth_tokens(token,email,expires_at) VALUES (?,?,?)').bind(token,email,expires).run();}
async function verify(token){return mf.dispatchFetch('https://research.levincap.com/auth/verify/'+token,{redirect:'manual'});}
test('actual magic-token verification signs a named member session; replay and nonmembers fail',async()=>{
 await db.prepare("INSERT INTO users(id,email,last_seen_at) VALUES ('named-analyst','named@example.test','2026-01-01'),('nonmember','outside@example.test','2026-01-01')").run();
 await db.prepare("INSERT INTO research_members(user_id,role) VALUES ('named-analyst','analyst')").run();
 await seedToken('synthetic-member-token','named@example.test',new Date(Date.now()+900000).toISOString());
 const result=await verify('synthetic-member-token');assert.equal(result.status,302);
 const cookie=result.headers.get('set-cookie');assert.ok(cookie);for(const flag of ['HttpOnly','Secure','SameSite=Lax'])assert.ok(cookie.includes(flag));
 const sessionCookie=cookie.split(';')[0];
 for(const host of ['research.levincap.com','test.workers.dev']){const response=await mf.dispatchFetch('https://'+host+'/research/workspace',{headers:{cookie:sessionCookie}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');}
 const replay=await verify('synthetic-member-token');assert.equal(replay.headers.get('set-cookie'),null);assert.match(await replay.text(),/invalid, expired, or already used/);
 assert.equal((await db.prepare("SELECT used FROM auth_tokens WHERE token='synthetic-member-token'").first()).used,1);
 await seedToken('synthetic-nonmember-token','outside@example.test',new Date(Date.now()+900000).toISOString());
 const outsider=await verify('synthetic-nonmember-token');assert.equal(outsider.status,302);
 const denied=await mf.dispatchFetch('https://research.levincap.com/research/workspace',{headers:{cookie:outsider.headers.get('set-cookie').split(';')[0]}});assert.equal(denied.status,403);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM research_members WHERE user_id='nonmember'").first()).n,0);
 assert.equal(outboundCalls,0);
});
test('expired and malformed token expiries cannot issue a session; expired signed cookies fail',async()=>{
 for(const [token,expiry] of [['expired','2000-01-01T00:00:00Z'],['malformed','not-a-date']]){
  await seedToken('synthetic-'+token,'named@example.test',expiry);const response=await verify('synthetic-'+token);assert.equal(response.headers.get('set-cookie'),null,token);assert.match(await response.text(),/invalid, expired, or already used/);assert.equal((await db.prepare('SELECT used FROM auth_tokens WHERE token=?').bind('synthetic-'+token).first()).used,0);
 }
 const expired=signedPayload({u:'named-analyst',e:'named@example.test',x:Date.now()-1000});
 for(const host of ['research.levincap.com','test.workers.dev'])assert.equal((await mf.dispatchFetch('https://'+host+'/research/workspace',{headers:{cookie:'sp_session='+expired}})).status,401);
 assert.equal(outboundCalls,0);
});

test('expiry instants are exclusive for signed sessions and magic tokens',async()=>{
 const instant=Date.now(),realNow=Date.now;Date.now=()=>instant;
 try{
  assert.equal(await auth.verifySession(signedPayload({u:'named-analyst',e:'named@example.test',x:instant}),'synthetic-auth-test-secret'),null);
  let consumed=false;
  const atExpiry={prepare(){return {bind(){return this;},async first(){return {email:'named@example.test',used:0,expires_at:new Date(instant).toISOString()};},async run(){consumed=true;throw new Error('Expired token must not be consumed');}};}};
  assert.equal(await auth.verifyMagicToken(atExpiry,'synthetic-boundary','levincap'),null);assert.equal(consumed,false);
 }finally{Date.now=realNow;}
});
