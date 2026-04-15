/**
 * Email delivery via MailChannels tx/v1/send API.
 *
 * Config (all optional in dev — if MAIL_FROM_ADDRESS is unset we log-only):
 *   MAILCHANNELS_API_KEY — bearer token (MailChannels moved to paid+key in 2024;
 *     Cloudflare Workers with DKIM configured also supports keyless sends).
 *   MAIL_FROM_ADDRESS — sender email, e.g. "hello@stockpitch.app". Required to
 *     actually send; when unset we skip and log.
 *   MAIL_FROM_NAME — friendly display name. Defaults to "Stock Pitch".
 *   MAILCHANNELS_DKIM_DOMAIN / _SELECTOR / _PRIVATE_KEY — optional DKIM signing.
 *     If all three are set, MailChannels signs outgoing mail on behalf of
 *     the domain. Without them the send still works if the domain is
 *     whitelisted at MailChannels.
 */

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface MailEnv {
  MAILCHANNELS_API_KEY?: string;
  MAIL_FROM_ADDRESS?: string;
  MAIL_FROM_NAME?: string;
  MAILCHANNELS_DKIM_DOMAIN?: string;
  MAILCHANNELS_DKIM_SELECTOR?: string;
  MAILCHANNELS_DKIM_PRIVATE_KEY?: string;
}

