import type { PortalEntry } from '../portfolio';

/**
 * Variant B: Levin Capital Research — editorial / institutional brand.
 * Magazine-family typography (Playfair + Cormorant + Inter), paper/ink/gold palette.
 * Inherits design DNA from The LCS Review.
 */
export function renderLevinCapLanding(portfolio: PortalEntry[]): string {
  const featured = portfolio.filter(p => p.featured);
  const rest = portfolio.filter(p => !p.featured);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Levin Capital Research — institutional equity research engagements, from the editor of The LCS Review. Browse live portals. Request bespoke coverage.">
<meta property="og:title" content="Levin Capital Research — Institutional coverage on demand">
<meta property="og:description" content="From the editor of The LCS Review. Institutional-quality equity research portals with source attribution, interactive models, and print-ready delivery.">
<meta name="theme-color" content="#FAF7F0">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1F4DA;</text></svg>">
<title>Levin Capital Research &middot; Institutional coverage on demand</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,900&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --paper:#FAF7F0;
  --paper-2:#F3EEE1;
  --paper-3:#ECE5D4;
  --ink:#0A0A0A;
  --ink-80:#2A2A2A;
  --ink-60:#5A5A55;
  --ink-40:#85817A;
  --ink-20:#C5BFB2;
  --gold:#B8973E;
  --gold-deep:#8B6F28;
  --claret:#7A1F2B;
  --steel:#2C5F7C;
  --green:#1A7A3A;
  --red:#C0392B;
  --serif:'Playfair Display',Georgia,serif;
  --body-serif:'Cormorant Garamond',Georgia,serif;
  --sans:'Inter',system-ui,sans-serif;
}
html{scroll-behavior:smooth}
body{font-family:var(--body-serif);background:var(--paper);color:var(--ink-80);line-height:1.55;-webkit-font-smoothing:antialiased;font-size:17px}
a{color:inherit;text-decoration:none}
.wrap{max-width:1180px;margin:0 auto;padding:0 40px}
.rule{border:none;border-top:1px solid var(--ink);margin:0}

/* MASTHEAD */
.masthead{background:var(--paper);padding:24px 0 20px;border-bottom:3px double var(--ink)}
.masthead .wrap{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px}
.masthead-brand{font-family:var(--serif);font-weight:900;color:var(--ink);font-size:26px;letter-spacing:-0.01em;line-height:1}
.masthead-brand em{font-weight:400;font-style:italic}
.masthead-meta{font-family:var(--sans);font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--ink-60);font-weight:600;text-align:right;line-height:1.7}
.masthead-meta strong{color:var(--ink);font-weight:700}

/* HERO */
.hero{padding:96px 0 80px;text-align:center;position:relative;overflow:hidden;background:linear-gradient(180deg,var(--paper) 0%,var(--paper-2) 100%)}
.hero-kicker{font-family:var(--sans);font-size:11px;letter-spacing:5px;text-transform:uppercase;color:var(--gold-deep);font-weight:800;margin-bottom:20px}
.hero-kicker::before{content:'\u25C6  ';color:var(--gold)}
.hero-kicker::after{content:'  \u25C6';color:var(--gold)}
.hero h1{font-family:var(--serif);font-weight:900;font-size:92px;color:var(--ink);letter-spacing:-0.035em;line-height:0.95;max-width:960px;margin:0 auto 28px}
.hero h1 em{font-weight:400;font-style:italic;color:var(--claret)}
.hero-deck{font-family:var(--body-serif);font-size:22px;color:var(--ink-80);max-width:680px;margin:0 auto 36px;line-height:1.55;font-style:italic;font-weight:500}
.hero-byline{font-family:var(--sans);font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--ink-60);font-weight:700;margin-bottom:40px}
.hero-byline strong{color:var(--ink);font-weight:800}
.hero-ctas{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px}
.btn{padding:16px 32px;font-family:var(--sans);font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;transition:all 0.15s;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:10px}
.btn-primary{background:var(--ink);color:var(--paper)}
.btn-primary:hover{background:var(--ink-80)}
.btn-secondary{background:transparent;color:var(--ink);border:1px solid var(--ink)}
.btn-secondary:hover{background:var(--ink);color:var(--paper)}

