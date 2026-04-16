import type { PortalEntry } from '../portfolio';
import type { LeaderboardRow } from '../pages/leaderboard';
import { escapeHtml } from '../lib/security';

/**
 * Stock Pitch homepage — Perplexity/v0-style simplicity.
 * Hero = single ticker input, do-one-thing. Below: proof (board top + latest).
 * Keeps 80s broadsheet aesthetic (Abril Fatface, cream paper, red accent) but
 * cuts 70% of the chrome of the old marketing layout.
 */
export function renderStockPitchLanding(portfolio: PortalEntry[], top: LeaderboardRow[] = []): string {
  const featured = portfolio.filter(p => p.featured).slice(0, 3);
  const others = portfolio.filter(p => !p.featured).slice(0, 3);
  const reports = [...featured, ...others].slice(0, 6);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Pitch a ticker. Get a research brief in 2 minutes. The market keeps score.">
<meta property="og:title" content="Stock Pitch — pitch a ticker, get a brief">
<meta property="og:description" content="Enter a ticker. Get a research brief. Market keeps score.">
<meta name="theme-color" content="#1A1814">
<title>Stock Pitch</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --paper:#F4EEE1;
  --paper-deep:#EBE2D0;
  --ink:#1A1814;
  --ink-60:#4E463D;
  --ink-40:#7E7468;
  --ink-20:#B9AE9C;
  --rule:#241F17;
  --red:#B7141F;
  --navy:#0E2340;
  --gold:#C9A34E;
  --bull:#1B5631;
  --bear:#8E1218;
  --display:'Abril Fatface',Georgia,serif;
  --body:'Lora',Georgia,serif;
  --mono:'IBM Plex Mono',ui-monospace,monospace;
}
html{background:var(--paper)}
body{
  font-family:var(--body);background:var(--paper);color:var(--ink);line-height:1.55;font-size:17px;
  -webkit-font-smoothing:antialiased;
  background-image:
    repeating-linear-gradient(90deg,transparent 0 23px,rgba(14,35,64,0.03) 23px 24px);
  background-attachment:fixed;
}
a{color:inherit;text-decoration:none}
.wrap{max-width:920px;margin:0 auto;padding:0 28px}

/* MASTHEAD — tiny, one line */
.masthead{padding:18px 0 16px;border-bottom:1px solid var(--rule)}
.masthead .wrap{display:flex;justify-content:space-between;align-items:center;gap:16px}
.mh-brand{font-family:var(--display);font-size:26px;line-height:1;color:var(--ink);display:flex;align-items:baseline;gap:8px}
.mh-brand .dot{width:10px;height:10px;border-radius:50%;background:var(--red);transform:translateY(-3px)}
.mh-nav{display:flex;align-items:center;gap:22px;font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase}
.mh-nav a{color:var(--ink-60);transition:color 0.15s}
.mh-nav a:hover{color:var(--red)}

/* HERO — the whole point */
.hero{padding:72px 0 64px;text-align:center}
.hero h1{
  font-family:var(--display);font-size:clamp(52px,9vw,96px);line-height:0.95;
  color:var(--ink);letter-spacing:-0.025em;margin-bottom:10px;
}
.hero h1 em{color:var(--red);font-style:italic}
.hero-tag{
  font-family:var(--body);font-style:italic;font-size:19px;color:var(--ink-60);margin-bottom:38px;
}
.ticker-form{
  display:flex;gap:0;max-width:560px;margin:0 auto 22px;
  border:2px solid var(--ink);background:var(--paper);
  box-shadow:6px 6px 0 var(--ink);
  transition:box-shadow 0.12s,transform 0.12s;
}
.ticker-form:focus-within{box-shadow:8px 8px 0 var(--red);transform:translate(-1px,-1px)}
.ticker-form input{
  flex:1;padding:18px 22px;border:none;background:transparent;
  font-family:var(--mono);font-size:24px;font-weight:700;letter-spacing:4px;
  color:var(--ink);text-transform:uppercase;outline:none;min-width:0;
}
.ticker-form input::placeholder{color:var(--ink-40);letter-spacing:4px;font-weight:500}
.ticker-form button{
  padding:18px 28px;background:var(--red);color:var(--paper);border:none;cursor:pointer;
  font-family:var(--mono);font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;
  transition:background 0.12s;
}
.ticker-form button:hover{background:#900d17}
.chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:4px}
.chip{
  padding:8px 14px;border:1px dotted var(--ink-40);
  font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:1.5px;color:var(--ink-60);
  cursor:pointer;transition:border 0.12s,color 0.12s,background 0.12s;
}
.chip:hover{border-color:var(--red);border-style:solid;color:var(--red);background:rgba(183,20,31,0.06)}

