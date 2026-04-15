/**
 * Share card HTML — rendered at a URL, then screenshotted to PNG via
 * Cloudflare Browser Rendering for OG images.
 *
 * Size: 1200x630 (Twitter/LinkedIn standard)
 */

interface ShareCardInput {
  ticker: string;
  company: string | null;
  direction: 'long' | 'short';
  rating: string;
  entry_price: number;
  current_price: number | null;
  price_target: number;
  return_pct: number;
  display_name: string;
  brand: 'stockpitch' | 'levincap';
}

export function renderShareCardHTML(input: ShareCardInput): string {
  const isLevin = input.brand === 'levincap';
  const accent = isLevin ? '#B8973E' : '#2EBD6B';
  const bg = isLevin ? '#FAF7F0' : '#0A0F1F';
  const ink = isLevin ? '#0A0A0A' : '#FFFFFF';
  const inkSoft = isLevin ? 'rgba(10,10,10,0.55)' : 'rgba(255,255,255,0.55)';
  const border = isLevin ? 'rgba(10,10,10,0.12)' : 'rgba(255,255,255,0.12)';
  const displayFont = isLevin ? "'Playfair Display',Georgia,serif" : "'Inter',system-ui,sans-serif";

  const dirSymbol = input.direction === 'long' ? '↑' : '↓';
  const dirColor = input.direction === 'long' ? '#2EBD6B' : '#E04759';
  const implied = input.direction === 'long'
    ? ((input.price_target - input.entry_price) / input.entry_price) * 100
    : ((input.entry_price - input.price_target) / input.entry_price) * 100;
  const returnPct = input.return_pct != null ? (input.return_pct * 100).toFixed(1) : null;
  const returnColor = (input.return_pct ?? 0) >= 0 ? '#2EBD6B' : '#E04759';

  const brandMark = isLevin
    ? '<span style="font-family:\'Playfair Display\',serif;font-weight:900">Levin Capital <em style="font-weight:400;font-style:italic">Research</em></span>'
    : '<span style="font-family:\'JetBrains Mono\',monospace;font-weight:700"><span style="color:' + accent + '">●</span> Stock Pitch</span>';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Share card</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,900;1,400&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{margin:0;padding:0}
body{
  width:1200px;height:630px;
  background:${bg};color:${ink};
  font-family:'Inter',sans-serif;
  padding:64px;
  position:relative;
  overflow:hidden;
}

.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:40px;font-size:18px;color:${inkSoft}}
.top .brand{font-size:22px;color:${ink}}

.ticker-row{display:flex;align-items:flex-start;gap:40px;margin-bottom:40px}
.ticker-col{flex:1;min-width:0}
.ticker-num{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:120px;color:${ink};letter-spacing:-2px;line-height:0.9;margin-bottom:8px}
.company{font-family:${displayFont};font-weight:${isLevin ? '400;font-style:italic' : '500'};font-size:26px;color:${inkSoft};margin-bottom:6px}
.badges{display:flex;gap:10px;margin-top:18px}
.badge{padding:8px 16px;font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border-radius:${isLevin ? '0' : '99px'}}
.badge.dir{background:${input.direction === 'long' ? 'rgba(46,189,107,0.15)' : 'rgba(224,71,89,0.15)'};color:${dirColor}}
.badge.rating{background:${isLevin ? 'rgba(184,151,62,0.15)' : 'rgba(255,255,255,0.08)'};color:${isLevin ? accent : ink};border:1px solid ${border}}

.return-col{text-align:right;min-width:280px}
${returnPct !== null ? `
.return-big{font-family:${displayFont};font-weight:900;font-size:108px;color:${returnColor};letter-spacing:-0.02em;line-height:0.92}
.return-label{font-size:16px;color:${inkSoft};letter-spacing:3px;text-transform:uppercase;font-weight:600;margin-top:6px}
` : `
.target-big{font-family:${displayFont};font-weight:900;font-size:84px;color:${accent};letter-spacing:-0.02em;line-height:0.92}
.target-label{font-size:16px;color:${inkSoft};letter-spacing:3px;text-transform:uppercase;font-weight:600;margin-top:6px}
`}

.prices{display:flex;gap:40px;padding:28px 32px;background:${isLevin ? 'rgba(10,10,10,0.04)' : 'rgba(255,255,255,0.04)'};border:1px solid ${border};margin-bottom:32px}
.prices .stat{flex:1}
.prices .stat .l{font-size:14px;color:${inkSoft};letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-bottom:8px}
.prices .stat .v{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:40px;color:${ink};letter-spacing:-0.01em;line-height:1}
.prices .stat .v.implied{color:${accent}}

.analyst{display:flex;align-items:center;gap:20px;padding-top:28px;border-top:1px solid ${border}}
.avatar{width:64px;height:64px;border-radius:50%;background:${accent};color:${isLevin ? ink : '#07122B'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:24px;font-family:'Inter',sans-serif}
.analyst-info{flex:1}
.analyst-name{font-family:${displayFont};font-weight:${isLevin ? '700' : '700'};font-size:26px;color:${ink};line-height:1.1}
.analyst-meta{font-size:15px;color:${inkSoft};margin-top:4px;letter-spacing:0.5px}
.cta{padding:16px 28px;background:${accent};color:${isLevin ? ink : '#07122B'};font-weight:700;font-size:16px;letter-spacing:1px;text-transform:uppercase}
</style>
</head>
<body>

<div class="top">
  <div class="brand">${brandMark}</div>
  <div>${isLevin ? 'Levin Capital Research' : 'stockpitch.app'}</div>
</div>

<div class="ticker-row">
  <div class="ticker-col">
    <div class="ticker-num">${input.ticker}</div>
    ${input.company ? `<div class="company">${input.company}</div>` : ''}
    <div class="badges">
      <span class="badge dir">${dirSymbol} ${input.direction}</span>
      <span class="badge rating">${input.rating}</span>
    </div>
  </div>
  <div class="return-col">
    ${returnPct !== null ? `
      <div class="return-big">${(input.return_pct >= 0 ? '+' : '') + returnPct}%</div>
      <div class="return-label">Return since entry</div>
    ` : `
      <div class="target-big">${implied >= 0 ? '+' : ''}${implied.toFixed(0)}%</div>
      <div class="target-label">Implied return</div>
    `}
  </div>
</div>

<div class="prices">
  <div class="stat">
    <div class="l">Entry</div>
    <div class="v">$${input.entry_price.toFixed(2)}</div>
  </div>
  ${input.current_price != null ? `
  <div class="stat">
    <div class="l">Current</div>
    <div class="v">$${input.current_price.toFixed(2)}</div>
  </div>
  ` : ''}
  <div class="stat">
    <div class="l">Target</div>
    <div class="v implied">$${input.price_target.toFixed(2)}</div>
  </div>
</div>

<div class="analyst">
  <div class="avatar">${initials(input.display_name)}</div>
  <div class="analyst-info">
    <div class="analyst-name">${input.display_name}</div>
    <div class="analyst-meta">Call tracked live on ${isLevin ? 'research.levincap.com' : 'stockpitch.app'}</div>
  </div>
  <div class="cta">Pitch yours →</div>
</div>

</body>
</html>`;
}

function initials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
