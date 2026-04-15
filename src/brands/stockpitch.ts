import type { PortalEntry } from '../portfolio';

/**
 * Stock Pitch homepage — 80s broadsheet aesthetic, matches leaderboard system.
 * Abril Fatface heads + Lora body, cream paper, red power accent, navy pinstripes.
 * No fabricated credentials. Readable on mobile.
 */
export function renderStockPitchLanding(portfolio: PortalEntry[]): string {
  const featured = portfolio.filter(p => p.featured).slice(0, 3);
  const rest = portfolio.filter(p => !p.featured).slice(0, 6);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Stock Pitch — submit a thesis, get an AI-generated research brief, let the market keep score. The leaderboard ranks every call by return since entry.">
<meta property="og:title" content="Stock Pitch — pitch a stock, let the market score it">
<meta property="og:description" content="Submit a thesis. AI writes the brief. Market keeps score.">
<meta name="theme-color" content="#1A1814">
<title>Stock Pitch — Pitch a stock. The market keeps score.</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --paper:#F4EEE1;
  --paper-deep:#EBE2D0;
  --ink:#1A1814;
  --ink-80:#2A251E;
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
html{background:var(--paper);scroll-behavior:smooth}
body{
  font-family:var(--body);background:var(--paper);color:var(--ink);line-height:1.6;font-size:17px;
  -webkit-font-smoothing:antialiased;
  background-image:
    repeating-linear-gradient(90deg,transparent 0 23px,rgba(14,35,64,0.035) 23px 24px),
    radial-gradient(circle at 20% 10%,rgba(183,20,31,0.04),transparent 55%),
    radial-gradient(circle at 80% 90%,rgba(14,35,64,0.05),transparent 60%);
  background-attachment:fixed;
}
a{color:inherit;text-decoration:none}
.wrap{max-width:1180px;margin:0 auto;padding:0 28px}

/* MASTHEAD ---------------------------------------------------------------- */
.masthead{background:var(--paper);border-bottom:2px solid var(--ink);padding:18px 0 16px;position:relative}
.masthead::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:2px;background:var(--ink)}
.masthead .wrap{display:flex;justify-content:space-between;align-items:center;gap:20px}
.mh-brand{font-family:var(--display);font-size:30px;line-height:0.9;color:var(--ink);letter-spacing:-0.01em;display:flex;align-items:baseline;gap:10px}
.mh-brand .dot{display:inline-block;width:11px;height:11px;border-radius:50%;background:var(--red);transform:translateY(-4px)}
.mh-nav{display:flex;align-items:center;gap:22px;font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase}
.mh-nav a{color:var(--ink-60);padding:6px 2px;border-bottom:2px solid transparent;transition:border 0.15s,color 0.15s}
.mh-nav a:hover{color:var(--ink);border-bottom-color:var(--red)}
.mh-cta{
  display:inline-block;padding:10px 18px;background:var(--red);color:var(--paper);
  font-family:var(--mono);font-weight:700;font-size:11px;letter-spacing:2px;text-transform:uppercase;
  box-shadow:3px 3px 0 var(--ink);transition:transform 0.12s,box-shadow 0.12s;
}
.mh-cta:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--ink);color:var(--paper)}

/* HERO -------------------------------------------------------------------- */
.hero{padding:72px 0 48px}
.hero-kicker{display:inline-block;background:var(--ink);color:var(--paper);padding:6px 12px;font-family:var(--mono);font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:600;margin-bottom:22px}
.hero h1{
  font-family:var(--display);font-size:clamp(56px,8vw,108px);line-height:0.95;
  color:var(--ink);letter-spacing:-0.025em;margin-bottom:22px;max-width:16ch;
}
.hero h1 em{color:var(--red);font-style:italic}
.hero-deck{
  font-family:var(--body);font-style:italic;font-size:21px;line-height:1.45;color:var(--ink-60);
  max-width:640px;border-left:3px solid var(--red);padding-left:18px;margin-bottom:30px;
}
.hero-ctas{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px}
.btn{
  display:inline-flex;align-items:center;gap:8px;padding:14px 24px;
  font-family:var(--mono);font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;
  transition:transform 0.12s,box-shadow 0.12s,background 0.12s;cursor:pointer;border:none;
}
.btn-primary{background:var(--red);color:var(--paper);box-shadow:4px 4px 0 var(--ink)}
.btn-primary:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--ink);color:var(--paper)}
.btn-ghost{background:transparent;color:var(--ink);border:2px solid var(--ink)}
.btn-ghost:hover{background:var(--ink);color:var(--paper)}

