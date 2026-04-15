import { escapeHtml } from '../lib/security';
import { renderNavChart } from '../lib/chart';
import type { PortfolioRow, PositionPerf } from '../lib/portfolios';

interface DetailInput {
  portfolio: PortfolioRow;
  positions: PositionPerf[];
  nav: number;
  total_return_pct: number;
  nav_history: Array<{ date: string; nav: number }>;
  brand: 'stockpitch' | 'levincap';
  origin: string;
}

export function renderPortfolioDetail(input: DetailInput): string {
  const { portfolio, positions, nav, total_return_pct, nav_history, brand, origin } = input;
  const isLevin = brand === 'levincap';
  const accent = isLevin ? '#B8973E' : '#2EBD6B';
  const accentDeep = isLevin ? '#8B6F28' : '#1D9A54';
  const bg = isLevin ? '#FAF7F0' : '#FFFFFF';
  const surface = isLevin ? '#FFFFFF' : '#F5F6F8';
  const ink = isLevin ? '#0A0A0A' : '#0A0F1F';
  const inkMuted = isLevin ? '#5A5651' : '#5A6074';
  const border = isLevin ? '#D4CFC3' : '#E2E4EA';
  const bodyFont = isLevin ? "'Cormorant Garamond',Georgia,serif" : "'Inter',system-ui,sans-serif";
  const displayFont = isLevin ? "'Playfair Display',Georgia,serif" : "'Inter',system-ui,sans-serif";
  const brandMark = isLevin ? 'Levin Capital <em>Research</em>' : 'Stock Pitch';

  const positive = total_return_pct >= 0;
  const returnColor = positive ? '#2EBD6B' : '#E04759';
  const returnPct = (total_return_pct * 100).toFixed(2);
  const inceptionDate = new Date(portfolio.inception_date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const chartSVG = renderNavChart(
    nav_history.map(n => ({ date: n.date, value: n.nav })),
    {
      color: accent,
      fillColor: isLevin ? 'rgba(184,151,62,0.08)' : 'rgba(46,189,107,0.10)',
      textColor: inkMuted,
      gridColor: border,
      height: 300,
    }
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(portfolio.name)} — ${isLevin ? 'Levin Capital Research' : 'Stock Pitch'}</title>

<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(portfolio.name)} · ${positive ? '+' : ''}${returnPct}%">
<meta property="og:description" content="${positions.length} positions · equal-weighted · rebalanced nightly. NAV $${Math.round(nav).toLocaleString()} since inception ${inceptionDate}.">
<meta property="og:image" content="${origin}/p/${portfolio.slug}/og.png">
<meta property="og:url" content="${origin}/p/${portfolio.slug}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(portfolio.name)} · ${positive ? '+' : ''}${returnPct}%">
<meta name="twitter:image" content="${origin}/p/${portfolio.slug}/og.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,900&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:${bg};--surface:${surface};--ink:${ink};--ink-muted:${inkMuted};--border:${border};
  --accent:${accent};--accent-deep:${accentDeep};
  --green:#2EBD6B;--red:#E04759;
  --display:${displayFont};--body:${bodyFont};--sans:'Inter',system-ui,sans-serif;--mono:'JetBrains Mono',monospace;
}
body{font-family:var(--body);background:var(--bg);color:var(--ink);line-height:1.55;-webkit-font-smoothing:antialiased;font-size:16px}
a{color:inherit;text-decoration:none}
.wrap{max-width:1080px;margin:0 auto;padding:0 24px}

