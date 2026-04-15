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
  return brand === 'levincap' ? renderLevincapLeaderboard(rows) : renderStockpitchLeaderboard(rows);
}

// ===========================================================================
// STOCK PITCH — "80s Power Ticker"
// Broadsheet newsprint meets trading floor. Abril Fatface heads, Lora body,
// pinstripe cream paper, Reuters ticker-tape running header, power-tie red
// CTAs, rubber-stamp rating marks, bull/bear iconic arrows, rule-line table.
// ===========================================================================

function renderStockpitchLeaderboard(rows: LeaderboardRow[]): string {
  const topRows = rows.slice(0, 3);
  const restRows = rows.slice(3);
  const tape = buildTicker(rows);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Leaderboard · Stock Pitch</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=IBM+Plex+Mono:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --paper:#F4EEE1;
  --paper-deep:#EBE2D0;
  --ink:#1A1814;
  --ink-60:#4E463D;
  --ink-40:#7E7468;
  --ink-20:#B9AE9C;
  --rule:#241F17;
  --red:#B7141F;
  --red-wash:rgba(183,20,31,0.08);
  --navy:#0E2340;
  --gold:#C9A34E;
  --bull:#1B5631;
  --bear:#8E1218;
  --display:'Abril Fatface',Georgia,serif;
  --body:'Lora',Georgia,serif;
  --mono:'IBM Plex Mono',ui-monospace,monospace;
}
html{background:var(--paper)}
body{
  font-family:var(--body);background:var(--paper);color:var(--ink);line-height:1.55;
  font-size:16px;
  -webkit-font-smoothing:antialiased;
  font-feature-settings:'onum' 1,'liga' 1;
  /* pinstripe cream paper */
  background-image:
    repeating-linear-gradient(90deg,transparent 0 23px,rgba(14,35,64,0.035) 23px 24px),
    radial-gradient(circle at 20% 10%,rgba(183,20,31,0.04),transparent 55%),
    radial-gradient(circle at 80% 90%,rgba(14,35,64,0.05),transparent 60%);
  background-attachment:fixed;
}
a{color:inherit;text-decoration:none}
.wrap{max-width:1180px;margin:0 auto;padding:0 28px}

/* ---- TICKER TAPE ---- */
.tape{
  background:var(--ink);color:var(--paper);
  border-bottom:3px solid var(--red);
  overflow:hidden;font-family:var(--mono);font-size:12px;font-weight:500;
  padding:9px 0;letter-spacing:0.5px;white-space:nowrap;
}
.tape-track{display:inline-block;animation:tickerScroll 60s linear infinite;padding-left:100%}
.tape span.sep{color:var(--gold);margin:0 14px}
.tape span.up{color:#7CE6A1}
.tape span.dn{color:#FF7A8A}
@keyframes tickerScroll{from{transform:translateX(0)}to{transform:translateX(-100%)}}

/* ---- MASTHEAD NAV ---- */
.masthead{
  background:var(--paper);
  border-bottom:2px solid var(--ink);
  padding:18px 0 16px;position:relative;
}
.masthead::after{
  content:"";position:absolute;left:0;right:0;bottom:-6px;height:2px;background:var(--ink);
}
.masthead .wrap{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:24px}
.mh-brand{
  font-family:var(--display);font-size:32px;line-height:0.9;color:var(--ink);letter-spacing:-0.01em;
  display:flex;align-items:baseline;gap:10px;
}
.mh-brand .dot{display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--red);transform:translateY(-4px)}
.mh-meta{
  justify-self:center;font-family:var(--mono);font-size:11px;letter-spacing:3px;color:var(--ink-60);text-transform:uppercase;
}
.mh-nav{display:flex;align-items:center;gap:18px;font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase}
.mh-nav a{color:var(--ink-60);padding:6px 2px;border-bottom:2px solid transparent;transition:border 0.15s}
.mh-nav a:hover,.mh-nav a.active{color:var(--ink);border-bottom-color:var(--red)}
.mh-cta{
  display:inline-block;padding:10px 18px;background:var(--red);color:var(--paper);
  font-family:var(--mono);font-weight:700;font-size:11px;letter-spacing:2px;text-transform:uppercase;
  box-shadow:3px 3px 0 var(--ink);transition:transform 0.12s,box-shadow 0.12s;
}
.mh-cta:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--ink)}
.mh-cta:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}

/* ---- HEADLINE BLOCK ---- */
.headline{padding:60px 0 30px;position:relative}
.headline::before{
  content:"VOL. I · NO. 1";position:absolute;top:18px;right:28px;
  font-family:var(--mono);font-size:10px;letter-spacing:3px;color:var(--ink-40);
}
.dateline{
  font-family:var(--mono);font-size:11px;letter-spacing:3px;text-transform:uppercase;
  color:var(--ink-40);font-weight:500;margin-bottom:18px;
  display:flex;align-items:center;gap:14px;
}
.dateline::before,.dateline::after{content:"";flex:0 0 60px;height:1px;background:var(--ink-40)}
.dateline::before{display:none}
.deck-kicker{
  display:inline-block;background:var(--ink);color:var(--paper);padding:6px 12px;
  font-family:var(--mono);font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:600;
  margin-bottom:22px;
}
.hed{
  font-family:var(--display);font-size:clamp(56px,8vw,108px);line-height:0.92;
  color:var(--ink);letter-spacing:-0.025em;margin-bottom:18px;max-width:18ch;
}
.hed .amp{color:var(--red);font-style:italic}
.subhed{
  font-family:var(--body);font-style:italic;font-size:22px;line-height:1.4;color:var(--ink-60);
  max-width:720px;border-left:3px solid var(--red);padding-left:18px;
}
.byline{
  margin-top:26px;font-family:var(--mono);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-40);
}

