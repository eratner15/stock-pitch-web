/**
 * SEC EDGAR data layer — deterministic, no LLM.
 *
 * Gives the portal generator grounded filings text so the model can write
 * from actual 10-K / 10-Q material instead of its training-data memory.
 *
 * SEC requires a descriptive User-Agent with contact info — we set one.
 * All endpoints are free and unauthenticated.
 */

const USER_AGENT = 'Levin Capital Research portals@levincap.com';

// Tickers → CIK lookup is published at this URL; cache the whole thing once.
// Small file (~1 MB), holds 10k+ tickers. Fetched once per Worker instance.
let tickerCikCache: Record<string, { cik: string; name: string }> | null = null;

async function loadTickerMap(): Promise<Record<string, { cik: string; name: string }>> {
  if (tickerCikCache) return tickerCikCache;
  try {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      cf: { cacheTtl: 86400 }, // daily
    });
    if (!res.ok) return {};
    const data = await res.json<Record<string, { cik_str: number; ticker: string; title: string }>>();
    const map: Record<string, { cik: string; name: string }> = {};
    for (const key of Object.keys(data)) {
      const row = data[key];
      map[row.ticker.toUpperCase()] = {
        cik: String(row.cik_str).padStart(10, '0'),
        name: row.title,
      };
    }
    tickerCikCache = map;
    return map;
  } catch (err) {
    console.error('EDGAR ticker map load failed:', err);
    return {};
  }
}

export async function getCik(ticker: string | any): Promise<{ cik: string; name: string } | null> {
  const t = String(ticker || '').toUpperCase().trim();
  if (!t) return null;
  const map = await loadTickerMap();
  return map[t] ?? null;
}

export interface FilingInfo {
  accessionNumber: string;
  form: string;             // "10-K", "10-Q", "8-K"
  filingDate: string;       // YYYY-MM-DD
  reportDate: string;
  primaryDocument: string;  // filename
  documentUrl: string;      // full URL to the primary doc
}

/**
 * List recent 10-K / 10-Q / 8-K filings for a ticker, newest first.
 */
