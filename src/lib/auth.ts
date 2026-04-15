/**
 * Auth: magic-link email login + HMAC-signed session cookies.
 *
 * Flow:
 *   1. User POSTs /auth/request with email
 *   2. We insert a short-lived row in auth_tokens (15 min expiry)
 *   3. Email the user a link: /auth/verify/<token>
 *   4. GET /auth/verify/<token> consumes the token, creates/updates user,
 *      and sets a signed session cookie for 30 days
 *   5. Subsequent requests hydrate the user via the cookie
 *
 * No DB read on session validation — cookie is signed + timestamped.
 */

import { newId } from './security';

const SESSION_COOKIE = 'sp_session';
const SESSION_TTL_SECONDS = 30 * 86400;
const MAGIC_TOKEN_TTL_SECONDS = 15 * 60;

export interface SessionUser {
  id: string;
  email: string;
}

// ===========================================================================
// Magic token (one-time link)
// ===========================================================================

export async function createMagicToken(
  db: D1Database,
  email: string
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const token = newId() + newId(); // 32 hex chars
  const expiresAt = new Date(Date.now() + MAGIC_TOKEN_TTL_SECONDS * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO auth_tokens (token, email, expires_at, used, created_at)
       VALUES (?, ?, ?, 0, datetime('now'))`
    )
    .bind(token, normalized, expiresAt)
    .run();

  return token;
}

/**
 * Verify + consume a magic token. Returns {email, user_id} on success, or
 * null if the token is invalid/expired/used. Creates a users row if the
 * email is not yet registered. Idempotent in the sense that re-clicking the
 * verify link with the same token returns null (single-use).
 */
export async function verifyMagicToken(
  db: D1Database,
  token: string,
  brand: string
): Promise<{ user_id: string; email: string; is_new_user: boolean } | null> {
  const row = await db
    .prepare(
      `SELECT email, expires_at, used FROM auth_tokens WHERE token = ?`
    )
    .bind(token)
    .first<{ email: string; expires_at: string; used: number }>();

  if (!row) return null;
  if (row.used) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  // Mark as used atomically — if two requests race, only one wins
  const result = await db
    .prepare(
      `UPDATE auth_tokens SET used = 1 WHERE token = ? AND used = 0`
    )
    .bind(token)
    .run();
  if (!result.meta.changes) return null;

  const email = row.email;

  // Upsert user (race-safe via INSERT OR IGNORE) — meta.changes tells us
  // whether this was a brand-new user (1) or an existing one (0)
  const newUserId = newId();
  let isNewUser = false;
  try {
    const insertRes = await db
      .prepare(
        `INSERT OR IGNORE INTO users (id, email, brand, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(newUserId, email, brand)
      .run();
    isNewUser = (insertRes.meta.changes ?? 0) > 0;
  } catch (e) {
    console.error('user insert in verify failed', e);
  }

  const userRow = await db
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>();
  if (!userRow) return null;

  // Touch last_seen
  try {
    await db
      .prepare(`UPDATE users SET last_seen_at = datetime('now') WHERE id = ?`)
      .bind(userRow.id)
      .run();
  } catch (e) {}

  return { user_id: userRow.id, email, is_new_user: isNewUser };
}

// ===========================================================================
// Session cookies (HMAC-signed)
// ===========================================================================

async function hmacSign(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacVerify(secret: string, data: string, expected: string): Promise<boolean> {
  const actual = await hmacSign(secret, data);
  if (actual.length !== expected.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Build a session cookie value: base64(user_id).expires.hmac
 * Not encrypted — user_id is visible — but tamper-proof.
 */
export async function signSession(
  userId: string,
  email: string,
  secret: string
): Promise<string> {
  const expires = Date.now() + SESSION_TTL_SECONDS * 1000;
  // encode user_id + email so we can hydrate without DB hit on every request
  const payloadRaw = JSON.stringify({ u: userId, e: email, x: expires });
  const payload = btoa(payloadRaw);
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

/**
 * Verify + decode a session cookie. Returns null if invalid/expired/tampered.
 */
export async function verifySession(
  cookie: string,
  secret: string
): Promise<SessionUser | null> {
  if (!cookie) return null;
  const dot = cookie.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const ok = await hmacVerify(secret, payload, sig);
  if (!ok) return null;

  try {
    const obj = JSON.parse(atob(payload)) as { u: string; e: string; x: number };
    if (!obj || typeof obj.u !== 'string' || typeof obj.x !== 'number') return null;
    if (Date.now() > obj.x) return null;
    return { id: obj.u, email: obj.e };
  } catch {
    return null;
  }
}

/**
 * Parse the Cookie header and return the named cookie value.
 */
export function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return;
  const parts = header.split(';');
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i < 0) continue;
    const k = p.slice(0, i).trim();
    if (k === name) return decodeURIComponent(p.slice(i + 1).trim());
  }
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

/**
 * Build a Set-Cookie header value for the session.
 */
export function sessionSetCookie(value: string, maxAgeSec = SESSION_TTL_SECONDS): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ].join('; ');
}

export function sessionClearCookie(): string {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ');
}

/**
 * Extract the signed-in user from a request. Returns null if no session or invalid.
 */
export async function getUserFromRequest(
  headers: Headers,
  secret: string
): Promise<SessionUser | null> {
  const raw = parseCookie(headers.get('Cookie') || undefined, SESSION_COOKIE);
  if (!raw) return null;
  return await verifySession(raw, secret);
}
