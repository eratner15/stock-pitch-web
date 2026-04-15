import type { PortalEntry } from '../portfolio';

/**
 * Levin Capital Research homepage — Loeb-Rhoades-inspired engraved aesthetic.
 * Bodoni Moda + Cormorant Garamond, cream laid paper, banker forest green +
 * champagne gold. No fabricated credentials. Mobile-readable.
 */
export function renderLevinCapLanding(portfolio: PortalEntry[]): string {
  const featured = portfolio.filter(p => p.featured).slice(0, 3);
  const rest = portfolio.filter(p => !p.featured).slice(0, 6);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Levin Capital Research — private notes on public markets. The Ledger compiles members' thesis calls and tracks them against the market nightly.">
<meta property="og:title" content="Levin Capital Research">
<meta property="og:description" content="Private notes on public markets. The Ledger keeps the score.">
<meta name="theme-color" content="#0F3B2E">
<title>Levin Capital Research</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,700;0,6..96,900;1,6..96,400;1,6..96,700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&family=IM+Fell+English+SC&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --paper:#F3EAD5;
  --paper-deep:#E6DABF;
  --paper-warm:#F8F0DB;
  --ink:#0A0806;
  --ink-80:#2E281D;
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
  --display:'Bodoni Moda','Didot',Georgia,serif;
  --body:'Cormorant Garamond','EB Garamond',Georgia,serif;
  --smcp:'IM Fell English SC',serif;
}
html{background:var(--paper);scroll-behavior:smooth}
body{
  font-family:var(--body);background:var(--paper);color:var(--ink);line-height:1.55;font-size:19px;
  -webkit-font-smoothing:antialiased;
  font-feature-settings:'onum' 1,'liga' 1,'dlig' 1;
  background-image:
    repeating-linear-gradient(0deg,transparent 0 31px,rgba(46,40,29,0.025) 31px 32px),
    radial-gradient(ellipse at 50% 0%,rgba(184,151,62,0.10),transparent 55%),
    radial-gradient(ellipse at 85% 85%,rgba(15,59,46,0.07),transparent 50%),
    radial-gradient(circle at 15% 60%,rgba(46,40,29,0.04),transparent 30%);
  background-attachment:fixed;
}
a{color:inherit;text-decoration:none}
.wrap{max-width:1020px;margin:0 auto;padding:0 40px}

/* MASTHEAD ---------------------------------------------------------------- */
.mast{padding:36px 0 0;position:relative;background:var(--paper);border-bottom:1px solid var(--ink)}
.mast::after{content:"";position:absolute;left:0;right:0;bottom:-5px;height:1px;background:var(--ink)}
.mast .wrap{text-align:center}
.mast-word{
  font-family:var(--display);font-weight:900;font-size:46px;line-height:1;color:var(--ink);
  letter-spacing:0.01em;text-transform:uppercase;font-variant-numeric:lining-nums;
}
.mast-sub{
  font-family:var(--display);font-style:italic;font-weight:400;font-size:26px;color:var(--banker);
  letter-spacing:0.02em;margin-top:4px;
}
.mast-hairline{margin:22px auto 0;width:100%;max-width:520px;height:1px;background:var(--ink);position:relative}
.mast-hairline::before,.mast-hairline::after{content:"";position:absolute;top:-3px;width:7px;height:7px;background:var(--gold);transform:rotate(45deg)}
.mast-hairline::before{left:-3px}
.mast-hairline::after{right:-3px}
.mast-nav{
  padding:16px 0 20px;display:flex;justify-content:center;gap:40px;
  font-family:var(--smcp);font-size:13px;letter-spacing:4px;text-transform:uppercase;color:var(--ink-60);
}
.mast-nav a{padding:4px 0;border-bottom:2px solid transparent;transition:border 0.2s,color 0.2s}
.mast-nav a:hover,.mast-nav a.active{color:var(--banker);border-bottom-color:var(--gold)}