/* KPI ROW ----------------------------------------------------------------- */
.kpis{
  display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:48px;
  border-top:4px double var(--ink);border-bottom:1px solid var(--ink);
}
.kpi{padding:22px 22px;border-right:1px dotted var(--ink-20)}
.kpi:last-child{border-right:none}
.kpi-v{font-family:var(--display);font-size:42px;line-height:0.9;color:var(--ink);letter-spacing:-0.02em}
.kpi-v .unit{color:var(--red);font-size:24px;margin-left:2px}
.kpi-l{font-family:var(--mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-40);margin-top:8px;font-weight:600}

/* THREE-STEP -------------------------------------------------------------- */
.steps{padding:72px 0 40px}
.section-eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--red);font-weight:700;margin-bottom:12px}
.section-hed{font-family:var(--display);font-size:clamp(38px,5vw,56px);line-height:1;color:var(--ink);letter-spacing:-0.02em;margin-bottom:14px}
.section-sub{font-family:var(--body);font-style:italic;font-size:19px;color:var(--ink-60);max-width:640px;margin-bottom:40px}
.step-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.step{background:var(--paper);border:1px solid var(--rule);padding:28px 26px;position:relative;box-shadow:4px 4px 0 var(--ink)}
.step-num{font-family:var(--display);font-size:60px;line-height:0.8;color:var(--red);margin-bottom:8px;letter-spacing:-0.02em}
.step-hed{font-family:var(--display);font-size:26px;line-height:1.05;color:var(--ink);margin-bottom:10px;letter-spacing:-0.01em}
.step-body{font-family:var(--body);font-size:16px;line-height:1.55;color:var(--ink-60)}