/* QUICK STATS — editorial row */
.stats-row{padding:40px 0;border-top:1px solid var(--ink);border-bottom:1px solid var(--ink);background:var(--paper)}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;max-width:920px;margin:0 auto}
.stat{padding:0 32px;border-right:1px solid var(--ink-20);text-align:center}
.stat:first-child{padding-left:0}
.stat:last-child{border-right:none;padding-right:0}
.stat-v{font-family:var(--serif);font-weight:900;font-size:56px;color:var(--ink);letter-spacing:-0.02em;line-height:1}
.stat-v em{font-weight:400;font-style:italic;color:var(--claret)}
.stat-l{font-family:var(--sans);font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--ink-60);font-weight:700;margin-top:8px}

/* GALLERY / FEATURE WELL */
.well{padding:88px 0 72px}
.section-header{text-align:center;margin-bottom:64px}
.section-kicker{font-family:var(--sans);font-size:10px;letter-spacing:5px;text-transform:uppercase;color:var(--gold-deep);font-weight:800;margin-bottom:12px}
.section-title{font-family:var(--serif);font-weight:900;font-size:56px;color:var(--ink);letter-spacing:-0.03em;line-height:0.95;text-transform:uppercase}
.section-title em{font-weight:400;font-style:italic;text-transform:none}
.section-deck{font-family:var(--body-serif);font-size:18px;color:var(--ink-60);max-width:620px;margin:16px auto 0;font-style:italic;font-weight:500}

.feature-hero{background:var(--ink);color:var(--paper);padding:56px;margin-bottom:48px;position:relative;overflow:hidden}
.feature-hero::before{content:'P. 01';position:absolute;top:24px;right:32px;font-family:var(--serif);font-size:20px;color:var(--gold);font-weight:900;letter-spacing:-0.01em}
.feature-hero .row{display:grid;grid-template-columns:1.4fr 1fr;gap:56px;align-items:center;position:relative;z-index:2}
.fh-kicker{font-family:var(--sans);font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--gold);font-weight:800;margin-bottom:14px}
.fh-title{font-family:var(--serif);font-weight:900;font-size:56px;line-height:0.95;color:var(--paper);letter-spacing:-0.025em;margin-bottom:20px}
.fh-title em{font-weight:400;font-style:italic;color:var(--gold)}
.fh-deck{font-family:var(--body-serif);font-size:18px;line-height:1.55;color:rgba(250,247,240,0.78);font-style:italic;font-weight:500;margin-bottom:28px}
.fh-stats{display:grid;grid-template-columns:repeat(2,auto);gap:28px;margin-bottom:28px}
.fh-stat-v{font-family:var(--serif);font-weight:900;font-size:36px;color:var(--gold);letter-spacing:-0.01em;line-height:1}
.fh-stat-l{font-family:var(--sans);font-size:10px;letter-spacing:2px;color:rgba(250,247,240,0.55);text-transform:uppercase;font-weight:700;margin-top:6px}
.fh-read{display:inline-block;padding:12px 24px;background:var(--gold);color:var(--ink);font-family:var(--sans);font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase}
.fh-read:hover{background:#D4B048}

/* Portal cards (editorial style) */
.featured-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:48px}
.portal-card{background:var(--paper);border-top:3px solid var(--ink);padding:28px 0;position:relative;display:block;transition:background 0.15s}
.portal-card:hover{background:var(--paper-2)}
.portal-card::before{content:attr(data-page);position:absolute;top:-3px;right:0;font-family:var(--serif);font-weight:900;font-size:56px;color:var(--ink-20);line-height:0.85;letter-spacing:-0.03em}
.portal-kicker{font-family:var(--sans);font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--claret);font-weight:800;margin-bottom:12px}
.portal-ticker{font-family:var(--sans);font-size:11px;letter-spacing:3px;color:var(--ink-60);font-weight:700;margin-bottom:8px}
.portal-title{font-family:var(--serif);font-weight:900;font-size:36px;line-height:0.95;color:var(--ink);letter-spacing:-0.02em;margin-bottom:14px}
.portal-title em{font-weight:400;font-style:italic}
.portal-deck{font-family:var(--body-serif);font-size:16px;line-height:1.55;color:var(--ink-60);font-style:italic;margin-bottom:18px}
.portal-footer{display:flex;justify-content:space-between;align-items:center;padding-top:14px;border-top:1px solid var(--ink-20)}
.portal-stat{font-family:var(--serif);font-weight:900;font-size:24px;color:var(--ink)}
.portal-stat-label{font-family:var(--sans);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-60);font-weight:700;margin-top:4px}
.portal-read{font-family:var(--sans);font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--ink);font-weight:800;border-bottom:1px solid var(--ink);padding-bottom:2px}
.portal-read::after{content:' \u2192'}

