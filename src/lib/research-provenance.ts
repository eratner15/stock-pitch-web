/** Normalize model metadata without inventing a recommendation or attribution. */
export const UNRATED = 'Unrated';
export const UNRESOLVED_SOURCE = 'Source unresolved';
const ratings = new Set(['BUY', 'HOLD', 'SELL', 'STRONG BUY', 'STRONG SELL', 'OUTPERFORM', 'UNDERPERFORM', 'NEUTRAL', 'OVERWEIGHT', 'UNDERWEIGHT']);
export function normalizeRating(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && ratings.has(value.trim().toUpperCase())) return value.trim().toUpperCase();
  }
  return UNRATED;
}
export function normalizeSource(value: unknown): string {
  if (typeof value !== 'string') return UNRESOLVED_SOURCE;
  const source = value.trim();
  if (/^https:\/\/[^\s]+$/i.test(source) || /^\[(10-K|10-Q|20-F|6-K|8-K|Market|Consensus|Computed|Estimated|Company|Transcript)\](?:\s.*)?$/i.test(source)) return source;
  return UNRESOLVED_SOURCE;
}
export function normalizeMetric(value: unknown): { label: string; value: string; source: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const k = value as Record<string, unknown>;
  const label = typeof k.label === 'string' ? k.label.trim() : '';
  if (!label) return null;
  return { label, value: typeof k.value === 'string' ? k.value : typeof k.value === 'number' && Number.isFinite(k.value) ? String(k.value) : '—', source: normalizeSource(k.source) };
}
/** Minimum gate only: source labels are not independent claim verification. */
export function assertPortalProvenance(content: { rating?: unknown; financials?: { keyMetrics?: unknown } }, filings: { filing_10k_url?: string | null; filing_10q_url?: string | null }): void {
  const metrics = content.financials?.keyMetrics;
  if (normalizeRating(content.rating) === UNRATED) throw new Error('Publication blocked: rating unresolved');
  if (!Array.isArray(metrics) || !metrics.length) throw new Error('Publication blocked: metric evidence unresolved');
  for (const raw of metrics) {
    const metric = normalizeMetric(raw);
    if (!metric || metric.source === UNRESOLVED_SOURCE || metric.value === '—' || !metric.value.trim()) throw new Error('Publication blocked: metric evidence unresolved');
    if (/\[10-K\]/i.test(metric.source) && !filings.filing_10k_url || /\[10-Q\]/i.test(metric.source) && !filings.filing_10q_url) throw new Error('Publication blocked: cited filing unavailable');
  }
}
