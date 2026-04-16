import type { PortalEntry } from '../portfolio';
import type { LeaderboardRow } from '../pages/leaderboard';
import { escapeHtml } from '../lib/security';

/**
 * Levin Capital Research homepage — same one-input pattern as Stock Pitch,
 * refined in Loeb-Rhoades aesthetic (Bodoni + Cormorant, banker green, gold).
 */
export function renderLevinCapLanding(portfolio: PortalEntry[], top: LeaderboardRow[] = []): string {
  const featured = portfolio.filter(p => p.featured).slice(0, 3);
  const others = portfolio.filter(p => !p.featured).slice(0, 3);
  const reports = [...featured, ...others].slice(0, 6);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Levin Capital Research. Submit a note. The Ledger keeps the score.">
<meta property="og:title" content="Levin Capital Research">
<meta property="og:description" content="Submit a note. The Ledger keeps the score.">
<meta name="theme-color" content="#0F3B2E">
<title>Levin Capital Research</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,400;1,9..144,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=IM+Fell+English+SC&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --paper:#F3EAD5;
  --paper-deep:#E6DABF;
  --paper-warm:#F8F0DB;
  --ink:#0A0806;
  --ink-60:#5A5040;
  --ink-40:#847961;
  --ink-20:#B8AE95;
  --rule:#2E281D;
  --banker:#0F3B2E;
  --banker-deep:#082619;
  --gold:#B8973E;
  --gold-deep:#8B6F28;
  --ledger-green:#0F3B2E;
  --ledger-red:#8B2A1E;
  --display:'Fraunces','Source Serif 4',Georgia,serif;
  --body:'Source Serif 4','Lora',Georgia,serif;
  --smcp:'IM Fell English SC',serif;
}
html{background:var(--paper)}
body{
  font-family:var(--body);background:var(--paper);color:var(--ink);line-height:1.62;font-size:18px;
  font-weight:450;
  -webkit-font-smoothing:antialiased;
  font-feature-settings:'onum' 1,'liga' 1;
  font-variation-settings:"opsz" 14;
  background-image:
    repeating-linear-gradient(0deg,transparent 0 31px,rgba(46,40,29,0.022) 31px 32px);
  background-attachment:fixed;
}
a{color:inherit;text-decoration:none}
.wrap{max-width:900px;margin:0 auto;padding:0 32px}

/* MASTHEAD — compact, centered */
.mast{padding:24px 0;border-bottom:1px solid var(--ink)}
.mast .wrap{display:flex;justify-content:space-between;align-items:center;gap:20px}
.mast-brand{font-family:var(--display);font-weight:700;font-size:22px;line-height:1;letter-spacing:0.02em;text-transform:uppercase;color:var(--ink);font-variation-settings:"opsz" 40}
.mast-brand em{font-style:italic;font-weight:500;color:var(--banker);text-transform:none;letter-spacing:0.01em;margin-left:6px;font-variation-settings:"opsz" 40}
.mast-nav{display:flex;align-items:center;gap:28px;font-family:var(--smcp);font-size:12px;letter-spacing:4px;text-transform:uppercase;color:var(--ink-60)}
.mast-nav a{padding:4px 0;border-bottom:2px solid transparent;transition:border 0.2s,color 0.2s}
.mast-nav a:hover{color:var(--banker);border-bottom-color:var(--gold)}

/* HERO */
.hero{padding:80px 0 64px;text-align:center}
.hero h1{
  font-family:var(--display);font-weight:700;font-size:clamp(54px,8vw,92px);line-height:1;
  color:var(--ink);letter-spacing:-0.02em;margin-bottom:14px;
  font-variation-settings:"opsz" 144,"SOFT" 50;
}
.hero h1 em{font-style:italic;font-weight:500;color:var(--banker);font-variation-settings:"opsz" 144,"SOFT" 60}
.hero-tag{
  font-family:var(--body);font-style:italic;font-size:20px;color:var(--ink-60);margin-bottom:40px;max-width:560px;margin-left:auto;margin-right:auto;line-height:1.5;
  font-weight:450;
}
.ticker-form{
  display:flex;gap:0;max-width:540px;margin:0 auto 22px;
  border:1px solid var(--ink);background:var(--paper-warm);
  box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 4px transparent,inset 0 0 0 5px var(--gold-deep);
  transition:box-shadow 0.15s;
}
.ticker-form:focus-within{box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 4px transparent,inset 0 0 0 5px var(--banker)}
.ticker-form input{
  flex:1;padding:18px 22px;border:none;background:transparent;
  font-family:var(--display);font-size:26px;font-weight:600;letter-spacing:3px;
  color:var(--ink);text-transform:uppercase;outline:none;min-width:0;
  font-variation-settings:"opsz" 60;
}
.ticker-form input::placeholder{color:var(--ink-40);letter-spacing:3px;font-weight:400;font-style:italic}
.ticker-form button{
  padding:18px 26px;background:var(--banker);color:var(--paper);border:none;cursor:pointer;
  font-family:var(--smcp);font-weight:400;font-size:12px;letter-spacing:4px;text-transform:uppercase;
  transition:background 0.15s;
}
.ticker-form button:hover{background:var(--banker-deep)}
.chips{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.chip{
  padding:7px 14px;
  font-family:var(--smcp);font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--ink-60);
  border:1px solid var(--ink-20);cursor:pointer;transition:border 0.15s,color 0.15s,background 0.15s;
}
.chip:hover{border-color:var(--banker);color:var(--banker);background:rgba(15,59,46,0.04)}