/* ---- PODIUM — 3 "cover story" cards ---- */
.podium{padding:40px 0 16px}
.podium-grid{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:18px;align-items:end}
.podium-card{
  background:var(--paper);border:1px solid var(--rule);padding:22px 22px 26px;position:relative;
  box-shadow:5px 5px 0 var(--ink);
}
.podium-card.first{background:var(--ink);color:var(--paper);border-color:var(--ink);box-shadow:5px 5px 0 var(--red);padding:30px 24px 34px}
.podium-card.first .pc-hed{color:var(--paper)}
.podium-card.first .pc-name{color:var(--gold)}
.podium-card.first .pc-return{color:#7CE6A1}
.podium-card.first .pc-return.neg{color:#FF8A9A}
.podium-card.first .pc-meta{color:var(--ink-20)}
.podium-card.first::before{
  content:"COVER STORY";position:absolute;top:-11px;left:22px;
  background:var(--red);color:var(--paper);font-family:var(--mono);font-size:9px;letter-spacing:3px;
  padding:3px 10px;font-weight:700;
}
.pc-rank{
  font-family:var(--display);font-size:64px;line-height:0.8;color:var(--red);letter-spacing:-0.02em;
  margin-bottom:4px;
}
.podium-card.first .pc-rank{color:var(--gold);font-size:84px}
.pc-hed{
  font-family:var(--mono);font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--ink-40);
  font-weight:600;margin-bottom:12px;
}
.pc-name{font-family:var(--display);font-size:28px;line-height:1;color:var(--ink);margin-bottom:12px}
.podium-card.first .pc-name{font-size:36px}
.pc-ticker-row{
  font-family:var(--mono);font-weight:600;font-size:13px;letter-spacing:1px;
  display:flex;align-items:center;gap:10px;margin-bottom:18px;
}
.pc-ticker{color:inherit}
.pc-dir-arrow{
  display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;
  background:var(--bull);color:var(--paper);font-size:14px;line-height:1;
}
.pc-dir-arrow.short{background:var(--bear)}
.pc-return{
  font-family:var(--display);font-size:56px;line-height:0.9;color:var(--bull);letter-spacing:-0.025em;
}
.pc-return.neg{color:var(--bear)}
.pc-meta{
  font-family:var(--mono);font-size:11px;letter-spacing:2px;color:var(--ink-40);margin-top:4px;
}

/* ---- LEDGER TABLE ---- */
.ledger{padding:64px 0 40px;border-top:4px double var(--ink);margin-top:40px}
.section-eyebrow{
  font-family:var(--mono);font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--red);
  font-weight:700;margin-bottom:10px;
}
.section-hed{
  font-family:var(--display);font-size:48px;line-height:0.95;color:var(--ink);letter-spacing:-0.02em;
  margin-bottom:10px;
}
.section-sub{
  font-family:var(--body);font-style:italic;font-size:17px;color:var(--ink-60);margin-bottom:28px;max-width:640px;
}
.tbl{
  width:100%;border-collapse:collapse;font-family:var(--mono);font-size:13px;
  background:var(--paper);border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);
}
.tbl th{
  text-align:left;padding:12px 14px;font-size:10px;letter-spacing:2px;text-transform:uppercase;
  color:var(--ink);font-weight:700;border-bottom:1px solid var(--rule);
  background:var(--paper-deep);
}
.tbl th.r{text-align:right}
.tbl td{padding:16px 14px;border-bottom:1px dotted var(--ink-20);vertical-align:middle}
.tbl td.r{text-align:right;font-variant-numeric:tabular-nums}
.tbl tr:hover{background:var(--red-wash)}
.tbl tr:hover .rank-big{color:var(--red)}
.rank-big{
  font-family:var(--display);font-size:32px;line-height:0.8;color:var(--ink);width:46px;
  letter-spacing:-0.02em;
}
.analyst{display:flex;align-items:center;gap:10px}
.analyst-mark{
  width:32px;height:32px;border:2px solid var(--ink);border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-family:var(--mono);font-size:11px;font-weight:700;background:var(--paper);
  color:var(--ink);letter-spacing:0;
}
.analyst-name{font-family:var(--body);font-weight:600;font-size:14px;color:var(--ink);letter-spacing:0}
.tkr{font-family:var(--mono);font-weight:700;font-size:14px;letter-spacing:1px}
.co{font-family:var(--body);font-weight:400;font-size:12px;color:var(--ink-60);font-style:italic;margin-top:1px;letter-spacing:0}
.stamp{
  display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border:1.5px solid currentColor;
  font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;
  transform:rotate(-2deg);background:transparent;
}
.stamp.long{color:var(--bull)}
.stamp.short{color:var(--bear)}
.stamp .arrow{font-size:11px;line-height:1}
.ret{font-family:var(--display);font-size:20px;letter-spacing:-0.01em;line-height:1}
.ret.pos{color:var(--bull)}
.ret.neg{color:var(--bear)}
.ret .sign{font-size:14px;vertical-align:0.1em}
.days{color:var(--ink-40);font-size:12px}

