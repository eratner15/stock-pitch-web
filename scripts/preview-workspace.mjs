// Local-only QA server: synthetic identities and data, never production bindings.
// Not imported by the Worker. Listens only on loopback.
import http from "node:http";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { Hono } from "hono";
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
const { workspace } = await bundle("src/routes/research-workspace.ts");
const catalogPath = process.env.LOCAL_CATALOG_SOURCE;
if (!catalogPath)
  throw Error(
    "Set LOCAL_CATALOG_SOURCE to the isolated LCS src/pages/research-magazine.ts",
  );
const { getResearchCatalog } = await bundle(catalogPath);
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("fixture")}}',
  compatibilityDate: "2026-04-10",
  d1Databases: ["DB"],
});
const DB = await mf.getD1Database("DB");
for (const file of ["005_research_desk.sql", "006_research_workspace.sql"])
  for (const s of readFileSync("src/db/migrations/" + file, "utf8")
    .replace(/--[^\n]*/g, "")
    .split(";")
    .filter((s) => s.trim()))
    await DB.prepare(s).run();
await DB.prepare(
  "INSERT INTO research_members(user_id,role) VALUES ('fixture-author','analyst'),('fixture-reviewer','reviewer')",
).run();
const env = {
  DB,
  RESEARCH_CATALOG: { fetch: async () => Response.json(getResearchCatalog()) },
  ANTHROPIC_API_KEY: "local-fixture-not-a-secret",
  RESEARCH_PUBLICATION_ENABLED: "true",
  WorkflowAgent: {
    idFromName: (x) => x,
    get: () => ({
      fetch: async () =>
        Response.json({
          analysis:
            "SYNTHETIC QA OUTPUT. Not investment research.\nSources: https://example.test/earnings\nNo house view is proposed.",
        }),
    }),
  },
};
const app = new Hono();
app.use("*", async (c, next) => {
  const reviewer = c.req.header("cookie")?.includes("fixture-role=reviewer");
  c.set("user", {
    id: reviewer ? "fixture-reviewer" : "fixture-author",
    email: "fixture@example.test",
  });
  await next();
});
app.route("/research/workspace", workspace);
http
  .createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const response = await app.fetch(
        new Request("http://127.0.0.1:8799" + req.url, {
          method: req.method,
          headers: req.headers,
          ...(body.length ? { body, duplex: "half" } : {}),
        }),
        env,
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch {
      res.writeHead(500);
      res.end("Local preview error");
    }
  })
  .listen(8799, "127.0.0.1", () =>
    console.log(
      "LOCAL SYNTHETIC QA ONLY http://127.0.0.1:8799/research/workspace",
    ),
  );