export async function sendEmail(
  env: MailEnv,
  args: SendArgs
): Promise<{ ok: boolean; skipped?: boolean; id?: string; error?: string }> {
  const fromEmail = env.MAIL_FROM_ADDRESS;
  const fromName = env.MAIL_FROM_NAME || 'Stock Pitch';

  if (!fromEmail) {
    console.log(`[email skipped — no MAIL_FROM_ADDRESS] to=${args.to} subject="${args.subject}"`);
    return { ok: true, skipped: true };
  }

  const personalization: Record<string, unknown> = {
    to: [{ email: args.to }],
  };
  if (env.MAILCHANNELS_DKIM_DOMAIN && env.MAILCHANNELS_DKIM_SELECTOR && env.MAILCHANNELS_DKIM_PRIVATE_KEY) {
    personalization.dkim_domain = env.MAILCHANNELS_DKIM_DOMAIN;
    personalization.dkim_selector = env.MAILCHANNELS_DKIM_SELECTOR;
    personalization.dkim_private_key = env.MAILCHANNELS_DKIM_PRIVATE_KEY;
  }

  const content: Array<{ type: string; value: string }> = [];
  if (args.text) content.push({ type: 'text/plain', value: args.text });
  content.push({ type: 'text/html', value: args.html });

  const body = {
    personalizations: [personalization],
    from: { email: fromEmail, name: fromName },
    subject: args.subject,
    content,
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.MAILCHANNELS_API_KEY) {
    headers['X-Api-Key'] = env.MAILCHANNELS_API_KEY;
  }

  try {
    const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[email] MailChannels returned ${res.status}: ${text}`);
      return { ok: false, error: `MailChannels ${res.status}` };
    }

    // MailChannels returns the message ID via header, not body
    const id = res.headers.get('X-Message-Id') || undefined;
    return { ok: true, id };
  } catch (err) {
    console.error('[email] send failed:', err);
    return { ok: false, error: String(err) };
  }
}

// ===========================================================================
// Templates
// ===========================================================================

const BRAND_FG = '#0A0F1F';
const BRAND_ACCENT = '#2EBD6B';
const BRAND_MUTED = '#5A6074';

function layout(title: string, body: string, ctaText?: string, ctaUrl?: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND_FG};line-height:1.55;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e2e4ea;border-radius:12px;overflow:hidden;max-width:560px;">
          <tr>
            <td style="padding:24px 28px 16px;border-bottom:1px solid #f0f1f5;">
              <div style="font-family:'SF Mono',Menlo,monospace;font-size:13px;font-weight:700;color:${BRAND_FG};letter-spacing:0.5px;">
                <span style="color:${BRAND_ACCENT};">●</span>&nbsp;Stock Pitch
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${body}
              ${ctaText && ctaUrl ? `
                <div style="margin:24px 0;">
                  <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;background:${BRAND_FG};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;letter-spacing:0.3px;">${ctaText}</a>
                </div>
                <p style="font-size:12px;color:${BRAND_MUTED};margin:16px 0 0;">Or copy this link: <br><span style="word-break:break-all;">${ctaUrl}</span></p>
              ` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#fafbfc;border-top:1px solid #f0f1f5;color:${BRAND_MUTED};font-size:11px;line-height:1.6;">
              Stock Pitch &middot; <a href="https://stock-pitch-web.evan-ratner.workers.dev" style="color:${BRAND_MUTED};">stockpitch.app</a><br>
              Nothing in this email is investment advice.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function magicLinkEmail(origin: string, token: string): { subject: string; html: string; text: string } {
  const url = `${origin}/auth/verify/${token}`;
  return {
    subject: 'Your sign-in link',
    text: `Sign in to Stock Pitch:\n\n${url}\n\nExpires in 15 minutes.`,
    html: layout(
      'Sign in',
      `
      <h2 style="font-size:24px;font-weight:700;color:${BRAND_FG};margin:0 0 12px;letter-spacing:-0.01em;">Sign in to Stock Pitch</h2>
      <p style="font-size:15px;color:${BRAND_MUTED};margin:0 0 4px;">Click the button below to sign in. The link is valid for 15 minutes.</p>
      `,
      'Sign in →',
      url
    ),
  };
}

export function welcomeEmail(origin: string, displayName?: string | null): { subject: string; html: string } {
  const rawName = displayName?.split(/\s+/)[0] || 'there';
  // Escape — display names are user-controlled and this email is HTML
  const name = rawName.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
  return {
    subject: 'Welcome to Stock Pitch',
    html: layout(
      'Welcome',
      `
      <h2 style="font-size:24px;font-weight:700;color:${BRAND_FG};margin:0 0 12px;letter-spacing:-0.01em;">Welcome, ${name}.</h2>
      <p style="font-size:15px;color:${BRAND_MUTED};margin:0 0 12px;">This is Stock Pitch. Submit a call, get an AI-generated research brief, let the market score it.</p>
      <p style="font-size:15px;color:${BRAND_MUTED};margin:0 0 4px;">Three links to start:</p>
      <ul style="font-size:15px;color:${BRAND_FG};padding-left:20px;margin:8px 0 16px;">
        <li style="margin-bottom:6px;"><a href="${origin}/submit" style="color:${BRAND_ACCENT};">Pitch your first stock</a></li>
        <li style="margin-bottom:6px;"><a href="${origin}/leaderboard" style="color:${BRAND_ACCENT};">See the current leaderboard</a></li>
        <li><a href="${origin}/p/top10" style="color:${BRAND_ACCENT};">The Top 10 auto-portfolio</a></li>
      </ul>
      `
    ),
  };
}

export function briefReadyEmail(
  origin: string,
  ticker: string,
  callId: string,
  direction: string
): { subject: string; html: string } {
  const url = `${origin}/c/${callId}`;
  return {
    subject: `Your ${ticker} research brief is ready`,
    html: layout(
      `${ticker} brief`,
      `
      <h2 style="font-size:22px;font-weight:700;color:${BRAND_FG};margin:0 0 12px;letter-spacing:-0.01em;">Your <strong>${ticker}</strong> brief is ready.</h2>
      <p style="font-size:15px;color:${BRAND_MUTED};margin:0 0 4px;">We've generated an institutional-grade research brief supporting your ${direction} thesis. Your call is now on the public leaderboard.</p>
      `,
      'View your call →',
      url
    ),
  };
}

export function positionOpenedEmail(
  origin: string,
  portfolioName: string,
  portfolioSlug: string,
  ticker: string,
  direction: string
): { subject: string; html: string } {
  const url = `${origin}/p/${portfolioSlug}`;
  return {
    subject: `New position: ${ticker} ${direction} in ${portfolioName}`,
    html: layout(
      `${ticker} opened in ${portfolioName}`,
      `
      <h2 style="font-size:22px;font-weight:700;color:${BRAND_FG};margin:0 0 12px;letter-spacing:-0.01em;">New position in <strong>${portfolioName}</strong></h2>
      <p style="font-size:15px;color:${BRAND_MUTED};margin:0 0 4px;">The portfolio opened <strong style="color:${BRAND_FG};">${ticker} ${direction}</strong> during today's rebalance. Entry price locked at current market close.</p>
      `,
      'View the portfolio →',
      url
    ),
  };
}
