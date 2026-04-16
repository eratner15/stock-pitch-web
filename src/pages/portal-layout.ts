import { escapeHtml } from '../lib/security';

/**
 * Shared portal layout — used by index/memo/model/consensus/deck/questions
 * so the five pages read as one continuous product.
 */

export interface PortalLayoutInput {
  ticker: string;
  company: string;
  activePage: 'index' | 'memo' | 'model' | 'consensus' | 'deck' | 'questions';
  price: string;                 // pre-formatted, e.g. "$198.08"
  asOf: string;                  // pre-formatted, e.g. "2026-04-14"
  title: string;                 // <title> content
  pageStyles?: string;           // extra CSS injected into <style>
  body: string;                  // inner <body> HTML (between nav + footer)
}

export function portalLayout(input: PortalLayoutInput): string {
  const { ticker, company, activePage, price, asOf, title, pageStyles, body } = input;
  const t = escapeHtml(ticker);
  const c = escapeHtml(company);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${c} (${t}) — Levin Capital Strategies institutional research portal.">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<style>
${PORTAL_CSS}
${pageStyles || ''}
</style>
</head>
<body>

<nav aria-label="Main navigation">
  <div class="wrap">
    <a href="/stock-pitch" class="nav-brand">Levin Capital Strategies</a>
    <div class="nav-links">
      <a href="/stock-pitch/${t}" class="${activePage === 'index' ? 'active' : ''}">Overview</a>
      <a href="/stock-pitch/${t}/memo" class="${activePage === 'memo' ? 'active' : ''}">Memo</a>
      <a href="/stock-pitch/${t}/model" class="${activePage === 'model' ? 'active' : ''}">Model</a>
      <a href="/stock-pitch/${t}/consensus" class="${activePage === 'consensus' ? 'active' : ''}">Consensus</a>
      <a href="/stock-pitch/${t}/deck" class="${activePage === 'deck' ? 'active' : ''}">Deck</a>
      <a href="/stock-pitch/${t}/questions" class="${activePage === 'questions' ? 'active' : ''}">Questions</a>
    </div>
    <div class="nav-right">
      <span class="nav-ticker">NYSE/NASDAQ: <strong>${t}</strong>${price && price !== '—' ? ` ${escapeHtml(price)}` : ''}${asOf ? ` <span class="as-of">as of ${escapeHtml(asOf)}</span>` : ''}</span>
    </div>
  </div>
</nav>

${body}

<footer>
  <div class="wrap">
    <div>© ${new Date().getFullYear()} Levin Capital Strategies</div>
    <div>
      <a href="/stock-pitch/${t}">Overview</a> ·
      <a href="/stock-pitch/${t}/memo">Memo</a> ·
      <a href="/stock-pitch/${t}/model">Model</a> ·
      <a href="/stock-pitch/${t}/consensus">Consensus</a> ·
      <a href="/stock-pitch/${t}/deck">Deck</a>
    </div>
  </div>
</footer>

</body>
</html>`;
}

/**
 * Markdown-to-HTML for AI output snippets. Handles paragraphs, bold/italic,
 * [Source] tag spans, line breaks. Safe: escapes first, then tags.
 */
export function portalMarkdown(md: string, inline = false): string {
  if (!md) return '';
  let out = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  out = out.replace(/\[([A-Za-z0-9\-\s]+)\]/g, '<span class="source-tag">[$1]</span>');
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*([^*]+)\*(\s|$)/g, '$1<em>$2</em>$3');
  if (inline) return out.trim();
  // Convert markdown tables to HTML
  out = out.replace(/((?:^\|.+\|$\n?){2,})/gm, (tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return tableBlock;
    const parseRow = (r: string) => r.split('|').slice(1, -1).map(c => c.trim());
    const header = parseRow(rows[0]);
    const isSep = (r: string) => /^\|[\s\-:|]+\|$/.test(r.trim());
    const dataStart = isSep(rows[1]) ? 2 : 1;
    const ths = header.map(h => `<th>${h}</th>`).join('');
    const trs = rows.slice(dataStart).filter(r => !isSep(r)).map(r => {
      const cells = parseRow(r);
      return `<tr>${cells.map(c => `<td>${c.startsWith('**') ? `<strong>${c.replace(/\*\*/g, '')}</strong>` : c}</td>`).join('')}</tr>`;
    }).join('');
    return `<table class="data"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  });
  // Convert markdown headers to HTML
  out = out.replace(/^#{3}\s+(.+)$/gm, '<h4 class="section-sub">$1</h4>');
  out = out.replace(/^#{2}\s+(.+)$/gm, '<h3 class="section-sub">$1</h3>');
  out = out.replace(/^#{1}\s+(.+)$/gm, '<h3 class="section-sub">$1</h3>');
  // Convert bullet lists
  out = out.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
  out = out.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul class="memo-list">${m}</ul>`);
  // Paragraphs — split on double newline but preserve headers and lists
  return out
    .split(/\n{2,}/)
    .map(p => {
      const t = p.trim();
      if (!t) return '';
      if (t.startsWith('<h') || t.startsWith('<ul') || t.startsWith('<li')) return t;
      return `<p>${t.replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

export const PORTAL_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#FFFFFF;--surface:#F8F9FB;--surface-2:#F1F3F6;--navy:#0F1729;
  --border:#E2E5EB;--border-light:#ECEEF2;
  --gold:#B8973E;--gold-soft:rgba(184,151,62,0.08);--gold-deep:#8B6F28;
  --steel:#2C5F7C;--green:#1A7A3A;--red:#C0392B;
  --text:#2D3748;--text-muted:#6B7280;--heading:#111827;
}
html{scroll-behavior:smooth;scroll-padding-top:110px}
body{font-family:'Merriweather',Georgia,serif;background:var(--bg);color:var(--text);line-height:1.7}
a{color:inherit;text-decoration:none}

nav[aria-label="Main navigation"]{position:fixed;top:0;left:0;right:0;z-index:100;padding:14px 0;background:rgba(255,255,255,0.92);backdrop-filter:blur(16px);border-bottom:1px solid var(--border-light)}
nav .wrap{max-width:1120px;margin:0 auto;padding:0 32px;display:flex;justify-content:space-between;align-items:center;gap:20px}
.nav-brand{font-family:'Inter',sans-serif;font-size:11px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;font-weight:700;white-space:nowrap}
.nav-links{display:flex;gap:16px;font-family:'Inter',sans-serif}
.nav-links a{font-size:12px;color:var(--text-muted);font-weight:500;transition:color 0.2s;white-space:nowrap}
.nav-links a.active,.nav-links a:hover{color:var(--heading)}
.nav-right{display:flex;align-items:center;gap:16px;font-family:'Inter',sans-serif;font-size:12px;color:var(--text-muted)}
.nav-ticker strong{color:var(--heading);font-weight:700;margin-left:4px}
.nav-ticker .as-of{color:var(--text-muted);font-weight:400;margin-left:6px;font-size:11px}

.portal-main{max-width:1120px;margin:0 auto;padding:130px 32px 80px}
.portal-narrow{max-width:720px;margin:0 auto;padding:130px 32px 80px}

h1{font-family:'Inter',sans-serif;font-size:36px;font-weight:800;color:var(--heading);letter-spacing:-0.02em;line-height:1.2;margin-bottom:14px}
h2{font-family:'Inter',sans-serif;font-size:24px;font-weight:800;color:var(--heading);margin:36px 0 16px;letter-spacing:-0.02em;scroll-margin-top:110px}
h3{font-family:'Inter',sans-serif;font-size:15px;font-weight:700;color:var(--heading);text-transform:uppercase;letter-spacing:1px;margin:24px 0 10px}

p{font-size:16px;line-height:1.75;color:var(--text);margin-bottom:18px}
p strong{color:var(--heading)}

.page-eyebrow{font-family:'Inter',sans-serif;font-size:11px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;font-weight:700;margin-bottom:12px}
.page-subtitle{font-family:'Inter',sans-serif;font-size:14px;color:var(--text-muted);font-weight:500;margin-bottom:4px}
.page-tagline{font-family:'Merriweather',serif;font-style:italic;font-size:18px;color:var(--text);margin-top:14px;line-height:1.55}

/* ── Memo section formatting ── */
.memo-page section{padding:36px 0 28px;border-top:1px solid var(--border);margin-top:8px}
.memo-page section:first-of-type{border-top:none;margin-top:0}
.memo-page h2{font-size:24px;line-height:1.25;margin-bottom:18px;color:var(--heading)}
.memo-page p{max-width:680px}
.memo-page .memo-header{padding-bottom:28px;border-bottom:2px solid var(--heading);margin-bottom:8px}
.memo-page .memo-tagline{font-family:'Merriweather',serif;font-style:italic;font-size:19px;color:var(--text-muted);margin-top:8px;line-height:1.5}
.memo-page .memo-rating-strip{display:flex;gap:0;margin-top:24px;border:1px solid var(--border);background:var(--surface)}
.memo-page .memo-rating-strip .rs{flex:1;padding:16px 18px;border-right:1px solid var(--border)}
.memo-page .memo-rating-strip .rs:last-child{border-right:none}
.memo-page .memo-rating-strip .lbl{font-family:'Inter',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);font-weight:600}
.memo-page .memo-rating-strip .val{font-size:22px;font-weight:800;color:var(--heading);margin-top:4px;font-family:'Inter',sans-serif}
.memo-page .memo-rating-strip .val.gold{color:var(--gold-deep)}
.memo-toc{background:var(--surface);border:1px solid var(--border);padding:20px 28px;margin:24px 0}
.memo-toc strong{font-family:'Inter',sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted)}
.memo-toc ol{columns:2;column-gap:32px;margin-top:12px;padding-left:20px}
.memo-toc li{font-family:'Inter',sans-serif;font-size:13px;line-height:2;color:var(--text)}
.memo-toc a{color:var(--steel);text-decoration:none;border-bottom:1px solid transparent}
.memo-toc a:hover{border-bottom-color:var(--steel)}
.bull-bear{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}
.bb-card{padding:24px;border:1px solid var(--border)}
.bb-card.bull{border-left:4px solid var(--green);background:rgba(26,122,58,0.03)}
.bb-card.bear{border-left:4px solid var(--red);background:rgba(192,57,43,0.03)}
.bb-card h3{font-family:'Inter',sans-serif;font-size:14px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px}
.bb-card.bull h3{color:var(--green)}
.bb-card.bear h3{color:var(--red)}
.bb-card ul{padding-left:18px;margin:0}
.bb-card li{font-size:14.5px;line-height:1.65;margin-bottom:8px;color:var(--text)}
.memo-sidenote{float:right;clear:right;width:200px;margin:0 -240px 16px 20px;padding:12px 14px;background:var(--surface);border-left:2px solid var(--gold);font-family:'Inter',sans-serif;font-size:12px;line-height:1.55;color:var(--text-muted)}
.diligence{display:grid;gap:16px}
.dq{background:var(--surface);padding:18px 22px;border-left:3px solid var(--steel)}
.dq-q{font-family:'Merriweather',serif;font-weight:700;font-size:15px;color:var(--heading);margin-bottom:6px}
.dq-why{font-family:'Inter',sans-serif;font-size:13px;color:var(--text-muted);font-style:italic}
.disclaimer{font-family:'Inter',sans-serif;font-size:12px;color:var(--text-muted);line-height:1.65;margin-top:40px;padding-top:20px;border-top:1px solid var(--border);max-width:680px}
@media(max-width:900px){
  .memo-sidenote{float:none;width:auto;margin:12px 0;border-left:2px solid var(--gold)}
  .bull-bear{grid-template-columns:1fr}
  .memo-toc ol{columns:1}
  .memo-page .memo-rating-strip{flex-wrap:wrap}
  .memo-page .memo-rating-strip .rs{min-width:45%;flex:1 1 45%}
}
.kicker{font-family:'Inter',sans-serif;font-size:10px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;font-weight:700;margin-bottom:8px}

.source-tag{display:inline-block;font-family:'Inter',sans-serif;font-size:10px;color:var(--gold);font-weight:600;letter-spacing:0.3px;vertical-align:super;margin-left:2px}
.section-sub{font-family:'Inter',sans-serif;font-size:18px;font-weight:700;color:var(--heading);margin:28px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border-light)}
.memo-list{margin:12px 0 12px 24px;list-style:disc}.memo-list li{margin-bottom:6px;line-height:1.65}

