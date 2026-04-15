import { escapeHtml } from '../lib/security';
import { portalLayout, portalMarkdown } from './portal-layout';
import type { PortalContent } from '../lib/portal-generator';
import type { PriceQuote } from '../lib/prices';

/**
 * Portal pages: index, model, consensus, deck, questions.
 * Memo page is in portal-memo.ts (kept separate because it's the richest).
 * All five pages share portal-layout for nav / chrome / typography.
 */

export interface PageInput {
  ticker: string;
  company: string;
  content: PortalContent;
  quote: PriceQuote | null;
  filing_10k_url: string | null;
  filing_10k_date: string | null;
  generated_at: string;
  peerQuotes?: Record<string, PriceQuote | null>; // for consensus page
}

const fmtPrice = (q: PriceQuote | null) => q ? `$${q.price.toFixed(2)}` : '—';
const fmtAsOf = (q: PriceQuote | null) => q?.as_of ? q.as_of.slice(0, 10) : '';

// ============================================================================
// INDEX / OVERVIEW PAGE
// ============================================================================
export function renderPortalIndex(input: PageInput): string {
  const { ticker, company, content, quote, generated_at } = input;
  const price = fmtPrice(quote);
  const asOf = fmtAsOf(quote);
  const ptLine = content.consensus.ourPt || '—';
  const ptFirst = ptLine.split(/[—–-]/)[0].trim();
  const ptDelta = ptLine.includes('—') || ptLine.includes('–') || ptLine.includes('-')
    ? ptLine.split(/[—–-]/).slice(1).join('—').trim()
    : '';

  const body = `
<main class="portal-main">
  <div class="page-eyebrow">Research Portal · Levin Capital Strategies</div>
  <h1>${escapeHtml(company)} <span style="color:var(--text-muted);font-weight:500">(${escapeHtml(ticker)})</span></h1>
  <div class="page-tagline" style="max-width:760px">${escapeHtml(content.tagline)}.</div>

  <div class="meta-strip" style="max-width:760px;grid-template-columns:repeat(4,1fr)">
    <div class="cell"><div class="lbl">Current Price</div><div class="val">${price}</div></div>
    <div class="cell"><div class="lbl">Price Target</div><div class="val gold">${escapeHtml(ptFirst)}</div></div>
    <div class="cell"><div class="lbl">Implied</div><div class="val" style="font-size:15px">${escapeHtml(ptDelta || '—')}</div></div>
    <div class="cell"><div class="lbl">As of</div><div class="val" style="font-size:14px">${asOf || generated_at.slice(0,10)}</div></div>
  </div>

  <div class="bluf" style="max-width:760px;margin-top:32px">
    <strong>The call:</strong> ${escapeHtml(stripMd(content.answer).slice(0, 500))}
  </div>

  <section class="index-grid">
    <a class="index-card" href="/stock-pitch/${escapeHtml(ticker)}/memo">
      <div class="index-card-eyebrow">§ I</div>
      <div class="index-card-title">Investment Memo</div>
      <div class="index-card-sub">Full thesis, SCQA analysis, bulls & bears, valuation framework.</div>
      <div class="index-card-cta">Read →</div>
    </a>
    <a class="index-card" href="/stock-pitch/${escapeHtml(ticker)}/model">
      <div class="index-card-eyebrow">§ II</div>
      <div class="index-card-title">Financial Model</div>
      <div class="index-card-sub">3-year historical + 3-year projected, key metrics, DCF narrative.</div>
      <div class="index-card-cta">Open →</div>
    </a>
    <a class="index-card" href="/stock-pitch/${escapeHtml(ticker)}/consensus">
      <div class="index-card-eyebrow">§ III</div>
      <div class="index-card-title">Street Consensus</div>
      <div class="index-card-sub">Peer comps, sell-side view, our price target & methodology.</div>
      <div class="index-card-cta">Compare →</div>
    </a>
    <a class="index-card" href="/stock-pitch/${escapeHtml(ticker)}/deck">
      <div class="index-card-eyebrow">§ IV</div>
      <div class="index-card-title">Presentation Deck</div>
      <div class="index-card-sub">8-slide pitch summary with speaker notes — for the IC room.</div>
      <div class="index-card-cta">Present →</div>
    </a>
    <a class="index-card" href="/stock-pitch/${escapeHtml(ticker)}/questions">
      <div class="index-card-eyebrow">§ V</div>
      <div class="index-card-title">Questions for Management</div>
      <div class="index-card-sub">${content.diligenceQuestions.length}-question diligence toolkit, each with rationale.</div>
      <div class="index-card-cta">Review →</div>
    </a>
  </section>

  <div style="max-width:760px;margin-top:16px">
    <p class="disclaimer">This portal was generated from SEC 10-K primary sources, live Yahoo Finance prices, and Workers AI (Llama 3.3 70B + Gemma). Numbers carry source tags; multi-step analysis is traceable. Not investment advice.</p>
  </div>
</main>
`;

  return portalLayout({
    ticker, company, activePage: 'index', price, asOf,
    title: `${ticker} · ${company} — LCS Research Portal`,
    body,
    pageStyles: `
.index-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin:40px 0 20px;max-width:1040px}
.index-card{display:block;background:var(--surface);border:1px solid var(--border-light);border-radius:12px;padding:24px 22px;transition:transform 0.15s,box-shadow 0.15s}
.index-card:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(15,23,41,0.08);border-color:var(--gold)}
.index-card-eyebrow{font-family:'Inter',sans-serif;font-size:10px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;font-weight:700;margin-bottom:8px}
.index-card-title{font-family:'Inter',sans-serif;font-size:18px;font-weight:700;color:var(--heading);margin-bottom:8px;letter-spacing:-0.01em}
.index-card-sub{font-family:'Merriweather',serif;font-size:14px;color:var(--text-muted);line-height:1.55;margin-bottom:14px}
.index-card-cta{font-family:'Inter',sans-serif;font-size:12px;color:var(--gold);font-weight:700;letter-spacing:1px;text-transform:uppercase}
`,
  });
}

