#!/usr/bin/env bash
set -euo pipefail
: "${CLOUDFLARE_API_TOKEN:?missing CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?missing CLOUDFLARE_ACCOUNT_ID}"

stage_tmp_dir="$(mktemp -d)"
stage_config="$PWD/wrangler.staging.generated.toml"
trap 'rm -rf "$stage_tmp_dir"; rm -f "$stage_config"' EXIT
stage_migrations="$stage_tmp_dir/migrations"
mkdir -p "$stage_migrations"
# schema.sql already contains the Stripe column from migration 002. Apply only
# later additive migrations so a fresh staging database and a rerun are both safe.
cp src/db/migrations/003_portal_jobs.sql "$stage_migrations/"
cp src/db/migrations/004_portals_and_feedback.sql "$stage_migrations/"
cp src/db/migrations/005_research_desk.sql "$stage_migrations/"
cp src/db/migrations/006_research_workspace.sql "$stage_migrations/"

if ! npx wrangler deployments list --name lcs-portfolio-intel-staging >/dev/null 2>&1; then
  printf '%s\n' 'export default {fetch(){return new Response("Staging catalog is starting",{status:503})}}' > "$stage_tmp_dir/placeholder.mjs"
  npx wrangler deploy "$stage_tmp_dir/placeholder.mjs" --name lcs-portfolio-intel-staging --compatibility-date 2026-09-14 --no-bundle
fi

db_name="stock-pitch-web-staging"
find_db() {
  npx wrangler d1 list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const row=JSON.parse(s).find(x=>x.name===process.argv[1]);if(row)process.stdout.write(row.uuid)})' "$db_name"
}
db_id="$(find_db)"
if [ -z "$db_id" ]; then
  npx wrangler d1 create "$db_name" --location enam
  db_id="$(find_db)"
fi
test -n "$db_id"

kv_name="stock-pitch-web-staging-REQUESTS"
find_kv() {
  npx wrangler kv namespace list | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const row=JSON.parse(s).find(x=>x.title===process.argv[1]);if(row)process.stdout.write(row.id)})' "$kv_name"
}
kv_id="$(find_kv)"
if [ -z "$kv_id" ]; then
  npx wrangler kv namespace create "$kv_name"
  kv_id="$(find_kv)"
fi
test -n "$kv_id"

cat > "$stage_config" <<TOML
name = "stock-pitch-web-staging"
main = "src/index.ts"
compatibility_date = "2026-04-15"
compatibility_flags = ["nodejs_compat"]
workers_dev = true
[vars]
ENVIRONMENT = "staging"
RESEARCH_PUBLICATION_ENABLED = "false"
[[services]]
binding = "RESEARCH_CATALOG"
service = "lcs-portfolio-intel-staging"
[[kv_namespaces]]
binding = "REQUESTS"
id = "$kv_id"
[[d1_databases]]
binding = "DB"
database_name = "$db_name"
database_id = "$db_id"
migrations_dir = "$stage_migrations"
[ai]
binding = "AI"
[browser]
binding = "BROWSER"
[[durable_objects.bindings]]
class_name = "ResearchAgent"
name = "ResearchAgent"
[[durable_objects.bindings]]
class_name = "WorkflowAgent"
name = "WorkflowAgent"
[[migrations]]
new_sqlite_classes = ["ResearchAgent"]
tag = "v1"
[[migrations]]
new_sqlite_classes = ["WorkflowAgent"]
tag = "v2"
[[rules]]
type = "Text"
globs = ["**/*.md"]
fallthrough = true
TOML

npx wrangler d1 execute DB --remote --config "$stage_config" --file=src/db/schema.sql
npx wrangler d1 migrations apply DB --remote --config "$stage_config"
npx wrangler deploy --config "$stage_config"
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET --config "$stage_config"

subdomain="$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).result.subdomain))')"
stage_url="https://stock-pitch-web-staging.$subdomain.workers.dev"
test "$(curl -sS --retry 8 --retry-delay 2 --retry-all-errors -o /dev/null -w '%{http_code}' "$stage_url/research/workspace")" = "401"
curl -fsS --retry 8 --retry-delay 2 --retry-all-errors "$stage_url/research/published-catalog" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s);if(!Array.isArray(x.documents))process.exit(1)})'
printf 'STAGING_URL=%s\n' "$stage_url"
