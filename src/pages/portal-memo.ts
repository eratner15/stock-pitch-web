import { escapeHtml } from '../lib/security';
import type { PortalContent } from '../lib/portal-generator';
import type { PriceQuote } from '../lib/prices';

/**
 * Portal memo page — matches the /amzn/memo.html aesthetic: fixed nav,
 * centered reading column, section kickers, inline source tags, Tufte-style
 * sidenotes. Uses the same CSS vars + Inter/Merriweather pair as the
 * hand-built portals on research.levincap.com/*.
 */

export interface PortalMemoInput {
  ticker: string;
  company: string;
  content: PortalContent;
  quote: PriceQuote | null;
  filing_10k_url: string | null;
  filing_10k_date: string | null;
  generated_at: string;
}

export function renderPortalMemo(input: PortalMemoInput): string {
  const { ticker, company, content, quote, filing_10k_url, filing_10k_date, generated_at } = input;
  const safeTicker = escapeHtml(ticker);
  const safeCompany = escapeHtml(company);

  const price = quote ? `$${quote.price.toFixed(2)}` : '—';
  const asOf = quote?.as_of ? quote.as_of.slice(0, 10) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${safeCompany} (${safeTicker}) investment memo — Levin Capital Strategies research.">
<title>${safeTicker} Investment Memo · LCS Research</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#FFFFFF;--surface:#F8F9FB;--navy:#0F1729;--border:#E2E5EB;--border-light:#ECEEF2;
  --gold:#B8973E;--gold-soft:rgba(184,151,62,0.08);--steel:#2C5F7C;
  --green:#1A7A3A;--red:#C0392B;
  --text:#2D3748;--text-muted:#6B7280;--heading:#111827;
}
html{scroll-behavior:smooth;scroll-padding-top:110px}
body{font-family:'Merriweather',Georgia,serif;background:var(--bg);color:var(--text);line-height:1.7}
a{color:inherit;text-decoration:none}

/* NAV — fixed top bar, matches /amzn style */
nav[aria-label="Main navigation"]{position:fixed;top:0;left:0;right:0;z-index:100;padding:14px 0;background:rgba(255,255,255,0.92);backdrop-filter:blur(16px);border-bottom:1px solid var(--border-light)}
nav .wrap{max-width:1120px;margin:0 auto;padding:0 32px;display:flex;justify-content:space-between;align-items:center}
.nav-brand{font-family:'Inter',sans-serif;font-size:11px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;font-weight:700}
.nav-links{display:flex;gap:18px;font-family:'Inter',sans-serif}
.nav-links a{font-size:12px;color:var(--text-muted);font-weight:500;transition:color 0.2s}
.nav-links a.active,.nav-links a:hover{color:var(--heading)}
.nav-right{display:flex;align-items:center;gap:16px;font-family:'Inter',sans-serif;font-size:12px;color:var(--text-muted)}
.nav-ticker strong{color:var(--heading);font-weight:700;margin-left:4px}

/* HEADER */
.memo-header{padding:130px 0 36px;max-width:720px;margin:0 auto;padding-left:32px;padding-right:32px;border-bottom:1px solid var(--border-light)}
.memo-eyebrow{font-family:'Inter',sans-serif;font-size:11px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;font-weight:700;margin-bottom:12px}
.memo-header h1{font-family:'Inter',sans-serif;font-size:36px;font-weight:800;color:var(--heading);letter-spacing:-0.02em;line-height:1.2;margin-bottom:14px}
.memo-subtitle{font-family:'Inter',sans-serif;font-size:14px;color:var(--text-muted);font-weight:500}
.memo-tagline{font-family:'Merriweather',serif;font-style:italic;font-size:18px;color:var(--text);margin-top:14px;line-height:1.55}

/* META STRIP */
.meta-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:24px;border-top:1px solid var(--border-light);border-bottom:1px solid var(--border-light);font-family:'Inter',sans-serif}
.meta-strip .cell{padding:14px 0;border-right:1px solid var(--border-light)}
.meta-strip .cell:last-child{border-right:none}
.meta-strip .lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);font-weight:600}
.meta-strip .val{font-size:18px;font-weight:700;color:var(--heading);margin-top:4px}
.meta-strip .val.pos{color:var(--green)}
.meta-strip .val.neg{color:var(--red)}