/* SECTION */
.section{padding:40px 0 32px;border-top:1px solid var(--ink-20)}
.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:20px;margin-bottom:22px;flex-wrap:wrap}
.section-hed{font-family:var(--display);font-weight:500;font-style:italic;font-size:30px;line-height:1;color:var(--ink);letter-spacing:-0.01em;font-variation-settings:"opsz" 72}
.section-hed strong{font-weight:700;font-style:normal;font-variation-settings:"opsz" 72}
.section-link{font-family:var(--smcp);font-size:11px;letter-spacing:4px;text-transform:uppercase;color:var(--ink-60);border-bottom:1px solid var(--gold);padding-bottom:3px;transition:color 0.15s}
.section-link:hover{color:var(--banker)}

/* LEDGER PREVIEW */
.lb-preview{background:var(--paper-warm);border:1px solid var(--ink);box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 4px transparent,inset 0 0 0 5px var(--gold-deep)}
.lb-row{
  display:grid;grid-template-columns:44px 1fr auto auto;gap:16px;
  padding:14px 22px;border-bottom:1px solid var(--ink-20);align-items:center;
  font-family:var(--body);font-size:17px;transition:background 0.15s;
}
.lb-row:last-child{border-bottom:none}
.lb-row:hover{background:rgba(15,59,46,0.04)}
.lb-rank{font-family:var(--display);font-style:italic;font-weight:500;font-size:22px;line-height:1;color:var(--ink-40);font-variation-settings:"opsz" 48}
.lb-analyst{font-family:var(--display);font-size:17px;font-weight:600;color:var(--ink);letter-spacing:-0.005em;font-variation-settings:"opsz" 24}
.lb-analyst .tkr{font-weight:700;color:var(--ink);margin-left:10px;font-size:15px;letter-spacing:1px}
.lb-dir{font-family:var(--smcp);font-size:10px;letter-spacing:3px;color:var(--ink-40);text-transform:uppercase}
.lb-ret{font-family:var(--display);font-weight:600;font-size:20px;line-height:1;letter-spacing:-0.01em;min-width:80px;text-align:right;font-variant-numeric:tabular-nums;font-variation-settings:"opsz" 48}
.lb-ret.pos{color:var(--ledger-green)}
.lb-ret.neg{color:var(--ledger-red)}

.lb-empty{padding:30px 22px;text-align:center;font-family:var(--body);font-style:italic;color:var(--ink-60);font-size:17px}
.lb-empty a{color:var(--banker);border-bottom:1px solid var(--gold)}

/* REPORTS */
.reports-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.report{
  background:var(--paper-warm);border:1px solid var(--ink);padding:22px 20px;display:block;transition:transform 0.12s;
  box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 4px transparent,inset 0 0 0 5px var(--gold-deep);
}
.report:hover{transform:translateY(-2px)}
.report-tkr{font-family:var(--display);font-weight:700;font-size:24px;line-height:1;color:var(--ink);letter-spacing:0.5px;margin-bottom:3px;font-variation-settings:"opsz" 48}
.report-co{font-family:var(--body);font-style:italic;font-size:14px;color:var(--ink-60);margin-bottom:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:450}
.report-thesis{font-family:var(--body);font-size:15px;line-height:1.58;color:var(--ink);margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-weight:450}
.report-foot{display:flex;justify-content:space-between;align-items:baseline;padding-top:10px;border-top:1px solid var(--ink-20)}
.report-stat{font-family:var(--display);font-weight:700;font-size:18px;line-height:1;font-variant-numeric:tabular-nums;font-variation-settings:"opsz" 24}
.report-stat.pos{color:var(--ledger-green)}
.report-stat.neg{color:var(--ledger-red)}
.report-rating{font-family:var(--smcp);font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--ink-40)}