/* LEADERBOARD TEASER */
.section{padding:36px 0 40px;border-top:1px dotted var(--ink-20)}
.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:20px;margin-bottom:18px;flex-wrap:wrap}
.section-hed{white-space:nowrap}
.section-hed{font-family:var(--display);font-size:28px;line-height:1;color:var(--ink);letter-spacing:-0.01em}
.section-hed em{color:var(--red);font-style:italic}
.section-link{font-family:var(--mono);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-60);border-bottom:1px solid var(--ink-20);padding-bottom:2px;transition:color 0.15s,border 0.15s}
.section-link:hover{color:var(--red);border-color:var(--red)}

.lb-preview{border:1px solid var(--rule);background:var(--paper)}
.lb-row{
  display:grid;grid-template-columns:36px 1fr auto auto;gap:14px;
  padding:12px 16px;border-bottom:1px solid var(--ink-20);align-items:center;
  font-family:var(--mono);font-size:13px;transition:background 0.12s;
}
.lb-row:last-child{border-bottom:none}
.lb-row:hover{background:rgba(183,20,31,0.04)}
.lb-rank{font-family:var(--display);font-size:22px;line-height:1;color:var(--ink-40);letter-spacing:-0.01em}
.lb-analyst{font-family:var(--body);font-size:14px;color:var(--ink);font-weight:600;letter-spacing:0}
.lb-analyst .tkr{font-family:var(--mono);font-weight:700;color:var(--ink);margin-left:8px;font-size:12px;letter-spacing:1px}
.lb-dir{font-family:var(--mono);font-size:10px;letter-spacing:1.5px;color:var(--ink-40);text-transform:uppercase;font-weight:600}
.lb-ret{font-family:var(--display);font-size:18px;line-height:1;letter-spacing:-0.01em;min-width:70px;text-align:right}
.lb-ret.pos{color:var(--bull)}
.lb-ret.neg{color:var(--bear)}

.lb-empty{padding:28px 16px;text-align:center;font-family:var(--body);font-style:italic;color:var(--ink-60);font-size:15px}
.lb-empty a{color:var(--red);border-bottom:1px solid var(--red)}