/* ---- MOBILE CARDS ---- */
.mobile-cards{display:none}
.mc-card{
  display:block;background:var(--paper);border:1px solid var(--rule);margin-bottom:14px;padding:18px;
  box-shadow:4px 4px 0 var(--ink);
}
.mc-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
.mc-left{display:flex;gap:10px;align-items:center;flex:1;min-width:0}
.mc-left .analyst-mark{width:36px;height:36px;font-size:12px;flex-shrink:0}
.mc-name{font-family:var(--display);font-size:18px;color:var(--ink);line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-rank-line{font-family:var(--mono);font-size:10px;letter-spacing:2px;color:var(--ink-40);text-transform:uppercase;margin-top:3px}
.mc-right{text-align:right}
.mc-ret-big{font-family:var(--display);font-size:30px;line-height:0.9;letter-spacing:-0.02em}
.mc-ret-big.pos{color:var(--bull)}
.mc-ret-big.neg{color:var(--bear)}
.mc-ret-label{font-family:var(--mono);font-size:10px;letter-spacing:2px;color:var(--ink-40);text-transform:uppercase;margin-top:2px}
.mc-bot{display:flex;justify-content:space-between;padding-top:12px;border-top:1px dotted var(--ink-20);font-family:var(--mono);font-size:12px;color:var(--ink-60)}
.mc-bot .tkr-sym{font-weight:700;color:var(--ink);letter-spacing:1px}

/* ---- EMPTY ---- */
.empty{text-align:center;padding:72px 24px;background:var(--paper-deep);border:2px dashed var(--rule)}
.empty .section-hed{font-size:36px}
.empty p{font-family:var(--body);font-style:italic;font-size:17px;color:var(--ink-60);margin-bottom:24px}
.empty-cta{
  display:inline-block;padding:14px 28px;background:var(--red);color:var(--paper);
  font-family:var(--mono);font-weight:700;font-size:12px;letter-spacing:3px;text-transform:uppercase;
  box-shadow:4px 4px 0 var(--ink);
}

/* ---- FOOTER (colophon) ---- */
footer{
  margin-top:60px;padding:36px 0 64px;
  border-top:1px solid var(--ink);border-bottom:6px double var(--ink);
  font-family:var(--mono);font-size:11px;letter-spacing:2px;color:var(--ink-40);text-transform:uppercase;
}
footer .wrap{display:flex;justify-content:space-between;align-items:center;gap:20px}
footer a{color:var(--ink-60);border-bottom:1px solid var(--ink-20)}
footer .colophon{font-family:var(--body);font-style:italic;text-transform:none;letter-spacing:0;font-size:12px;color:var(--ink-40)}

/* ---- RESPONSIVE ---- */
@media(max-width:860px){
  body{font-size:17px}
  .tape{display:none}
  .masthead{padding:14px 0 12px}
  .masthead .wrap{grid-template-columns:1fr auto;gap:14px}
  .mh-meta{display:none}
  .mh-nav{gap:10px;font-size:11px;letter-spacing:1px}
  .mh-nav a:not(.mh-cta){display:none}
  .mh-brand{font-size:24px}
  .headline{padding:36px 0 20px}
  .headline::before{display:none}
  .hed{font-size:44px;line-height:0.95}
  .subhed{font-size:17px;padding-left:14px}
  .deck-kicker{font-size:10px;padding:5px 10px}
  .dateline{font-size:10px;letter-spacing:2px}
  .dateline::after{flex:0 1 30px}
  .byline{font-size:10px}
  .podium{padding:24px 0 0}
  .podium-grid{grid-template-columns:1fr;gap:16px}
  .podium-card.first{order:-1}
  .podium-card{padding:22px 20px}
  .podium-card.first{padding:26px 22px}
  .pc-rank{font-size:48px}
  .podium-card.first .pc-rank{font-size:60px}
  .pc-name{font-size:24px}
  .podium-card.first .pc-name{font-size:30px}
  .pc-return{font-size:44px}
  .podium-card.first .pc-return{font-size:52px}
  .ledger{padding:44px 0 32px;margin-top:28px}
  .section-hed{font-size:32px}
  .section-sub{font-size:15px}
  .tbl{display:none}
  .mobile-cards{display:block}
  .mc-card{padding:16px;margin-bottom:12px}
  .mc-name{font-size:17px}
  .mc-ret-big{font-size:26px}
  .wrap{padding:0 20px}
  footer{margin-top:40px;padding:24px 0 40px}
  footer .wrap{flex-direction:column;gap:10px;text-align:center;letter-spacing:1.5px}
  footer .colophon{font-size:12px}
}
</style>
</head>
<body>

<div class="tape" aria-hidden="true">
  <div class="tape-track">${tape}${tape}</div>
</div>

<header class="masthead">
  <div class="wrap">
    <a href="/" class="mh-brand"><span class="dot"></span>Stock Pitch</a>
    <div class="mh-meta">THE DAILY · ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase()}</div>
    <nav class="mh-nav">
      <a href="/">Cover</a>
      <a href="/leaderboard" class="active">Leaderboard</a>
      <a href="/p/top10">Top 10</a>
      <a href="/submit" class="mh-cta">Pitch a Call</a>
    </nav>
  </div>
</header>

<section class="headline">
  <div class="wrap">
    <div class="dateline">Live · Updated nightly · ${rows.length} call${rows.length === 1 ? '' : 's'} tracked</div>
    <div class="deck-kicker">★ The Leaderboard ★</div>
    <h1 class="hed">Who's <span class="amp">calling</span> it&nbsp;right.</h1>
    <p class="subhed">Every pitch tracked by entry-to-current price performance. No votes. No bias. Just the market keeping score.</p>
    <div class="byline">By the Numbers · Compiled from the live book</div>
  </div>
</section>

${topRows.length >= 3 ? `
<section class="podium">
  <div class="wrap">
    <div class="podium-grid">
      ${renderSpPodium(topRows[1], 2)}
      ${renderSpPodium(topRows[0], 1, true)}
      ${renderSpPodium(topRows[2], 3)}
    </div>
  </div>
</section>
` : ''}

<section class="ledger">
  <div class="wrap">
    ${rows.length === 0 ? `
      <div class="empty">
        <div class="section-eyebrow">The Book is Empty</div>
        <h2 class="section-hed">Be the first to call it.</h2>
        <p>The leaderboard is waiting for its lead story. Submit a thesis, lock your entry price, and run with the market.</p>
        <a href="/submit" class="empty-cta">Take the Cover →</a>
      </div>
    ` : `
      <div class="section-eyebrow">§ The Full Book</div>
      <h2 class="section-hed">All calls, sorted by return.</h2>
      <p class="section-sub">Ranked high to low. Rows update when prices refresh nightly — you're seeing yesterday's close or tonight's if the ticker's traded.</p>
      <table class="tbl">
        <thead>
          <tr>
            <th>#</th>
            <th>Analyst</th>
            <th>Ticker</th>
            <th>Position</th>
            <th class="r">Entry</th>
            <th class="r">Current</th>
            <th class="r">Return</th>
            <th class="r">Days</th>
          </tr>
        </thead>
        <tbody>
          ${restRows.map(r => renderSpRow(r)).join('')}
        </tbody>
      </table>
      <div class="mobile-cards">
        ${rows.map(r => renderSpMobile(r)).join('')}
      </div>
    `}
  </div>