/* FOOTER */
footer{margin-top:40px;padding:24px 0 40px;border-top:3px double var(--ink);text-align:center;
  font-family:var(--smcp);font-size:11px;letter-spacing:4px;color:var(--ink-60);text-transform:uppercase}
footer .wrap{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
footer a{color:var(--ink-60);border-bottom:1px solid transparent}
footer a:hover{color:var(--banker);border-bottom-color:var(--gold)}
footer .note{font-family:var(--body);font-style:italic;text-transform:none;letter-spacing:0;font-size:13px;color:var(--ink-40)}

@media(max-width:720px){
  body{font-size:18px}
  .wrap{padding:0 22px}
  .mast-brand{font-size:18px}
  .mast-nav{gap:14px;font-size:11px;letter-spacing:2px}
  .hero{padding:48px 0 44px}
  .hero h1{font-size:46px;letter-spacing:-0.005em;word-spacing:0.06em}
  .hero-tag{font-size:17px;margin-bottom:28px}
  .ticker-form{max-width:100%}
  .ticker-form input{padding:14px 16px;font-size:20px;letter-spacing:2px}
  .ticker-form button{padding:14px 18px;font-size:11px;letter-spacing:3px}
  .chips{gap:9px}
  .chip{padding:10px 14px;font-size:11px;letter-spacing:2px}
  .section-link{display:none}
  .section{padding:30px 0 24px}
  .section-hed{font-size:24px}
  .lb-row{grid-template-columns:32px 1fr auto;gap:12px;padding:14px 18px}
  .lb-dir{display:none}
  .lb-rank{font-size:18px}
  .lb-ret{font-size:17px;min-width:66px}
  .lb-analyst{font-size:16px}
  .lb-analyst .tkr{font-size:15px}
  .reports-grid{grid-template-columns:1fr;gap:12px}
  footer{padding:20px 0 32px;margin-top:28px}
  footer .wrap{flex-direction:column;gap:8px;text-align:center;letter-spacing:2px}
}
</style>
</head>
<body>

<header class="mast">
  <div class="wrap">
    <a href="/" class="mast-brand">Levin Capital <em>Research</em></a>
    <nav class="mast-nav">
      <a href="/leaderboard">The Ledger</a>
      <a href="/p/top10">Top Ten</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="wrap">
    <h1>Build a <em>pitch.</em></h1>
    <p class="hero-tag">Enter a ticker. The house composes the research brief. The Ledger keeps the score, nightly.</p>
    <form class="ticker-form" action="/submit" method="get" onsubmit="return sanitizeTicker(event)">
      <input name="ticker" id="heroTicker" placeholder="TICKER" maxlength="8" autocomplete="off" spellcheck="false" autofocus>
      <button type="submit">Compose →</button>
    </form>
    <div class="chips">
      ${['NVDA','AAPL','PLTR','MSGS','TSLA','BX'].map(t => `<span class="chip" data-t="${t}">${t}</span>`).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2 class="section-hed"><strong>Top</strong> of <em>the Ledger</em></h2>
      <a href="/leaderboard" class="section-link">The full book →</a>
    </div>
    ${top.length === 0 ? `
      <div class="lb-preview">
        <div class="lb-empty">The book opens empty. <a href="/submit">Commit</a> the first note.</div>
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
      <h2 class="section-hed"><em>Live</em> <strong>portals</strong></h2>
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
    <div>© ${new Date().getFullYear()} Levin Capital Research · <a href="/leaderboard">Ledger</a> · <a href="/submit">Submit</a></div>
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
document.getElementById('heroTicker').addEventListener('input', e => {
  const el = e.target;
  const v = el.value.toUpperCase().replace(/[^A-Z.]/g,'');
  if (v !== el.value) el.value = v;
});
</script>

</body>
</html>`;
}

function renderLbRow(r: LeaderboardRow, rank: number): string {
  const pos = r.return_pct >= 0;
  const romans = ['','I','II','III','IV','V'];
  const dir = r.direction === 'long' ? 'long' : 'short';
  return `<a class="lb-row" href="/c/${encodeURIComponent(r.call_id)}">
    <div class="lb-rank">${romans[rank] || rank}.</div>
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
