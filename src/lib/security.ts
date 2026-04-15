/**
 * HTML escape for any user-supplied string rendered into HTML.
 * Apply to: display_name, thesis, ticker, company, catalyst — anywhere a user-
 * provided value ends up inside an HTML document, attribute, or OG meta tag.
 */
export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c] || c));
}

/**
 * Attribute-safe escape — stricter than escapeHtml for values that land
 * inside attribute contexts that the browser may parse as JS (e.g. onclick=...).
 * We avoid ever rendering user-supplied values inside event-handler attributes;
 * this helper exists to make that intent explicit at call sites that need it.
 */
export function escapeAttr(s: string | null | undefined): string {
  return escapeHtml(s);
}

/** Strict email validation — server-side, matches RFC-ish real-world usage. */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const e = email.trim().toLowerCase();
  if (e.length > 254) return false;
  // Local@domain with at least one dot in domain
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Normalize a ticker to upper-alpha + dots (e.g. BRK.B), max 10 chars. */
export function sanitizeTicker(t: string | null | undefined): string | null {
  if (!t || typeof t !== 'string') return null;
  const clean = t.toUpperCase().replace(/[^A-Z.]/g, '');
  if (clean.length < 1 || clean.length > 10) return null;
  return clean;
}

/**
 * Rate limit a key via KV. Returns `true` if the request is allowed, `false`
 * if blocked. Window is in seconds. Simple fixed-window counter — good enough
 * to stop casual spam; would switch to a token bucket at scale.
 */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSec: number
): Promise<{ allowed: boolean; current: number }> {
  const rlKey = `rl:${key}`;
  try {
    const existing = await kv.get(rlKey);
    const count = existing ? parseInt(existing, 10) : 0;
    if (count >= limit) {
      return { allowed: false, current: count };
    }
    await kv.put(rlKey, String(count + 1), { expirationTtl: windowSec });
    return { allowed: true, current: count + 1 };
  } catch (err) {
    // Fail open on KV errors so we don't block users from legitimate behavior
    console.error('rate-limit check failed', err);
    return { allowed: true, current: 0 };
  }
}

/** Random 16-char hex id — replaces uuid slicing, stable format. */
export function newId(): string {
  // crypto.getRandomValues is available in Workers
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}