export async function getRecentFilings(
  tickerOrCik: string,
  limit = 40
): Promise<FilingInfo[]> {
  // Accept either a ticker symbol or a raw CIK number
  let cik: string;
  let entry: { cik: string; name: string } | null;
  if (/^\d+$/.test(tickerOrCik)) {
    cik = tickerOrCik.padStart(10, '0');
    entry = { cik, name: '' };
  } else {
    entry = await getCik(tickerOrCik);
    if (!entry) return [];
    cik = entry.cik;
  }

  try {
    const res = await fetch(
      `https://data.sec.gov/submissions/CIK${entry.cik}.json`,
      { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }, cf: { cacheTtl: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json<{
      filings?: {
        recent?: {
          accessionNumber: string[];
          form: string[];
          filingDate: string[];
          reportDate: string[];
          primaryDocument: string[];
        };
      };
    }>();
    const r = data.filings?.recent;
    if (!r) return [];

    const out: FilingInfo[] = [];
    for (let i = 0; i < r.form.length && out.length < limit; i++) {
      const form = r.form[i];
      if (form !== '10-K' && form !== '10-Q' && form !== '8-K' && form !== '20-F' && form !== 'S-1') continue;
      const accession = r.accessionNumber[i];
      const accessionNoHyphens = accession.replace(/-/g, '');
      const doc = r.primaryDocument[i];
      out.push({
        accessionNumber: accession,
        form,
        filingDate: r.filingDate[i],
        reportDate: r.reportDate[i] ?? r.filingDate[i],
        primaryDocument: doc,
        documentUrl: `https://www.sec.gov/Archives/edgar/data/${parseInt(entry.cik, 10)}/${accessionNoHyphens}/${doc}`,
      });
    }
    return out;
  } catch (err) {
    console.error('EDGAR filings fetch failed:', err);
    return [];
  }
}

/**
 * Fetch the raw HTML of a filing's primary document, then strip it down to
 * plaintext + preserve section headers. We don't need perfect parsing — we
 * just need clean text that the model can read.
 */
export async function fetchFilingText(url: string, maxChars = 150000): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,*/*' },
      cf: { cacheTtl: 86400 },
    });
    if (!res.ok) return '';
    const html = await res.text();
    return stripFilingHtml(html).slice(0, maxChars);
  } catch (err) {
    console.error('EDGAR filing text fetch failed:', err);
    return '';
  }
}

function stripFilingHtml(html: string): string {
  // Drop SEC XBRL metadata + inline style/script/ix: tags
  let s = html
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<\/?ix:[^>]*>/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '');
  // Convert common block tags to line breaks before stripping other tags
  s = s
    .replace(/<\/(p|div|tr|h[1-6]|li|br|table)\s*>/gi, '\n')
    .replace(/<(h[1-6])\b[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n');
  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, ' ');
  // Decode a few common entities
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8217;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#\d+;/g, ' ');
  // Collapse whitespace
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

/**
 * Pull the MD&A section out of a 10-K/10-Q plaintext blob.
 * Heuristic: find the "Management's Discussion and Analysis" heading and
 * return text until the next "Item" heading or end of doc.
 */
export function extractMDA(text: string): string {
  const lower = text.toLowerCase();
  // Try several variants — filings use different apostrophes and spacing
  const patterns = [
    /item\s*7[\.\s\-—]*management[''\s]*s? discussion/,
    /management[''\s]*s? discussion and analysis/,
    /management[''\s]*s? discussion of/,
  ];
  let start = -1;
  for (const p of patterns) {
    const m = lower.search(p);
    if (m >= 0) { start = m; break; }
  }
  if (start < 0) {
    // Last resort: take the middle of the document (often contains business review)
    const mid = Math.floor(text.length / 3);
    return text.slice(mid, mid + 60000);
  }
  const tail = text.slice(start);
  const endRel = tail.toLowerCase().search(/item\s*7a[\.\s\-—]*quantitative|item\s*8[\.\s\-—]*financial statements/);
  if (endRel < 0) return tail.slice(0, 80000);
  return tail.slice(0, endRel).slice(0, 80000);
}

/**
 * Pull Risk Factors (Item 1A) out of a 10-K plaintext blob.
 */
export function extractRiskFactors(text: string): string {
  const lower = text.toLowerCase();
  const patterns = [
    /item\s*1a[\.\s\-—]*risk factors/,
    /risk factors[\s\n]/,
  ];
  let start = -1;
  for (const p of patterns) {
    const m = lower.search(p);
    if (m >= 0) { start = m; break; }
  }
  if (start < 0) return '';
  const tail = text.slice(start);
  const endRel = tail.toLowerCase().search(/item\s*1b|item\s*2[\.\s\-—]*properties|unresolved staff/);
  if (endRel < 0) return tail.slice(0, 60000);
  return tail.slice(0, endRel).slice(0, 60000);
}

/**
 * Convenience: fetch the latest 10-K and pull MD&A + Risk Factors. Used as
 * the primary grounding for the portal memo + risks sections. We look at
 * the 40 most recent filings because active companies push 8-Ks regularly
 * and the last 10-K can easily be >10 filings back.
 */
export async function fetchLatest10K(tickerOrCik: string): Promise<{
  filing: FilingInfo | null;
  url: string;
  date: string;
  mda: string;
  risks: string;
  rawText: string;
  fullText: string;
}> {
  const filings = await getRecentFilings(tickerOrCik, 40);
  const latest10K = filings.find(f => f.form === '10-K') ?? filings.find(f => f.form === '20-F');
  if (!latest10K) return { filing: null, url: '', date: '', mda: '', risks: '', rawText: '', fullText: '' };

  const rawText = await fetchFilingText(latest10K.documentUrl);
  return {
    filing: latest10K,
    url: latest10K.documentUrl,
    date: latest10K.filingDate,
    mda: extractMDA(rawText),
    risks: extractRiskFactors(rawText),
    rawText,
    fullText: rawText,
  };
}

export async function fetchLatest10Q(tickerOrCik: string): Promise<{
  filing: FilingInfo | null;
  url: string;
  date: string;
  text: string;
}> {
  const filings = await getRecentFilings(tickerOrCik, 40);
  const latest10Q = filings.find(f => f.form === '10-Q');
  if (!latest10Q) return { filing: null, url: '', date: '', text: '' };
  const text = await fetchFilingText(latest10Q.documentUrl);
  return { filing: latest10Q, url: latest10Q.documentUrl, date: latest10Q.filingDate, text };
}

// Old fetchLatest10Q removed — replaced by the version above that returns url+date