</section>

<footer>
  <div class="wrap">
    <div>© ${new Date().getFullYear()} Stock Pitch · <a href="/">Cover</a> · <a href="/submit">Submit</a></div>
    <div class="colophon">"Nothing in here is investment advice — just what the book is doing."</div>
  </div>
</footer>

</body>
</html>`;
}

function renderSpPodium(r: LeaderboardRow, rank: number, first = false): string {
  const pos = r.return_pct >= 0;
  const arrow = r.direction === 'long' ? '▲' : '▼';
  return `<a href="/c/${r.call_id}" class="podium-card ${first ? 'first' : ''}">
    <div class="pc-rank">${rank === 1 ? 'I' : rank === 2 ? 'II' : 'III'}</div>
    <div class="pc-hed">${first ? 'Lead Story' : rank === 2 ? 'Second Run' : 'Also Noted'}</div>
    <div class="pc-name">${r.user_display}</div>
    <div class="pc-ticker-row">
      <span class="pc-dir-arrow ${r.direction}">${arrow}</span>
      <span class="pc-ticker">${r.ticker}</span>
      <span style="color:currentColor;opacity:0.5">·</span>
      <span>${r.direction.toUpperCase()}</span>
    </div>
    <div class="pc-return ${pos ? '' : 'neg'}">${pos ? '+' : ''}${(r.return_pct * 100).toFixed(1)}%</div>
    <div class="pc-meta">Held ${r.days_held}d · Entry $${r.entry_price.toFixed(2)}</div>
  </a>`;
}

function renderSpRow(r: LeaderboardRow): string {
  const pos = r.return_pct >= 0;
  return `<tr onclick="location='/c/${r.call_id}'" style="cursor:pointer">
    <td><div class="rank-big">${r.rank}</div></td>
    <td>
      <div class="analyst">
        <div class="analyst-mark">${r.user_initials}</div>
        <div class="analyst-name">${r.user_display}</div>
      </div>
    </td>
    <td>
      <div class="tkr">${r.ticker}</div>
      ${r.company ? `<div class="co">${r.company}</div>` : ''}
    </td>
    <td>
      <span class="stamp ${r.direction}">
        <span class="arrow">${r.direction === 'long' ? '▲' : '▼'}</span> ${r.direction}
      </span>
    </td>
    <td class="r">$${r.entry_price.toFixed(2)}</td>
    <td class="r">$${r.current_price.toFixed(2)}</td>
    <td class="r"><span class="ret ${pos ? 'pos' : 'neg'}"><span class="sign">${pos ? '+' : ''}</span>${(r.return_pct * 100).toFixed(1)}%</span></td>
    <td class="r days">${r.days_held}</td>
  </tr>`;
}

function renderSpMobile(r: LeaderboardRow): string {
  const pos = r.return_pct >= 0;
  return `<a href="/c/${r.call_id}" class="mc-card">
    <div class="mc-top">
      <div class="mc-left">
        <div class="analyst-mark">${r.user_initials}</div>
        <div style="min-width:0;flex:1">
          <div class="mc-name">${r.user_display}</div>
          <div class="mc-rank-line">№ ${r.rank} · ${r.days_held}d held</div>
        </div>
      </div>
      <div class="mc-right">
        <div class="mc-ret-big ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${(r.return_pct * 100).toFixed(1)}%</div>
        <div class="mc-ret-label">Return</div>
      </div>
    </div>
    <div class="mc-bot">
      <div><span class="tkr-sym">${r.ticker}</span> · ${r.direction}</div>
      <div>$${r.entry_price.toFixed(2)} → $${r.current_price.toFixed(2)}</div>
    </div>
  </a>`;
}

function buildTicker(rows: LeaderboardRow[]): string {
  if (rows.length === 0) {
    return `<span class="sep">◆</span> BOOK EMPTY — TAKE THE COVER AT /SUBMIT <span class="sep">◆</span> THE MARKET IS OPEN <span class="sep">◆</span> `;
  }
  return rows.slice(0, 30).map(r => {
    const pct = (r.return_pct * 100).toFixed(2);
    const cls = r.return_pct >= 0 ? 'up' : 'dn';
    const sign = r.return_pct >= 0 ? '+' : '';
    return `${r.ticker} <span class="${cls}">${sign}${pct}%</span>`;
  }).join(' <span class="sep">◆</span> ') + ' <span class="sep">◆</span> ';
}

// ===========================================================================
// LEVIN CAPITAL RESEARCH — "Loeb Rhoades & Co." inspired
// Mid-century Wall Street engraved stock-certificate aesthetic. Bodoni Moda
// wordmark with hero ampersand, Cormorant body, cream laid paper, banker's
// forest green primary + champagne gold leaf, guilloche scrollwork borders,
// red serial-number folios, copperplate italic subtitles, small caps nav.
// ===========================================================================

function renderLevincapLeaderboard(rows: LeaderboardRow[]): string {
  const topRows = rows.slice(0, 3);
  const restRows = rows.slice(3);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Ledger · Levin Capital Research</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,700;0,6..96,900;1,6..96,400;1,6..96,700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&family=IM+Fell+English+SC&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  /* Loeb, Rhoades & Co. — banker's laid paper + forest green + champagne gold */
  --paper:#F3EAD5;
  --paper-deep:#E6DABF;
  --paper-warm:#F8F0DB;
  --ink:#0A0806;
  --ink-80:#2E281D;
  --ink-60:#5A5040;
  --ink-40:#847961;
  --ink-20:#B8AE95;
  --rule:#2E281D;
  --banker:#0F3B2E;          /* Loeb Rhoades forest green — primary */
  --banker-deep:#082619;
  --banker-ink:#133A2D;
  --gold:#B8973E;            /* champagne gold leaf */
  --gold-deep:#8B6F28;
  --serial-red:#8E1C22;      /* engraved-certificate red for serials */
  --ledger-green:#0F3B2E;
  --ledger-red:#8B2A1E;
  --display:'Bodoni Moda','Didot',Georgia,serif;
  --body:'Cormorant Garamond','EB Garamond',Georgia,serif;
  --smcp:'IM Fell English SC',serif;
  --egar:'EB Garamond',Georgia,serif;
  --script:'Cormorant Garamond',serif; /* italic for subtitles */
}
html{background:var(--paper)}
body{
  font-family:var(--body);background:var(--paper);color:var(--ink);line-height:1.55;font-size:19px;
  -webkit-font-smoothing:antialiased;
  font-feature-settings:'onum' 1,'liga' 1,'dlig' 1;
  /* laid paper — faint horizontal ruled lines + warm wash + gold bloom top */
  background-image:
    repeating-linear-gradient(0deg,transparent 0 31px,rgba(46,40,29,0.025) 31px 32px),
    radial-gradient(ellipse at 50% 0%,rgba(184,151,62,0.10),transparent 55%),
    radial-gradient(ellipse at 85% 85%,rgba(15,59,46,0.07),transparent 50%),
    radial-gradient(circle at 15% 60%,rgba(46,40,29,0.04),transparent 30%);
  background-attachment:fixed;
}
a{color:inherit;text-decoration:none}
.wrap{max-width:1020px;margin:0 auto;padding:0 40px}

/* ---- MASTHEAD — restrained two-line wordmark ---- */
.mast{
  padding:36px 0 0;position:relative;background:var(--paper);
  border-bottom:1px solid var(--ink);
}
.mast::after{
  content:"";position:absolute;left:0;right:0;bottom:-5px;height:1px;background:var(--ink);
}
.mast .wrap{text-align:center}
.mast-word{
  font-family:var(--display);font-weight:900;font-size:46px;line-height:1;color:var(--ink);
  letter-spacing:0.01em;text-transform:uppercase;
  font-variant-numeric:lining-nums;
}
.mast-sub{
  font-family:var(--display);font-style:italic;font-weight:400;font-size:26px;color:var(--banker);
  letter-spacing:0.02em;margin-top:4px;
}
.mast-hairline{
  margin:22px auto 0;width:100%;max-width:520px;height:1px;background:var(--ink);position:relative;
}
.mast-hairline::before,.mast-hairline::after{
  content:"";position:absolute;top:-3px;width:7px;height:7px;background:var(--gold);
  transform:rotate(45deg);
}
.mast-hairline::before{left:-3px}
.mast-hairline::after{right:-3px}
.mast-nav{
  padding:16px 0 20px;
  display:flex;justify-content:center;gap:40px;
  font-family:var(--smcp);font-size:13px;letter-spacing:4px;text-transform:uppercase;color:var(--ink-60);
}
.mast-nav a{padding:4px 0;border-bottom:2px solid transparent;transition:border 0.2s,color 0.2s}
.mast-nav a:hover,.mast-nav a.active{color:var(--banker);border-bottom-color:var(--gold)}

/* ---- DECO ORNAMENT ---- */
.deco-rule{
  display:flex;align-items:center;justify-content:center;gap:16px;margin:40px 0;
  color:var(--gold);
}
.deco-rule::before,.deco-rule::after{
  content:"";flex:0 1 160px;height:1px;background:linear-gradient(90deg,transparent,var(--gold-deep),transparent);
}
.deco-rule .diamond{
  width:10px;height:10px;background:var(--gold);transform:rotate(45deg);position:relative;
}
.deco-rule .diamond::before{
  content:"";position:absolute;inset:2px;background:var(--paper);
}
.deco-rule .diamond::after{
  content:"";position:absolute;inset:3px;background:var(--gold);
}
.deco-rule.heavy::before,.deco-rule.heavy::after{flex:0 1 220px;height:2px}

/* ---- COLUMN: leading essay ---- */
.essay{padding:40px 0 10px}
.essay .dateline{
  text-align:center;font-family:var(--smcp);font-size:11px;letter-spacing:6px;
  color:var(--ink-60);margin-bottom:28px;text-transform:uppercase;
}
.essay h1{
  font-family:var(--display);font-weight:900;font-size:clamp(54px,7vw,88px);line-height:0.98;
  color:var(--ink);letter-spacing:-0.02em;text-align:center;margin-bottom:18px;
}
.essay h1 em{font-style:italic;font-weight:400;color:var(--banker)}
.essay .deck{
  font-family:var(--body);font-style:italic;font-size:22px;line-height:1.45;color:var(--ink-80);
  text-align:center;max-width:640px;margin:0 auto;
}
.essay .byline{
  margin-top:30px;text-align:center;font-family:var(--smcp);font-size:11px;
  letter-spacing:5px;color:var(--ink-40);text-transform:uppercase;
}

/* ---- TOP PLATE: three "engraved" cards ---- */
.plates{padding:28px 0 8px}
.plates-grid{display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:22px;align-items:stretch}
.plate{
  background:var(--paper-warm);padding:30px 26px 34px;position:relative;
  border:1px solid var(--ink);
  display:flex;flex-direction:column;
  box-shadow:
    inset 0 0 0 1px var(--paper-warm),
    inset 0 0 0 5px transparent,
    inset 0 0 0 6px var(--gold-deep);
}
.plate.primary{
  background:var(--ink);color:var(--paper);border-color:var(--ink);
  box-shadow:
    inset 0 0 0 1px var(--ink),
    inset 0 0 0 5px transparent,
    inset 0 0 0 6px var(--gold);
  padding:40px 30px 44px;
}
.plate.primary .p-roman{color:var(--gold)}
.plate.primary .p-tag{color:var(--gold);border-color:var(--gold)}
.plate.primary .p-name{color:var(--paper)}
.plate.primary .p-ticker{color:var(--gold)}
.plate.primary .p-co{color:var(--ink-20)}
.plate.primary .p-return{color:#EAD89D}
.plate.primary .p-return.neg{color:#E29B8F}
.plate.primary .p-meta{color:var(--ink-20)}

.p-roman{
  font-family:var(--display);font-weight:400;font-style:italic;font-size:66px;line-height:0.85;
  color:var(--banker);letter-spacing:0;margin-bottom:6px;
}
.plate.primary .p-roman{font-size:84px}
.p-tag{
  display:inline-block;font-family:var(--smcp);font-size:10px;letter-spacing:5px;color:var(--banker);
  border:1px solid var(--banker);padding:3px 10px;text-transform:uppercase;margin-bottom:18px;
  align-self:flex-start;
}
.p-name{
  font-family:var(--display);font-weight:700;font-size:28px;line-height:1.05;color:var(--ink);
  margin-bottom:14px;letter-spacing:-0.01em;
}
.plate.primary .p-name{font-size:36px}
.p-ticker-row{
  font-family:var(--body);font-size:17px;color:var(--ink-80);margin-bottom:18px;
  display:flex;align-items:baseline;gap:8px;
}
.p-ticker{font-family:var(--display);font-weight:700;font-size:20px;letter-spacing:1px}
.p-sep{color:var(--ink-40)}
.p-dir{font-style:italic;color:var(--ink-60)}
.p-return{
  font-family:var(--display);font-weight:900;font-size:48px;line-height:0.9;
  color:var(--ledger-green);letter-spacing:-0.02em;margin-top:auto;
  font-variant-numeric:oldstyle-nums tabular-nums;
}
.plate.primary .p-return{font-size:62px}
.p-return.neg{color:var(--ledger-red)}
.p-meta{
  font-family:var(--smcp);font-size:11px;letter-spacing:3px;color:var(--ink-40);
  margin-top:6px;text-transform:uppercase;
}

/* ---- LEDGER TABLE ---- */
.book{padding:40px 0 60px}
.book-head{text-align:center;margin-bottom:10px}
.book-eyebrow{font-family:var(--smcp);font-size:11px;letter-spacing:6px;color:var(--banker);margin-bottom:8px;text-transform:uppercase}
.book-hed{font-family:var(--display);font-weight:400;font-style:italic;font-size:42px;color:var(--ink);letter-spacing:-0.01em;line-height:1.05;margin-bottom:8px}
.book-hed strong{font-weight:900;font-style:normal}
.book-sub{font-family:var(--body);font-style:italic;font-size:17px;color:var(--ink-60);max-width:520px;margin:0 auto}

.ledger-tbl{
  width:100%;border-collapse:collapse;margin-top:36px;font-family:var(--body);font-size:16px;
  border-top:3px double var(--ink);border-bottom:3px double var(--ink);
}
.ledger-tbl th{
  text-align:left;padding:14px 14px 12px;font-family:var(--smcp);font-size:11px;letter-spacing:3px;
  color:var(--ink);font-weight:400;border-bottom:1px solid var(--ink);text-transform:uppercase;
}
.ledger-tbl th.r{text-align:right}
.ledger-tbl td{padding:18px 14px;border-bottom:1px solid var(--ink-20);vertical-align:middle}
.ledger-tbl td.r{text-align:right;font-variant-numeric:oldstyle-nums tabular-nums;font-family:var(--display);font-weight:500}
.ledger-tbl tr:hover{background:var(--paper-warm)}
.ledger-tbl tr:hover .l-rank{color:var(--banker)}
.l-rank{
  font-family:var(--display);font-style:italic;font-weight:400;font-size:26px;color:var(--ink);
  width:60px;line-height:1;letter-spacing:0;
}
.l-analyst{display:flex;align-items:center;gap:14px}
.l-monogram{
  width:38px;height:38px;border:1px solid var(--ink);border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-family:var(--display);font-weight:700;font-size:13px;background:var(--paper-warm);
  color:var(--ink);letter-spacing:0.5px;position:relative;
}
.l-monogram::after{
  content:"";position:absolute;inset:3px;border:0.5px solid var(--gold-deep);border-radius:50%;pointer-events:none;
}
.l-name{font-family:var(--display);font-weight:500;font-size:17px;color:var(--ink);letter-spacing:-0.01em}
.l-tkr{font-family:var(--display);font-weight:700;font-size:18px;color:var(--ink);letter-spacing:1px}
.l-co{font-family:var(--body);font-style:italic;font-size:14px;color:var(--ink-60);margin-top:1px;letter-spacing:0}
.l-dir{
  font-family:var(--smcp);font-size:11px;letter-spacing:3px;text-transform:uppercase;
  padding:3px 10px;border:1px solid currentColor;display:inline-block;
}
.l-dir.long{color:var(--ledger-green)}
.l-dir.short{color:var(--ledger-red)}
.l-ret{font-family:var(--display);font-weight:700;font-size:20px;letter-spacing:-0.01em;font-variant-numeric:oldstyle-nums tabular-nums}
.l-ret.pos{color:var(--ledger-green)}
.l-ret.neg{color:var(--ledger-red)}

/* ---- MOBILE LEDGER CARDS ---- */
.mc-stack{display:none}
.lm-card{
  display:block;background:var(--paper-warm);border:1px solid var(--ink);margin-bottom:18px;
  padding:22px;position:relative;
  box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 4px transparent,inset 0 0 0 5px var(--gold-deep);
}
.lm-top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px}
.lm-left{flex:1;min-width:0}
.lm-rank{font-family:var(--display);font-style:italic;font-size:15px;color:var(--ink-60);margin-bottom:4px}
.lm-name{font-family:var(--display);font-weight:700;font-size:20px;color:var(--ink);letter-spacing:-0.01em;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lm-right{text-align:right}
.lm-ret{font-family:var(--display);font-weight:900;font-size:28px;letter-spacing:-0.02em;line-height:1;font-variant-numeric:oldstyle-nums tabular-nums}
.lm-ret.pos{color:var(--ledger-green)}
.lm-ret.neg{color:var(--ledger-red)}
.lm-ret-sub{font-family:var(--smcp);font-size:10px;letter-spacing:3px;color:var(--ink-40);margin-top:3px;text-transform:uppercase}
.lm-mid{display:flex;align-items:center;gap:10px;padding:12px 0;border-top:1px solid var(--ink-20);border-bottom:1px solid var(--ink-20);margin-bottom:10px}
.lm-mid .l-tkr{font-size:17px}
.lm-mid .l-co{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lm-bot{font-family:var(--smcp);font-size:10px;letter-spacing:3px;color:var(--ink-60);text-transform:uppercase;display:flex;justify-content:space-between}

/* ---- EMPTY ---- */
.empty{text-align:center;padding:80px 24px;background:var(--paper-warm);border:1px solid var(--ink);margin:20px 0;position:relative;box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 5px transparent,inset 0 0 0 6px var(--gold-deep)}
.empty .book-hed{font-size:36px;margin-bottom:14px}
.empty p{font-family:var(--body);font-style:italic;font-size:19px;color:var(--ink-60);max-width:520px;margin:0 auto 28px}
.empty-cta{
  display:inline-block;padding:14px 32px;border:1px solid var(--ink);
  font-family:var(--smcp);font-size:12px;letter-spacing:5px;text-transform:uppercase;color:var(--ink);
  background:var(--gold);transition:background 0.2s;
}
.empty-cta:hover{background:var(--banker);color:var(--paper)}

/* ---- COLOPHON FOOTER ---- */
footer{
  margin-top:40px;padding:30px 0 44px;border-top:3px double var(--ink);
}
footer .wrap{text-align:center}
.colo-word{font-family:var(--display);font-weight:900;font-size:22px;color:var(--ink);letter-spacing:0.04em;text-transform:uppercase;line-height:1}
.colo-amp{font-family:var(--display);font-style:italic;font-weight:400;color:var(--gold);font-size:30px;line-height:0.9;margin:2px 0}
.colo-sub{font-family:var(--display);font-style:italic;color:var(--banker);font-size:17px;margin-bottom:4px}
.colo-meta{font-family:var(--smcp);font-size:11px;letter-spacing:4px;color:var(--ink-60);margin-top:14px;text-transform:uppercase}
.colo-meta a{color:var(--ink-60);border-bottom:1px solid transparent}
.colo-meta a:hover{color:var(--banker);border-bottom-color:var(--gold)}
.colo-note{font-family:var(--body);font-style:italic;font-size:14px;color:var(--ink-40);margin-top:14px;max-width:520px;margin-left:auto;margin-right:auto}

/* ---- RESPONSIVE ---- */
@media(max-width:820px){
  body{font-size:18px;line-height:1.55}
  .wrap{padding:0 22px}
  .mast{padding:28px 0 0}
  .mast-word{font-size:32px;letter-spacing:0.02em}
  .mast-sub{font-size:22px;margin-top:2px}
  .mast-hairline{max-width:320px;margin-top:18px}
  .mast-nav{gap:22px;letter-spacing:2px;font-size:12px;padding:12px 0 16px}
  .essay{padding:28px 0 4px}
  .essay .dateline{font-size:10px;letter-spacing:3px;margin-bottom:16px}
  .essay h1{font-size:46px}
  .essay .deck{font-size:17px}
  .essay .byline{font-size:10px;letter-spacing:3px}
  .deco-rule{margin:24px 0}
  .deco-rule::before,.deco-rule::after{flex:0 1 70px}
  .plates{padding:16px 0 4px}
  .plates-grid{grid-template-columns:1fr;gap:16px}
  .plate{padding:22px 22px 26px}
  .plate.primary{order:-1;padding:28px 24px 32px}
  .p-roman{font-size:54px}
  .plate.primary .p-roman{font-size:68px}
  .p-tag{font-size:9px;letter-spacing:3px;padding:3px 8px;margin-bottom:14px}
  .p-name{font-size:26px}
  .plate.primary .p-name{font-size:32px}
  .p-return{font-size:44px}
  .plate.primary .p-return{font-size:54px}
  .p-meta{font-size:10px;letter-spacing:2px}
  .book{padding:24px 0 40px}
  .book-eyebrow{font-size:10px;letter-spacing:4px}
  .book-hed{font-size:30px}
  .book-sub{font-size:15px}
  .ledger-tbl{display:none}
  .mc-stack{display:block}
  .lm-card{padding:20px}
  .lm-name{font-size:21px}
  .lm-ret{font-size:28px}
  footer{margin-top:28px;padding:24px 0 36px}
  .colo-word{font-size:20px}
  .colo-sub{font-size:16px}
  .colo-amp{font-size:26px}
  .colo-meta{letter-spacing:2.5px;font-size:10px}
}
</style>
</head>
<body>

<header class="mast">
  <div class="wrap">
    <div class="mast-word">Levin Capital</div>
    <div class="mast-sub">Research</div>
    <div class="mast-hairline"></div>
    <nav class="mast-nav">
      <a href="/">Cover</a>
      <a href="/leaderboard" class="active">Leaderboard</a>
      <a href="/p/top10">Top Ten</a>
      <a href="/submit">Submit</a>
    </nav>
  </div>
</header>

<section class="essay">
  <div class="wrap">
    <div class="dateline">${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}).toUpperCase()} · VOLUME I · FOLIO ${String(rows.length).padStart(3,'0')}</div>
    <h1>The <em>Ledger.</em></h1>
    <p class="deck">Every call committed to the book, kept in balance by the market itself. No votes, no voices, no editorial hand &mdash; only the price, settled.</p>
    <div class="byline">Compiled nightly · By the house</div>
  </div>
</section>

<div class="deco-rule heavy"><span></span><span class="diamond"></span><span></span></div>

${topRows.length >= 3 ? `
<section class="plates">
  <div class="wrap">
    <div class="plates-grid">
      ${renderLcPlate(topRows[1], 2)}
      ${renderLcPlate(topRows[0], 1, true)}
      ${renderLcPlate(topRows[2], 3)}
    </div>
  </div>