/* DECO RULE --------------------------------------------------------------- */
.deco{display:flex;align-items:center;justify-content:center;gap:14px;margin:40px 0;color:var(--gold)}
.deco::before,.deco::after{content:"";flex:0 1 160px;height:1px;background:linear-gradient(90deg,transparent,var(--gold-deep),transparent)}
.deco .diamond{width:9px;height:9px;background:var(--gold);transform:rotate(45deg)}

/* HERO / ESSAY ------------------------------------------------------------ */
.hero{padding:48px 0 24px}
.hero .wrap{text-align:center}
.hero-dateline{font-family:var(--smcp);font-size:11px;letter-spacing:5px;color:var(--ink-60);margin-bottom:22px;text-transform:uppercase}
.hero h1{
  font-family:var(--display);font-weight:900;font-size:clamp(48px,6.5vw,82px);line-height:0.98;
  color:var(--ink);letter-spacing:-0.02em;margin-bottom:20px;
}
.hero h1 em{font-style:italic;font-weight:400;color:var(--banker)}
.hero-deck{
  font-family:var(--body);font-style:italic;font-size:22px;line-height:1.5;color:var(--ink-80);
  max-width:640px;margin:0 auto 30px;
}
.hero-ctas{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:6px}
.btn{
  display:inline-flex;align-items:center;gap:8px;padding:13px 26px;
  font-family:var(--smcp);font-weight:400;font-size:12px;letter-spacing:4px;text-transform:uppercase;
  transition:background 0.2s,color 0.2s;cursor:pointer;border:1px solid var(--ink);
}
.btn-primary{background:var(--banker);color:var(--paper);border-color:var(--banker)}
.btn-primary:hover{background:var(--banker-deep);color:var(--paper)}
.btn-gold{background:var(--gold);color:var(--ink);border-color:var(--gold-deep)}
.btn-gold:hover{background:var(--gold-deep);color:var(--paper)}
.btn-ghost{background:transparent;color:var(--ink)}
.btn-ghost:hover{background:var(--ink);color:var(--paper)}

/* KPI ROW ----------------------------------------------------------------- */
.kpis{
  display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:44px;
  border-top:3px double var(--ink);border-bottom:3px double var(--ink);
}
.kpi{padding:20px 18px;border-right:1px solid var(--ink-20);text-align:center}
.kpi:last-child{border-right:none}
.kpi-v{font-family:var(--display);font-weight:900;font-size:38px;line-height:0.95;color:var(--ink);letter-spacing:-0.01em;font-variant-numeric:oldstyle-nums}
.kpi-v em{font-style:italic;font-weight:400;color:var(--banker)}
.kpi-l{font-family:var(--smcp);font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--ink-60);margin-top:8px}

/* SECTION SHARED ---------------------------------------------------------- */
.section-eyebrow{font-family:var(--smcp);font-size:11px;letter-spacing:5px;color:var(--banker);margin-bottom:10px;text-transform:uppercase;text-align:center}
.section-hed{font-family:var(--display);font-weight:400;font-style:italic;font-size:clamp(34px,4.5vw,48px);line-height:1.05;color:var(--ink);letter-spacing:-0.01em;text-align:center;margin-bottom:12px}
.section-hed strong{font-weight:900;font-style:normal}
.section-sub{font-family:var(--body);font-style:italic;font-size:18px;color:var(--ink-60);max-width:560px;margin:0 auto 40px;text-align:center}

/* THREE-STEP -------------------------------------------------------------- */
.steps{padding:32px 0 20px}
.step-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.step{
  background:var(--paper-warm);padding:30px 26px;border:1px solid var(--ink);position:relative;
  box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 4px transparent,inset 0 0 0 5px var(--gold-deep);
}
.step-num{font-family:var(--display);font-style:italic;font-weight:400;font-size:52px;line-height:0.85;color:var(--banker);margin-bottom:14px}
.step-hed{font-family:var(--display);font-weight:700;font-size:22px;line-height:1.1;color:var(--ink);margin-bottom:10px;letter-spacing:-0.01em}
.step-body{font-family:var(--body);font-size:17px;line-height:1.55;color:var(--ink-80)}

