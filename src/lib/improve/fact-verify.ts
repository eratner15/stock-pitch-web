/**
 * Fact verifier — scans generated memo prose for numerical claims and
 * checks if each appears in the raw 10-K text. Any claim not found within
 * reasonable fuzzy match is flagged as [Unverified].
 *
 * Runs in the same request as generation, post-writePortalContent,
 * before the HTML is rendered. Annotates the content so templates can
 * show a verification badge + warning callouts.
 */

export interface VerificationResult {
  total_claims: number;
  verified: number;
  unverified: number;
  verification_rate: number;      // 0-1
  unverified_claims: Array<{ section: string; text: string; near: string }>;
}

/**
 * Extract numerical claims from prose. A "claim" is any dollar amount,
 * percentage, or multiple that appears in a sentence. We extract the
 * numeric token + a few words of surrounding context for display.
 */
interface Claim {
  numeric: string;               // e.g. "$1.2B" or "18%"
  context: string;               // ~40 char window around it
  section: string;               // which memo section it came from
}

const CLAIM_REGEX = /\$[0-9]+(?:\.[0-9]+)?\s*(?:[KMBT]|[KMBT]illion|trillion)?|\b[0-9]+(?:\.[0-9]+)?\s*%|\b[0-9]+(?:\.[0-9]+)?\s*(?:basis points|bps|x\b)/gi;

export function extractClaims(prose: string, section: string): Claim[] {
  if (!prose) return [];
  const out: Claim[] = [];
  let match: RegExpExecArray | null;
  const rx = new RegExp(CLAIM_REGEX.source, 'gi');
  while ((match = rx.exec(prose)) !== null) {
    const start = Math.max(0, match.index - 40);
    const end = Math.min(prose.length, match.index + match[0].length + 40);
    out.push({
      numeric: match[0].trim(),
      context: prose.slice(start, end).replace(/\s+/g, ' ').trim(),
      section,
    });
  }
  return out;
}

/**
 * Normalize a numeric claim so "1.2B" matches "1,200 million" etc.
 * Returns an array of equivalent string forms to search in the filing.
 */
export function expandNumericForms(numeric: string): string[] {
  const s = numeric.replace(/[$\s]/g, '').toLowerCase();
  const out: string[] = [numeric, s];
  // Percent
  const pct = s.match(/^([0-9]+(?:\.[0-9]+)?)%$/);
  if (pct) {
    out.push(pct[1] + '%', pct[1] + ' percent');
    return [...new Set(out)];
  }
  // Basis points
  const bps = s.match(/^([0-9]+)\s*(bps|basis points)/i);
  if (bps) {
    out.push(bps[1] + 'bps', bps[1] + ' basis points');
    return [...new Set(out)];
  }
  // Dollars with scale
  const m = s.match(/^\$?([0-9]+(?:\.[0-9]+)?)\s*([kmbt])?/);
  if (m) {
    const n = parseFloat(m[1]);
    const unit = m[2];
    const forms = new Set<string>();
    if (unit === 'b' || (!unit && n < 100)) {
      forms.add(`${n}B`);
      forms.add(`${n} billion`);
      forms.add(`${(n * 1000).toFixed(0)}M`);
      forms.add(`${(n * 1000).toLocaleString('en-US')}`);
    } else if (unit === 'm') {
      forms.add(`${n}M`);
      forms.add(`${n} million`);
      forms.add(`${(n * 1000).toLocaleString('en-US')}`);
    } else if (!unit) {
      forms.add(n.toString());
      forms.add(n.toLocaleString('en-US'));
    }
    forms.forEach(f => out.push(f));
  }
  return [...new Set(out)].filter(Boolean);
}

export function verifyClaims(claims: Claim[], filingText: string): VerificationResult {
  const normFiling = filingText.toLowerCase().replace(/[,$\s]/g, '');
  let verified = 0;
  const unverified: Array<{ section: string; text: string; near: string }> = [];

  for (const claim of claims) {
    const forms = expandNumericForms(claim.numeric);
    const found = forms.some(f => {
      const norm = f.toLowerCase().replace(/[,$\s]/g, '');
      if (norm.length < 2) return false;
      return normFiling.includes(norm);
    });
    if (found) verified++;
    else unverified.push({ section: claim.section, text: claim.numeric, near: claim.context });
  }

  return {
    total_claims: claims.length,
    verified,
    unverified: unverified.length,
    verification_rate: claims.length > 0 ? verified / claims.length : 1,
    unverified_claims: unverified,
  };
}

/**
 * Full portal verification — scans every prose section and returns a
 * summary. Unverified claim lists are useful but percentage-verified
 * is the at-a-glance metric we display in the memo footer.
 */
export function verifyPortal(
  content: {
    executiveSummary?: string; businessOverview?: string;
    thesisSituation?: string; thesisComplication?: string;
    supportingPoint1?: { body: string }; supportingPoint2?: { body: string };
    supportingPoint3?: { body: string };
    keyRisks?: string; valuationSection?: string; priceTargetSection?: string;
    catalystsSection?: string; sotpSection?: { body: string };
    mgmtSection?: { body: string }; competitiveSection?: { body: string };
    financialBridge?: string;
  },
  filingText: string
): VerificationResult {
  const allClaims: Claim[] = [
    ...extractClaims(content.executiveSummary || '', 'Executive Summary'),
    ...extractClaims(content.businessOverview || '', 'Business Overview'),
    ...extractClaims(content.thesisSituation || '', 'Situation'),
    ...extractClaims(content.thesisComplication || '', 'Complication'),
    ...extractClaims(content.supportingPoint1?.body || '', 'Support 1'),
    ...extractClaims(content.supportingPoint2?.body || '', 'Support 2'),
    ...extractClaims(content.supportingPoint3?.body || '', 'Support 3'),
    ...extractClaims(content.competitiveSection?.body || '', 'Competitive'),
    ...extractClaims(content.sotpSection?.body || '', 'SOTP'),
    ...extractClaims(content.mgmtSection?.body || '', 'Management'),
    ...extractClaims(content.financialBridge || '', 'Bridge'),
    ...extractClaims(content.keyRisks || '', 'Risks'),
    ...extractClaims(content.valuationSection || '', 'Valuation'),
    ...extractClaims(content.priceTargetSection || '', 'Price Target'),
    ...extractClaims(content.catalystsSection || '', 'Catalysts'),
  ];
  return verifyClaims(allClaims, filingText);
}
