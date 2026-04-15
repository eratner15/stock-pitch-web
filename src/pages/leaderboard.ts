import type { PriceQuote } from '../lib/prices';

export interface LeaderboardRow {
  rank: number;
  user_display: string;
  user_initials: string;
  ticker: string;
  company: string | null;
  direction: 'long' | 'short';
  rating: string;
  entry_price: number;
  current_price: number;
  return_pct: number;
  annualized_pct: number;
  price_target: number;
  days_held: number;
  thesis_preview: string;
  call_id: string;
}

export function renderLeaderboard(rows: LeaderboardRow[], brand: 'stockpitch' | 'levincap'): string {
  const isLevin = brand === 'levincap';
  const accentColor = isLevin ? '#B8973E' : '#2EBD6B';
  const bg = isLevin ? '#FAF7F0' : '#FFFFFF';
  const ink = isLevin ? '#0A0A0A' : '#0A0F1F';
  const displaySerif = isLevin ? "'Playfair Display',Georgia,serif" : 'inherit';
  const bodyFont = isLevin ? "'Cormorant Garamond',Georgia,serif" : "'Inter',system-ui,sans-serif";
  const brandMark = isLevin ? 'Levin Capital <em>Research</em>' : 'Stock Pitch';

  const topRows = rows.slice(0, 3);
  const restRows = rows.slice(3);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${isLevin ? 'Leaderboard · Levin Capital Research' : 'Leaderboard · Stock Pitch'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:${bg};
  --bg-2:${isLevin ? '#F3EEE1' : '#F5F6F8'};
  --ink:${ink};
  --ink-60:${isLevin ? '#5A5651' : '#5A6074'};
  --ink-40:${isLevin ? '#85817A' : '#8B90A0'};
  --ink-20:${isLevin ? '#C5BFB2' : '#D9DBE3'};
  --border:${isLevin ? '#D4CFC3' : '#E2E4EA'};
  --accent:${accentColor};
  --green:#1A7A3A;
  --red:#C0392B;
}
body{font-family:${bodyFont};background:var(--bg);color:var(--ink);line-height:1.55;-webkit-font-smoothing:antialiased;font-size:${isLevin ? '17' : '15'}px}
a{color:inherit;text-decoration:none}
.wrap{max-width:1180px;margin:0 auto;padding:0 32px}

/* NAV */
nav{position:sticky;top:0;z-index:50;padding:14px 0;background:${isLevin ? 'rgba(250,247,240,0.92)' : 'rgba(255,255,255,0.88)'};backdrop-filter:blur(14px);border-bottom:${isLevin ? '3px double var(--ink)' : '1px solid var(--border)'}}
nav .wrap{display:flex;justify-content:space-between;align-items:center}
.brand{font-family:${isLevin ? displaySerif : "'JetBrains Mono',monospace"};font-weight:${isLevin ? '900' : '700'};font-size:${isLevin ? '22px' : '15px'};color:var(--ink);letter-spacing:${isLevin ? '-0.01em' : 'normal'}}
.brand em{font-weight:${isLevin ? '400' : '500'};font-style:italic}
.nav-links{display:flex;gap:24px;font-family:'Inter',sans-serif}
.nav-links a{font-size:12px;color:var(--ink-60);font-weight:500;letter-spacing:${isLevin ? '2px;text-transform:uppercase' : 'normal'}}
.nav-links a.active{color:var(--ink);font-weight:700}
.cta{padding:${isLevin ? '10px 20px' : '8px 18px'};background:var(--ink);color:${bg};font-size:${isLevin ? '11px' : '13px'};font-weight:${isLevin ? '800;letter-spacing:2px;text-transform:uppercase' : '600'};font-family:'Inter',sans-serif;border-radius:${isLevin ? '0' : '6px'}}

/* HERO */
.hero{padding:72px 0 48px;text-align:center;background:linear-gradient(180deg,var(--bg) 0%,var(--bg-2) 100%);border-bottom:1px solid var(--border)}
.hero-kicker{font-family:${isLevin ? "'Inter',sans-serif" : "'JetBrains Mono',monospace"};font-size:${isLevin ? '10px' : '11px'};letter-spacing:${isLevin ? '5px' : '2px'};text-transform:uppercase;color:var(--accent);font-weight:${isLevin ? '800' : '600'};margin-bottom:18px}
.hero h1{font-family:${displaySerif};font-weight:${isLevin ? '900' : '800'};font-size:${isLevin ? '64px' : '52px'};color:var(--ink);letter-spacing:-0.03em;line-height:1;margin-bottom:16px}
.hero h1 em{font-style:italic;font-weight:${isLevin ? '400' : '500'};color:var(--accent)}
.hero-deck{font-family:${bodyFont};font-size:${isLevin ? '20px' : '17px'};color:var(--ink-60);max-width:640px;margin:0 auto;font-style:${isLevin ? 'italic' : 'normal'}}

/* PODIUM */
.podium{padding:64px 0 32px}
.podium-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:920px;margin:0 auto}
.podium-card{background:var(--bg);border:1px solid var(--border);border-top:3px solid var(--accent);padding:28px 24px;text-align:center;position:relative}
.podium-card.p1{transform:translateY(-16px);border-top-width:4px}
.rank{position:absolute;top:-12px;left:50%;transform:translateX(-50%);width:32px;height:32px;background:var(--ink);color:var(--bg);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:14px}
.podium-card.p1 .rank{background:var(--accent);color:${isLevin ? 'var(--ink)' : '#fff'}}
.avatar{width:56px;height:56px;border-radius:50%;background:var(--accent);color:${isLevin ? 'var(--ink)' : '#fff'};display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;font-weight:700;font-size:18px;margin:8px auto 12px}
.user-name{font-family:${displaySerif};font-size:${isLevin ? '20px' : '17px'};font-weight:${isLevin ? '700' : '700'};color:var(--ink);margin-bottom:4px}
.ticker-line{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--ink-60);letter-spacing:1px;margin-bottom:12px}
.ticker-line strong{color:var(--accent);font-weight:700}
.return-big{font-family:${displaySerif};font-weight:900;font-size:${isLevin ? '48px' : '40px'};color:var(--green);letter-spacing:-0.02em;line-height:1}
.return-big.neg{color:var(--red)}
.return-label{font-family:'Inter',sans-serif;font-size:10px;letter-spacing:1.5px;color:var(--ink-40);text-transform:uppercase;font-weight:600;margin-top:4px}

