import { escapeHtml } from '../lib/security';

type Brand = 'stockpitch' | 'levincap';

interface UserCall {
  id: string;
  ticker: string;
  company: string | null;
  direction: 'long' | 'short';
  rating: string;
  entry_price: number;
  current_price: number | null;
  price_target: number;
  return_pct: number;
  days_held: number;
  entry_date: string;
  thesis: string;
}

interface FollowedPortfolio {
  slug: string;
  name: string;
  description: string | null;
  current_value: number | null;
  irr_since_inception: number | null;
  followed_at: string;
}

interface DashboardInput {
  user: { id: string; email: string; display_name: string | null };
  calls: UserCall[];
  followed: FollowedPortfolio[];
  brand: Brand;
}

export function renderDashboard(input: DashboardInput): string {
  const { user, calls, followed, brand } = input;
  const isLevin = brand === 'levincap';
  const accent = isLevin ? '#B8973E' : '#2EBD6B';
  const bg = isLevin ? '#FAF7F0' : '#FFFFFF';
  const surface = isLevin ? '#F3EEE1' : '#F5F6F8';
  const ink = isLevin ? '#0A0A0A' : '#0A0F1F';
  const inkMuted = isLevin ? '#5A5651' : '#5A6074';
  const border = isLevin ? '#D4CFC3' : '#E2E4EA';
  const display = isLevin ? "'Playfair Display',Georgia,serif" : "'Inter',system-ui,sans-serif";
  const body = isLevin ? "'Cormorant Garamond',Georgia,serif" : "'Inter',system-ui,sans-serif";
  const mono = "'JetBrains Mono',monospace";
  const brandMark = isLevin
    ? `<span style="font-family:'Playfair Display',serif;font-weight:900">Levin Capital <em style="font-weight:400;font-style:italic">Research</em></span>`
    : `<span style="font-family:'JetBrains Mono',monospace;font-weight:700"><span style="color:${accent}">●</span> Stock Pitch</span>`;

  const totalCalls = calls.length;
  const wins = calls.filter(c => c.return_pct > 0).length;
  const avgReturn = totalCalls > 0 ? calls.reduce((a, c) => a + c.return_pct, 0) / totalCalls : 0;
  const battingAvg = totalCalls > 0 ? wins / totalCalls : 0;
  const firstName = (user.display_name || user.email.split('@')[0]).split(/\s+/)[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard · ${isLevin ? 'Levin Capital Research' : 'Stock Pitch'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Cormorant+Garamond:ital,wght@0,500;0,600&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:${bg};--surface:${surface};--ink:${ink};--ink-muted:${inkMuted};--border:${border};--accent:${accent};--green:#2EBD6B;--red:#E04759}
body{font-family:${body};background:var(--bg);color:var(--ink);line-height:1.55;-webkit-font-smoothing:antialiased;font-size:16px}
a{color:inherit;text-decoration:none}
.wrap{max-width:1080px;margin:0 auto;padding:0 24px}

nav{padding:16px 0;border-bottom:1px solid var(--border);position:sticky;top:0;background:${isLevin ? 'rgba(250,247,240,0.94)' : 'rgba(255,255,255,0.94)'};backdrop-filter:blur(12px);z-index:50}
nav .wrap{display:flex;justify-content:space-between;align-items:center}
.brand{font-family:${isLevin ? display : mono};font-weight:${isLevin ? '900' : '700'};font-size:${isLevin ? '20px' : '14px'};color:var(--ink)}
.brand em{font-weight:${isLevin ? '400' : '500'};font-style:italic}
.nav-right{display:flex;align-items:center;gap:20px;font-family:'Inter',sans-serif;font-size:12px}
.nav-right a{color:var(--ink-muted);font-weight:500}
.nav-right .email{color:var(--ink);font-weight:600;font-family:${mono}}
.logout-btn{font-family:'Inter',sans-serif;font-size:11px;color:var(--ink-muted);font-weight:600;padding:6px 12px;border:1px solid var(--border);border-radius:${isLevin ? '0' : '99px'};cursor:pointer;background:none}
.logout-btn:hover{color:var(--ink);border-color:var(--ink)}

.hero{padding:48px 0 32px;border-bottom:1px solid var(--border)}
.hero-kicker{font-family:${isLevin ? "'Inter',sans-serif" : mono};font-size:${isLevin ? '10px' : '11px'};letter-spacing:${isLevin ? '4px' : '2px'};text-transform:uppercase;color:var(--accent);font-weight:${isLevin ? '800' : '600'};margin-bottom:10px}
h1{font-family:${display};font-weight:${isLevin ? '900' : '800'};font-size:42px;color:var(--ink);letter-spacing:-0.02em;line-height:1;margin-bottom:10px}
h1 em{font-style:italic;font-weight:${isLevin ? '400' : '500'};color:var(--accent)}

.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:24px;border:1px solid var(--border);background:var(--surface);${isLevin ? '' : 'border-radius:12px;overflow:hidden'}}
.kpi{padding:18px 20px;border-right:1px solid var(--border)}
.kpi:last-child{border-right:none}
.kpi .l{font-family:'Inter',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-muted);font-weight:600;margin-bottom:6px}
.kpi .v{font-family:${display};font-weight:${isLevin ? '900' : '800'};font-size:24px;color:var(--ink);letter-spacing:-0.015em;line-height:1}
.kpi .v.pos{color:var(--green)}.kpi .v.neg{color:var(--red)}

.section{padding:32px 0 24px}
.section h2{font-family:${display};font-weight:${isLevin ? '900' : '700'};font-size:22px;color:var(--ink);letter-spacing:-0.01em;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between}
.section h2 .count{font-family:'Inter',sans-serif;font-size:13px;color:var(--ink-muted);font-weight:500}

.empty{padding:40px 24px;text-align:center;background:var(--surface);border:1px dashed var(--border);${isLevin ? '' : 'border-radius:12px'}}
.empty p{font-family:${body};color:var(--ink-muted);${isLevin ? 'font-style:italic' : ''};margin-bottom:14px}
.empty a.btn{display:inline-block;padding:12px 22px;background:var(--ink);color:var(--bg);font-family:'Inter',sans-serif;font-weight:700;font-size:13px;letter-spacing:0.3px;${isLevin ? '' : 'border-radius:8px'}}

.call-list{display:grid;gap:10px}
.call-card{background:var(--bg);border:1px solid var(--border);padding:16px 18px;${isLevin ? '' : 'border-radius:10px'};display:grid;grid-template-columns:1fr auto auto;gap:14px;align-items:center;transition:border 0.12s}
.call-card:hover{border-color:var(--accent)}
.call-card .ticker-line{font-family:${mono};font-weight:700;font-size:15px;color:var(--ink);letter-spacing:0.5px}
.call-card .co{font-family:${body};font-size:13px;color:var(--ink-muted);${isLevin ? 'font-style:italic' : ''};margin-top:2px}
.call-card .dir{display:inline-block;margin-left:6px;padding:2px 6px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
.call-card .dir.long{background:rgba(46,189,107,0.12);color:var(--green)}
.call-card .dir.short{background:rgba(224,71,89,0.12);color:var(--red)}
.call-card .price-col{text-align:right;font-family:${mono};font-size:13px;color:var(--ink-muted)}
.call-card .return-col{text-align:right;font-family:${mono};font-size:16px;font-weight:700}
.call-card .return-col.pos{color:var(--green)}
.call-card .return-col.neg{color:var(--red)}

.portfolio-list{display:grid;gap:10px}
.portfolio-card{background:var(--bg);border:1px solid var(--border);padding:18px 20px;${isLevin ? '' : 'border-radius:10px'};display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center}
.portfolio-card:hover{border-color:var(--accent)}
.portfolio-card .p-name{font-family:${display};font-weight:${isLevin ? '700' : '700'};font-size:17px;color:var(--ink);letter-spacing:-0.01em}
.portfolio-card .p-meta{font-family:${body};font-size:13px;color:var(--ink-muted);${isLevin ? 'font-style:italic' : ''};margin-top:2px}
.portfolio-card .p-nav{font-family:${mono};font-weight:700;font-size:16px;color:var(--ink)}
.portfolio-card .p-ret{font-family:${mono};font-size:12px;font-weight:600;text-align:right;margin-top:2px}
.portfolio-card .p-ret.pos{color:var(--green)}.portfolio-card .p-ret.neg{color:var(--red)}

footer{padding:28px 0;border-top:1px solid var(--border);text-align:center;font-family:'Inter',sans-serif;font-size:11px;color:var(--ink-muted);margin-top:40px}

@media(max-width:700px){
  h1{font-size:32px}
  .kpi-row{grid-template-columns:1fr 1fr}
  .kpi:nth-child(odd){border-right:1px solid var(--border)}
  .kpi{border-bottom:1px solid var(--border)}
  .kpi:last-child,.kpi:nth-last-child(2){border-bottom:none}
  .call-card{grid-template-columns:1fr auto;font-size:13px}
  .call-card .price-col{display:none}
  .nav-right .email{display:none}
}
</style>
</head>
<body>

<nav>
  <div class="wrap">
    <a href="/" class="brand">${brandMark}</a>
    <div class="nav-right">
      <a href="/submit">+ New Call</a>
      <a href="/leaderboard">Leaderboard</a>
      <span class="email">${escapeHtml(user.email)}</span>
      <form method="POST" action="/auth/logout" style="margin:0">
        <button type="submit" class="logout-btn">Sign out</button>
      </form>
    </div>
  </div>
</nav>

<section class="hero">
  <div class="wrap">
    <div class="hero-kicker">Your Dashboard</div>
    <h1>Welcome back, <em>${escapeHtml(firstName)}.</em></h1>
    <div class="kpi-row">
      <div class="kpi">
        <div class="l">Your Calls</div>
        <div class="v">${totalCalls}</div>
      </div>
      <div class="kpi">
        <div class="l">Batting Avg</div>
        <div class="v">${totalCalls > 0 ? (battingAvg * 100).toFixed(0) + '%' : '—'}</div>
      </div>
      <div class="kpi">
        <div class="l">Avg Return</div>
        <div class="v ${avgReturn >= 0 ? 'pos' : 'neg'}">${totalCalls > 0 ? (avgReturn >= 0 ? '+' : '') + (avgReturn * 100).toFixed(1) + '%' : '—'}</div>
      </div>
      <div class="kpi">
        <div class="l">Following</div>
        <div class="v">${followed.length}</div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Your Calls <span class="count">${totalCalls === 0 ? 'none yet' : `${totalCalls} total`}</span></h2>
    ${calls.length === 0 ? `
      <div class="empty">
        <p>You haven't pitched a call yet. Your first one's free and lands on the public leaderboard.</p>
        <a href="/submit" class="btn">Pitch Your First Call →</a>
      </div>
    ` : `
      <div class="call-list">
        ${calls.map(c => {
          const positive = c.return_pct >= 0;
          const ret = c.current_price != null ? `${positive ? '+' : ''}${(c.return_pct * 100).toFixed(1)}%` : '—';
          return `<a href="/c/${c.id}" class="call-card">
            <div>
              <div class="ticker-line">${escapeHtml(c.ticker)}<span class="dir ${c.direction}">${c.direction === 'long' ? '↑' : '↓'} ${c.direction}</span></div>
              ${c.company ? `<div class="co">${escapeHtml(c.company)}</div>` : ''}
            </div>
            <div class="price-col">
              $${c.entry_price.toFixed(2)} → ${c.current_price != null ? '$' + c.current_price.toFixed(2) : '—'}<br>
              <span style="font-size:11px">target $${c.price_target.toFixed(2)}</span>
            </div>
            <div class="return-col ${positive ? 'pos' : 'neg'}">
              ${ret}
              <div style="font-family:'Inter',sans-serif;font-size:10px;font-weight:500;color:var(--ink-muted);margin-top:2px">${c.days_held}d</div>
            </div>
          </a>`;
        }).join('')}
      </div>
    `}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Portfolios You Follow <span class="count">${followed.length === 0 ? 'none yet' : `${followed.length} subscribed`}</span></h2>
    ${followed.length === 0 ? `
      <div class="empty">
        <p>Follow a model portfolio to get entry and exit notifications.</p>
        <a href="/p/top10" class="btn">Browse the Top 10 →</a>
      </div>
    ` : `
      <div class="portfolio-list">
        ${followed.map(p => {
          const positive = (p.irr_since_inception ?? 0) >= 0;
          const ret = p.irr_since_inception != null ? `${positive ? '+' : ''}${(p.irr_since_inception * 100).toFixed(1)}%` : '—';
          return `<a href="/p/${p.slug}" class="portfolio-card">
            <div>
              <div class="p-name">${escapeHtml(p.name)}</div>
              ${p.description ? `<div class="p-meta">${escapeHtml(p.description.slice(0, 100))}${p.description.length > 100 ? '…' : ''}</div>` : ''}
            </div>
            <div>
              <div class="p-nav">${p.current_value != null ? '$' + Math.round(p.current_value).toLocaleString() : '—'}</div>
              <div class="p-ret ${positive ? 'pos' : 'neg'}">${ret} IRR</div>
            </div>
          </a>`;
        }).join('')}
      </div>
    `}
  </div>
</section>

<footer>
  <div class="wrap">
    &copy; 2026 ${isLevin ? 'Levin Capital Research' : 'Stock Pitch'}
  </div>
</footer>

</body>
</html>`;
}
