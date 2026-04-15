import { escapeHtml } from '../lib/security';
import { portalLayout, portalMarkdown } from './portal-layout';
import type { PortalContent } from '../lib/portal-generator';
import type { PriceQuote } from '../lib/prices';

export interface PortalMemoInput {
  ticker: string;
  company: string;
  content: PortalContent;
  quote: PriceQuote | null;
  filing_10k_url: string | null;
  filing_10k_date: string | null;
  generated_at: string;
}

/**
 * Investment memo page — modeled on /amzn/memo.html. Ten section headings,
 * Tufte sidenotes in the right margin, source tags inline, BLUF box up top,
 * dense institutional prose. The AI section writers emit the content; the
 * template only handles structure + typography.
 */
export function renderPortalMemo(input: PortalMemoInput): string {
  const { ticker, company, content, quote, filing_10k_url, filing_10k_date, generated_at } = input;
  const price = quote ? `$${quote.price.toFixed(2)}` : '—';
  const asOf = quote?.as_of ? quote.as_of.slice(0, 10) : '';
  const ptFirst = (content.consensus.ourPt || '').split(/[—–-]/)[0].trim() || '—';
  const ptDelta = content.consensus.ourPt || '—';

  // Render prose with inline sidenote margin callouts. The generator already
  // stripped [[SIDENOTE: …]] markers from prose and collected them separately.
  // We spread them through the memo as margin notes anchored to section heads.
  const sidenotes = (content.sidenotes || []).slice(0, 20);

  const body = `
<main class="memo-page">

<div class="memo-header">
  <div class="page-eyebrow">Investment Memo · Levin Capital Strategies</div>
  <h1>${escapeHtml(company)} <span class="ticker-muted">(${escapeHtml(ticker)})</span></h1>
  <div class="memo-tagline">${escapeHtml(content.tagline)}.</div>
  <div class="memo-rating-strip">
    <div class="rs"><div class="lbl">Current Price</div><div class="val">${price}</div></div>
    <div class="rs"><div class="lbl">Price Target</div><div class="val gold">${escapeHtml(ptFirst)}</div></div>
    <div class="rs"><div class="lbl">Implied</div><div class="val" style="font-size:14px">${escapeHtml((ptDelta.match(/[-+]?\d+%\s*\w+/) || ['—'])[0])}</div></div>
    <div class="rs"><div class="lbl">Analyst</div><div class="val" style="font-size:14px">LCS Research</div></div>
    <div class="rs"><div class="lbl">Date</div><div class="val" style="font-size:14px">${asOf || generated_at.slice(0,10)}</div></div>
  </div>
</div>

<nav class="memo-toc" aria-label="Table of contents">
  <strong>Table of Contents</strong>
  <ol>
    <li><a href="#exec-summary">Executive Summary</a></li>
    <li><a href="#business">${escapeHtml(company)} at a Glance</a></li>
    <li><a href="#situation">The Core Thesis: Situation</a></li>
    <li><a href="#complication">The Core Thesis: Complication</a></li>
    <li><a href="#support-1">${escapeHtml(content.supportingPoint1.heading)}</a></li>
    <li><a href="#support-2">${escapeHtml(content.supportingPoint2.heading)}</a></li>
    <li><a href="#support-3">${escapeHtml(content.supportingPoint3.heading)}</a></li>
    <li><a href="#competitive">${escapeHtml(content.competitiveSection.heading)}</a></li>
    <li><a href="#bridge">The Revenue &amp; Earnings Bridge</a></li>
    <li><a href="#sotp">${escapeHtml(content.sotpSection.heading)}</a></li>
    <li><a href="#mgmt">${escapeHtml(content.mgmtSection.heading)}</a></li>
    <li><a href="#risks">Key Risks</a></li>
    <li><a href="#valuation">Valuation Framework</a></li>
    <li><a href="#price-target">Price Target & Scenarios</a></li>
    <li><a href="#catalysts">Catalysts & Timeline</a></li>
  </ol>
</nav>

<div class="bluf">
  <strong>BLUF — Bottom Line Up Front.</strong> ${portalMarkdown(content.bluf, true)}
</div>

<section>
  <div class="kicker">§ I — Executive Summary</div>
  <h2 id="exec-summary">A research brief on ${escapeHtml(company)}</h2>
  ${sideAnnotated(content.executiveSummary, sidenotes, 0, 2)}
</section>

<section>
  <div class="kicker">§ II — Company Overview</div>
  <h2 id="business">${escapeHtml(company)} at a glance</h2>
  ${sideAnnotated(content.businessOverview, sidenotes, 2, 4)}
</section>

<section>
  <div class="kicker">§ III — The Core Thesis</div>
  <h2 id="situation">Situation: what the market currently prices</h2>
  ${sideAnnotated(content.thesisSituation, sidenotes, 4, 6)}

  <h2 id="complication">Complication: what's being mispriced</h2>
  ${sideAnnotated(content.thesisComplication, sidenotes, 6, 8)}
</section>

<section>
  <div class="kicker">§ IV — Supporting Analysis</div>
  <h2 id="support-1">${escapeHtml(content.supportingPoint1.heading)}</h2>
  ${sideAnnotated(content.supportingPoint1.body, sidenotes, 8, 11)}

  <h2 id="support-2">${escapeHtml(content.supportingPoint2.heading)}</h2>
  ${sideAnnotated(content.supportingPoint2.body, sidenotes, 11, 13)}

  <h2 id="support-3">${escapeHtml(content.supportingPoint3.heading)}</h2>
  ${sideAnnotated(content.supportingPoint3.body, sidenotes, 13, 16)}
</section>

<section>
  <div class="kicker">§ V — Competitive Landscape</div>
  <h2 id="competitive">${escapeHtml(content.competitiveSection.heading)}</h2>
  ${sideAnnotated(content.competitiveSection.body, sidenotes, 16, 18)}
</section>

<section>
  <div class="kicker">§ VI — The Bridge</div>
  <h2 id="bridge">The revenue &amp; earnings bridge</h2>
  ${sideAnnotated(content.financialBridge, sidenotes, 16, 17)}
</section>

<section>
  <div class="kicker">§ VII — Sum of Parts</div>
  <h2 id="sotp">${escapeHtml(content.sotpSection.heading)}</h2>
  ${sideAnnotated(content.sotpSection.body, sidenotes, 17, 19)}
</section>

<section>
  <div class="kicker">§ VIII — Stewardship</div>
  <h2 id="mgmt">${escapeHtml(content.mgmtSection.heading)}</h2>
  ${sideAnnotated(content.mgmtSection.body, sidenotes, 19, 20)}
</section>

<section>
  <div class="kicker">§ IX — Bulls and Bears</div>
  <h2>The case in brief</h2>
  <div class="bull-bear">
    <div class="bb-card bull">
      <h3>Bull Case</h3>
      <ul>${content.bullPoints.map(b => `<li>${portalMarkdown(b, true)}</li>`).join('')}</ul>
    </div>
    <div class="bb-card bear">
      <h3>Bear Case</h3>
      <ul>${content.bearPoints.map(b => `<li>${portalMarkdown(b, true)}</li>`).join('')}</ul>
    </div>
  </div>
</section>

<section>
  <div class="kicker">§ X — Risks</div>
  <h2 id="risks">What could derail the thesis</h2>
  ${sideAnnotated(content.keyRisks, sidenotes, 14, 16)}
</section>

<section>
  <div class="kicker">§ XI — Valuation</div>
  <h2 id="valuation">How we frame value</h2>
  ${sideAnnotated(content.valuationSection, sidenotes, 16, 18)}
</section>

<section>
  <div class="kicker">§ XII — Recommendation</div>
  <h2 id="price-target">Price target and scenario analysis</h2>
  ${sideAnnotated(content.priceTargetSection, sidenotes, 18, 19)}
</section>

<section>
  <div class="kicker">§ XIII — Catalysts</div>
  <h2 id="catalysts">Path to value — 12-24 months</h2>
  ${sideAnnotated(content.catalystsSection, sidenotes, 19, 20)}
</section>

${content.diligenceQuestions.length > 0 ? `
<section>
  <div class="kicker">§ XIV — Diligence Toolkit</div>
  <h2 id="diligence">Questions for Management</h2>
  <div class="diligence">
    ${content.diligenceQuestions.map(d => `
      <div class="dq">
        <div class="dq-q">${escapeHtml(d.q)}</div>
        <div class="dq-why">${escapeHtml(d.rationale)}</div>
      </div>
    `).join('')}
  </div>
</section>
` : ''}

<p class="disclaimer">
  <strong>Sources &amp; methodology.</strong>
  ${filing_10k_url ? `Primary: <a href="${filing_10k_url}" target="_blank" rel="noopener">10-K (${escapeHtml(filing_10k_date || '')})</a>.` : ''}
  Live quotes via Yahoo Finance (as of ${escapeHtml(asOf || generated_at.slice(0,10))}).
  Forward estimates are model-derived with <span class="source-tag">[Estimated]</span> tags and methodology inline.
  This memo was composed by the Levin Capital research platform chaining Llama 3.3 70B calls against the stock-pitch skill.
  Not investment advice.
</p>

</main>
`;

  return portalLayout({
    ticker, company, activePage: 'memo', price, asOf,
    title: `${ticker} Investment Memo · LCS Research`,
    body,
    pageStyles: `
.memo-page{max-width:880px;margin:0 auto;padding:130px 32px 60px}
.memo-header{border-bottom:1px solid var(--border);padding-bottom:28px;margin-bottom:8px}
.memo-header h1{font-size:38px;letter-spacing:-0.025em;margin-bottom:6px}
.ticker-muted{color:var(--text-muted);font-weight:500;font-size:0.8em;letter-spacing:0}
.memo-tagline{font-family:'Merriweather',serif;font-style:italic;font-size:20px;color:var(--text);margin:8px 0 20px;line-height:1.5;max-width:680px}

.memo-rating-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:0;border-top:1px solid var(--border-light);border-bottom:1px solid var(--border-light);font-family:'Inter',sans-serif}
.memo-rating-strip .rs{padding:14px 16px;border-right:1px solid var(--border-light)}
.memo-rating-strip .rs:last-child{border-right:none}
.memo-rating-strip .lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);font-weight:600}
.memo-rating-strip .val{font-size:20px;font-weight:700;color:var(--heading);margin-top:4px}
.memo-rating-strip .val.gold{color:var(--gold-deep)}

.memo-toc{background:var(--surface);border:1px solid var(--border-light);border-radius:10px;padding:22px 26px;margin:36px 0 40px}
.memo-toc strong{display:block;font-family:'Inter',sans-serif;font-size:10px;letter-spacing:3px;color:var(--gold);font-weight:700;text-transform:uppercase;margin-bottom:14px}
.memo-toc ol{list-style:none;counter-reset:toc;padding:0;margin:0;columns:2;column-gap:24px}
.memo-toc li{counter-increment:toc;margin-bottom:8px;break-inside:avoid}
.memo-toc a{font-family:'Inter',sans-serif;font-size:13px;color:var(--heading);font-weight:500;display:flex;align-items:baseline;gap:8px;padding:2px 0}
.memo-toc a:hover{color:var(--gold)}
.memo-toc a::before{content:counter(toc,upper-roman) ".";font-family:'Inter',sans-serif;font-size:10px;color:var(--gold);font-weight:700;min-width:28px}

.bluf{background:var(--gold-soft);border-left:3px solid var(--gold);padding:22px 28px;margin:28px 0 40px;font-family:'Merriweather',serif;font-size:17px;line-height:1.7;color:var(--heading)}
.bluf strong{font-weight:700;color:var(--gold-deep);display:block;margin-bottom:4px;font-size:12px;letter-spacing:2px;text-transform:uppercase}

.memo-page section{position:relative;padding:8px 0 24px}
.memo-page h2{font-size:24px;font-weight:800;color:var(--heading);margin:32px 0 16px;letter-spacing:-0.02em;scroll-margin-top:110px}
.memo-page p{font-size:16px;line-height:1.78;color:var(--text);margin-bottom:18px}
.memo-page p strong{color:var(--heading)}

.memo-sidenote{
  float:right;clear:right;width:220px;margin-right:-236px;margin-top:4px;
  font-family:'Inter',sans-serif;font-size:12px;line-height:1.55;color:var(--text-muted);
  border-left:2px solid var(--gold);padding:4px 0 4px 12px;background:transparent;
}
@media (max-width:1100px){
  .memo-sidenote{float:none;width:auto;margin:12px 0;padding:10px 14px;background:var(--surface);border-left:3px solid var(--gold);border-radius:0 6px 6px 0;display:block}
}

.bull-bear{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0 36px}
.bb-card{background:var(--surface);border:1px solid var(--border-light);border-radius:10px;padding:22px}
.bb-card.bull{border-top:3px solid var(--green)}
.bb-card.bear{border-top:3px solid var(--red)}
.bb-card h3{font-size:12px;letter-spacing:2px;margin-top:0;color:var(--heading)}
.bb-card ul{padding-left:18px;margin:10px 0 0;list-style:disc}
.bb-card li{font-size:15px;line-height:1.55;margin-bottom:10px;color:var(--text)}

.diligence{margin:20px 0 32px}
.dq{padding:16px 0;border-bottom:1px solid var(--border-light)}
.dq:last-child{border-bottom:none}
.dq-q{font-family:'Merriweather',serif;font-size:16px;font-weight:700;color:var(--heading);margin-bottom:4px}
.dq-why{font-family:'Inter',sans-serif;font-size:13px;color:var(--text-muted);line-height:1.55}
.dq-why::before{content:"Why it matters: ";color:var(--gold);font-weight:600}

@media(max-width:760px){
  .memo-page{padding:100px 20px 40px}
  .memo-header h1{font-size:26px}
  .memo-rating-strip{grid-template-columns:1fr 1fr}
  .memo-rating-strip .rs:nth-child(even){border-right:none}
  .memo-rating-strip .rs:nth-last-child(-n+2){border-top:1px solid var(--border-light)}
  .memo-toc ol{columns:1}
  .bull-bear{grid-template-columns:1fr;gap:14px}
}
`,
  });
}

/**
 * Interleave sidenotes into a prose block. Sidenotes show in the right
 * margin on wide viewports and stack inline on narrow screens. Anchored
 * to section by slicing the global sidenotes array into ranges.
 */
function sideAnnotated(prose: string, sidenotes: string[], from: number, to: number): string {
  const ours = sidenotes.slice(from, Math.min(to, sidenotes.length));
  const notes = ours.map(n => `<aside class="memo-sidenote">${escapeHtml(n)}</aside>`).join('');
  return notes + portalMarkdown(prose);
}