/* GALLERY ----------------------------------------------------------------- */
.gallery{padding:24px 0 40px}
.portal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.portal-grid.secondary{gap:14px;margin-top:18px}
.portal{
  background:var(--paper-warm);padding:24px 22px;border:1px solid var(--ink);position:relative;
  box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 4px transparent,inset 0 0 0 5px var(--gold-deep);
  transition:transform 0.15s;display:block;
}
.portal:hover{transform:translateY(-2px)}
.portal-ticker{font-family:var(--display);font-weight:700;font-size:30px;line-height:1;color:var(--ink);margin-bottom:2px;letter-spacing:1px}
.portal-co{font-family:var(--body);font-style:italic;font-size:15px;color:var(--ink-60);margin-bottom:14px}
.portal-cat{display:inline-block;font-family:var(--smcp);font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--banker);border:1px solid var(--banker);padding:2px 8px;margin-bottom:14px}
.portal-thesis{font-family:var(--body);font-size:16px;line-height:1.55;color:var(--ink-80);margin-bottom:18px}
.portal-foot{display:flex;justify-content:space-between;align-items:baseline;padding-top:12px;border-top:1px solid var(--ink-20)}
.portal-stat{font-family:var(--display);font-weight:900;font-size:24px;color:var(--ledger-green);line-height:1;font-variant-numeric:oldstyle-nums}
.portal-stat-l{font-family:var(--smcp);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-40);margin-top:3px}
.portal-rating{font-family:var(--smcp);font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--ink);border:1px solid var(--ink);padding:3px 8px}
.portal-rating.buy,.portal-rating.ow{color:var(--ledger-green);border-color:var(--ledger-green)}
.portal-rating.hold{color:var(--ink-40);border-color:var(--ink-40)}
.portal-rating.part{color:var(--banker);border-color:var(--banker)}
.portal.compact{padding:20px}
.portal.compact .portal-ticker{font-size:24px}
.portal.compact .portal-thesis{font-size:15px;margin-bottom:14px}

/* PRACTICE ESSAY ---------------------------------------------------------- */
.practice{padding:40px 0 28px}
.practice .wrap{max-width:720px}
.practice h2{font-family:var(--display);font-weight:900;font-size:36px;line-height:1;color:var(--ink);letter-spacing:-0.01em;text-align:center;margin-bottom:24px}
.practice h2 em{font-style:italic;font-weight:400;color:var(--banker)}
.practice p{font-family:var(--body);font-size:19px;line-height:1.65;color:var(--ink-80);margin-bottom:18px}
.practice p:first-of-type::first-letter{
  font-family:var(--display);font-weight:900;font-size:60px;line-height:0.9;color:var(--banker);
  float:left;padding:6px 10px 0 0;
}

/* CTA BLOCK --------------------------------------------------------------- */
.cta-block{
  background:var(--ink);color:var(--paper);padding:60px 48px;margin:40px 0 60px;
  position:relative;border:1px solid var(--ink);
  box-shadow:inset 0 0 0 1px var(--ink),inset 0 0 0 6px transparent,inset 0 0 0 7px var(--gold);
}
.cta-block .section-eyebrow{color:var(--gold)}
.cta-block .section-hed{color:var(--paper)}
.cta-block .section-hed em{color:var(--gold);font-style:italic}
.cta-block .section-sub{color:var(--ink-20)}
.cta-block .hero-ctas .btn-ghost{color:var(--paper);border-color:var(--paper)}
.cta-block .hero-ctas .btn-ghost:hover{background:var(--paper);color:var(--ink)}

/* COLOPHON FOOTER --------------------------------------------------------- */
footer{margin-top:40px;padding:30px 0 44px;border-top:3px double var(--ink)}
footer .wrap{text-align:center}
.colo-word{font-family:var(--display);font-weight:900;font-size:22px;color:var(--ink);letter-spacing:0.04em;text-transform:uppercase;line-height:1}
.colo-sub{font-family:var(--display);font-style:italic;color:var(--banker);font-size:17px;margin-top:2px}
.colo-meta{font-family:var(--smcp);font-size:11px;letter-spacing:4px;color:var(--ink-60);margin-top:14px;text-transform:uppercase}
.colo-meta a{color:var(--ink-60);border-bottom:1px solid transparent}
.colo-meta a:hover{color:var(--banker);border-bottom-color:var(--gold)}
.colo-note{font-family:var(--body);font-style:italic;font-size:14px;color:var(--ink-40);margin-top:14px;max-width:520px;margin-left:auto;margin-right:auto}