/* LATEST REPORTS */
.reports-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.report{
  background:var(--paper);border:1px solid var(--rule);padding:18px;
  display:block;transition:transform 0.1s,box-shadow 0.1s;
}
.report:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--ink)}
.report-tkr{font-family:var(--display);font-size:26px;line-height:1;color:var(--ink);margin-bottom:2px}
.report-co{font-family:var(--body);font-style:italic;font-size:13px;color:var(--ink-60);margin-bottom:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.report-thesis{font-family:var(--body);font-size:14.5px;line-height:1.55;color:var(--ink);margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.report-foot{display:flex;justify-content:space-between;align-items:baseline;padding-top:10px;border-top:1px dotted var(--ink-20);font-family:var(--mono);font-size:11px;letter-spacing:1.5px}
.report-stat{font-family:var(--display);font-size:18px;line-height:1}
.report-stat.pos{color:var(--bull)}
.report-stat.neg{color:var(--bear)}
.report-rating{color:var(--ink-40);text-transform:uppercase;font-weight:700}

/* FOOTER — minimal */
footer{margin-top:40px;padding:22px 0 36px;border-top:1px solid var(--rule);
  font-family:var(--mono);font-size:11px;letter-spacing:2px;color:var(--ink-40);text-transform:uppercase}
footer .wrap{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
footer .note{font-family:var(--body);font-style:italic;text-transform:none;letter-spacing:0;font-size:12px;color:var(--ink-40)}

@media(max-width:720px){
  body{font-size:17px}
  .wrap{padding:0 20px}
  .mh-brand{font-size:22px}
  .mh-nav{gap:14px;font-size:10px;letter-spacing:1px}
  .hero{padding:44px 0 44px}
  .hero h1{font-size:48px;line-height:0.98;letter-spacing:-0.01em;word-spacing:0.04em}
  .hero-tag{font-size:17px;margin-bottom:28px;line-height:1.5}
  .ticker-form{max-width:100%;box-shadow:4px 4px 0 var(--ink)}
  .ticker-form input{padding:14px 16px;font-size:20px;letter-spacing:3px}
  .ticker-form button{padding:14px 18px;font-size:11px;letter-spacing:1.5px}
  .chips{gap:7px}
  .chip{padding:11px 14px;font-size:12px}
  .section-link{display:none}
  .section{padding:28px 0 32px}
  .section-hed{font-size:24px;white-space:normal}
  .lb-row{grid-template-columns:28px 1fr auto;gap:10px;padding:13px 14px}
  .lb-dir{display:none}
  .lb-rank{font-size:18px}
  .lb-ret{font-size:17px;min-width:60px}
  .lb-analyst{font-size:16px}
  .report{padding:16px}
  .reports-grid{grid-template-columns:1fr;gap:10px}
  .report-tkr{font-size:24px}
  .report-co{font-size:14px}
  .report-thesis{font-size:15px;line-height:1.55}
  .report-stat{font-size:18px}
  footer .wrap{flex-direction:column;gap:8px;text-align:center}
}
</style>
</head>
<body>

<header class="masthead">
  <div class="wrap">
    <a href="/" class="mh-brand"><span class="dot"></span>Stock Pitch</a>
    <nav class="mh-nav">
      <a href="/leaderboard">Leaderboard</a>
      <a href="/p/top10">Top 10</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="wrap">
    <h1>Pitch a <em>stock.</em></h1>
    <p class="hero-tag">Enter a ticker. Get an AI research brief. The market keeps score.</p>
    <form class="ticker-form" action="/submit" method="get" onsubmit="return sanitizeTicker(event)">
      <input name="ticker" id="heroTicker" placeholder="TYPE A TICKER" maxlength="8" autocomplete="off" spellcheck="false" autofocus>
      <button type="submit">Pitch →</button>
    </form>
    <div class="chips">
      ${['NVDA','AAPL','PLTR','MSGS','TSLA','BX'].map(t => `<span class="chip" data-t="${t}">${t}</span>`).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2 class="section-hed">Top of the <em>board</em></h2>
      <a href="/leaderboard" class="section-link">Full leaderboard →</a>
    </div>
    ${top.length === 0 ? `
      <div class="lb-preview">
        <div class="lb-empty">No calls ranked yet. <a href="/submit">Be the first</a> — take the cover.</div>
      </div>
    ` : `
      <div class="lb-preview">
        ${top.map((r, i) => renderLbRow(r, i + 1)).join('')}
      </div>
    `}
  </div>
</section>

${reports.length > 0 ? `
<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2 class="section-hed">Latest <em>reports</em></h2>
      <a href="/leaderboard" class="section-link">Browse all →</a>
    </div>
    <div class="reports-grid">
      ${reports.map(renderReport).join('')}
    </div>
  </div>
</section>
` : ''}

<footer>
  <div class="wrap">
    <div>© ${new Date().getFullYear()} Stock Pitch · <a href="/leaderboard">Board</a> · <a href="/submit">Submit</a></div>
    <div class="note">Nothing here is investment advice.</div>
  </div>
</footer>

<script>
function sanitizeTicker(e){
  const el = document.getElementById('heroTicker');
  const v = (el.value || '').toUpperCase().replace(/[^A-Z.]/g,'').slice(0,8);
  if (!v) { e.preventDefault(); el.focus(); return false; }
  el.value = v;
  return true;
}
document.querySelectorAll('.chip').forEach(c => {
  c.addEventListener('click', () => {
    const t = c.dataset.t;
    window.location.href = (window.__BASE_PATH__ || '') + '/submit?ticker=' + encodeURIComponent(t);
  });
});
// Force uppercase as user types
document.getElementById('heroTicker').addEventListener('input', e => {
  const el = e.target;
  const v = el.value.toUpperCase().replace(/[^A-Z.]/g,'');
  if (v !== el.value) el.value = v;
});
</script>

</body>
</html>`;
}

function toRoman(n: number): string {
  return ['I','II','III','IV','V','VI','VII','VIII','IX','X'][n - 1] || String(n);
}

function renderLbRow(r: LeaderboardRow, rank: number): string {
  const pos = r.return_pct >= 0;
  const dir = r.direction === 'long' ? 'long' : 'short';
  return `<a class="lb-row" href="/c/${encodeURIComponent(r.call_id)}">
    <div class="lb-rank">${toRoman(rank)}</div>
    <div>
      <span class="lb-analyst">${escapeHtml(r.user_display)}<span class="tkr">${escapeHtml(r.ticker)}</span></span>
    </div>
    <div class="lb-dir">${dir}</div>
    <div class="lb-ret ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${(r.return_pct * 100).toFixed(1)}%</div>
  </a>`;
}

function renderReport(p: PortalEntry): string {
  const isNeg = p.headline_stat.trim().startsWith('-');
  const statClass = isNeg ? 'neg' : 'pos';
  return `<a href="${p.url}" class="report" target="_blank" rel="noopener">
    <div class="report-tkr">${escapeHtml(p.ticker)}</div>
    <div class="report-co">${escapeHtml(p.company)}</div>
    <div class="report-thesis">${escapeHtml(p.thesis)}</div>
    <div class="report-foot">
      <div class="report-stat ${statClass}">${escapeHtml(p.headline_stat)}</div>
      <div class="report-rating">${escapeHtml(p.rating)}</div>
    </div>
  </a>`;
}
