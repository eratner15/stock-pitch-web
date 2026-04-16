import { escapeHtml } from '../lib/security';

export interface PortalRow {
  ticker: string;
  company: string | null;
  sector: string | null;
  direction: string | null;
  rating: string | null;
  price_at_generation: number | null;
  price_target: number | null;
  upside_pct: number | null;
  confidence_index: number;
  summary: string | null;
  generated_at: string;
}

export interface BookSummary {
  book: 'long' | 'short';
  positions: Array<{
    ticker: string;
    weight_pct: number;
    confidence_index: number;
    price_target: number | null;
  }>;
}

export function renderLibrary(
  brand: 'stockpitch' | 'levincap',
  portals: PortalRow[],
  longBook: BookSummary | null,
  shortBook: BookSummary | null,
): string {
  const isLevin = brand === 'levincap';

  const portalCards = portals.map(p => {
    const conf = Math.round(p.confidence_index);
    const confColor = conf >= 70 ? 'var(--bull)' : conf >= 40 ? 'var(--gold)' : 'var(--bear)';
    const dir = p.direction === 'short' ? 'SHORT' : 'LONG';
    const upside = p.upside_pct != null ? `${p.upside_pct > 0 ? '+' : ''}${(p.upside_pct * 100).toFixed(0)}%` : '';
    return `<a href="/${escapeHtml(p.ticker)}/memo" class="portal-card">
      <div class="pc-top">
        <div class="pc-ticker">${escapeHtml(p.ticker)}</div>
        <div class="pc-conf" style="color:${confColor}">${conf}</div>
      </div>
      <div class="pc-company">${escapeHtml(p.company || '')}</div>
      <div class="pc-summary">${escapeHtml(p.summary || '')}</div>
      <div class="pc-foot">
        <span class="pc-dir ${p.direction === 'short' ? 'short' : 'long'}">${dir}</span>
        <span class="pc-rating">${escapeHtml(p.rating || '')}</span>
        ${upside ? `<span class="pc-upside">${upside}</span>` : ''}
        ${p.sector ? `<span class="pc-sector">${escapeHtml(p.sector)}</span>` : ''}
      </div>
    </a>`;
  }).join('');

  const renderBook = (book: BookSummary | null, label: string) => {
    if (!book || book.positions.length === 0) return `<div class="book-empty">${label}: No positions yet</div>`;
    const bars = book.positions.map(p => `
      <div class="bk-row">
        <span class="bk-ticker">${escapeHtml(p.ticker)}</span>
        <div class="bk-bar-wrap">
          <div class="bk-bar" style="width:${Math.min(p.weight_pct * 100, 100).toFixed(1)}%"></div>
        </div>
        <span class="bk-wt">${(p.weight_pct * 100).toFixed(1)}%</span>
      </div>
    `).join('');
    return `<div class="book">
      <div class="book-label">${label}</div>
      ${bars}
    </div>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Research Library — ${isLevin ? 'Levin Capital' : 'Stock Pitch'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Fraunces:ital,wght@0,500;0,700;1,500&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --paper:${isLevin ? '#FAF7F0' : '#F4EEE1'};
  --paper-warm:${isLevin ? '#F5EFE0' : '#EBE2D0'};
  --ink:${isLevin ? '#1A1510' : '#1A1814'};
  --ink-60:${isLevin ? '#5A5043' : '#4E463D'};
  --ink-40:${isLevin ? '#8A7E6F' : '#7E7468'};
  --accent:${isLevin ? '#1A4D3E' : '#B7141F'};
  --gold:#B8973E;
  --bull:#1B5631;
  --bear:#8E1218;
  --border:${isLevin ? '#D4CFC3' : '#B9AE9C'};
  --display:${isLevin ? "'Fraunces','Source Serif 4',Georgia,serif" : "'Abril Fatface',Georgia,serif"};
  --body:${isLevin ? "'Source Serif 4','Lora',Georgia,serif" : "'Lora',Georgia,serif"};
  --mono:'IBM Plex Mono',ui-monospace,monospace;
}
html{background:var(--paper)}
body{font-family:var(--body);background:var(--paper);color:var(--ink);font-size:17px;line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:1000px;margin:0 auto;padding:0 28px}

.masthead{padding:18px 0 16px;border-bottom:1px solid var(--ink)}
.masthead .wrap{display:flex;justify-content:space-between;align-items:center;gap:16px}
.mh-brand{font-family:var(--display);font-size:${isLevin ? '22px' : '26px'};line-height:1;color:var(--ink);${isLevin ? 'font-weight:700;letter-spacing:0.02em;text-transform:uppercase' : ''}}
${!isLevin ? '.mh-brand .dot{width:10px;height:10px;border-radius:50%;background:var(--accent);display:inline-block;transform:translateY(-3px);margin-right:6px}' : ''}
.mh-nav{display:flex;gap:22px;font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase}
.mh-nav a{color:var(--ink-60);transition:color 0.15s}
.mh-nav a:hover{color:var(--accent)}

.hero{padding:48px 0 40px;text-align:center;border-bottom:1px dotted var(--border)}
.hero h1{font-family:var(--display);font-size:clamp(36px,6vw,56px);line-height:1;letter-spacing:-0.02em;margin-bottom:10px}
.hero h1 em{color:var(--accent);font-style:italic}
.hero-sub{font-family:var(--body);font-style:italic;font-size:18px;color:var(--ink-60)}

.books-section{padding:32px 0;border-bottom:1px dotted var(--border)}
.books-row{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.book{padding:20px;background:var(--paper-warm);border:1px solid var(--border)}
.book-label{font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--ink-60);margin-bottom:14px}
.book-empty{font-family:var(--body);font-style:italic;color:var(--ink-40);font-size:15px;padding:20px}
.bk-row{display:flex;align-items:center;gap:10px;padding:6px 0}
.bk-ticker{font-family:var(--mono);font-size:13px;font-weight:700;min-width:50px;letter-spacing:1px}
.bk-bar-wrap{flex:1;height:18px;background:var(--paper);border:1px solid var(--border);overflow:hidden}
.bk-bar{height:100%;background:var(--accent);opacity:0.7;transition:width 0.3s}
.bk-wt{font-family:var(--mono);font-size:12px;color:var(--ink-60);min-width:45px;text-align:right}

.grid-section{padding:32px 0}
.grid-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px}
.grid-hed{font-family:var(--display);font-size:28px;line-height:1}
.grid-hed em{color:var(--accent);font-style:italic}
.grid-count{font-family:var(--mono);font-size:12px;color:var(--ink-40);letter-spacing:2px}
.portal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.portal-card{
  background:var(--paper-warm);border:1px solid var(--ink);padding:20px;
  display:block;transition:transform 0.12s,box-shadow 0.12s;
}
.portal-card:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--ink)}
.pc-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px}
.pc-ticker{font-family:var(--display);font-size:28px;line-height:1;color:var(--ink)}
.pc-conf{font-family:var(--mono);font-size:20px;font-weight:700}
.pc-company{font-family:var(--body);font-style:italic;font-size:14px;color:var(--ink-60);margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-summary{font-family:var(--body);font-size:14.5px;line-height:1.5;color:var(--ink);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:14px}
.pc-foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-top:10px;border-top:1px dotted var(--border);font-family:var(--mono);font-size:11px;letter-spacing:1px}
.pc-dir{font-weight:700;text-transform:uppercase;padding:3px 8px;border:1px solid}
.pc-dir.long{color:var(--bull);border-color:var(--bull)}
.pc-dir.short{color:var(--bear);border-color:var(--bear)}
.pc-rating{font-weight:700;color:var(--ink-60);text-transform:uppercase}
.pc-upside{color:var(--bull);font-weight:700}
.pc-sector{color:var(--ink-40)}

footer{margin-top:40px;padding:22px 0 36px;border-top:1px solid var(--ink);
  font-family:var(--mono);font-size:11px;letter-spacing:2px;color:var(--ink-40);text-transform:uppercase}
footer .wrap{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}

@media(max-width:720px){
  .wrap{padding:0 20px}
  .hero{padding:32px 0 28px}
  .hero h1{font-size:32px}
  .books-row{grid-template-columns:1fr}
  .portal-grid{grid-template-columns:1fr}
  .mh-brand{font-size:20px}
  .mh-nav{gap:14px;font-size:10px}
  footer .wrap{flex-direction:column;text-align:center}
}
</style>
</head>
<body>

<header class="masthead">
  <div class="wrap">
    <a href="/" class="mh-brand">${isLevin ? 'Levin Capital <em style="font-style:italic;font-weight:500">Research</em>' : '<span class="dot"></span>Stock Pitch'}</a>
    <nav class="mh-nav">
      <a href="/">Home</a>
      <a href="/library">Library</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="wrap">
    <h1>${isLevin ? 'The Research <em>Desk</em>' : 'Research <em>Library</em>'}</h1>
    <p class="hero-sub">Every AI-generated portal, ranked by confidence. The desk never sleeps.</p>
  </div>
</section>

${(longBook && longBook.positions.length > 0) || (shortBook && shortBook.positions.length > 0) ? `
<section class="books-section">
  <div class="wrap">
    <div class="books-row">
      ${renderBook(longBook, 'Long Book')}
      ${renderBook(shortBook, 'Short Book')}
    </div>
  </div>
</section>
` : ''}

<section class="grid-section">
  <div class="wrap">
    <div class="grid-head">
      <h2 class="grid-hed">${isLevin ? '<em>Generated</em> Portals' : 'All <em>Research</em>'}</h2>
      <div class="grid-count">${portals.length} portals</div>
    </div>
    ${portals.length === 0 ? `
      <div style="text-align:center;padding:60px 20px;font-family:var(--body);font-style:italic;color:var(--ink-60);font-size:18px">
        No research yet. <a href="/" style="color:var(--accent);border-bottom:1px solid var(--accent)">Generate your first portal</a>.
      </div>
    ` : `
      <div class="portal-grid">
        ${portalCards}
      </div>
    `}
  </div>
</section>

<footer>
  <div class="wrap">
    <div>© ${new Date().getFullYear()} ${isLevin ? 'Levin Capital Research' : 'Stock Pitch'} · <a href="/">Home</a></div>
    <div style="font-family:var(--body);font-style:italic;text-transform:none;letter-spacing:0;font-size:12px">Nothing here is investment advice.</div>
  </div>
</footer>

</body>
</html>`;
}
