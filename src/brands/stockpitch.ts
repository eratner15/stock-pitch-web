import type { PortalEntry } from '../portfolio';

/**
 * Variant A: Stock Pitch — standalone product brand.
 * Startup / product aesthetic. Inter + JetBrains Mono. Navy/green/gold.
 */
export function renderStockPitchLanding(portfolio: PortalEntry[]): string {
  const featured = portfolio.filter(p => p.featured);
  const rest = portfolio.filter(p => !p.featured);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Stock Pitch — institutional-quality equity research portals, generated in 48 hours. Browse eight live examples across sectors.">
<meta property="og:title" content="Stock Pitch — Pitch-ready research portals">
<meta property="og:description" content="Generate institutional equity research in 48 hours. Interactive models, source-tagged analysis, PDF export.">
<meta name="theme-color" content="#0A0F1F">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1F4C8;</text></svg>">
<title>Stock Pitch &middot; Pitch-ready research portals</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#FFFFFF;
  --bg-2:#F5F6F8;
  --ink:#0A0F1F;
  --ink-80:#1F2537;
  --ink-60:#5A6074;
  --ink-40:#8B90A0;
  --ink-20:#D9DBE3;
  --accent:#2EBD6B;
  --accent-dark:#1D9A54;
  --gold:#F5B800;
  --red:#E04759;
  --steel:#3A6FB5;
  --border:#E2E4EA;
  --sans:'Inter',system-ui,-apple-system,sans-serif;
  --mono:'JetBrains Mono',monospace;
}
html{scroll-behavior:smooth}
body{font-family:var(--sans);background:var(--bg);color:var(--ink-80);line-height:1.6;-webkit-font-smoothing:antialiased;font-size:15px}
a{color:inherit;text-decoration:none}
.wrap{max-width:1180px;margin:0 auto;padding:0 24px}

