/** Public projection only: no source material, author IDs, or draft bodies. */
export async function publishedCatalog(db: D1Database) {
  const { results } = await db.prepare(
    "SELECT id,document_id,company_id,ticker,title,body,published_at,revised_at,reviewed_at FROM research_revisions WHERE status='published' AND visibility='public' ORDER BY published_at DESC,id",
  ).all<any>();
  return results.map(r => ({
    id: `workspace:${r.id}`, documentId: r.document_id, companyId: r.company_id,
    ticker: r.ticker, title: r.title, summary: r.body.slice(0, 240),
    sector: 'Not recorded', canonicalUrl: `https://research.levincap.com/research/published/${encodeURIComponent(r.id)}`,
    documentType: 'earnings', publicationStatus: 'published', visibility: 'public',
    publishedAt: r.published_at, revisedAt: r.revised_at, lastReviewedAt: r.reviewed_at,
    relatedDocuments: [], origin: 'workspace',
  }));
}