.rest-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.rest-card{background:var(--paper);padding:24px;border:1px solid var(--ink-20);transition:border 0.15s}
.rest-card:hover{border-color:var(--ink)}
.rest-card .portal-title{font-size:22px;margin-bottom:10px}
.rest-card .portal-deck{font-size:14px;margin-bottom:14px}
.rest-card .portal-stat{font-size:18px}
.rest-card::before{display:none}

/* EDITOR'S NOTE */
.editors{background:var(--paper-2);padding:96px 0;border-top:1px solid var(--ink);border-bottom:1px solid var(--ink)}
.editors-inner{max-width:720px;margin:0 auto;text-align:center}
.editors-kicker{font-family:var(--sans);font-size:10px;letter-spacing:5px;text-transform:uppercase;color:var(--gold-deep);font-weight:800;margin-bottom:16px}
.editors-title{font-family:var(--serif);font-weight:900;font-size:48px;color:var(--ink);letter-spacing:-0.02em;line-height:1;margin-bottom:32px}
.editors-title em{font-weight:400;font-style:italic}
.editors-body{font-family:var(--body-serif);font-size:19px;line-height:1.75;color:var(--ink-80);text-align:left;font-weight:500}
.editors-body::first-letter{font-family:var(--serif);float:left;font-size:88px;line-height:0.84;padding:8px 14px 0 0;font-weight:900;color:var(--ink)}
.editors-body p{margin-bottom:20px}
.editors-sig{margin-top:36px;padding-top:24px;border-top:1px solid var(--ink-20);text-align:center}
.sig-name{font-family:var(--serif);font-weight:400;font-style:italic;font-size:26px;color:var(--ink)}
.sig-title{font-family:var(--sans);font-size:10px;color:var(--ink-60);letter-spacing:3px;text-transform:uppercase;margin-top:6px;font-weight:600}

/* ENGAGEMENT BOX */
.order{padding:96px 0;background:var(--ink);color:var(--paper)}
.order-inner{max-width:860px;margin:0 auto;text-align:center}
.order-kicker{font-family:var(--sans);font-size:10px;letter-spacing:5px;text-transform:uppercase;color:var(--gold);font-weight:800;margin-bottom:14px}
.order-title{font-family:var(--serif);font-weight:900;font-size:56px;color:var(--paper);letter-spacing:-0.025em;line-height:0.95;margin-bottom:20px}
.order-title em{font-weight:400;font-style:italic;color:var(--gold)}
.order-deck{font-family:var(--body-serif);font-size:20px;color:rgba(250,247,240,0.75);max-width:640px;margin:0 auto 48px;font-style:italic;font-weight:500;line-height:1.55}
.price-card{background:rgba(250,247,240,0.04);border:1px solid rgba(250,247,240,0.12);padding:40px;max-width:620px;margin:0 auto;text-align:left}
.price-top{display:flex;justify-content:space-between;align-items:baseline;padding-bottom:28px;border-bottom:1px solid rgba(250,247,240,0.1);margin-bottom:24px}
.price-label{font-family:var(--sans);font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--gold);font-weight:800;margin-bottom:6px}
.price-body{font-family:var(--body-serif);font-size:14px;color:rgba(250,247,240,0.55);font-style:italic}
.price-amount{font-family:var(--serif);font-weight:900;font-size:60px;color:var(--paper);letter-spacing:-0.025em;line-height:1}
.price-amount .currency{font-size:30px;color:rgba(250,247,240,0.5);margin-right:2px}
.price-features{list-style:none;margin-bottom:28px}
.price-features li{padding:12px 0;font-family:var(--body-serif);font-size:16px;color:rgba(250,247,240,0.88);display:flex;align-items:flex-start;gap:12px;border-bottom:1px dashed rgba(250,247,240,0.08)}
.price-features li:last-child{border-bottom:none}
.price-features li::before{content:'\u276F';color:var(--gold);font-weight:700;font-size:12px;margin-top:4px}