/* GALLERY ----------------------------------------------------------------- */
.gallery{padding:48px 0 72px;border-top:4px double var(--ink);margin-top:32px}
.portal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:24px}
.portal-grid.secondary{grid-template-columns:repeat(3,1fr);gap:14px;margin-top:8px}
.portal{background:var(--paper);border:1px solid var(--rule);padding:24px;transition:transform 0.12s,box-shadow 0.12s;display:block;position:relative}
.portal:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--ink)}
.portal-ticker{font-family:var(--display);font-size:32px;line-height:0.95;color:var(--ink);letter-spacing:-0.01em;margin-bottom:2px}
.portal-co{font-family:var(--body);font-style:italic;font-size:15px;color:var(--ink-60);margin-bottom:14px}
.portal-cat{display:inline-block;font-family:var(--mono);font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);border:1px solid var(--navy);padding:2px 8px;margin-bottom:14px;font-weight:600}
.portal-thesis{font-family:var(--body);font-size:15px;line-height:1.55;color:var(--ink-80);margin-bottom:18px}
.portal-foot{display:flex;justify-content:space-between;align-items:baseline;padding-top:14px;border-top:1px dotted var(--ink-20)}
.portal-stat{font-family:var(--display);font-size:24px;color:var(--bull);line-height:1}
.portal-stat-l{font-family:var(--mono);font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-40);margin-top:2px;font-weight:600}
.portal-rating{font-family:var(--mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700}
.portal-rating.buy{color:var(--bull)}
.portal-rating.ow{color:var(--bull)}
.portal-rating.hold{color:var(--ink-40)}
.portal-rating.part{color:var(--navy)}
.portal.compact{padding:20px}
.portal.compact .portal-ticker{font-size:24px}
.portal.compact .portal-thesis{font-size:14px;margin-bottom:14px}

/* CTA BLOCK --------------------------------------------------------------- */
.cta-block{
  background:var(--ink);color:var(--paper);padding:56px 40px;margin:48px 0 64px;
  position:relative;border:2px solid var(--ink);box-shadow:6px 6px 0 var(--red);
}
.cta-block .section-eyebrow{color:var(--gold)}
.cta-block .section-hed{color:var(--paper)}
.cta-block .section-hed em{color:var(--gold);font-style:italic}
.cta-block .section-sub{color:var(--ink-20);margin-bottom:28px}
.cta-block .btn-primary{box-shadow:4px 4px 0 var(--gold)}
.cta-block .btn-primary:hover{box-shadow:5px 5px 0 var(--gold)}

/* FOOTER ------------------------------------------------------------------ */
footer{margin-top:40px;padding:32px 0 56px;border-top:1px solid var(--ink);border-bottom:6px double var(--ink);
  font-family:var(--mono);font-size:11px;letter-spacing:2px;color:var(--ink-40);text-transform:uppercase}
footer .wrap{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
footer a{color:var(--ink-60);border-bottom:1px solid var(--ink-20)}
footer .note{font-family:var(--body);font-style:italic;text-transform:none;letter-spacing:0;font-size:13px;color:var(--ink-40)}

/* RESPONSIVE -------------------------------------------------------------- */
@media(max-width:860px){
  body{font-size:17px}
  .masthead{padding:14px 0 12px}
  .masthead .wrap{gap:12px}
  .mh-brand{font-size:22px}
  .mh-brand .dot{width:9px;height:9px;transform:translateY(-3px)}
  .mh-nav{gap:12px;font-size:10px;letter-spacing:1px}
  .mh-nav a:not(.mh-cta){display:none}
  .mh-cta{padding:9px 14px;font-size:10px;letter-spacing:1.5px}
  .hero{padding:44px 0 32px}
  .hero h1{font-size:44px;max-width:100%}
  .hero-deck{font-size:17px;padding-left:14px}
  .hero-kicker{font-size:10px;padding:5px 10px;margin-bottom:18px}
  .hero-ctas{gap:10px}
  .btn{padding:12px 18px;font-size:11px;letter-spacing:1.5px}
  .kpis{grid-template-columns:1fr 1fr;margin-top:32px}
  .kpi{padding:16px 18px;border-bottom:1px dotted var(--ink-20)}
  .kpi:nth-child(odd){border-right:1px dotted var(--ink-20)}
  .kpi:nth-child(even){border-right:none}
  .kpi:nth-last-child(-n+2){border-bottom:none}
  .kpi-v{font-size:30px}
  .kpi-v .unit{font-size:18px}
  .steps{padding:48px 0 28px}
  .section-hed{font-size:32px}
  .section-sub{font-size:16px;margin-bottom:28px}
  .step-grid{grid-template-columns:1fr;gap:14px}
  .step{padding:24px 22px}
  .step-num{font-size:48px}
  .step-hed{font-size:22px}
  .gallery{padding:36px 0 48px;margin-top:16px}
  .portal-grid,.portal-grid.secondary{grid-template-columns:1fr;gap:12px}
  .portal{padding:22px}
  .portal-ticker{font-size:28px}
  .cta-block{padding:36px 24px;margin:36px 0 48px;box-shadow:4px 4px 0 var(--red)}
  footer{padding:22px 0 40px;margin-top:28px}
  footer .wrap{flex-direction:column;gap:10px;text-align:center;letter-spacing:1.5px}
  footer .note{font-size:12px}
  .wrap{padding:0 20px}
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
      <a href="/submit" class="mh-cta">Pitch a Call</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="wrap">
    <div class="hero-kicker">★ First call is free ★</div>
    <h1>Pitch a stock. <em>The market</em> keeps score.</h1>
    <p class="hero-deck">Submit your thesis at today's close. An AI writes the research brief. Every call sits on the leaderboard, tracked nightly, ranked by return since entry.</p>
    <div class="hero-ctas">
      <a href="/submit" class="btn btn-primary">Pitch your first call →</a>
      <a href="/leaderboard" class="btn btn-ghost">See the leaderboard</a>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-v">${portfolio.length}</div><div class="kpi-l">Live portals</div></div>
      <div class="kpi"><div class="kpi-v">~2<span class="unit">min</span></div><div class="kpi-l">AI brief ready</div></div>
      <div class="kpi"><div class="kpi-v">Free</div><div class="kpi-l">First call</div></div>
      <div class="kpi"><div class="kpi-v">Nightly</div><div class="kpi-l">Rebalance cadence</div></div>
    </div>
  </div>
</section>

<section class="steps">
  <div class="wrap">
    <div class="section-eyebrow">§ How It Works</div>
    <h2 class="section-hed">Thesis in. Brief out. Market scores it.</h2>
    <p class="section-sub">Three steps, no gatekeepers. You write the call; we handle the research and the scoreboard.</p>
    <div class="step-grid">
      <div class="step">
        <div class="step-num">I</div>
        <div class="step-hed">Submit your thesis.</div>
        <div class="step-body">Ticker, long or short, price target, a few hundred words on why. Entry price is locked to the current market quote — nobody backdates anything.</div>
      </div>
      <div class="step">
        <div class="step-num">II</div>
        <div class="step-hed">AI writes the brief.</div>
        <div class="step-body">A source-tagged research note built from your thesis: business summary, key drivers, risks, path to the price target. Cached and shareable within minutes.</div>
      </div>
      <div class="step">
        <div class="step-num">III</div>
        <div class="step-hed">Market keeps score.</div>
        <div class="step-body">Prices refresh nightly. Your call is ranked against every other call on the book by return since entry. The leaderboard does the editorializing for you.</div>
      </div>
    </div>
  </div>
</section>

<section class="gallery">
  <div class="wrap">
    <div class="section-eyebrow">§ The Book</div>
    <h2 class="section-hed">Live portals on the wire.</h2>
    <p class="section-sub">A sample of research portals already published. Each one is a full thesis with model, comps, and market-tracked performance.</p>
    ${featured.length > 0 ? `<div class="portal-grid">
      ${featured.map(p => renderPortal(p, false)).join('')}
    </div>` : ''}
    ${rest.length > 0 ? `<div class="portal-grid secondary">
      ${rest.map(p => renderPortal(p, true)).join('')}
    </div>` : ''}
  </div>
</section>

<section>
  <div class="wrap">
    <div class="cta-block">
      <div class="section-eyebrow">★ Ready to run?</div>
      <h2 class="section-hed">Pitch your <em>first call.</em></h2>
      <p class="section-sub">It's free. You keep the attribution. The market tells you whether you were right.</p>
      <div class="hero-ctas">
        <a href="/submit" class="btn btn-primary">Start writing →</a>
        <a href="/leaderboard" class="btn btn-ghost" style="color:var(--paper);border-color:var(--paper)">Browse the board</a>
      </div>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <div>© ${new Date().getFullYear()} Stock Pitch · <a href="/leaderboard">Leaderboard</a> · <a href="/submit">Submit</a> · <a href="/p/top10">Top 10</a></div>
    <div class="note">Nothing on this site is investment advice.</div>
  </div>
</footer>

</body>
</html>`;
}

function renderPortal(p: PortalEntry, compact: boolean): string {
  const isNeg = p.headline_stat.trim().startsWith('-');
  const statColor = isNeg ? 'color:var(--bear)' : 'color:var(--bull)';
  return `<a href="${p.url}" class="portal ${compact ? 'compact' : ''}" target="_blank" rel="noopener">
    <div class="portal-ticker">${p.ticker}</div>
    <div class="portal-co">${p.company}</div>
    <span class="portal-cat">${p.category}</span>
    <div class="portal-thesis">${p.thesis}</div>
    <div class="portal-foot">
      <div>
        <div class="portal-stat" style="${statColor}">${p.headline_stat}</div>
        <div class="portal-stat-l">${p.headline_label}</div>
      </div>
      <div class="portal-rating ${p.rating_class}">${p.rating}</div>
    </div>
  </a>`;
}