/* NAV */
nav{position:sticky;top:0;z-index:100;padding:14px 0;background:rgba(255,255,255,0.88);backdrop-filter:blur(14px);border-bottom:1px solid var(--border)}
nav .wrap{display:flex;justify-content:space-between;align-items:center}
.brand{display:flex;align-items:center;gap:10px;font-family:var(--mono);font-weight:700;font-size:15px;color:var(--ink)}
.brand-dot{width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:0 0 12px rgba(46,189,107,0.55)}
.nav-links{display:flex;gap:28px}
.nav-links a{font-size:13px;color:var(--ink-60);font-weight:500;transition:color 0.15s}
.nav-links a:hover{color:var(--ink)}
.nav-cta{padding:8px 16px;background:var(--ink);color:#fff;border-radius:6px;font-size:13px;font-weight:600;transition:background 0.15s}
.nav-cta:hover{background:var(--ink-80)}

/* HERO */
.hero{padding:96px 0 72px;text-align:center;background:linear-gradient(180deg,var(--bg) 0%,var(--bg-2) 100%)}
.hero-kicker{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;background:rgba(46,189,107,0.12);border:1px solid rgba(46,189,107,0.3);border-radius:99px;font-family:var(--mono);font-size:11px;font-weight:600;color:var(--accent-dark);letter-spacing:0.3px;margin-bottom:24px}
.hero-kicker::before{content:'';width:6px;height:6px;background:var(--accent);border-radius:50%;animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
.hero h1{font-size:68px;font-weight:900;color:var(--ink);letter-spacing:-0.035em;line-height:1.02;max-width:900px;margin:0 auto 24px}
.hero h1 em{font-style:normal;background:linear-gradient(120deg,var(--accent) 0%,var(--steel) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hero-deck{font-size:20px;color:var(--ink-60);max-width:680px;margin:0 auto 40px;line-height:1.55}
.hero-ctas{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.btn{padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;transition:all 0.15s;cursor:pointer;border:none;font-family:inherit;display:inline-flex;align-items:center;gap:8px}
.btn-primary{background:var(--ink);color:#fff}
.btn-primary:hover{background:var(--ink-80);transform:translateY(-1px);box-shadow:0 4px 12px rgba(10,15,31,0.2)}
.btn-secondary{background:var(--bg);color:var(--ink);border:1px solid var(--border)}
.btn-secondary:hover{border-color:var(--ink);background:var(--bg-2)}

.hero-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:72px;padding-top:40px;border-top:1px solid var(--border);max-width:880px;margin-left:auto;margin-right:auto}
.hstat{text-align:left;padding:0 24px;border-right:1px solid var(--border)}
.hstat:last-child{border-right:none}
.hstat-v{font-family:var(--mono);font-weight:700;font-size:32px;color:var(--ink);letter-spacing:-0.02em;line-height:1}
.hstat-v .unit{color:var(--accent);margin-left:2px}
.hstat-l{font-size:11px;color:var(--ink-60);text-transform:uppercase;letter-spacing:1.5px;margin-top:8px;font-weight:500}

/* HOW IT WORKS */
.how{padding:72px 0}
.section-label{font-family:var(--mono);font-size:11px;color:var(--accent-dark);text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:12px;text-align:center}
.section-title{font-size:36px;font-weight:800;color:var(--ink);letter-spacing:-0.02em;line-height:1.1;text-align:center;margin-bottom:14px}
.section-sub{font-size:17px;color:var(--ink-60);text-align:center;max-width:620px;margin:0 auto 48px}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:48px}
.step{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:32px 28px;position:relative;transition:all 0.15s}
.step:hover{border-color:var(--ink-40);transform:translateY(-2px);box-shadow:0 8px 24px rgba(10,15,31,0.05)}
.step-num{font-family:var(--mono);font-weight:700;font-size:13px;color:var(--accent);margin-bottom:14px}
.step h3{font-size:20px;font-weight:700;color:var(--ink);margin-bottom:10px;letter-spacing:-0.01em}
.step p{font-size:14px;color:var(--ink-60);line-height:1.65}
.step-arrow{position:absolute;top:50%;right:-16px;transform:translateY(-50%);color:var(--ink-20);font-size:20px;z-index:2;background:var(--bg);padding:2px 6px}

/* GALLERY */
.gallery{padding:72px 0;background:var(--bg-2)}
.gallery-kicker{font-family:var(--mono);font-size:11px;color:var(--accent-dark);text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:10px;text-align:center}
.gallery-title{font-size:36px;font-weight:800;color:var(--ink);letter-spacing:-0.02em;text-align:center;margin-bottom:14px}
.gallery-sub{font-size:16px;color:var(--ink-60);text-align:center;margin-bottom:48px}
.gallery-sub strong{color:var(--ink);font-weight:600}
.featured-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:32px}
.portal-card{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:28px 24px;transition:all 0.15s;display:flex;flex-direction:column;gap:12px;position:relative;overflow:hidden}
.portal-card:hover{border-color:var(--ink-40);transform:translateY(-3px);box-shadow:0 12px 32px rgba(10,15,31,0.08)}
.portal-card.featured{border-color:var(--accent);background:linear-gradient(180deg,rgba(46,189,107,0.02) 0%,var(--bg) 50%)}
.portal-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.portal-ticker{font-family:var(--mono);font-weight:700;font-size:13px;color:var(--accent-dark);letter-spacing:1px}
.portal-rating{font-family:var(--mono);font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.5px}
.portal-rating.buy{background:rgba(46,189,107,0.12);color:var(--accent-dark)}
.portal-rating.ow{background:rgba(58,111,181,0.12);color:var(--steel)}
.portal-rating.part{background:rgba(245,184,0,0.15);color:#A37900}
.portal-rating.hold{background:rgba(139,144,160,0.15);color:var(--ink-60)}
.portal-name{font-size:19px;font-weight:700;color:var(--ink);letter-spacing:-0.01em;line-height:1.25}
.portal-category{font-family:var(--mono);font-size:10px;color:var(--ink-40);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:-4px}
.portal-thesis{font-size:13px;color:var(--ink-60);line-height:1.55;flex:1}
.portal-footer{display:flex;justify-content:space-between;align-items:flex-end;padding-top:12px;border-top:1px solid var(--border);margin-top:4px}
.portal-stat{font-family:var(--mono);font-weight:700;font-size:18px;color:var(--ink)}
.portal-stat-label{font-size:10px;color:var(--ink-40);text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.portal-open{font-family:var(--mono);font-size:11px;color:var(--accent-dark);font-weight:600;letter-spacing:0.5px}
.portal-open::after{content:' \u2192';transition:transform 0.2s}
.portal-card:hover .portal-open::after{transform:translateX(3px)}
.rest-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.rest-card{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:18px;transition:all 0.15s}
.rest-card:hover{border-color:var(--ink-40)}
.rest-card .portal-name{font-size:15px}
.rest-card .portal-thesis{font-size:12px}
.rest-card .portal-stat{font-size:15px}

/* CUSTOM PORTAL CTA */
.order{padding:96px 0;background:var(--ink);color:#fff;text-align:center}
.order h2{font-size:42px;font-weight:800;color:#fff;letter-spacing:-0.025em;line-height:1.1;margin-bottom:16px}
.order h2 em{font-style:normal;color:var(--accent)}
.order-sub{font-size:17px;color:rgba(255,255,255,0.65);max-width:620px;margin:0 auto 40px;line-height:1.55}
.price-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:40px;max-width:560px;margin:0 auto;text-align:left}
.price-main{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.1)}
.price-label{font-family:var(--mono);font-size:11px;color:var(--accent);letter-spacing:2px;text-transform:uppercase;font-weight:600}
.price-amount{font-family:var(--mono);font-weight:700;font-size:44px;color:#fff;letter-spacing:-0.02em}
.price-amount .currency{font-size:24px;color:rgba(255,255,255,0.55);margin-right:2px}
.price-note{font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px}
.price-features{margin-bottom:24px}
.price-features li{list-style:none;padding:10px 0;font-size:14px;color:rgba(255,255,255,0.85);display:flex;align-items:center;gap:10px;border-bottom:1px dashed rgba(255,255,255,0.08)}
.price-features li:last-child{border-bottom:none}
.price-features li::before{content:'\u2713';color:var(--accent);font-weight:700}

.form{display:grid;gap:12px;margin-top:12px}
.form input,.form textarea{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:12px 14px;font-size:14px;font-family:inherit;color:#fff;transition:border 0.15s}
.form input:focus,.form textarea:focus{outline:none;border-color:var(--accent)}
.form input::placeholder,.form textarea::placeholder{color:rgba(255,255,255,0.35)}
.form textarea{min-height:80px;resize:vertical;font-family:inherit}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form button{padding:14px;background:var(--accent);color:var(--ink);font-weight:700;font-size:14px;border:none;border-radius:8px;cursor:pointer;transition:background 0.15s;letter-spacing:0.3px}
.form button:hover{background:#3CC878}
.form-msg{font-size:13px;color:var(--accent);margin-top:6px;text-align:center;display:none}
.form-msg.show{display:block}

/* FOOTER */
footer{padding:48px 0 32px;text-align:center;border-top:1px solid var(--border);background:var(--bg)}
footer .wrap{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
footer p{font-size:12px;color:var(--ink-40);font-family:var(--mono)}
footer a{color:var(--ink-60);margin:0 10px}
footer a:hover{color:var(--ink)}
footer .sister-note{font-size:11px;color:var(--ink-40);margin-top:8px}
footer .sister-note a{color:var(--accent-dark);font-weight:600;margin:0 4px}

/* RESPONSIVE */
@media(max-width:900px){
  .hero h1{font-size:44px}
  .hero-deck{font-size:17px}
  .hero-stats{grid-template-columns:repeat(2,1fr);row-gap:32px}
  .hstat{border-right:none}
  .hstat:nth-child(odd){border-right:1px solid var(--border)}
  .steps{grid-template-columns:1fr}
  .step-arrow{display:none}
  .featured-grid,.rest-grid{grid-template-columns:1fr}
  .order h2{font-size:30px}
  .form-grid{grid-template-columns:1fr}
  .price-card{padding:28px}
  nav .nav-links{display:none}
}
</style>
</head>
<body>

<nav>
  <div class="wrap">
    <a href="/" class="brand">
      <span class="brand-dot"></span>
      Stock Pitch
    </a>
    <div class="nav-links">
      <a href="#gallery">Gallery</a>
      <a href="/leaderboard">Leaderboard</a>
      <a href="/submit">Submit a Call</a>
    </div>
    <a href="/submit" class="nav-cta">Submit a Call</a>
  </div>
</nav>

<section class="hero">
  <div class="wrap">
    <div class="hero-kicker">Free · Your first call on the house</div>
    <h1>Submit your <em>calls</em>. Let the <em>market</em> score them.</h1>
    <p class="hero-deck">A leaderboard for equity research — tracked by price performance, not votes. Submit a ticker, a direction, a price target, and your thesis. We lock in entry price and track your call forward. No bias. No subjective score. Just the market.</p>
    <div class="hero-ctas">
      <a href="/submit" class="btn btn-primary">Submit Your First Call &rarr;</a>
      <a href="/leaderboard" class="btn btn-secondary">View the Leaderboard</a>
    </div>
    <div class="hero-stats">
      <div class="hstat">
        <div class="hstat-v">8<span class="unit">+</span></div>
        <div class="hstat-l">Live Portals</div>
      </div>
      <div class="hstat">
        <div class="hstat-v">6</div>
        <div class="hstat-l">Pages Each</div>
      </div>
      <div class="hstat">
        <div class="hstat-v">48<span class="unit">hr</span></div>
        <div class="hstat-l">Turnaround</div>
      </div>
      <div class="hstat">
        <div class="hstat-v">100<span class="unit">%</span></div>
        <div class="hstat-l">Source-Tagged</div>
      </div>
    </div>
  </div>
</section>

<section id="how" class="how">
  <div class="wrap">
    <div class="section-label">How It Works</div>
    <h2 class="section-title">From ticker to pitch deck in three steps</h2>
    <p class="section-sub">Each portal bundles a landing, a long-form investment memo, an interactive financial model, a 14-slide deck, a consensus view, and 20 pre-written management questions.</p>
    <div class="steps">
      <div class="step">
        <div class="step-num">01.</div>
        <h3>Request a ticker</h3>
        <p>Tell us the company, provide optional sell-side PDFs for enrichment, and note any specific angle. Works for public equities, pre-IPO (S-1 TTW), and M&amp;A situations.</p>
        <div class="step-arrow">&rarr;</div>
      </div>
      <div class="step">
        <div class="step-num">02.</div>
        <h3>We research autonomously</h3>
        <p>SEC filings, earnings transcripts, IR materials, live market data, and sector-specific frameworks (FRE/DE, accretion/dilution, NAV, OR, etc.). Every number tagged to a primary source.</p>
        <div class="step-arrow">&rarr;</div>
      </div>
      <div class="step">
        <div class="step-num">03.</div>
        <h3>Delivered in 48 hours</h3>
        <p>A private URL with six linked pages, a print-ready PDF, and the underlying model. Share with your team, cite in your pitch, take to your next meeting.</p>
      </div>
    </div>
  </div>
</section>

<section id="gallery" class="gallery">
  <div class="wrap">
    <div class="gallery-kicker">The Gallery</div>
    <h2 class="gallery-title">Browse live examples</h2>
    <p class="gallery-sub">Eight portals covering <strong>mergers, special situations, pre-IPO, compounders, and cyclical setups</strong>. Click any to explore the full six-page portal.</p>

    <div class="featured-grid">
      ${featured.map(p => renderCard(p, true)).join('')}
    </div>

    <div class="rest-grid">
      ${rest.map(p => renderCard(p, false)).join('')}
    </div>
  </div>
</section>

<section id="order" class="order">
  <div class="wrap">
    <h2>Need a portal for <em>your ticker?</em></h2>
    <p class="order-sub">One-off custom portal. Delivered in 48 hours. Private URL shareable with your team. No subscription.</p>

    <div class="price-card">
      <div class="price-main">
        <div>
          <div class="price-label">Custom Portal</div>
          <div class="price-note">One-time · Private URL · Your ticker</div>
        </div>
        <div class="price-amount"><span class="currency">$</span>149</div>
      </div>
      <ul class="price-features">
        <li>All six pages: index, memo, deck, model, consensus, questions</li>
        <li>Interactive model with Bull / Base / Street / Bear presets</li>
        <li>Source-tagged analysis — every number traced to primary source</li>
        <li>Print-ready PDF export</li>
        <li>Private URL — share with your team; not indexed publicly</li>
        <li>Delivered within 48 hours</li>
      </ul>
      <form class="form" id="requestForm" onsubmit="submitRequest(event)">
        <input type="text" name="ticker" placeholder="Ticker (e.g. PLTR, UBER, SNOW)" required maxlength="8">
        <div class="form-grid">
          <input type="email" name="email" placeholder="Your email" required>
          <input type="text" name="firm" placeholder="Firm (optional)">
        </div>
        <textarea name="notes" placeholder="Any specific angle or focus? (optional)"></textarea>
        <button type="submit">Request Portal &mdash; $149</button>
        <div class="form-msg" id="formMsg"></div>
      </form>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <div class="brand">
      <span class="brand-dot"></span>
      Stock Pitch
    </div>
    <div>
      <a href="#gallery">Gallery</a>
      <a href="#order">Request</a>
      <a href="https://github.com/eratner15/stock-pitch">Source</a>
    </div>
    <p>&copy; 2026 &middot; Built on Cloudflare Workers</p>
  </div>
  <p class="sister-note">Related: the magazine &middot; <a href="https://cafecito-ai.com/lcs/magazine/">LCS Review</a> &middot; <a href="https://cafecito-ai.com/lcs/ratlinks/">Ratlinks</a></p>
</footer>

<script>
async function submitRequest(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button');
  const msg = document.getElementById('formMsg');
  const data = Object.fromEntries(new FormData(form));
  btn.disabled = true;
  btn.textContent = 'Sending...';
  try {
    const r = await fetch('/api/request', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data),
    });
    const j = await r.json();
    if (j.success) {
      msg.textContent = j.message;
      msg.classList.add('show');
      form.reset();
    } else {
      msg.textContent = j.error || 'Something went wrong. Try again.';
      msg.classList.add('show');
      msg.style.color = '#E04759';
    }
  } catch(err) {
    msg.textContent = 'Network error. Please try again.';
    msg.classList.add('show');
    msg.style.color = '#E04759';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Request Portal — $149';
  }
}
// Analytics pixel
(new Image()).src = '/api/pixel?p=home_a';
<\/script>
</body>
</html>`;
}

function renderCard(p: PortalEntry, featured: boolean): string {
  if (featured) {
    return `<a href="${p.url}" target="_blank" rel="noopener" class="portal-card featured">
      <div class="portal-header">
        <span class="portal-ticker">${p.ticker}</span>
        <span class="portal-rating ${p.rating_class}">${p.rating}</span>
      </div>
      <div>
        <div class="portal-category">${p.category} &middot; ${p.pattern}</div>
        <div class="portal-name">${p.company}</div>
      </div>
      <p class="portal-thesis">${p.thesis}</p>
      <div class="portal-footer">
        <div>
          <div class="portal-stat">${p.headline_stat}</div>
          <div class="portal-stat-label">${p.headline_label}</div>
        </div>
        <span class="portal-open">Open</span>
      </div>
    </a>`;
  }
  return `<a href="${p.url}" target="_blank" rel="noopener" class="portal-card rest-card">
    <div class="portal-header">
      <span class="portal-ticker">${p.ticker}</span>
      <span class="portal-rating ${p.rating_class}">${p.rating}</span>
    </div>
    <div class="portal-category">${p.category}</div>
    <div class="portal-name">${p.company}</div>
    <p class="portal-thesis">${p.thesis}</p>
    <div class="portal-footer">
      <div>
        <div class="portal-stat">${p.headline_stat}</div>
        <div class="portal-stat-label">${p.headline_label}</div>
      </div>
      <span class="portal-open">Open</span>
    </div>
  </a>`;
}
