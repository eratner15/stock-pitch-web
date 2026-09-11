export interface Holding {
  ticker: string | null;
  exchange?: string;
  securityId?: string;
  company: string;
  weight: number | null;
  currency: string | null;
  assetType: "equity" | "cash" | "derivative" | "unresolved";
}
export interface Snapshot {
  etf: string;
  asOf: string | null;
  sourceUrl: string;
  provider: string;
  completeness: "full" | "partial" | "unknown";
  holdings: Holding[];
}
export const tickerPattern = /^[A-Z][A-Z0-9.-]{0,14}$/;
export function safeSource(value: unknown): string {
  if (typeof value !== "string" || value.length > 2000)
    throw new Error("A source URL is required");
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password)
    throw new Error("Sources must be HTTPS URLs without credentials");
  return u.href;
}
export function validateSnapshot(input: any): Snapshot {
  if (
    !input ||
    !tickerPattern.test(input.etf) ||
    typeof input.provider !== "string" ||
    !input.provider.trim() ||
    input.provider.length > 120
  )
    throw new Error("ETF and provider required");
  if (
    input.asOf !== null &&
    (typeof input.asOf !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.asOf) ||
      !Number.isFinite(Date.parse(input.asOf)) ||
      new Date(input.asOf).toISOString().slice(0, 10) !== input.asOf ||
      input.asOf > new Date().toISOString().slice(0, 10))
  )
    throw new Error("Invalid holdings date");
  if (
    !["full", "partial", "unknown"].includes(input.completeness) ||
    !Array.isArray(input.holdings) ||
    !input.holdings.length ||
    input.holdings.length > 5000
  )
    throw new Error("Holdings and completeness required");
  const holdings = input.holdings.map((h: any): Holding => {
    if (
      !h ||
      typeof h.company !== "string" ||
      !h.company.trim() ||
      h.company.length > 300 ||
      !["equity", "cash", "derivative", "unresolved"].includes(h.assetType)
    )
      throw new Error("Invalid holding identity");
    if (
      h.ticker !== null &&
      (typeof h.ticker !== "string" || !tickerPattern.test(h.ticker))
    )
      throw new Error("Invalid holding ticker");
    if(h.exchange!==undefined&&(typeof h.exchange!=='string'||!/^[A-Za-z0-9._-]{1,30}$/.test(h.exchange)))throw new Error('Invalid exchange');
    if(h.securityId!==undefined&&(typeof h.securityId!=='string'||!h.securityId.trim()||h.securityId.length>160))throw new Error('Invalid security ID');
    if (
      h.weight !== null &&
      (typeof h.weight !== "number" ||
        !Number.isFinite(h.weight) ||
        h.weight < 0 ||
        h.weight > 100)
    )
      throw new Error("Weight must be percent, 0–100, or null");
    if (
      h.currency !== null &&
      (typeof h.currency !== "string" || !/^[A-Z]{3}$/.test(h.currency))
    )
      throw new Error("Invalid currency");
    return {
      ticker: h.ticker,
      ...(h.exchange?{exchange:h.exchange.toUpperCase()}:{}),
      ...(h.securityId?{securityId:h.securityId}:{}),
      company: h.company,
      weight: h.weight,
      currency: h.currency,
      assetType: h.assetType,
    };
  });
  return {
    etf: input.etf,
    asOf: input.asOf,
    sourceUrl: safeSource(input.sourceUrl),
    provider: input.provider,
    completeness: input.completeness,
    holdings,
  };
}
export function discover(snapshot: Snapshot, covered: Set<string>, query = "") {
  return snapshot.holdings
    .filter((h) =>
      `${h.ticker || ""} ${h.company}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .map((h) => ({
      ...h,
      eligible: false,
      requiresIdentityResolution: h.assetType === "equity" && !!h.ticker,
      coverage:
        h.ticker && covered.has(h.ticker)
          ? "Existing coverage"
          : "No catalog coverage found",
      reason:
        h.assetType !== "equity"
          ? "Excluded from company ideas: identity or asset type unresolved/non-equity"
          : `${h.weight === null ? "Weight not recorded" : `${h.weight}% of reported holdings snapshot`}; ${h.ticker && covered.has(h.ticker) ? "review against existing thesis" : "new coverage candidate"}`,
    }))
    .sort(
      (a, b) =>
        Number(b.assetType==='equity') - Number(a.assetType==='equity') ||
        (b.weight ?? -1) - (a.weight ?? -1),
    );
}