</section>

<div class="deco-rule"><span></span><span class="diamond"></span><span></span></div>
` : ''}

<section class="book">
  <div class="wrap">
    ${rows.length === 0 ? `
      <div class="empty">
        <div class="book-eyebrow">&mdash; Book Opens Empty &mdash;</div>
        <h2 class="book-hed"><em>No calls, yet.</em></h2>
        <p>The ledger awaits its first committed thesis. Submit a call; the market will keep the score.</p>
        <a href="/submit" class="empty-cta">Open the Book</a>
      </div>
    ` : `
      <div class="book-head">
        <div class="book-eyebrow">&mdash; The Full Book &mdash;</div>
        <h2 class="book-hed"><strong>All calls,</strong> <em>as the market has them.</em></h2>
        <p class="book-sub">Ranked by return since entry. Figures are settled to last close; positions remain open until the thesis plays out.</p>
      </div>
      <table class="ledger-tbl">
        <thead>
          <tr>
            <th>№</th>
            <th>Analyst</th>
            <th>Security</th>
            <th>Position</th>
            <th class="r">Entry</th>
            <th class="r">Last</th>
            <th class="r">Return</th>
            <th class="r">Days</th>
          </tr>
        </thead>
        <tbody>
          ${restRows.map(r => renderLcRow(r)).join('')}
        </tbody>
      </table>
      <div class="mc-stack">
        ${rows.map(r => renderLcMobile(r)).join('')}
      </div>
    `}
  </div>
</section>

<div class="deco-rule heavy"><span></span><span class="diamond"></span><span></span></div>

<footer>
  <div class="wrap">
    <div class="colo-word">Levin Capital</div>
    <div class="colo-sub">Research</div>
    <div class="colo-meta">© ${new Date().getFullYear()} · <a href="/">Cover</a> &middot; <a href="/submit">Submit</a> &middot; <a href="/p/top10">Top Ten</a></div>
    <div class="colo-note">Figures herein are not investment advice.</div>
  </div>
</footer>

</body>
</html>`;
}