/* RESPONSIVE -------------------------------------------------------------- */
@media(max-width:820px){
  body{font-size:18px;line-height:1.55}
  .wrap{padding:0 22px}
  .mast{padding:28px 0 0}
  .mast-word{font-size:32px}
  .mast-sub{font-size:22px}
  .mast-hairline{max-width:320px;margin-top:18px}
  .mast-nav{gap:22px;letter-spacing:2px;font-size:12px;padding:12px 0 16px}
  .deco{margin:24px 0}
  .deco::before,.deco::after{flex:0 1 70px}
  .hero{padding:28px 0 16px}
  .hero-dateline{font-size:10px;letter-spacing:3px;margin-bottom:16px}
  .hero h1{font-size:40px}
  .hero-deck{font-size:17px;margin-bottom:22px}
  .btn{padding:12px 18px;font-size:11px;letter-spacing:2.5px}
  .kpis{grid-template-columns:1fr 1fr;margin-top:32px}
  .kpi{padding:16px 14px;border-bottom:1px solid var(--ink-20)}
  .kpi:nth-child(even){border-right:none}
  .kpi:nth-last-child(-n+2){border-bottom:none}
  .kpi-v{font-size:28px}
  .steps{padding:16px 0 8px}
  .step-grid{grid-template-columns:1fr;gap:14px}
  .step{padding:24px 22px}
  .step-num{font-size:44px;margin-bottom:10px}
  .step-hed{font-size:20px}
  .step-body{font-size:16px}
  .section-hed{font-size:30px}
  .section-sub{font-size:16px;margin-bottom:28px}
  .gallery{padding:12px 0 24px}
  .portal-grid,.portal-grid.secondary{grid-template-columns:1fr;gap:14px}
  .portal{padding:22px}
  .portal-ticker{font-size:26px}
  .practice{padding:24px 0 16px}
  .practice h2{font-size:28px}
  .practice p{font-size:17px}
  .practice p:first-of-type::first-letter{font-size:46px}
  .cta-block{padding:36px 26px;margin:28px 0 40px}
  footer{margin-top:24px;padding:24px 0 36px}
  .colo-word{font-size:20px}
  .colo-sub{font-size:16px}
  .colo-meta{letter-spacing:2.5px;font-size:10px}
}
</style>
</head>
<body>

<header class="mast">
  <div class="wrap">
    <div class="mast-word">Levin Capital</div>
    <div class="mast-sub">Research</div>
    <div class="mast-hairline"></div>
    <nav class="mast-nav">
      <a href="/" class="active">Cover</a>
      <a href="/leaderboard">Leaderboard</a>
      <a href="/p/top10">Top Ten</a>
      <a href="/submit">Submit</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="wrap">
    <div class="hero-dateline">Private Notes on Public Markets</div>
    <h1>Every call, <em>committed to the book.</em></h1>
    <p class="hero-deck">The Ledger compiles members' thesis calls, locks their entry price at the close, and tracks each position against the market nightly. No votes. No editorializing. Just the price, settled.</p>
    <div class="hero-ctas">
      <a href="/leaderboard" class="btn btn-gold">Browse The Ledger →</a>
      <a href="/submit" class="btn btn-ghost">Submit a note</a>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-v">${portfolio.length}</div><div class="kpi-l">Live portals</div></div>
      <div class="kpi"><div class="kpi-v">48<em>hr</em></div><div class="kpi-l">Brief turnaround</div></div>
      <div class="kpi"><div class="kpi-v">I.</div><div class="kpi-l">First note is free</div></div>
      <div class="kpi"><div class="kpi-v">∞</div><div class="kpi-l">No votes, no bias</div></div>
    </div>
  </div>
</section>

<div class="deco"><span></span><span class="diamond"></span><span></span></div>