// ============================================================================
// MODEL PAGE
// ============================================================================
export function renderPortalModel(input: PageInput): string {
  const { ticker, company, content, quote, filing_10k_url, filing_10k_date } = input;
  const price = fmtPrice(quote);
  const asOf = fmtAsOf(quote);
  const f = content.financials;

  const body = `
<main class="portal-narrow" style="max-width:880px">
  <div class="page-eyebrow">Financial Model · Levin Capital Strategies</div>
  <h1>${escapeHtml(company)} <span style="color:var(--text-muted);font-weight:500">(${escapeHtml(ticker)})</span></h1>
  <div class="page-subtitle">3-year historical + 3-year projected · FY figures from 10-K; estimates labeled</div>

  <div class="kicker">§ I — Historical</div>
  <h2>Reported financials (past 3 fiscal years)</h2>
  ${f.historical.length > 0 ? `
  <table class="data">
    <thead>
      <tr><th>Period</th><th class="r">Revenue</th><th class="r">Operating Income</th><th class="r">EPS</th></tr>
    </thead>
    <tbody>
      ${f.historical.map(h => `
        <tr>
          <td><strong>${escapeHtml(h.year)}</strong></td>
          <td class="r">${escapeHtml(h.revenue)}</td>
          <td class="r">${escapeHtml(h.operatingIncome)}</td>
          <td class="r">${escapeHtml(h.eps)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<p style="color:var(--text-muted)">Historical figures pending re-extraction from 10-K.</p>'}

  <div class="kicker">§ II — Projected</div>
  <h2>Forward estimates (next 3 fiscal years)</h2>
  ${f.projected.length > 0 ? `
  <table class="data">
    <thead>
      <tr><th>Period</th><th class="r">Revenue</th><th class="r">EBITDA Margin</th><th class="r">EPS</th></tr>
    </thead>
    <tbody>
      ${f.projected.map(p => `
        <tr>
          <td><strong>${escapeHtml(p.year)}</strong></td>
          <td class="r">${escapeHtml(p.revenue)}</td>
          <td class="r">${escapeHtml(p.ebitdaMargin)}</td>
          <td class="r">${escapeHtml(p.eps)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <p style="font-size:12px;color:var(--text-muted);font-family:'Inter',sans-serif;margin-top:-12px">
    Forward figures are <span class="source-tag">[Estimated]</span> using disclosed guidance + historical CAGR. Not a promise.
  </p>
  ` : '<p style="color:var(--text-muted)">Projections pending re-run.</p>'}

  <div class="kicker">§ III — Key Metrics</div>
  <h2>Snapshot</h2>
  ${f.keyMetrics.length > 0 ? `
  <table class="data">
    <thead><tr><th>Metric</th><th>Value</th><th>Source</th></tr></thead>
    <tbody>
      ${f.keyMetrics.map(k => `
        <tr>
          <td><strong>${escapeHtml(k.label)}</strong></td>
          <td>${escapeHtml(k.value)}</td>
          <td><span class="source-tag" style="vertical-align:baseline">${escapeHtml(k.source)}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<p style="color:var(--text-muted)">Key metrics pending.</p>'}

  <div class="kicker">§ IV — DCF Framework</div>
  <h2>How we get to intrinsic value</h2>
  ${portalMarkdown(f.dcfNarrative || 'DCF framework pending.')}

  <p class="disclaimer"><strong>Sources:</strong>
  ${filing_10k_url ? `<a href="${filing_10k_url}" target="_blank" rel="noopener">10-K (${escapeHtml(filing_10k_date || '')})</a> · ` : ''}
  ${quote ? `Yahoo Finance live quote (${price} as of ${asOf}) · ` : ''}
  Forward estimates are AI-extracted with source tags. Numbers labeled <span class="source-tag">[Estimated]</span> are derived, not reported. Not investment advice.</p>
</main>
`;

  return portalLayout({
    ticker, company, activePage: 'model', price, asOf,
    title: `${ticker} Financial Model · LCS Research`,
    body,
  });
}

// ============================================================================
// CONSENSUS PAGE
// ============================================================================
export function renderPortalConsensus(input: PageInput): string {
  const { ticker, company, content, quote, peerQuotes } = input;
  const price = fmtPrice(quote);
  const asOf = fmtAsOf(quote);
  const c = content.consensus;
  const peers = (c.peerTickers || []).map(t => ({
    ticker: t,
    quote: peerQuotes?.[t] ?? null,
  }));

  const body = `
<main class="portal-narrow" style="max-width:880px">
  <div class="page-eyebrow">Street Consensus · Levin Capital Strategies</div>
  <h1>${escapeHtml(company)} <span style="color:var(--text-muted);font-weight:500">(${escapeHtml(ticker)})</span></h1>
  <div class="page-subtitle">Where the Street stands vs. our view</div>

  <div class="bluf">
    <strong>Our PT:</strong> ${escapeHtml(c.ourPt || '—')}
  </div>

  <div class="kicker">§ I — Sell-Side View</div>
  <h2>Where the consensus sits</h2>
  ${portalMarkdown(c.streetView || 'Consensus view pending.')}

  <div class="kicker">§ II — Peer Comps</div>
  <h2>Closest public comparables</h2>
  ${peers.length > 0 ? `
  <table class="data">
    <thead>
      <tr><th>Ticker</th><th>Company</th><th class="r">Price</th><th class="r">As of</th></tr>
    </thead>
    <tbody>
      ${peers.map(p => `
        <tr>
          <td><a href="https://finance.yahoo.com/quote/${escapeHtml(p.ticker)}" target="_blank" rel="noopener" style="color:var(--gold);font-weight:600">${escapeHtml(p.ticker)}</a></td>
          <td>${escapeHtml(p.quote?.company || '—')}</td>
          <td class="r">${p.quote ? `$${p.quote.price.toFixed(2)}` : '—'}</td>
          <td class="r" style="color:var(--text-muted);font-size:11px">${p.quote?.as_of ? p.quote.as_of.slice(0,10) : '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <p style="font-size:12px;color:var(--text-muted);font-family:'Inter',sans-serif;margin-top:-12px">
    Prices live from Yahoo Finance · edge-cached 180s · click any ticker to verify.
  </p>
  ` : '<p style="color:var(--text-muted)">Peer set pending.</p>'}

  <h3>Our read on the peer set</h3>
  ${portalMarkdown(c.peerNote || 'Peer analysis pending.')}

  <div class="kicker">§ III — Our Price Target</div>
  <h2>How we get to ${escapeHtml((c.ourPt || '—').split(/[—–-]/)[0].trim())}</h2>
  ${portalMarkdown(c.ptMethodology || 'Methodology pending.')}

  <p class="disclaimer"><strong>Sources:</strong> Peer prices live via Yahoo Finance v8 chart endpoint. Sell-side view is an AI synthesis — specific analyst ratings not pulled in v1. Not investment advice.</p>
</main>
`;

  return portalLayout({
    ticker, company, activePage: 'consensus', price, asOf,
    title: `${ticker} Consensus · LCS Research`,
    body,
  });
}

// ============================================================================
// DECK PAGE
// ============================================================================
export function renderPortalDeck(input: PageInput): string {
  const { ticker, company, content, quote } = input;
  const price = fmtPrice(quote);
  const asOf = fmtAsOf(quote);

  const body = `
<main class="portal-main" style="max-width:960px">
  <div class="page-eyebrow">Presentation Deck · Levin Capital Strategies</div>
  <h1>${escapeHtml(company)} <span style="color:var(--text-muted);font-weight:500">(${escapeHtml(ticker)})</span></h1>
  <div class="page-subtitle">IC-ready 8-slide summary · print or present</div>

  <div class="deck">
    ${content.deckSlides.map((s, i) => `
      <section class="slide" id="slide-${i + 1}">
        <div class="slide-num">${String(i + 1).padStart(2, '0')} / ${String(content.deckSlides.length).padStart(2, '0')}</div>
        <h2 class="slide-title">${escapeHtml(s.title)}</h2>
        ${s.bullets.length > 0 ? `
          <ul class="slide-bullets">
            ${s.bullets.map(b => `<li>${portalMarkdown(b, true)}</li>`).join('')}
          </ul>
        ` : ''}
        ${s.speakerNote ? `<div class="slide-speaker"><strong>Analyst note:</strong> ${portalMarkdown(s.speakerNote, true)}</div>` : ''}
      </section>
    `).join('')}
  </div>

  ${content.deckSlides.length === 0 ? '<p style="color:var(--text-muted)">Deck slides pending re-generation.</p>' : ''}

  <p class="disclaimer">Deck auto-generated from the memo + consensus analysis. Each slide has a speaker note for the analyst presenting. Not investment advice.</p>
</main>
`;

  return portalLayout({
    ticker, company, activePage: 'deck', price, asOf,
    title: `${ticker} Deck · LCS Research`,
    body,
    pageStyles: `
.deck{display:grid;gap:20px;margin:40px 0 20px}
.slide{background:var(--surface);border:1px solid var(--border-light);border-radius:12px;padding:32px 36px;position:relative;page-break-after:always}
.slide-num{position:absolute;top:18px;right:24px;font-family:'Inter',sans-serif;font-size:11px;letter-spacing:2px;color:var(--text-muted);font-weight:700}
.slide-title{font-family:'Inter',sans-serif;font-size:26px;font-weight:800;color:var(--heading);letter-spacing:-0.01em;margin:0 0 20px;scroll-margin-top:110px}
.slide-bullets{list-style:none;padding:0;margin:0 0 20px}
.slide-bullets li{font-family:'Merriweather',serif;font-size:16px;line-height:1.6;color:var(--text);padding:12px 0 12px 24px;border-bottom:1px solid var(--border-light);position:relative}
.slide-bullets li:last-child{border-bottom:none}
.slide-bullets li::before{content:"▸";position:absolute;left:0;color:var(--gold);font-weight:700}
.slide-speaker{background:var(--gold-soft);border-left:3px solid var(--gold);padding:14px 18px;font-family:'Inter',sans-serif;font-size:13px;color:var(--heading);line-height:1.6;border-radius:0 6px 6px 0}
.slide-speaker strong{color:var(--gold-deep);font-weight:700}
@media print{.slide{break-inside:avoid;page-break-inside:avoid}}
`,
  });
}

// ============================================================================
// QUESTIONS PAGE
// ============================================================================
export function renderPortalQuestions(input: PageInput): string {
  const { ticker, company, content, quote } = input;
  const price = fmtPrice(quote);
  const asOf = fmtAsOf(quote);

  const body = `
<main class="portal-narrow" style="max-width:800px">
  <div class="page-eyebrow">Questions for Management · Diligence Toolkit</div>
  <h1>${escapeHtml(company)} <span style="color:var(--text-muted);font-weight:500">(${escapeHtml(ticker)})</span></h1>
  <div class="page-subtitle">${content.diligenceQuestions.length} probing questions for the next earnings call or IR meeting</div>

  <div class="questions">
    ${content.diligenceQuestions.map((d, i) => `
      <div class="q">
        <div class="q-num">Q${i + 1}</div>
        <div class="q-body">
          <div class="q-text">${escapeHtml(d.q)}</div>
          <div class="q-why"><strong>Why:</strong> ${escapeHtml(d.rationale)}</div>
        </div>
      </div>
    `).join('')}
  </div>

  ${content.diligenceQuestions.length === 0 ? '<p style="color:var(--text-muted)">Questions pending re-generation.</p>' : ''}

  <p class="disclaimer">These questions are auto-generated from the 10-K risk factors and MD&A excerpts. Designed to probe what management has NOT disclosed, not repeat what's already in the filing. Not investment advice.</p>
</main>
`;

  return portalLayout({
    ticker, company, activePage: 'questions', price, asOf,
    title: `${ticker} Diligence Questions · LCS Research`,
    body,
    pageStyles: `
.questions{display:grid;gap:16px;margin:32px 0 20px}
.q{display:grid;grid-template-columns:60px 1fr;gap:18px;background:var(--surface);border:1px solid var(--border-light);border-radius:10px;padding:20px 24px;align-items:start}
.q-num{font-family:'Inter',sans-serif;font-size:20px;font-weight:800;color:var(--gold);letter-spacing:-0.01em}
.q-text{font-family:'Merriweather',serif;font-size:17px;font-weight:700;color:var(--heading);line-height:1.4;margin-bottom:8px}
.q-why{font-family:'Inter',sans-serif;font-size:13px;color:var(--text-muted);line-height:1.55}
.q-why strong{color:var(--gold-deep)}
@media(max-width:640px){
  .q{grid-template-columns:1fr;gap:6px;padding:18px 20px}
  .q-num{font-size:16px}
}
`,
  });
}

function stripMd(s: string): string {
  return s.replace(/\*\*/g, '').replace(/\[([^\]]+)\]/g, '').replace(/\s+/g, ' ').trim();
}