.form{display:grid;gap:14px;margin-top:16px}
.form input,.form textarea{background:rgba(250,247,240,0.05);border:1px solid rgba(250,247,240,0.15);padding:14px 16px;font-family:var(--body-serif);font-size:16px;color:var(--paper);transition:border 0.15s}
.form input:focus,.form textarea:focus{outline:none;border-color:var(--gold)}
.form input::placeholder,.form textarea::placeholder{color:rgba(250,247,240,0.35);font-style:italic}
.form textarea{min-height:90px;resize:vertical;font-family:inherit}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form button{padding:16px;background:var(--gold);color:var(--ink);font-family:var(--sans);font-weight:800;font-size:11px;letter-spacing:3px;text-transform:uppercase;border:none;cursor:pointer;transition:background 0.15s}
.form button:hover{background:#D4B048}
.form-msg{font-family:var(--body-serif);font-size:15px;color:var(--gold);text-align:center;margin-top:8px;font-style:italic;display:none}
.form-msg.show{display:block}

/* COLOPHON */
.colophon{padding:64px 0 40px;text-align:center;border-top:3px double var(--ink);background:var(--paper)}
.colophon-mark{font-family:var(--serif);font-weight:900;font-size:32px;color:var(--ink);font-style:italic;letter-spacing:-0.01em;margin-bottom:4px}
.colophon-tagline{font-family:var(--body-serif);font-style:italic;color:var(--ink-60);font-size:16px;margin-bottom:28px}
.colophon-meta{font-family:var(--sans);font-size:10px;color:var(--ink-60);letter-spacing:2px;text-transform:uppercase;font-weight:600;line-height:2}
.colophon-meta strong{color:var(--ink)}
.colophon-links{margin-top:24px;font-family:var(--sans);font-size:11px;color:var(--ink-60);letter-spacing:1px}
.colophon-links a{color:var(--gold-deep);font-weight:700;margin:0 10px;border-bottom:1px dotted var(--gold-deep);padding-bottom:1px}

@media(max-width:1000px){
  .hero h1{font-size:52px}
  .hero-deck{font-size:18px}
  .stats-grid{grid-template-columns:repeat(2,1fr);gap:32px 0}
  .stat{border-right:none;padding:0 16px}
  .stat:nth-child(odd){border-right:1px solid var(--ink-20)}
  .section-title{font-size:36px}
  .feature-hero{padding:32px}
  .feature-hero .row{grid-template-columns:1fr;gap:28px}
  .fh-title{font-size:36px}
  .featured-grid,.rest-grid{grid-template-columns:1fr}
  .editors-title,.order-title{font-size:32px}
  .form-grid{grid-template-columns:1fr}
  .wrap{padding:0 24px}
}
</style>
</head>
<body>

<header class="masthead">
  <div class="wrap">
    <div class="masthead-brand">Levin Capital <em>Research</em></div>
    <div class="masthead-meta">
      <strong>Institutional Equity Research</strong><br>
      By the editor of The LCS Review
    </div>
  </div>
</header>

<section class="hero">
  <div class="wrap">
    <div class="hero-kicker">From the Editor of The LCS Review</div>
    <h1>Institutional research,<br/><em>on demand.</em></h1>
    <p class="hero-deck">Bespoke equity research engagements for allocators, advisors, and investment committees. Six-page portals. Source-tagged. Delivered in forty-eight hours.</p>
    <div class="hero-byline">By <strong>Evan Ratner</strong> &middot; Founding Editor</div>
    <div class="hero-ctas">
      <a href="/submit" class="btn btn-primary">Submit a Call</a>
      <a href="/leaderboard" class="btn btn-secondary">The Leaderboard</a>
    </div>
  </div>
</section>

<section class="stats-row">
  <div class="stats-grid">
    <div class="stat">
      <div class="stat-v">VIII</div>
      <div class="stat-l">Live Engagements</div>
    </div>
    <div class="stat">
      <div class="stat-v">48<em>hr</em></div>
      <div class="stat-l">Turnaround</div>
    </div>
    <div class="stat">
      <div class="stat-v">6</div>
      <div class="stat-l">Pages Per Portal</div>
    </div>
    <div class="stat">
      <div class="stat-v">100<em>%</em></div>
      <div class="stat-l">Source-Attributed</div>
    </div>
  </div>
</section>

<section id="gallery" class="well">
  <div class="wrap">
    <div class="section-header">
      <div class="section-kicker">The Portfolio</div>
      <h2 class="section-title">Live <em>Engagements</em></h2>
      <p class="section-deck">Eight portals across mergers, special situations, pre-IPO, compounders, and cyclical setups. Every number traced to an original source.</p>
    </div>

    ${renderFeatureHero(featured[0])}

    <div class="featured-grid">
      ${featured.slice(1).map((p, i) => renderFeaturedCard(p, i + 2)).join('')}
    </div>

    <div class="rest-grid">
      ${rest.map(p => renderRestCard(p)).join('')}
    </div>
  </div>
</section>

<section class="editors">
  <div class="editors-inner">
    <div class="editors-kicker">&mdash; A Note from the Editor &mdash;</div>
    <h2 class="editors-title">On the business of <em>research</em></h2>
    <div class="editors-body">
      <p>Most financial research is written under a conflict of interest &mdash; by sell-side analysts whose firms are also the bank's investment banking clients, or by newsletters monetized through traffic. The research you find here is neither. It is commissioned directly, delivered privately, and written with the same standards of source attribution I apply to pieces published in The LCS Review.</p>
      <p>An engagement produces six linked pages: a landing, a long-form memo, an interactive financial model, a fourteen-slide presentation, a consensus view, and twenty hand-crafted management questions. A PDF comes with it. Every historical figure is tagged to a 10-K, a 10-Q, an earnings transcript, or a named market-data source. Forward estimates are flagged as such.</p>
      <p>If you need coverage on a specific ticker &mdash; whether for a client meeting, an internal pitch, or your own ongoing process &mdash; write in below. I'll get back to you the same day.</p>
    </div>
    <div class="editors-sig">
      <div class="sig-name">Evan Ratner</div>
      <div class="sig-title">Founding Editor</div>
    </div>
  </div>
</section>

<section id="order" class="order">
  <div class="order-inner">
    <div class="wrap">
      <div class="order-kicker">&mdash; Commission a Portal &mdash;</div>
      <h2 class="order-title">Request a bespoke <em>engagement</em></h2>
      <p class="order-deck">One-off research engagement. Your ticker. Delivered within forty-eight hours to a private URL. No subscription required.</p>

      <div class="price-card">
        <div class="price-top">
          <div>
            <div class="price-label">The Engagement</div>
            <div class="price-body">One-off &middot; Private URL &middot; Any ticker, any sector</div>
          </div>
          <div class="price-amount"><span class="currency">$</span>149</div>
        </div>
        <ul class="price-features">
          <li>Six linked pages: landing, memo, deck, model, consensus, management questions</li>
          <li>Interactive valuation model with Bull / Base / Street / Bear scenarios</li>
          <li>Source attribution on every historical figure &mdash; 10-K, transcript, IR materials</li>
          <li>Print-ready PDF for distribution</li>
          <li>Private URL, not indexed publicly &mdash; share only with your team</li>
          <li>Delivered within forty-eight hours of confirmation</li>
        </ul>
        <form class="form" id="requestForm" onsubmit="submitRequest(event)">
          <input type="text" name="ticker" placeholder="Ticker symbol" required maxlength="8">
          <div class="form-grid">
            <input type="email" name="email" placeholder="Your email" required>
            <input type="text" name="firm" placeholder="Firm (optional)">
          </div>
          <textarea name="notes" placeholder="Particular angle, focus, or context? (optional)"></textarea>
          <button type="submit">Commission &mdash; $149</button>
          <div class="form-msg" id="formMsg"></div>
        </form>
      </div>
    </div>
  </div>
</section>

<footer class="colophon">
  <div class="colophon-mark">Levin Capital <em>Research</em></div>
  <div class="colophon-tagline">Institutional coverage on demand</div>
  <div class="colophon-meta">
    <strong>Established 2019</strong> &middot; A Levin Capital Strategies imprint &middot; By the editor of The LCS Review<br>
    Typeset in Playfair Display &amp; Cormorant Garamond
  </div>
  <div class="colophon-links">
    Related reading &middot;
    <a href="https://cafecito-ai.com/lcs/magazine/">The LCS Review</a>
    <a href="https://cafecito-ai.com/lcs/ratlinks/">Ratlinks</a>
  </div>
</footer>

<script>
async function submitRequest(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button');
  const msg = document.getElementById('formMsg');
  const data = Object.fromEntries(new FormData(form));
  btn.disabled = true;
  btn.textContent = 'SENDING...';
  try {
    const r = await fetch('/api/request', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data),
    });
    const j = await r.json();
    if (j.success) {
      msg.textContent = 'Thank you. ' + j.message;
      msg.classList.add('show');
      form.reset();
    } else {
      msg.textContent = j.error || 'An error occurred. Please try again.';
      msg.classList.add('show');
    }
  } catch(err) {
    msg.textContent = 'Network error. Please try again.';
    msg.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Commission — $149';
  }
}
(new Image()).src = '/api/pixel?p=home_b';
<\/script>
</body>
</html>`;
}

function renderFeatureHero(p: PortalEntry | undefined): string {
  if (!p) return '';
  return `<a href="${p.url}" target="_blank" rel="noopener" class="feature-hero">
    <div class="row">
      <div>
        <div class="fh-kicker">Cover Engagement &middot; ${p.category}</div>
        <h3 class="fh-title">${p.company}</h3>
        <p class="fh-deck">${p.thesis}</p>
        <div class="fh-stats">
          <div>
            <div class="fh-stat-v">${p.headline_stat}</div>
            <div class="fh-stat-l">${p.headline_label}</div>
          </div>
          <div>
            <div class="fh-stat-v">${p.rating}</div>
            <div class="fh-stat-l">LCS Rating</div>
          </div>
        </div>
        <span class="fh-read">Read the Portal</span>
      </div>
      <div>
        <div style="font-family:var(--serif);font-weight:900;font-size:180px;color:rgba(184,151,62,0.15);line-height:0.85;letter-spacing:-0.05em;text-align:right">${p.ticker}</div>
      </div>
    </div>
  </a>`;
}

function renderFeaturedCard(p: PortalEntry, page: number): string {
  return `<a href="${p.url}" target="_blank" rel="noopener" class="portal-card" data-page="${String(page).padStart(3, '0')}">
    <div class="portal-kicker">${p.category} &middot; ${p.pattern}</div>
    <div class="portal-ticker">${p.ticker}</div>
    <h3 class="portal-title">${p.company}</h3>
    <p class="portal-deck">${p.thesis}</p>
    <div class="portal-footer">
      <div>
        <div class="portal-stat">${p.headline_stat}</div>
        <div class="portal-stat-label">${p.headline_label}</div>
      </div>
      <span class="portal-read">Read</span>
    </div>
  </a>`;
}

function renderRestCard(p: PortalEntry): string {
  return `<a href="${p.url}" target="_blank" rel="noopener" class="portal-card rest-card">
    <div class="portal-kicker">${p.category}</div>
    <div class="portal-ticker">${p.ticker}</div>
    <h3 class="portal-title">${p.company}</h3>
    <p class="portal-deck">${p.thesis}</p>
    <div class="portal-footer">
      <div>
        <div class="portal-stat">${p.headline_stat}</div>
        <div class="portal-stat-label">${p.headline_label}</div>
      </div>
      <span class="portal-read">Read</span>
    </div>
  </a>`;
}