/* BODY */
.memo-body{max-width:720px;margin:0 auto;padding:40px 32px 80px}
.memo-body h2{font-family:'Inter',sans-serif;font-size:24px;font-weight:800;color:var(--heading);margin:36px 0 16px;letter-spacing:-0.02em;scroll-margin-top:110px}
.memo-body h3{font-family:'Inter',sans-serif;font-size:15px;font-weight:700;color:var(--heading);text-transform:uppercase;letter-spacing:1px;margin:24px 0 10px}
.memo-body p{font-size:16px;line-height:1.75;color:var(--text);margin-bottom:18px}
.memo-body p strong{color:var(--heading)}
.memo-body ul{margin:12px 0 20px;padding-left:20px}
.memo-body li{margin-bottom:10px;line-height:1.7}
.memo-body a.source-link{color:var(--gold);border-bottom:1px dotted var(--gold);font-weight:600}

.kicker{font-family:'Inter',sans-serif;font-size:10px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;font-weight:700;margin-top:40px;margin-bottom:8px}

/* Source tags inline [10-K], [Market], etc. */
.source-tag{display:inline-block;font-family:'Inter',sans-serif;font-size:10px;color:var(--gold);font-weight:600;letter-spacing:0.3px;vertical-align:super;margin-left:2px}

/* TOC */
.memo-toc{position:static;z-index:1;background:var(--surface);border:1px solid var(--border-light);border-radius:10px;padding:20px 24px;margin:28px 0 36px}
.memo-toc strong{display:block;font-family:'Inter',sans-serif;font-size:10px;letter-spacing:2px;color:var(--gold);font-weight:700;text-transform:uppercase;margin-bottom:12px}
.memo-toc a{display:inline-block;margin-right:16px;margin-bottom:6px;font-family:'Inter',sans-serif;font-size:13px;color:var(--heading);font-weight:500;border-bottom:1px dotted var(--border)}
.memo-toc a:hover{color:var(--gold)}

/* BLUF callout */
.bluf{background:var(--gold-soft);border-left:3px solid var(--gold);padding:18px 22px;margin:24px 0 28px;font-family:'Merriweather',serif;font-size:16px;line-height:1.65;color:var(--heading)}
.bluf strong{font-weight:700}

/* Bull/Bear two-column */
.bull-bear{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0 36px}
.bb-card{background:var(--surface);border:1px solid var(--border-light);border-radius:10px;padding:22px}
.bb-card.bull{border-top:3px solid var(--green)}
.bb-card.bear{border-top:3px solid var(--red)}
.bb-card h3{font-size:12px;letter-spacing:2px;margin-top:0;color:var(--heading)}
.bb-card ul{padding-left:18px;margin:10px 0 0}
.bb-card li{font-size:15px;line-height:1.55;margin-bottom:10px;color:var(--text)}

/* Diligence Q&A list */
.diligence{margin:20px 0 32px}
.dq{padding:16px 0;border-bottom:1px solid var(--border-light)}
.dq:last-child{border-bottom:none}
.dq-q{font-family:'Merriweather',serif;font-size:16px;font-weight:700;color:var(--heading);margin-bottom:4px}
.dq-why{font-family:'Inter',sans-serif;font-size:13px;color:var(--text-muted);line-height:1.5}
.dq-why::before{content:"Why: ";color:var(--gold);font-weight:600}

