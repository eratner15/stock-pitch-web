interface CallDetail {
  id: string;
  ticker: string;
  company: string | null;
  direction: 'long' | 'short';
  rating: string;
  entry_price: number;
  current_price: number | null;
  price_target: number;
  entry_date: string;
  time_horizon_months: number;
  thesis: string;
  catalyst: string | null;
  display_name: string;
  brief_markdown: string;
  days_held: number;
  return_pct: number;
}

export function renderCallDetail(call: CallDetail, brand: 'stockpitch' | 'levincap', origin: string): string {
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

  const dirColor = call.direction === 'long' ? '#2EBD6B' : '#E04759';
  const returnColor = call.return_pct >= 0 ? '#2EBD6B' : '#E04759';
  const returnPct = call.return_pct != null ? (call.return_pct * 100).toFixed(1) : '—';
  const impliedReturn = call.direction === 'long'
    ? ((call.price_target - call.entry_price) / call.entry_price) * 100
    : ((call.entry_price - call.price_target) / call.entry_price) * 100;

  const brief = renderMarkdown(call.brief_markdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${call.ticker} — ${call.display_name}'s ${call.direction} call · ${isLevin ? 'Levin Capital Research' : 'Stock Pitch'}</title>

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:title" content="${call.ticker} ${call.direction.toUpperCase()} · ${call.display_name}'s call">
<meta property="og:description" content="Entry $${call.entry_price.toFixed(2)} · Target $${call.price_target.toFixed(2)} · ${impliedReturn.toFixed(1)}% implied${call.return_pct !== 0 ? ` · ${returnPct}% so far` : ''}">
<meta property="og:image" content="${origin}/c/${call.id}/og.png">
<meta property="og:url" content="${origin}/c/${call.id}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${call.ticker} ${call.direction.toUpperCase()} · ${call.display_name}">
<meta name="twitter:description" content="Entry $${call.entry_price.toFixed(2)} · Target $${call.price_target.toFixed(2)}">
<meta name="twitter:image" content="${origin}/c/${call.id}/og.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,900&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:${bg};--surface:${surface};--ink:${ink};--ink-muted:${inkMuted};--border:${border};
  --accent:${accent};--green:#2EBD6B;--red:#E04759;
  --display:${displayFont};--body:${bodyFont};--sans:'Inter',system-ui,sans-serif;--mono:'JetBrains Mono',monospace;
}
body{font-family:var(--body);background:var(--bg);color:var(--ink);line-height:1.6;-webkit-font-smoothing:antialiased;font-size:17px}
a{color:inherit;text-decoration:none}
.wrap{max-width:760px;margin:0 auto;padding:0 24px}

nav{padding:16px 0;border-bottom:1px solid var(--border);position:sticky;top:0;background:${isLevin ? 'rgba(250,247,240,0.94)' : 'rgba(255,255,255,0.94)'};backdrop-filter:blur(12px);z-index:50}
nav .wrap{display:flex;justify-content:space-between;align-items:center}
.brand{font-family:${isLevin ? 'var(--display)' : 'var(--mono)'};font-weight:${isLevin ? '900' : '700'};font-size:${isLevin ? '20px' : '14px'};color:var(--ink)}
.brand em{font-weight:${isLevin ? '400' : '500'};font-style:italic}
.nav-back{font-family:var(--sans);font-size:12px;color:var(--ink-muted);font-weight:500;letter-spacing:0.5px}
.nav-back:hover{color:var(--ink)}

/* Masthead card */
.masthead{padding:48px 0 24px}
.badge-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.badge{padding:4px 10px;font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border-radius:${isLevin ? '0' : '99px'}}
.badge.dir-long{background:rgba(46,189,107,0.12);color:var(--green)}
.badge.dir-short{background:rgba(224,71,89,0.12);color:var(--red)}
.badge.rating{background:${isLevin ? 'rgba(184,151,62,0.12)' : 'rgba(10,15,31,0.08)'};color:${isLevin ? 'var(--accent)' : 'var(--ink)'}}
.badge.date{color:var(--ink-muted);background:transparent;border:1px solid var(--border)}

.ticker-hero{font-family:var(--mono);font-weight:700;font-size:48px;color:var(--ink);letter-spacing:-0.01em;margin-bottom:4px}
.company-name{font-family:var(--display);font-weight:${isLevin ? '400' : '600'};${isLevin ? 'font-style:italic' : ''};font-size:22px;color:var(--ink-muted);margin-bottom:28px}

/* Price block */
.price-block{background:var(--surface);border:1px solid var(--border);border-radius:${isLevin ? '0' : '14px'};padding:28px;margin-bottom:40px;display:grid;grid-template-columns:1fr 1fr;gap:24px}
.price-block .col{position:relative}
.price-block .col + .col{padding-left:24px;border-left:1px solid var(--border)}
.price-block .label{font-family:var(--mono);font-size:10px;color:var(--ink-muted);letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-bottom:6px}
.price-block .v{font-family:var(--display);font-weight:${isLevin ? '900' : '800'};font-size:36px;color:var(--ink);letter-spacing:-0.02em;line-height:1}
.price-block .sub{font-family:var(--sans);font-size:12px;color:var(--ink-muted);margin-top:4px}
.price-block .v.return{color:${returnColor}}

/* Analyst byline */
.byline{display:flex;align-items:center;gap:12px;padding:20px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:40px}
.byline .avatar{width:44px;height:44px;border-radius:50%;background:var(--accent);color:${isLevin ? 'var(--ink)' : '#fff'};display:flex;align-items:center;justify-content:center;font-family:var(--sans);font-weight:700;font-size:16px}
.byline .name{font-family:var(--display);font-weight:${isLevin ? '700' : '700'};font-size:17px;color:var(--ink);line-height:1.2}
.byline .meta{font-family:var(--sans);font-size:12px;color:var(--ink-muted);margin-top:2px}

/* Thesis card */
.thesis-card{background:${isLevin ? '#F3EEE1' : '#F5F6F8'};border-left:4px solid var(--accent);padding:24px 28px;margin-bottom:40px;border-radius:${isLevin ? '0' : '0 14px 14px 0'}}
.thesis-card .label{font-family:var(--mono);font-size:10px;color:var(--accent);letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:10px}
.thesis-card .body{font-family:var(--body);font-size:18px;color:var(--ink);line-height:1.65;${isLevin ? 'font-style:italic' : ''};font-weight:${isLevin ? '500' : '400'}}

/* Brief (AI-generated) */
.brief{padding:24px 0 60px}
.brief-label{font-family:var(--mono);font-size:10px;color:var(--ink-muted);letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-bottom:6px}
.brief h1{display:none}
.brief h2{font-family:var(--display);font-weight:${isLevin ? '900' : '800'};font-size:24px;color:var(--ink);letter-spacing:-0.01em;margin:32px 0 14px;line-height:1.2}
.brief h2:first-of-type{margin-top:0}
.brief p{font-family:var(--body);font-size:${isLevin ? '18px' : '16px'};color:var(--ink);line-height:1.75;margin-bottom:18px}
.brief ul{margin:16px 0 18px 0;padding-left:0;list-style:none}
.brief li{font-family:var(--body);font-size:${isLevin ? '17px' : '15px'};color:var(--ink);line-height:1.65;padding:8px 0 8px 24px;position:relative}
.brief li::before{content:'\u276F';position:absolute;left:0;color:var(--accent);font-weight:700}
.brief blockquote{border-left:3px solid var(--accent);padding:6px 0 6px 20px;margin:16px 0;font-family:var(--body);${isLevin ? 'font-style:italic' : ''};color:var(--ink);font-size:${isLevin ? '20px' : '17px'};line-height:1.55}
.brief strong{color:var(--ink);font-weight:700}
.brief em{color:var(--ink);${isLevin ? 'font-style:italic' : ''}}

/* Share block */
.share{background:${isLevin ? 'var(--ink)' : '#0A0F1F'};color:#FAF7F0;padding:40px;margin:40px 0;border-radius:${isLevin ? '0' : '18px'};text-align:center}
.share h3{font-family:var(--display);font-weight:${isLevin ? '900' : '800'};font-size:26px;color:#FAF7F0;letter-spacing:-0.01em;margin-bottom:10px}
.share h3 em{font-style:italic;font-weight:${isLevin ? '400' : '500'};color:var(--accent)}
.share p{font-family:var(--body);font-size:16px;color:rgba(250,247,240,0.65);margin-bottom:24px;${isLevin ? 'font-style:italic' : ''}}
.share-buttons{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.share-btn{padding:14px 24px;background:var(--accent);color:${isLevin ? 'var(--ink)' : '#07122B'};border:none;border-radius:${isLevin ? '0' : '10px'};font-family:var(--sans);font-weight:700;font-size:14px;cursor:pointer;letter-spacing:0.3px;transition:transform 0.12s}
.share-btn:hover{transform:translateY(-2px)}
.share-btn.twitter{background:#fff;color:#000}
.share-btn.outline{background:transparent;color:#FAF7F0;border:1px solid rgba(250,247,240,0.3)}
.share-btn.outline:hover{border-color:var(--accent);color:var(--accent)}

/* Footer */
footer{padding:40px 0;border-top:1px solid var(--border);text-align:center;font-family:var(--sans);font-size:12px;color:var(--ink-muted)}
footer a{color:var(--accent);font-weight:600}

@media(max-width:640px){
  .ticker-hero{font-size:36px}
  .price-block{grid-template-columns:1fr;gap:16px}
  .price-block .col + .col{padding-left:0;padding-top:16px;border-left:none;border-top:1px solid var(--border)}
  .price-block .v{font-size:28px}
  .brief h2{font-size:20px}
  .share{padding:28px 20px}
  .share h3{font-size:22px}
}
</style>
</head>
<body>

<nav>
  <div class="wrap">
    <a href="/" class="brand">${brandMark}</a>
    <a href="/leaderboard" class="nav-back">&larr; Leaderboard</a>
  </div>
</nav>

<main>
  <section class="masthead">
    <div class="wrap">
      <div class="badge-row">
        <span class="badge dir-${call.direction}">${call.direction === 'long' ? '\u2191 LONG' : '\u2193 SHORT'}</span>
        <span class="badge rating">${call.rating.toUpperCase()}</span>
        <span class="badge date">${formatDate(call.entry_date)} &middot; ${call.time_horizon_months} mo target</span>
      </div>
      <div class="ticker-hero">${call.ticker}</div>
      ${call.company ? `<div class="company-name">${call.company}</div>` : ''}

      <div class="price-block">
        <div class="col">
          <div class="label">Entry</div>
          <div class="v">$${call.entry_price.toFixed(2)}</div>
          <div class="sub">Locked ${formatDate(call.entry_date)}</div>
        </div>
        <div class="col">
          <div class="label">${call.current_price != null ? 'Current' : 'Target'}</div>
          ${call.current_price != null ? `
            <div class="v return">${returnPct === '—' ? '—' : (call.return_pct >= 0 ? '+' : '') + returnPct + '%'}</div>
            <div class="sub">$${call.current_price.toFixed(2)} &middot; ${call.days_held} day${call.days_held === 1 ? '' : 's'} held</div>
          ` : `
            <div class="v">$${call.price_target.toFixed(2)}</div>
            <div class="sub">${impliedReturn >= 0 ? '+' : ''}${impliedReturn.toFixed(1)}% implied</div>
          `}
        </div>
      </div>

      <div class="byline">
        <div class="avatar">${initials(call.display_name)}</div>
        <div>
          <div class="name">${call.display_name}</div>
          <div class="meta">Analyst &middot; Entry ${formatDate(call.entry_date)}</div>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="thesis-card">
        <div class="label">The Thesis &middot; in the analyst's own words</div>
        <div class="body">"${escapeHtml(call.thesis)}"</div>
      </div>

      <div class="brief-label">Research Brief &middot; AI-assisted, ${call.display_name}'s thesis extended</div>
      <article class="brief">${brief}</article>

      <div class="share">
        <h3>Share the <em>call</em></h3>
        <p>Your name is on it. Your thesis is public. Track it live on the leaderboard.</p>
        <div class="share-buttons">
          <a class="share-btn twitter" href="#" onclick="shareTwitter(event)">&#x1D54F; Share on X</a>
          <button class="share-btn" onclick="copyLink()">&#128279; Copy Link</button>
          <a class="share-btn outline" href="/submit">&rarr; Pitch Another</a>
        </div>
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    &copy; 2026 ${isLevin ? 'Levin Capital Research' : 'Stock Pitch'} &middot;
    <a href="/leaderboard">Leaderboard</a> &middot;
    <a href="/submit">Pitch a Stock</a>
  </div>
</footer>

<script>
function shareTwitter(e){
  e.preventDefault();
  const url = location.href;
  const text = '${call.ticker} ${call.direction.toUpperCase()} · my call. Entry $${call.entry_price.toFixed(2)}, target $${call.price_target.toFixed(2)}. Tracked live:';
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url), '_blank');
}
async function copyLink(){
  try {
    await navigator.clipboard.writeText(location.href);
    const btn = event.target;
    const orig = btn.textContent;
    btn.textContent = '\u2713 Copied';
    setTimeout(() => { btn.textContent = orig; }, 1800);
  } catch(e){}
}
</script>

</body>
</html>`;
}

// --- Helpers ---

function initials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c] || c));
}

/** Minimal markdown renderer — handles the subset we need from AI briefs */
function renderMarkdown(md: string): string {
  if (!md) return '';
  // Escape HTML first
  let html = escapeHtml(md);

  // Headers
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Bold / italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

  // Lists (- or * at line start)
  html = html.replace(/(?:^|\n)((?:- .+\n?)+)/g, (_m, block) => {
    const items = block.trim().split('\n').map((l: string) => '<li>' + l.replace(/^- /, '') + '</li>').join('');
    return '\n<ul>' + items + '</ul>\n';
  });

  // Paragraphs: split on double-newline, wrap non-tagged lines
  const blocks = html.split(/\n\s*\n/);
  html = blocks.map(b => {
    b = b.trim();
    if (!b) return '';
    if (/^<(h2|ul|blockquote|p)/.test(b)) return b;
    return '<p>' + b.replace(/\n/g, ' ') + '</p>';
  }).join('\n');

  return html;
}