/* TABLE */
.leaderboard-section{padding:48px 0 96px}
.section-title{font-family:${displaySerif};font-weight:${isLevin ? '900' : '800'};font-size:${isLevin ? '32px' : '26px'};color:var(--ink);margin-bottom:8px;letter-spacing:-0.01em}
.section-sub{font-family:${bodyFont};color:var(--ink-60);font-size:${isLevin ? '16px' : '14px'};margin-bottom:32px;${isLevin ? 'font-style:italic' : ''}}
.lb-table{width:100%;border-collapse:collapse;font-family:'Inter',sans-serif;font-size:13px}
.lb-table th{text-align:left;padding:14px 12px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-60);font-weight:700;border-bottom:2px solid var(--ink)}
.lb-table th.right{text-align:right}
.lb-table th.center{text-align:center}
.lb-table td{padding:18px 12px;border-bottom:1px solid var(--border);vertical-align:middle}
.lb-table td.right{text-align:right;font-family:'JetBrains Mono',monospace;font-weight:600}
.lb-table td.center{text-align:center}
.lb-table tr:hover{background:var(--bg-2)}
.rank-cell{width:40px;font-family:${displaySerif};font-weight:${isLevin ? '900' : '800'};font-size:22px;color:var(--ink-40)}
.user-cell{display:flex;align-items:center;gap:10px}
.user-cell .avatar-sm{width:32px;height:32px;border-radius:50%;background:var(--accent);color:${isLevin ? 'var(--ink)' : '#fff'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.user-cell .name{font-weight:600;color:var(--ink)}
.ticker-cell{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:14px;color:var(--ink)}
.ticker-cell .co{font-family:${bodyFont};font-weight:400;font-size:12px;color:var(--ink-60);letter-spacing:normal;text-transform:none;${isLevin ? 'font-style:italic' : ''};margin-top:2px}
.direction-pill{display:inline-block;padding:3px 8px;border-radius:${isLevin ? '0' : '4px'};font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
.direction-pill.long{background:rgba(26,122,58,0.12);color:var(--green)}
.direction-pill.short{background:rgba(192,57,43,0.12);color:var(--red)}
.return-cell{font-weight:700;font-size:15px}
.return-cell.pos{color:var(--green)}
.return-cell.neg{color:var(--red)}

/* Mobile card stack — hidden on desktop */
.mobile-cards{display:none}
.lb-card{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:18px;margin-bottom:12px;display:block}
.lb-card .row1{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
.lb-card .user-side{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.lb-card .user-side .avatar-sm{width:34px;height:34px;border-radius:50%;background:var(--accent);color:${isLevin ? 'var(--ink)' : '#fff'};display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;font-weight:700;font-size:12px;flex-shrink:0}
.lb-card .user-meta{min-width:0;flex:1}
.lb-card .user-meta .name{font-family:${displaySerif};font-weight:${isLevin ? '700' : '700'};font-size:15px;color:var(--ink);line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-card .user-meta .rank-line{font-family:'Inter',sans-serif;font-size:11px;color:var(--ink-40);letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-top:2px}
.lb-card .return-side{text-align:right;flex-shrink:0}
.lb-card .return-big{font-family:${displaySerif};font-weight:${isLevin ? '900' : '800'};font-size:24px;letter-spacing:-0.02em;line-height:1}
.lb-card .return-big.pos{color:var(--green)}
.lb-card .return-big.neg{color:var(--red)}
.lb-card .return-sub{font-family:'Inter',sans-serif;font-size:10px;color:var(--ink-40);letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-top:2px}
.lb-card .row2{display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid var(--border);gap:10px}
.lb-card .ticker-block{display:flex;align-items:baseline;gap:8px;flex:1;min-width:0}
.lb-card .ticker-sym{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:16px;color:var(--ink);letter-spacing:1px}
.lb-card .ticker-co{font-family:${bodyFont};font-size:12px;color:var(--ink-60);${isLevin ? 'font-style:italic' : ''};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-card .dir-small{display:inline-block;padding:2px 6px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:3px}
.lb-card .dir-small.long{background:rgba(26,122,58,0.12);color:var(--green)}
.lb-card .dir-small.short{background:rgba(192,57,43,0.12);color:var(--red)}
.lb-card .price-block{text-align:right;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ink-60);line-height:1.4}
.lb-card .price-block .entry{color:var(--ink-40);font-size:11px}

.empty-state{text-align:center;padding:80px 20px;background:var(--bg-2);border:1px dashed var(--border)}
.empty-state h3{font-family:${displaySerif};font-size:28px;font-weight:${isLevin ? '900' : '800'};color:var(--ink);margin-bottom:12px}
.empty-state p{font-family:${bodyFont};font-size:16px;color:var(--ink-60);margin-bottom:24px;${isLevin ? 'font-style:italic' : ''}}
.empty-cta{display:inline-block;padding:14px 28px;background:var(--ink);color:var(--bg);font-family:'Inter',sans-serif;font-weight:${isLevin ? '800' : '600'};font-size:${isLevin ? '11px' : '13px'};letter-spacing:${isLevin ? '3px' : 'normal'};text-transform:${isLevin ? 'uppercase' : 'none'}}

footer{padding:40px 0;border-top:1px solid var(--border);text-align:center;font-family:'Inter',sans-serif;font-size:11px;color:var(--ink-40)}

@media(max-width:760px){
  .hero h1{font-size:${isLevin ? '40px' : '36px'}}
  .hero{padding:56px 0 40px}
  .podium{padding:40px 0 24px}
  .podium-grid{grid-template-columns:1fr;gap:14px}
  .podium-card.p1{transform:none}
  .podium-card{padding:20px 16px}
  .return-big{font-size:36px}
  /* Hide the desktop table on mobile, show card stack */
  .lb-table{display:none}
  .mobile-cards{display:block}
  .nav-links{display:none}
  .leaderboard-section{padding:32px 0 72px}
  .section-title{font-size:${isLevin ? '26px' : '22px'}}
  .wrap{padding:0 20px}
}
</style>
</head>
<body>

<nav>
  <div class="wrap">
    <a href="/" class="brand">${brandMark}</a>
    <div class="nav-links">
      <a href="/">Home</a>
      <a href="/leaderboard" class="active">Leaderboard</a>
      <a href="/submit">Submit a Call</a>
    </div>
    <a href="/submit" class="cta">${isLevin ? 'Submit a Call' : 'Submit Your Call'}</a>
  </div>
</nav>

<section class="hero">
  <div class="wrap">
    <div class="hero-kicker">${isLevin ? '— The Leaderboard —' : 'Live · Updated Daily'}</div>
    <h1>${isLevin ? 'Best <em>Calls</em>, by the numbers' : 'The <em>Leaderboard</em>'}</h1>
    <p class="hero-deck">${isLevin
      ? 'Every call submitted by a member is tracked automatically by price performance. No bias, no voting, no subjective score. Just the market.'
      : 'Every call tracked by entry-to-current price performance. No votes. No bias. Just the market.'}</p>
  </div>
</section>

${topRows.length >= 3 ? `
<section class="podium">
  <div class="wrap">
    <div class="podium-grid">
      ${renderPodiumCard(topRows[1], 2, isLevin)}
      ${renderPodiumCard(topRows[0], 1, isLevin, true)}
      ${renderPodiumCard(topRows[2], 3, isLevin)}
    </div>
  </div>
</section>
` : ''}

<section class="leaderboard-section">
  <div class="wrap">
    ${rows.length === 0 ? `
      <div class="empty-state">
        <h3>The leaderboard is empty &mdash; for now.</h3>
        <p>Be the first to submit a call. Every ticker tracked by entry-to-current price performance, updated daily.</p>
        <a href="/submit" class="empty-cta">Submit the First Call</a>
      </div>
    ` : `
      <h2 class="section-title">${isLevin ? 'All Calls by Performance' : 'All Calls'}</h2>
      <p class="section-sub">${rows.length} call${rows.length === 1 ? '' : 's'} tracked · sorted by return since entry</p>
      <table class="lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Analyst</th>
            <th>Ticker</th>
            <th>Direction</th>
            <th class="right">Entry</th>
            <th class="right">Current</th>
            <th class="right">Return</th>
            <th class="right">Days</th>
          </tr>
        </thead>
        <tbody>
          ${restRows.map(r => renderRow(r)).join('')}
        </tbody>
      </table>
      <div class="mobile-cards">
        ${rows.map(r => renderMobileCard(r)).join('')}
      </div>
    `}
  </div>
</section>

<footer>
  <div class="wrap">
    &copy; 2026 ${isLevin ? 'Levin Capital Research' : 'Stock Pitch'} &middot; Leaderboard updated daily &middot;
    <a href="/">Back to home</a>
  </div>
</footer>

</body>
</html>`;
}

function renderPodiumCard(r: LeaderboardRow, rank: number, isLevin: boolean, first = false): string {
  return `<div class="podium-card ${first ? 'p1' : ''}">
    <div class="rank">#${rank}</div>
    <div class="avatar">${r.user_initials}</div>
    <div class="user-name">${r.user_display}</div>
    <div class="ticker-line"><strong>${r.ticker}</strong> &middot; ${r.direction.toUpperCase()}</div>
    <div class="return-big ${r.return_pct < 0 ? 'neg' : ''}">${r.return_pct >= 0 ? '+' : ''}${(r.return_pct * 100).toFixed(1)}%</div>
    <div class="return-label">Return &middot; ${r.days_held}d</div>
  </div>`;
}

function renderRow(r: LeaderboardRow): string {
  const positive = r.return_pct >= 0;
  return `<tr>
    <td class="rank-cell">${r.rank}</td>
    <td>
      <div class="user-cell">
        <div class="avatar-sm">${r.user_initials}</div>
        <div class="name">${r.user_display}</div>
      </div>
    </td>
    <td>
      <div class="ticker-cell">${r.ticker}</div>
      ${r.company ? `<div class="co">${r.company}</div>` : ''}
    </td>
    <td><span class="direction-pill ${r.direction}">${r.direction}</span></td>
    <td class="right">$${r.entry_price.toFixed(2)}</td>
    <td class="right">$${r.current_price.toFixed(2)}</td>
    <td class="right return-cell ${positive ? 'pos' : 'neg'}">${positive ? '+' : ''}${(r.return_pct * 100).toFixed(1)}%</td>
    <td class="right">${r.days_held}</td>
  </tr>`;
}

function renderMobileCard(r: LeaderboardRow): string {
  const positive = r.return_pct >= 0;
  return `<a href="/c/${r.call_id}" class="lb-card">
    <div class="row1">
      <div class="user-side">
        <div class="avatar-sm">${r.user_initials}</div>
        <div class="user-meta">
          <div class="name">${r.user_display}</div>
          <div class="rank-line">Rank #${r.rank} · ${r.days_held}d held</div>
        </div>
      </div>
      <div class="return-side">
        <div class="return-big ${positive ? 'pos' : 'neg'}">${positive ? '+' : ''}${(r.return_pct * 100).toFixed(1)}%</div>
        <div class="return-sub">Return</div>
      </div>
    </div>
    <div class="row2">
      <div class="ticker-block">
        <span class="ticker-sym">${r.ticker}</span>
        <span class="dir-small ${r.direction}">${r.direction === 'long' ? '↑' : '↓'} ${r.direction}</span>
      </div>
      <div class="price-block">
        <div>$${r.current_price.toFixed(2)}</div>
        <div class="entry">entry $${r.entry_price.toFixed(2)}</div>
      </div>
    </div>
  </a>`;
}

// --- Helpers ---

export function initialsFrom(displayName: string): string {
  if (!displayName) return '??';
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.floor((end - start) / 86400000));
}
