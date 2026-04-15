/**
 * Tiny SVG line chart renderer. Inline output — no external JS, no images.
 * Used for portfolio NAV history on the portfolio detail page and share card.
 */

interface ChartPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

interface ChartOptions {
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  bgColor?: string;
  gridColor?: string;
  textColor?: string;
  showAxis?: boolean;
  showGrid?: boolean;
  padding?: { top: number; right: number; bottom: number; left: number };
}

export function renderNavChart(points: ChartPoint[], opts: ChartOptions = {}): string {
  const w = opts.width ?? 720;
  const h = opts.height ?? 260;
  const color = opts.color ?? '#2EBD6B';
  const fillColor = opts.fillColor ?? 'rgba(46,189,107,0.08)';
  const bgColor = opts.bgColor ?? 'transparent';
  const gridColor = opts.gridColor ?? 'rgba(128,128,128,0.15)';
  const textColor = opts.textColor ?? '#5A6074';
  const showAxis = opts.showAxis ?? true;
  const showGrid = opts.showGrid ?? true;
  const pad = opts.padding ?? { top: 16, right: 16, bottom: 28, left: 56 };

  if (points.length === 0) {
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="background:${bgColor}">
      <text x="${w / 2}" y="${h / 2}" text-anchor="middle" fill="${textColor}"
            font-family="Inter,sans-serif" font-size="13">
        NAV history will appear here after the first snapshot
      </text>
    </svg>`;
  }

  // If only 1 point, give it width so the chart isn't degenerate
  const extended = points.length === 1 ? [points[0], points[0]] : points;

  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const values = extended.map(p => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  // Add 2% padding to y-axis for visual breathing room
  const rangeV = Math.max(1, maxV - minV);
  const yMin = minV - rangeV * 0.05;
  const yMax = maxV + rangeV * 0.05;

  const xStep = extended.length > 1 ? innerW / (extended.length - 1) : 0;
  const pts = extended.map((p, i) => {
    const x = pad.left + i * xStep;
    const y = pad.top + (1 - (p.value - yMin) / (yMax - yMin)) * innerH;
    return { x, y, value: p.value, date: p.date };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const fillPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} Z`;

  // Horizontal gridlines (5)
  let gridEls = '';
  if (showGrid) {
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (innerH / 4) * i;
      gridEls += `<line x1="${pad.left}" y1="${y}" x2="${pad.left + innerW}" y2="${y}" stroke="${gridColor}" stroke-width="1"/>`;
    }
  }

  // Y-axis labels (3)
  let yLabels = '';
  if (showAxis) {
    for (let i = 0; i <= 2; i++) {
      const t = i / 2;
      const val = yMax - t * (yMax - yMin);
      const y = pad.top + t * innerH;
      yLabels += `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" fill="${textColor}" font-family="Inter,sans-serif" font-size="10" font-weight="500">$${Math.round(val).toLocaleString()}</text>`;
    }
  }

  // X-axis labels: first + last date
  let xLabels = '';
  if (showAxis && extended.length >= 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    xLabels += `<text x="${first.x}" y="${pad.top + innerH + 18}" text-anchor="start" fill="${textColor}" font-family="Inter,sans-serif" font-size="10">${formatDate(extended[0].date)}</text>`;
    xLabels += `<text x="${last.x}" y="${pad.top + innerH + 18}" text-anchor="end" fill="${textColor}" font-family="Inter,sans-serif" font-size="10">${formatDate(extended[extended.length - 1].date)}</text>`;
  }

  // Current value marker (rightmost point)
  const lastPt = pts[pts.length - 1];
  const markerEls = `
    <circle cx="${lastPt.x.toFixed(1)}" cy="${lastPt.y.toFixed(1)}" r="5" fill="${color}" stroke="#fff" stroke-width="2"/>
  `;

  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="background:${bgColor};overflow:visible" xmlns="http://www.w3.org/2000/svg">
    ${gridEls}
    <path d="${fillPath}" fill="${fillColor}" stroke="none"/>
    <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${markerEls}
    ${yLabels}
    ${xLabels}
  </svg>`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