nav{padding:16px 0;border-bottom:1px solid var(--border);position:sticky;top:0;background:${isLevin ? 'rgba(250,247,240,0.94)' : 'rgba(255,255,255,0.94)'};backdrop-filter:blur(12px);z-index:50}
nav .wrap{display:flex;justify-content:space-between;align-items:center}
.brand{font-family:${isLevin ? 'var(--display)' : 'var(--mono)'};font-weight:${isLevin ? '900' : '700'};font-size:${isLevin ? '20px' : '14px'};color:var(--ink)}
.brand em{font-weight:${isLevin ? '400' : '500'};font-style:italic}
.nav-links{display:flex;gap:20px;font-family:'Inter',sans-serif;font-size:12px}
.nav-links a{color:var(--ink-muted);font-weight:500;letter-spacing:${isLevin ? '1px;text-transform:uppercase' : 'normal'}}

.hero{padding:56px 0 40px;border-bottom:1px solid var(--border)}
.hero-kicker{font-family:${isLevin ? "'Inter',sans-serif" : "'JetBrains Mono',monospace"};font-size:${isLevin ? '10px' : '11px'};letter-spacing:${isLevin ? '4px' : '2px'};text-transform:uppercase;color:var(--accent);font-weight:${isLevin ? '800' : '600'};margin-bottom:14px}
.hero h1{font-family:var(--display);font-weight:${isLevin ? '900' : '800'};font-size:${isLevin ? '56px' : '48px'};color:var(--ink);letter-spacing:-0.025em;line-height:1;margin-bottom:14px}
.hero h1 em{font-style:italic;font-weight:${isLevin ? '400' : '500'};color:var(--accent)}
.hero-desc{font-family:var(--body);font-size:${isLevin ? '18px' : '16px'};color:var(--ink-muted);max-width:720px;${isLevin ? 'font-style:italic' : ''};line-height:1.55}

.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:32px;border:1px solid var(--border);background:var(--surface);${isLevin ? '' : 'border-radius:14px;overflow:hidden'}}
.kpi{padding:20px 24px;border-right:1px solid var(--border)}
.kpi:last-child{border-right:none}
.kpi .l{font-family:var(--sans);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-muted);font-weight:600;margin-bottom:6px}
.kpi .v{font-family:var(--display);font-weight:${isLevin ? '900' : '800'};font-size:28px;color:var(--ink);letter-spacing:-0.015em;line-height:1}
.kpi .v.pos{color:var(--green)}.kpi .v.neg{color:var(--red)}
.kpi .sub{font-family:var(--sans);font-size:11px;color:var(--ink-muted);margin-top:4px;font-weight:500}

/* Chart */
.chart-section{padding:32px 0 16px}
.chart-title{font-family:var(--display);font-weight:${isLevin ? '900' : '700'};font-size:18px;color:var(--ink);margin-bottom:4px;letter-spacing:-0.01em}
.chart-sub{font-family:var(--sans);font-size:12px;color:var(--ink-muted);margin-bottom:16px;letter-spacing:0.5px}
.chart-wrap{background:var(--surface);border:1px solid var(--border);padding:16px;${isLevin ? '' : 'border-radius:14px'}}

/* Holdings */
.holdings{padding:32px 0 48px}
.holdings-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;flex-wrap:wrap;gap:8px}
.holdings-head h2{font-family:var(--display);font-weight:${isLevin ? '900' : '700'};font-size:22px;color:var(--ink);letter-spacing:-0.01em}
.holdings-head .meta{font-family:var(--sans);font-size:12px;color:var(--ink-muted)}
.h-table{width:100%;border-collapse:collapse;font-family:var(--sans);font-size:13px}
.h-table th{text-align:left;padding:10px 12px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-muted);font-weight:700;border-bottom:2px solid var(--ink)}
.h-table th.right{text-align:right}
.h-table td{padding:14px 12px;border-bottom:1px solid var(--border)}
.h-table td.right{text-align:right;font-family:var(--mono);font-weight:600}
.h-table tr:hover{background:var(--surface)}
.h-table .ticker-cell{font-family:var(--mono);font-weight:700;font-size:13px;letter-spacing:0.5px;color:var(--ink)}
.h-table .ticker-cell a{color:var(--ink);border-bottom:1px dotted var(--border);padding-bottom:1px}
.h-table .ticker-cell a:hover{color:var(--accent);border-bottom-color:var(--accent)}
.h-table .dir-pill{display:inline-block;margin-left:6px;padding:2px 6px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:${isLevin ? '0' : '3px'}}
.h-table .dir-pill.long{background:rgba(46,189,107,0.12);color:var(--green)}
.h-table .dir-pill.short{background:rgba(224,71,89,0.12);color:var(--red)}
.h-table .ret.pos{color:var(--green)}
.h-table .ret.neg{color:var(--red)}