table.data{width:100%;border-collapse:collapse;font-family:'Inter',sans-serif;font-size:13px;margin:18px 0 28px}
table.data th{text-align:left;padding:10px 12px;border-bottom:2px solid var(--border);font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);font-weight:700}
table.data td{padding:12px;border-bottom:1px solid var(--border-light);color:var(--text)}
table.data td.r,table.data th.r{text-align:right;font-variant-numeric:tabular-nums}
table.data tr:hover td{background:var(--surface)}
table.data td strong{color:var(--heading)}

.bluf{background:var(--gold-soft);border-left:3px solid var(--gold);padding:18px 22px;margin:24px 0 28px;font-family:'Merriweather',serif;font-size:16px;line-height:1.65;color:var(--heading)}
.bluf strong{font-weight:700}

.meta-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:24px;border-top:1px solid var(--border-light);border-bottom:1px solid var(--border-light);font-family:'Inter',sans-serif}
.meta-strip .cell{padding:14px 0;border-right:1px solid var(--border-light)}
.meta-strip .cell:last-child{border-right:none}
.meta-strip .lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);font-weight:600}
.meta-strip .val{font-size:20px;font-weight:700;color:var(--heading);margin-top:4px}
.meta-strip .val.pos{color:var(--green)}
.meta-strip .val.neg{color:var(--red)}
.meta-strip .val.gold{color:var(--gold-deep)}

.disclaimer{background:var(--surface);border-left:3px solid var(--text-muted);padding:14px 18px;margin:32px 0 0;font-family:'Inter',sans-serif;font-size:12px;color:var(--text-muted);line-height:1.6}
.disclaimer a{color:var(--gold);border-bottom:1px dotted var(--gold);font-weight:600}

footer{border-top:1px solid var(--border-light);padding:32px 0 48px;font-family:'Inter',sans-serif;font-size:12px;color:var(--text-muted);margin-top:48px}
footer .wrap{max-width:1120px;margin:0 auto;padding:0 32px;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
footer a{color:var(--text-muted);border-bottom:1px solid var(--border)}

@media(max-width:820px){
  nav .wrap{padding:0 20px;gap:10px}
  .nav-links{display:none}
  .nav-right{font-size:11px}
  .portal-main,.portal-narrow{padding:100px 20px 60px}
  h1{font-size:26px}
  h2{font-size:20px}
  .meta-strip{grid-template-columns:1fr 1fr}
  .meta-strip .cell:nth-child(even){border-right:none}
  .meta-strip .cell:nth-last-child(-n+2){border-top:1px solid var(--border-light)}
}
`;