function renderLcPlate(r: LeaderboardRow, rank: number, primary = false): string {
  const pos = r.return_pct >= 0;
  const romans = ['', 'I.', 'II.', 'III.'];
  const tags = ['', 'Lead Position', 'Second Entry', 'Third Entry'];
  return `<a href="/c/${r.call_id}" class="plate ${primary ? 'primary' : ''}">
    <div class="p-roman">${romans[rank]}</div>
    <div class="p-tag">${tags[rank]}</div>
    <div class="p-name">${r.user_display}</div>
    <div class="p-ticker-row">
      <span class="p-ticker">${r.ticker}</span>
      <span class="p-sep">·</span>
      <span class="p-dir">${r.direction === 'long' ? 'long' : 'short'}</span>
    </div>
    <div class="p-return ${pos ? '' : 'neg'}">${pos ? '+' : ''}${(r.return_pct * 100).toFixed(1)}%</div>
    <div class="p-meta">Held ${r.days_held} days · Entry at $${r.entry_price.toFixed(2)}</div>
  </a>`;
}

function renderLcRow(r: LeaderboardRow): string {
  const pos = r.return_pct >= 0;
  return `<tr onclick="location='/c/${r.call_id}'" style="cursor:pointer">
    <td><div class="l-rank">${toRoman(r.rank)}</div></td>
    <td>
      <div class="l-analyst">
        <div class="l-monogram">${r.user_initials}</div>
        <div class="l-name">${r.user_display}</div>
      </div>
    </td>
    <td>
      <div class="l-tkr">${r.ticker}</div>
      ${r.company ? `<div class="l-co">${r.company}</div>` : ''}
    </td>
    <td><span class="l-dir ${r.direction}">${r.direction}</span></td>
    <td class="r">$${r.entry_price.toFixed(2)}</td>
    <td class="r">$${r.current_price.toFixed(2)}</td>
    <td class="r"><span class="l-ret ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${(r.return_pct * 100).toFixed(1)}%</span></td>
    <td class="r">${r.days_held}</td>
  </tr>`;
}

