# Deployment

The portal deploys as a Cloudflare Worker using Hono. This file covers the scaffold, routing, and deployment workflow.

## Prerequisites

- Node.js 20+
- Cloudflare account
- Cloudflare API token or OAuth (via `wrangler login`)
- Domain configured with Cloudflare (for zone routes) OR default `workers.dev` subdomain

## Starter Project Structure

The plugin includes a boilerplate at `boilerplate/` that you can use as a starting point:

```
boilerplate/
├── package.json
├── wrangler.toml.example
├── tsconfig.json
├── src/
│   ├── index.ts              # Hono app with route handlers
│   ├── types.ts              # Env type
│   └── pages/
│       ├── ticker-index.ts
│       ├── ticker-memo.ts
│       ├── ticker-presentation.ts
│       ├── ticker-model.ts
│       └── ticker-consensus.ts
```

Copy this to your working directory and customize.

## Integration with Existing Worker

If you're adding a ticker to an EXISTING multi-ticker portfolio Worker (the LCS pattern), follow this integration approach:

### 1. Add the 5 imports

```ts
// src/index.ts
import { bxIndexHTML } from './pages/bx-index';
import { bxMemoHTML } from './pages/bx-memo';
import { bxPresentationHTML } from './pages/bx-presentation';
import { bxModelHTML } from './pages/bx-model';
import { bxConsensusHTML } from './pages/bx-consensus';
```

### 2. Add the 5 route handlers

```ts
// In the main request handler:
if (path === '/lcs/bx' || path === '/lcs/bx/') return c.html(bxIndexHTML);
if (path === '/lcs/bx/memo.html') return c.html(bxMemoHTML);
if (path === '/lcs/bx/presentation.html') return c.html(bxPresentationHTML);
if (path === '/lcs/bx/model.html') return c.html(bxModelHTML);
if (path === '/lcs/bx/consensus.html') return c.html(bxConsensusHTML);
```

### 3. Deploy

```bash
cd /path/to/your/worker
source ~/.nvm/nvm.sh && nvm use 20
npx wrangler deploy
```

## Wrangler Configuration

**Basic wrangler.toml:**

```toml
name = "stock-research"
main = "src/index.ts"
compatibility_date = "2025-06-01"

# Option A: Deploy to workers.dev subdomain
# (no routes needed; accessible at stock-research.YOUR_SUBDOMAIN.workers.dev)

# Option B: Custom zone routes
routes = [
  { pattern = "yourdomain.com/research/*", zone_name = "yourdomain.com" },
]

# Optional bindings (if pulling live data):
# [[d1_databases]]
# binding = "DB"
# database_name = "your-db"
# database_id = "..."
#
# [[kv_namespaces]]
# binding = "CACHE"
# id = "..."
```

## Authentication

Prefer OAuth over API tokens for personal use:

```bash
npx wrangler login
```

This stores credentials at `~/.wrangler/config/default.toml` and auto-refreshes.

If using an API token in CI/CD:

```bash
CLOUDFLARE_API_TOKEN=your_token npx wrangler deploy
```

**Common token gotchas:**
- Some tokens are scoped to specific workers/zones. If deploy fails with "Authentication error," try another token or use OAuth.
- Tokens can expire (OAuth tokens refresh; permanent tokens don't).
- WSL2 Node.js sometimes can't verify Cloudflare TLS — use `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` as a prefix.

## Deploy Commands

### Standard deploy

```bash
source ~/.nvm/nvm.sh && nvm use 20
npx wrangler deploy
```

### Deploy with WSL2 TLS fix

```bash
source ~/.nvm/nvm.sh && nvm use 20
NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt npx wrangler deploy
```

### Deploy with explicit API token

```bash
CLOUDFLARE_API_TOKEN=cfut_... CLOUDFLARE_ACCOUNT_ID=... npx wrangler deploy
```

## Verification

After deploy, verify all 5 pages return 200:

```bash
TICKER=bx
DOMAIN=yourdomain.com

for page in "" "memo.html" "presentation.html" "model.html" "consensus.html"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/lcs/${TICKER}/${page}")
  echo "${TICKER}/${page:-index}: ${code}"
done
```

Expected output:

```
bx/index: 200
bx/memo.html: 200
bx/presentation.html: 200
bx/model.html: 200
bx/consensus.html: 200
```

If any return 404, the routing is wrong. If any return 500, there's a build-time error in the TypeScript — check `npx wrangler deploy` output.

## Template Literal Debugging

The most common deploy failure is malformed template literals in the page HTML:

- Unescaped backticks inside inline `<script>`
- Unescaped `${` inside template literals
- Missing closing `` ` `` at end of page constant

If `wrangler deploy` hangs or fails with "Unexpected token," grep for:

```bash
grep -n '${' src/pages/bx-model.ts | grep -v '\\\${'
```

All `${` inside the template literal should be escaped as `\${` unless they are genuinely interpolations.

## Post-Deploy

1. **Visual spot-check** all 5 pages via browser
2. **Interactive model test:** move each slider, click each preset, try keyboard shortcuts
3. **Dark mode toggle** on all 5 pages (verify localStorage persists)
4. **Mobile test** (responsive rules, collapsed nav, sidenotes)
5. **Share URL** with the audience

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 404 on all pages | Route pattern mismatch | Verify `path === '/lcs/bx'` matches the request |
| 500 on one page | TypeScript compile error | Run `npx wrangler deploy` locally; read error |
| Pages render without styles | `<style>` block broken | Check for unclosed braces, bad CSS |
| Model page slow/frozen | Too many sensitivity recomputes | Memoize `computeModel`; use debounce on input |
| Dark mode doesn't persist | localStorage key mismatch | Verify same key in toggle and on-load logic |
| Sliders don't move display | Event listener not wired | Add `document.getElementById(id).addEventListener('input', update)` |
| Carousel doesn't work on deck | JS error on load | Check browser console for stack trace |
| Mobile nav collapses wrong | Breakpoint mismatch | `@media(max-width:600px){.nav-links{display:none}}` |
