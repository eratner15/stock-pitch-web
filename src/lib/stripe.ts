/**
 * Stripe billing for Stock Pitch — Phase 2c.
 *
 * Tiers (users.tier column):
 *   - free         : default, 1 call free, read leaderboard + top10
 *   - pro          : $29/mo, unlimited calls, follow all portfolios, email alerts
 *   - white_glove  : $299/mo, custom portal generation, priority briefs
 *
 * Flow:
 *   1. User clicks Upgrade → POST /api/checkout {tier}
 *   2. We create a Stripe Checkout Session, return its URL
 *   3. User completes payment → Stripe redirects to /billing/success?session_id=
 *   4. Stripe fires `checkout.session.completed` webhook → POST /stripe/webhook
 *   5. We update users.tier + users.stripe_customer_id
 *   6. Subsequent subscription.* events keep tier in sync
 *
 * All Stripe API calls use fetch directly — no SDK, since Workers env is light.
 * Secret config:
 *   STRIPE_SECRET_KEY        — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET    — whsec_... for signature verification
 *   STRIPE_PRICE_PRO         — price_... for $29/mo
 *   STRIPE_PRICE_WHITEGLOVE  — price_... for $299/mo
 */

export type Tier = 'free' | 'pro' | 'white_glove';

export function priceForTier(
  env: { STRIPE_PRICE_PRO?: string; STRIPE_PRICE_WHITEGLOVE?: string },
  tier: Exclude<Tier, 'free'>
): string | null {
  if (tier === 'pro') return env.STRIPE_PRICE_PRO ?? null;
  if (tier === 'white_glove') return env.STRIPE_PRICE_WHITEGLOVE ?? null;
  return null;
}

/**
 * Create a Stripe Checkout Session (subscription mode) and return its URL.
 * Caller is responsible for auth + rate-limiting.
 */
export async function createCheckoutSession(
  env: { STRIPE_SECRET_KEY?: string },
  args: {
    priceId: string;
    userId: string;
    email: string;
    successUrl: string;
    cancelUrl: string;
  }
): Promise<{ ok: true; url: string; session_id: string } | { ok: false; error: string }> {
  if (!env.STRIPE_SECRET_KEY) {
    return { ok: false, error: 'Stripe not configured' };
  }

  const body = new URLSearchParams();
  body.append('mode', 'subscription');
  body.append('line_items[0][price]', args.priceId);
  body.append('line_items[0][quantity]', '1');
  body.append('customer_email', args.email);
  body.append('client_reference_id', args.userId);
  body.append('metadata[user_id]', args.userId);
  body.append('subscription_data[metadata][user_id]', args.userId);
  body.append('success_url', `${args.successUrl}?session_id={CHECKOUT_SESSION_ID}`);
  body.append('cancel_url', args.cancelUrl);
  body.append('allow_promotion_codes', 'true');

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[stripe] checkout create failed ${res.status}: ${text}`);
    return { ok: false, error: `Stripe ${res.status}` };
  }

  const data = await res.json<{ id: string; url: string }>();
  return { ok: true, url: data.url, session_id: data.id };
}

/**
 * Verify a Stripe webhook signature using the `Stripe-Signature` header.
 * Reimplements the timing-safe HMAC-SHA256 check (no SDK needed on Workers).
 */
export async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
  toleranceSec = 300
): Promise<boolean> {
  const parts = Object.fromEntries(
    sigHeader.split(',').map(kv => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    })
  ) as { t?: string; v1?: string };
  if (!parts.t || !parts.v1) return false;

  const timestamp = parseInt(parts.t, 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSec) return false;

  const signedPayload = `${parts.t}.${payload}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Given a Stripe checkout.session.completed or customer.subscription.* event,
 * figure out what tier the user should be on. Returns null if the event
 * doesn't map to a tier change we care about.
 */
export function tierFromEvent(
  event: any,
  env: { STRIPE_PRICE_PRO?: string; STRIPE_PRICE_WHITEGLOVE?: string }
): { user_id: string; tier: Tier; customer_id?: string } | null {
  const type = event?.type as string | undefined;
  if (!type) return null;

  if (type === 'checkout.session.completed') {
    const s = event.data.object;
    const userId = s.client_reference_id ?? s.metadata?.user_id;
    if (!userId) return null;
    const priceId = s.line_items?.data?.[0]?.price?.id
      ?? s.subscription?.items?.data?.[0]?.price?.id;
    const tier = matchTier(priceId, env);
    if (!tier) return null;
    return { user_id: userId, tier, customer_id: s.customer ?? undefined };
  }

  if (type === 'customer.subscription.updated' || type === 'customer.subscription.created') {
    const sub = event.data.object;
    const userId = sub.metadata?.user_id;
    if (!userId) return null;
    if (sub.status !== 'active' && sub.status !== 'trialing') {
      return { user_id: userId, tier: 'free', customer_id: sub.customer };
    }
    const priceId = sub.items?.data?.[0]?.price?.id;
    const tier = matchTier(priceId, env) ?? 'free';
    return { user_id: userId, tier, customer_id: sub.customer };
  }

  if (type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const userId = sub.metadata?.user_id;
    if (!userId) return null;
    return { user_id: userId, tier: 'free', customer_id: sub.customer };
  }

  return null;
}

function matchTier(
  priceId: string | undefined,
  env: { STRIPE_PRICE_PRO?: string; STRIPE_PRICE_WHITEGLOVE?: string }
): Tier | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === env.STRIPE_PRICE_WHITEGLOVE) return 'white_glove';
  return null;
}