function renderLcMobile(r: LeaderboardRow): string {
  const pos = r.return_pct >= 0;
  return `<a href="/c/${r.call_id}" class="lm-card">
    <div class="lm-top">
      <div class="lm-left">
        <div class="lm-rank">№ ${toRoman(r.rank)}</div>
        <div class="lm-name">${r.user_display}</div>
      </div>
      <div class="lm-right">
        <div class="lm-ret ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${(r.return_pct * 100).toFixed(1)}%</div>
        <div class="lm-ret-sub">Return</div>
      </div>
    </div>
    <div class="lm-mid">
      <div class="l-tkr">${r.ticker}</div>
      ${r.company ? `<div class="l-co">${r.company}</div>` : '<div style="flex:1"></div>'}
      <span class="l-dir ${r.direction}">${r.direction}</span>
    </div>
    <div class="lm-bot">
      <span>Entry $${r.entry_price.toFixed(2)} → $${r.current_price.toFixed(2)}</span>
      <span>${r.days_held}d</span>
    </div>
  </a>`;
}

function toRoman(n: number): string {
  if (n <= 0 || n > 3999) return String(n);
  const map: [number, string][] = [
    [1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],
    [100,'C'],[90,'XC'],[50,'L'],[40,'XL'],
    [10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I'],
  ];
  let s = '';
  let rem = n;
  for (const [v, sym] of map) {
    while (rem >= v) { s += sym; rem -= v; }
  }
  return s;
}

// ===========================================================================
// Shared helpers used by builders in index.ts
// ===========================================================================

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
