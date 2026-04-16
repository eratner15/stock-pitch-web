/**
 * Inline SVG chart helpers — no external libs. Used by portal pages.
 * Stock-pitch portals get three signature charts that the hand-crafted
 * /amzn/ gold standard doesn't have:
 *   1. Revenue trend (historical + projected, grouped bars)
 *   2. EPS trend (line)
 *   3. 1-year price chart (area)
 * Inline SVG means instant render, no JS, print-friendly.
 */

export interface RevenueRow {
  year: string;
  revenue: string;           // "$X.XB" pre-normalized
  operatingIncome?: string;
  eps?: string;
  ebitdaMargin?: string;
}

export interface PricePoint {
  t: number;                 // unix ms
  c: number;                 // close
}

// --------------------------------------------------------------------------
// Parse "$12.3B", "$462M", "12.4%", "$1.21", "n.d." into a number or null
// --------------------------------------------------------------------------
export function parseDollarValue(s: string | undefined): number | null {
  if (!s) return null;
  const str = String(s).trim().toLowerCase().replace(/[, $]/g, '');
  if (str === 'n.d.' || str === '—' || str === '') return null;
  const m = str.match(/^(-?[0-9]*\.?[0-9]+)\s*([kmbt])?%?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || '').toLowerCase();
  if (unit === 't') return n * 1e12;
  if (unit === 'b') return n * 1e9;
  if (unit === 'm') return n * 1e6;
  if (unit === 'k') return n * 1e3;
  return n;
}

function fmtAxis(n: number): string {
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

// --------------------------------------------------------------------------
// Revenue trend chart — grouped bars, historical + projected side-by-side
// --------------------------------------------------------------------------
export function renderRevenueChart(
  historical: RevenueRow[],
  projected: RevenueRow[],
): string {
  const allRows = [...historical, ...projected];
  const values = allRows
    .map(r => ({ year: r.year, v: parseDollarValue(r.revenue), projected: projected.some(p => p.year === r.year) }))
    .filter(r => r.v != null) as Array<{ year: string; v: number; projected: boolean }>;
  if (values.length < 2) return '';

  const W = 680, H = 240, pad = { t: 20, r: 20, b: 34, l: 54 };
  const maxV = Math.max(...values.map(v => v.v));
  const scaleY = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / maxV);
  const barWidth = (W - pad.l - pad.r) / values.length * 0.7;
  const slot = (W - pad.l - pad.r) / values.length;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => maxV * f);

  const bars = values.map((v, i) => {
    const x = pad.l + i * slot + (slot - barWidth) / 2;
    const y = scaleY(v.v);
    const height = H - pad.b - y;
    const fill = v.projected ? 'var(--gold)' : 'var(--navy)';
    const opacity = v.projected ? '0.7' : '1';
    return `<g>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${height.toFixed(1)}" fill="${fill}" opacity="${opacity}" rx="2"/>
      <text x="${(x + barWidth / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="var(--heading)">${fmtAxis(v.v)}</text>
      <text x="${(x + barWidth / 2).toFixed(1)}" y="${(H - pad.b + 16).toFixed(1)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" fill="var(--text-muted)">${v.year}</text>
    </g>`;
  }).join('');

  const axis = yTicks.slice(1).map(t => {
    const y = scaleY(t);
    return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border-light)" stroke-width="1"/>
    <text x="${pad.l - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="Inter,sans-serif" font-size="10" fill="var(--text-muted)">${fmtAxis(t)}</text>`;
  }).join('');

  return `<figure class="portal-chart">
    <figcaption>Revenue trend — historical (navy) + projected (gold)</figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue trend chart" style="width:100%;height:auto;max-width:${W}px;display:block">
      ${axis}
      <line x1="${pad.l}" x2="${W - pad.r}" y1="${H - pad.b}" y2="${H - pad.b}" stroke="var(--border)" stroke-width="1"/>
      ${bars}
    </svg>
  </figure>`;
}

