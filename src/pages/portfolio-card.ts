import { escapeHtml } from '../lib/security';
import { renderNavChart } from '../lib/chart';
import type { PortfolioRow, PositionPerf } from '../lib/portfolios';

interface CardInput {
  portfolio: PortfolioRow;
  positions: PositionPerf[];
  nav: number;
  total_return_pct: number;
  nav_history: Array<{ date: string; nav: number }>;
  brand: 'stockpitch' | 'levincap';
}

/**
 * 1200x630 share card for a portfolio. Rendered as HTML at /p/:slug/card,
 * screenshotted to PNG by Browser Rendering at /p/:slug/og.png.
 */
export function renderPortfolioCard(input: CardInput): string {
  const { portfolio, positions, nav, total_return_pct, nav_history, brand } = input;
  const isLevin = brand === 'levincap';
  const accent = isLevin ? '#B8973E' : '#2EBD6B';
  const bg = isLevin ? '#FAF7F0' : '#0A0F1F';
  const ink = isLevin ? '#0A0A0A' : '#FFFFFF';
  const inkSoft = isLevin ? 'rgba(10,10,10,0.55)' : 'rgba(255,255,255,0.55)';
  const border = isLevin ? 'rgba(10,10,10,0.12)' : 'rgba(255,255,255,0.12)';
  const displayFont = isLevin ? "'Playfair Display',Georgia,serif" : "'Inter',system-ui,sans-serif";

  const positive = total_return_pct >= 0;
  const returnColor = positive ? '#2EBD6B' : '#E04759';
  const returnStr = (positive ? '+' : '') + (total_return_pct * 100).toFixed(2) + '%';

  // Top 3 holdings by contribution
  const top3 = [...positions]
    .sort((a, b) => b.weighted_contribution - a.weighted_contribution)
    .slice(0, 3);

  const brandMark = isLevin
    ? `<span style="font-family:'Playfair Display',serif;font-weight:900">Levin Capital <em style="font-weight:400;font-style:italic">Research</em></span>`
    : `<span style="font-family:'JetBrains Mono',monospace;font-weight:700"><span style="color:${accent}">●</span> Stock Pitch</span>`;

  const chartSVG = renderNavChart(
    nav_history.map(n => ({ date: n.date, value: n.nav })),
    {
      width: 520,
      height: 180,
      color: accent,
      fillColor: isLevin ? 'rgba(184,151,62,0.15)' : 'rgba(46,189,107,0.18)',
      textColor: inkSoft,
      gridColor: border,
      showAxis: false,
      showGrid: false,
      padding: { top: 8, right: 8, bottom: 8, left: 8 },
    }
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Portfolio share card</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,900;1,400&family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{margin:0;padding:0}
body{
  width:1200px;height:630px;
  background:${bg};color:${ink};
  font-family:'Inter',sans-serif;
  padding:56px 64px;
  position:relative;
  overflow:hidden;
}

.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;font-size:15px;color:${inkSoft}}
.top .brand{font-size:18px;color:${ink}}
.top .kicker{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${accent};font-weight:700}

.content-row{display:grid;grid-template-columns:1.2fr 1fr;gap:48px;margin-top:8px;align-items:flex-start}

.left-col .portfolio-name{font-family:${displayFont};font-weight:900;font-size:64px;color:${ink};letter-spacing:-0.025em;line-height:1;margin-bottom:24px}
.left-col .nav-block{display:flex;align-items:baseline;gap:20px;margin-bottom:24px}
.left-col .nav-v{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:44px;color:${ink};letter-spacing:-0.01em;line-height:1}
.left-col .return-big{font-family:${displayFont};font-weight:900;font-size:72px;color:${returnColor};letter-spacing:-0.025em;line-height:0.9}
.left-col .return-label{font-family:'Inter',sans-serif;font-size:13px;color:${inkSoft};letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-top:4px}

.meta-row{display:flex;gap:24px;margin-top:28px;padding-top:20px;border-top:1px solid ${border}}
.meta-col{font-family:'Inter',sans-serif}
.meta-col .l{font-size:10px;color:${inkSoft};letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:4px}
.meta-col .v{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:20px;color:${ink};letter-spacing:-0.01em}

.right-col{display:flex;flex-direction:column;justify-content:space-between;height:440px}
.chart-container{background:${isLevin ? 'rgba(10,10,10,0.03)' : 'rgba(255,255,255,0.03)'};border:1px solid ${border};padding:8px;height:200px}

.top3{margin-top:16px}
.top3-label{font-family:'Inter',sans-serif;font-size:10px;color:${inkSoft};letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:12px}
.top3-list{display:flex;flex-direction:column;gap:8px}
.top3-item{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:${isLevin ? 'rgba(10,10,10,0.03)' : 'rgba(255,255,255,0.04)'};border:1px solid ${border}}
.top3-item .tkr{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:16px;color:${ink};letter-spacing:1px}
.top3-item .tkr .dir{display:inline-block;margin-left:6px;padding:1px 6px;font-size:10px;letter-spacing:1px;text-transform:uppercase;background:${isLevin ? 'rgba(10,10,10,0.08)' : 'rgba(255,255,255,0.08)'};color:${ink}}
.top3-item .ret{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:15px}
.top3-item .ret.pos{color:#2EBD6B}
.top3-item .ret.neg{color:#E04759}

.cta{position:absolute;bottom:56px;right:64px;padding:14px 22px;background:${accent};color:${isLevin ? ink : '#07122B'};font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase}
.footer-meta{position:absolute;bottom:56px;left:64px;font-family:'JetBrains Mono',monospace;font-size:13px;color:${inkSoft};letter-spacing:1px}
</style>
</head>
<body>

<div class="top">
  <div class="brand">${brandMark}</div>
  <div class="kicker">Model Portfolio · ${positions.length} positions</div>
</div>

<div class="content-row">
  <div class="left-col">
    <div class="portfolio-name">${escapeHtml(portfolio.name)}</div>
    <div class="nav-block">
      <div class="nav-v">$${Math.round(nav).toLocaleString()}</div>
      <div style="font-family:'Inter',sans-serif;font-size:13px;color:${inkSoft};letter-spacing:1px;text-transform:uppercase;font-weight:600">Current NAV</div>
    </div>
    <div class="return-big">${returnStr}</div>
    <div class="return-label">Total Return since Inception</div>
    <div class="meta-row">
      <div class="meta-col">
        <div class="l">Rebalance</div>
        <div class="v">Nightly</div>
      </div>
      <div class="meta-col">
        <div class="l">Weighting</div>
        <div class="v">Equal</div>
      </div>
      <div class="meta-col">
        <div class="l">Constituents</div>
        <div class="v">${positions.length}</div>
      </div>
    </div>
  </div>

  <div class="right-col">
    <div>
      <div class="top3-label">Top Contributors</div>
      <div class="chart-container">${chartSVG}</div>
    </div>
    <div class="top3">
      <div class="top3-label">Top 3 Positions</div>
      <div class="top3-list">
        ${top3.map(p => `
          <div class="top3-item">
            <div class="tkr">${escapeHtml(p.ticker)} <span class="dir">${p.direction}</span></div>
            <div class="ret ${p.return_pct >= 0 ? 'pos' : 'neg'}">${p.return_pct >= 0 ? '+' : ''}${(p.return_pct * 100).toFixed(1)}%</div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>
</div>

<div class="footer-meta">${isLevin ? 'research.levincap.com' : 'stockpitch.app'}</div>
<div class="cta">Follow →</div>

</body>
</html>`;
}