/* Footer */
footer{border-top:1px solid var(--border-light);padding:32px 0 48px;font-family:'Inter',sans-serif;font-size:12px;color:var(--text-muted)}
footer .wrap{max-width:720px;margin:0 auto;padding:0 32px;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
footer a{color:var(--text-muted);border-bottom:1px solid var(--border)}

.disclaimer{background:var(--surface);border-left:3px solid var(--text-muted);padding:14px 18px;margin:24px 0 0;font-family:'Inter',sans-serif;font-size:12px;color:var(--text-muted);line-height:1.6}

@media(max-width:720px){
  nav .wrap{padding:0 20px}
  .nav-links a{display:none}
  .nav-links a.active{display:inline}
  .memo-header,.memo-body{padding-left:20px;padding-right:20px}
  .memo-header{padding-top:100px}
  .memo-header h1{font-size:26px}
  .meta-strip{grid-template-columns:1fr 1fr}
  .meta-strip .cell:nth-child(even){border-right:none}
  .meta-strip .cell:nth-last-child(-n+2){border-top:1px solid var(--border-light)}
  .bull-bear{grid-template-columns:1fr;gap:14px}
}
</style>
</head>
<body>

<nav aria-label="Main navigation">
  <div class="wrap">
    <a href="/stock-pitch" class="nav-brand">Levin Capital Strategies</a>
    <div class="nav-links">
      <a href="/stock-pitch/${safeTicker}">Overview</a>
      <a href="/stock-pitch/${safeTicker}/memo" class="active">Memo</a>
      <a href="/stock-pitch/${safeTicker}/consensus">Consensus</a>
    </div>
    <div class="nav-right">
      <span class="nav-ticker">NYSE/NASDAQ: <strong>${safeTicker}</strong>${price !== '—' ? ` ${price}` : ''}</span>
    </div>
  </div>
</nav>

<header class="memo-header">
  <div class="memo-eyebrow">Investment Memo · Levin Capital Strategies</div>
  <h1>${safeCompany} (${safeTicker})</h1>
  <div class="memo-subtitle">${asOf ? `As of ${asOf}` : 'Live brief'} · Institutional Research</div>
  <div class="memo-tagline">${escapeHtml(content.tagline)}.</div>
  <div class="meta-strip">
    <div class="cell"><div class="lbl">Price</div><div class="val">${price}</div></div>
    <div class="cell"><div class="lbl">Direction</div><div class="val">—</div></div>
    <div class="cell"><div class="lbl">Analyst</div><div class="val">LCS</div></div>
    <div class="cell"><div class="lbl">Generated</div><div class="val" style="font-size:14px">${escapeHtml(generated_at.slice(0,10))}</div></div>
  </div>
</header>

<main class="memo-body">

<nav class="memo-toc" aria-label="Table of contents">
  <strong>Contents</strong>
  <a href="#summary">Business Summary</a>
  <a href="#scqa">Situation / Complication / Question / Answer</a>
  <a href="#bullbear">Bulls & Bears</a>
  <a href="#valuation">Valuation</a>
  <a href="#diligence">Questions for Management</a>
</nav>

<div class="bluf">
  <strong>The call:</strong> ${escapeHtml(content.answer || content.tagline + '.')}
</div>

<div class="kicker">§ I — Business Summary</div>
<h2 id="summary">${safeCompany} at a glance</h2>
${markdownToHtml(content.businessSummary)}

<div class="kicker">§ II — SCQA</div>
<h2 id="scqa">Situation, Complication, Question, Answer</h2>

<h3>Situation</h3>
${markdownToHtml(content.situation)}

<h3>Complication</h3>
${markdownToHtml(content.complication)}

<h3>The Central Question</h3>
${markdownToHtml(content.centralQuestion)}

<h3>Our Answer</h3>
${markdownToHtml(content.answer)}

<div class="kicker">§ III — Bulls and Bears</div>
<h2 id="bullbear">Bulls & Bears</h2>
<div class="bull-bear">
  <div class="bb-card bull">
    <h3>Bull Case</h3>
    <ul>${content.bullPoints.map(b => `<li>${markdownToHtml(b, true)}</li>`).join('')}</ul>
  </div>
  <div class="bb-card bear">
    <h3>Bear Case</h3>
    <ul>${content.bearPoints.map(b => `<li>${markdownToHtml(b, true)}</li>`).join('')}</ul>
  </div>
</div>

<div class="kicker">§ IV — Valuation</div>
<h2 id="valuation">How we frame value</h2>
${markdownToHtml(content.valuationNote)}

${content.diligenceQuestions.length > 0 ? `
<div class="kicker">§ V — Diligence</div>
<h2 id="diligence">Questions for Management</h2>
<div class="diligence">
  ${content.diligenceQuestions.map(d => `
    <div class="dq">
      <div class="dq-q">${escapeHtml(d.q)}</div>
      <div class="dq-why">${escapeHtml(d.rationale)}</div>
    </div>
  `).join('')}
</div>
` : ''}

<p class="disclaimer"><strong>Sources:</strong>
${filing_10k_url ? `<a class="source-link" href="${filing_10k_url}" target="_blank" rel="noopener">10-K (${escapeHtml(filing_10k_date || '')})</a> · ` : ''}
Live quotes via Yahoo Finance. This memo is automatically generated by Levin Capital Strategies' research platform from SEC primary sources. Not investment advice.</p>

</main>

<footer>
  <div class="wrap">
    <div>© ${new Date().getFullYear()} Levin Capital Strategies</div>
    <div><a href="/stock-pitch">← Build another pitch</a></div>
  </div>
</footer>

</body>
</html>`;
}

/**
 * Minimal markdown → HTML converter for the content snippets we get back
 * from the model. We only need to handle: bold (**...**), italic (*...*),
 * paragraph breaks (blank lines), inline tags like [10-K]. Every model
 * output is paragraph-level text — no headers, lists, or tables produced
 * by the model (we structure those ourselves).
 */
function markdownToHtml(md: string, inline = false): string {
  if (!md) return '';
  // Escape HTML first — model shouldn't emit it but defense in depth
  let out = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Inline tag decoration: [10-K], [Market], etc.
  out = out.replace(/\[([A-Za-z0-9\-]+)\]/g, '<span class="source-tag">[$1]</span>');
  // Bold + italic
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*([^*]+)\*(\s|$)/g, '$1<em>$2</em>$3');
  if (inline) return out.trim();
  // Paragraphs
  return out
    .split(/\n{2,}/)
    .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}