<section class="steps">
  <div class="wrap">
    <div class="section-eyebrow">— The Practice —</div>
    <h2 class="section-hed"><strong>Thesis in.</strong> <em>Brief out. Market keeps the score.</em></h2>
    <p class="section-sub">Three movements, no gatekeepers. You commit the call; the house handles the research and the ledger.</p>
    <div class="step-grid">
      <div class="step">
        <div class="step-num">I.</div>
        <div class="step-hed">Commit your note.</div>
        <div class="step-body">Ticker, direction, price target, and a few hundred words on why. Entry price is locked to the current quote at the moment of submission.</div>
      </div>
      <div class="step">
        <div class="step-num">II.</div>
        <div class="step-hed">The house writes the brief.</div>
        <div class="step-body">A source-tagged research note built from your thesis: business summary, drivers, risks, and the path to target. Published within minutes.</div>
      </div>
      <div class="step">
        <div class="step-num">III.</div>
        <div class="step-hed">The market settles it.</div>
        <div class="step-body">Prices refresh nightly. Your note is ranked against every other note on the book by return since entry. The Ledger reports; it does not prescribe.</div>
      </div>
    </div>
  </div>
</section>

<div class="deco"><span></span><span class="diamond"></span><span></span></div>

<section class="gallery">
  <div class="wrap">
    <div class="section-eyebrow">— Live Portals —</div>
    <h2 class="section-hed"><em>Selected engagements,</em> <strong>on the wire.</strong></h2>
    <p class="section-sub">A sample of research portals already in circulation. Each is a full thesis with model, comparables, and market-tracked performance.</p>
    ${featured.length > 0 ? `<div class="portal-grid">
      ${featured.map(p => renderPortal(p, false)).join('')}
    </div>` : ''}
    ${rest.length > 0 ? `<div class="portal-grid secondary">
      ${rest.map(p => renderPortal(p, true)).join('')}
    </div>` : ''}
  </div>
</section>

<section class="practice">
  <div class="wrap">
    <h2>On <em>the practice.</em></h2>
    <p>Research writing has always been a private correspondence first. An analyst commits a view to paper, a partner reads it over breakfast, the position is sized or declined. What gets lost in the louder versions of this business, the ones that run on television and on Twitter, is the discipline of the margin notes.</p>
    <p>This is a place for the margin notes. Theses committed while they are still inconvenient. Entry prices locked while they are still uncertain. Scores kept quietly, by the market itself. If the work is good, the book will say so.</p>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="cta-block">
      <div class="section-eyebrow">— An Invitation —</div>
      <h2 class="section-hed"><em>Open</em> the book.</h2>
      <p class="section-sub">The first note is free. You keep the attribution. The market tells you whether you were right.</p>
      <div class="hero-ctas">
        <a href="/submit" class="btn btn-gold">Submit your first note →</a>
        <a href="/leaderboard" class="btn btn-ghost">Read The Ledger</a>
      </div>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <div class="colo-word">Levin Capital</div>
    <div class="colo-sub">Research</div>
    <div class="colo-meta">© ${new Date().getFullYear()} · <a href="/leaderboard">Leaderboard</a> &middot; <a href="/submit">Submit</a> &middot; <a href="/p/top10">Top Ten</a></div>
    <div class="colo-note">Nothing on this site is investment advice.</div>
  </div>
</footer>

</body>
</html>`;
}

function renderPortal(p: PortalEntry, compact: boolean): string {
  return `<a href="${p.url}" class="portal ${compact ? 'compact' : ''}" target="_blank" rel="noopener">
    <div class="portal-ticker">${p.ticker}</div>
    <div class="portal-co">${p.company}</div>
    <span class="portal-cat">${p.category}</span>
    <div class="portal-thesis">${p.thesis}</div>
    <div class="portal-foot">
      <div>
        <div class="portal-stat">${p.headline_stat}</div>
        <div class="portal-stat-l">${p.headline_label}</div>
      </div>
      <div class="portal-rating ${p.rating_class}">${p.rating}</div>
    </div>
  </a>`;
}