// --------------------------------------------------------------------------
// EPS trend — line
// --------------------------------------------------------------------------
export function renderEpsChart(
  historical: RevenueRow[],
  projected: RevenueRow[],
): string {
  const allRows = [...historical, ...projected];
  const values = allRows
    .map(r => ({ year: r.year, v: parseDollarValue(r.eps), projected: projected.some(p => p.year === r.year) }))
    .filter(r => r.v != null) as Array<{ year: string; v: number; projected: boolean }>;
  if (values.length < 2) return '';

  const W = 680, H = 220, pad = { t: 16, r: 20, b: 34, l: 44 };
  const minV = Math.min(0, ...values.map(v => v.v));
  const maxV = Math.max(...values.map(v => v.v));
  const range = maxV - minV || 1;
  const scaleY = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - minV) / range);
  const scaleX = (i: number) => pad.l + i * ((W - pad.l - pad.r) / (values.length - 1));

  const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleY(v.v).toFixed(1)}`).join(' ');
  const points = values.map((v, i) => {
    const fill = v.projected ? 'var(--gold)' : 'var(--navy)';
    return `<circle cx="${scaleX(i).toFixed(1)}" cy="${scaleY(v.v).toFixed(1)}" r="5" fill="${fill}" stroke="#fff" stroke-width="2"/>
    <text x="${scaleX(i).toFixed(1)}" y="${(scaleY(v.v) - 12).toFixed(1)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="var(--heading)">$${v.v.toFixed(2)}</text>
    <text x="${scaleX(i).toFixed(1)}" y="${(H - pad.b + 16).toFixed(1)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" fill="var(--text-muted)">${v.year}</text>`;
  }).join('');

  return `<figure class="portal-chart">
    <figcaption>EPS trend</figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="EPS trend chart" style="width:100%;height:auto;max-width:${W}px;display:block">
      <line x1="${pad.l}" x2="${W - pad.r}" y1="${H - pad.b}" y2="${H - pad.b}" stroke="var(--border)" stroke-width="1"/>
      <path d="${linePath}" fill="none" stroke="var(--navy)" stroke-width="2"/>
      ${points}
    </svg>
  </figure>`;
}

// --------------------------------------------------------------------------
// 1-year stock price chart — area
// --------------------------------------------------------------------------
export function renderPriceChart(
  points: PricePoint[],
  priceTarget: number | null = null,
): string {
  if (points.length < 5) return '';
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const W = 680, H = 220, pad = { t: 20, r: 48, b: 30, l: 48 };
  const minT = sorted[0].t;
  const maxT = sorted[sorted.length - 1].t;
  const closes = sorted.map(p => p.c).concat(priceTarget != null && priceTarget > 0 ? [priceTarget] : []);
  const minC = Math.min(...closes) * 0.95;
  const maxC = Math.max(...closes) * 1.05;
  const scaleX = (t: number) => pad.l + ((t - minT) / (maxT - minT)) * (W - pad.l - pad.r);
  const scaleY = (c: number) => pad.t + (1 - (c - minC) / (maxC - minC)) * (H - pad.t - pad.b);

  const pathPoints = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.t).toFixed(1)} ${scaleY(p.c).toFixed(1)}`).join(' ');
  const areaPath = `${pathPoints} L ${scaleX(maxT).toFixed(1)} ${(H - pad.b).toFixed(1)} L ${scaleX(minT).toFixed(1)} ${(H - pad.b).toFixed(1)} Z`;
  const lastPrice = sorted[sorted.length - 1].c;

  const ptMarker = priceTarget != null && priceTarget > 0
    ? `<line x1="${pad.l}" x2="${W - pad.r}" y1="${scaleY(priceTarget).toFixed(1)}" y2="${scaleY(priceTarget).toFixed(1)}" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="4 4"/>
       <text x="${(W - pad.r + 4).toFixed(1)}" y="${(scaleY(priceTarget) + 3).toFixed(1)}" font-family="Inter,sans-serif" font-size="11" font-weight="700" fill="var(--gold-deep)">PT $${priceTarget.toFixed(0)}</text>`
    : '';

  // Sample dates to show along x-axis
  const ticks = [0, 0.5, 1].map(f => sorted[Math.floor((sorted.length - 1) * f)]);

  return `<figure class="portal-chart">
    <figcaption>1-year price · last close ${fmtAxis(lastPrice)}</figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="1-year stock price chart" style="width:100%;height:auto;max-width:${W}px;display:block">
      <defs><linearGradient id="priceAreaFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--navy)" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="var(--navy)" stop-opacity="0"/>
      </linearGradient></defs>
      <line x1="${pad.l}" x2="${W - pad.r}" y1="${H - pad.b}" y2="${H - pad.b}" stroke="var(--border)" stroke-width="1"/>
      <line x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t}" y2="${pad.t}" stroke="var(--border-light)" stroke-width="1"/>
      <path d="${areaPath}" fill="url(#priceAreaFill)"/>
      <path d="${pathPoints}" fill="none" stroke="var(--navy)" stroke-width="1.8"/>
      <circle cx="${scaleX(maxT).toFixed(1)}" cy="${scaleY(lastPrice).toFixed(1)}" r="4" fill="var(--navy)"/>
      <text x="${(scaleX(maxT) - 6).toFixed(1)}" y="${(scaleY(lastPrice) - 8).toFixed(1)}" text-anchor="end" font-family="Inter,sans-serif" font-size="11" font-weight="700" fill="var(--heading)">$${lastPrice.toFixed(2)}</text>
      ${ptMarker}
      <text x="${pad.l}" y="${(H - pad.b + 16).toFixed(1)}" text-anchor="start" font-family="Inter,sans-serif" font-size="10" fill="var(--text-muted)">${new Date(ticks[0].t).toISOString().slice(0,10)}</text>
      <text x="${((W - pad.r + pad.l) / 2).toFixed(1)}" y="${(H - pad.b + 16).toFixed(1)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" fill="var(--text-muted)">${new Date(ticks[1].t).toISOString().slice(0,10)}</text>
      <text x="${(W - pad.r).toFixed(1)}" y="${(H - pad.b + 16).toFixed(1)}" text-anchor="end" font-family="Inter,sans-serif" font-size="10" fill="var(--text-muted)">${new Date(ticks[2].t).toISOString().slice(0,10)}</text>
    </svg>
  </figure>`;
}