/* Share */
.share{background:${isLevin ? 'var(--ink)' : '#0A0F1F'};color:#FAF7F0;padding:40px;margin:40px 0;${isLevin ? '' : 'border-radius:18px'};text-align:center}
.share h3{font-family:var(--display);font-weight:${isLevin ? '900' : '800'};font-size:26px;color:#FAF7F0;letter-spacing:-0.01em;margin-bottom:10px}
.share h3 em{font-style:italic;font-weight:${isLevin ? '400' : '500'};color:var(--accent)}
.share p{font-family:var(--body);font-size:16px;color:rgba(250,247,240,0.65);margin-bottom:20px;${isLevin ? 'font-style:italic' : ''}}
.share-buttons{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.share-btn{padding:14px 22px;background:var(--accent);color:${isLevin ? 'var(--ink)' : '#07122B'};border:none;${isLevin ? '' : 'border-radius:10px'};font-family:var(--sans);font-weight:700;font-size:13px;cursor:pointer;letter-spacing:0.3px;transition:transform 0.12s}
.share-btn:hover{transform:translateY(-2px)}
.share-btn.twitter{background:#fff;color:#000}
.share-btn.outline{background:transparent;color:#FAF7F0;border:1px solid rgba(250,247,240,0.3)}
.share-btn.outline:hover{border-color:var(--accent);color:var(--accent)}

footer{padding:32px 0;border-top:1px solid var(--border);text-align:center;font-family:'Inter',sans-serif;font-size:12px;color:var(--ink-muted)}
footer a{color:var(--accent-deep);font-weight:600}

@media(max-width:760px){
  .hero h1{font-size:36px}
  .kpi-row{grid-template-columns:1fr 1fr}
  .kpi{border-right:0;border-bottom:1px solid var(--border)}
  .kpi:nth-child(odd){border-right:1px solid var(--border)}
  .kpi:last-child{border-bottom:none}
  .kpi:nth-last-child(2):nth-child(odd){border-bottom:none}
  .h-table th:nth-child(4),.h-table td:nth-child(4),
  .h-table th:nth-child(5),.h-table td:nth-child(5){display:none}
  .h-table{font-size:12px}
  .nav-links{display:none}
  .share{padding:28px 20px}
}
</style>
</head>
<body>

<nav>
  <div class="wrap">
    <a href="/" class="brand">${brandMark}</a>
    <div class="nav-links">
      <a href="/leaderboard">Leaderboard</a>
      <a href="/submit">Submit a Call</a>
      <a href="/p/top10" style="color:var(--ink);font-weight:700">Portfolios</a>
    </div>
  </div>
</nav>

<section class="hero">
  <div class="wrap">
    <div class="hero-kicker">Model Portfolio · Auto-Rebalanced Nightly</div>
    <h1>${escapeHtml(portfolio.name)}</h1>
    <p class="hero-desc">${escapeHtml(portfolio.description || '')}</p>
    <div class="kpi-row">
      <div class="kpi">
        <div class="l">Current NAV</div>
        <div class="v">$${Math.round(nav).toLocaleString()}</div>
        <div class="sub">Inception $${portfolio.inception_value.toLocaleString()}</div>
      </div>
      <div class="kpi">
        <div class="l">Total Return</div>
        <div class="v ${positive ? 'pos' : 'neg'}">${positive ? '+' : ''}${returnPct}%</div>
        <div class="sub">Since ${inceptionDate}</div>
      </div>
      <div class="kpi">
        <div class="l">Positions</div>
        <div class="v">${positions.length}</div>
        <div class="sub">Equal-weighted ${positions.length > 0 ? (100 / positions.length).toFixed(1) : '0'}%</div>
      </div>
      <div class="kpi">
        <div class="l">Rebalance</div>
        <div class="v">Nightly</div>
        <div class="sub">By annualized IRR</div>
      </div>
    </div>
  </div>
</section>

<section class="chart-section">
  <div class="wrap">
    <div class="chart-title">NAV History</div>
    <div class="chart-sub">Daily close · since inception</div>
    <div class="chart-wrap">${chartSVG}</div>
  </div>
</section>

<section class="holdings">
  <div class="wrap">
    <div class="holdings-head">
      <h2>Current Holdings</h2>
      <div class="meta">${positions.length} position${positions.length === 1 ? '' : 's'} · ordered by contribution</div>
    </div>
    <table class="h-table">
      <thead>
        <tr>
          <th>Ticker</th>
          <th class="right">Weight</th>
          <th class="right">Entry</th>
          <th class="right">Current</th>
          <th class="right">Days</th>
          <th class="right">Return</th>
          <th class="right">Contribution</th>
        </tr>
      </thead>
      <tbody>
        ${[...positions]
          .sort((a, b) => b.weighted_contribution - a.weighted_contribution)
          .map(p => {
            const posReturn = (p.return_pct * 100).toFixed(2);
            const posContrib = (p.weighted_contribution * 100).toFixed(2);
            const callLink = p.call_id ? `<a href="/c/${p.call_id}">${escapeHtml(p.ticker)}</a>` : escapeHtml(p.ticker);
            return `<tr>
              <td class="ticker-cell">
                ${callLink}
                <span class="dir-pill ${p.direction}">${p.direction}</span>
              </td>
              <td class="right">${p.weight_pct.toFixed(1)}%</td>
              <td class="right">$${p.entry_price.toFixed(2)}</td>
              <td class="right">$${p.current_price.toFixed(2)}</td>
              <td class="right">${p.days_held}</td>
              <td class="right ret ${p.return_pct >= 0 ? 'pos' : 'neg'}">${p.return_pct >= 0 ? '+' : ''}${posReturn}%</td>
              <td class="right ret ${p.weighted_contribution >= 0 ? 'pos' : 'neg'}">${p.weighted_contribution >= 0 ? '+' : ''}${posContrib}%</td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="share">
      <h3>Track the <em>portfolio</em></h3>
      <p>Equal-weighted, auto-rebalanced nightly, entry prices locked the moment each position enters the book.</p>
      <div class="share-buttons">
        <a class="share-btn twitter" href="#" onclick="shareTwitter(event)">𝕏 Share on X</a>
        <button class="share-btn" onclick="copyLink()">🔗 Copy Link</button>
        <a class="share-btn outline" href="/submit">→ Pitch a Call</a>
      </div>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    &copy; 2026 ${isLevin ? 'Levin Capital Research' : 'Stock Pitch'} ·
    <a href="/leaderboard">Leaderboard</a> ·
    <a href="/submit">Pitch a Stock</a> ·
    <a href="/p/top10">Top 10</a>
  </div>
</footer>

<script>
function shareTwitter(e){
  e.preventDefault();
  const url = location.href;
  const text = '${escapeHtml(portfolio.name)} · ${positive ? '+' : ''}${returnPct}% since inception. ${positions.length}-position model portfolio, auto-rebalanced nightly.';
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url), '_blank');
}
async function copyLink(){
  try {
    await navigator.clipboard.writeText(location.href);
    const btn = event.target;
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = orig; }, 1800);
  } catch(e){}
}
</script>

</body>
</html>`;
}
