import { escapeHtml } from '../lib/security';

type Brand = 'stockpitch' | 'levincap';

function baseStyles(brand: Brand): { bg: string; surface: string; ink: string; inkMuted: string; border: string; accent: string; display: string; body: string; mono: string; brandMark: string } {
  const isLevin = brand === 'levincap';
  return {
    bg: isLevin ? '#FAF7F0' : '#FFFFFF',
    surface: isLevin ? '#F3EEE1' : '#F5F6F8',
    ink: isLevin ? '#0A0A0A' : '#0A0F1F',
    inkMuted: isLevin ? '#5A5651' : '#5A6074',
    border: isLevin ? '#D4CFC3' : '#E2E4EA',
    accent: isLevin ? '#B8973E' : '#2EBD6B',
    display: isLevin ? "'Playfair Display',Georgia,serif" : "'Inter',system-ui,sans-serif",
    body: isLevin ? "'Cormorant Garamond',Georgia,serif" : "'Inter',system-ui,sans-serif",
    mono: "'JetBrains Mono',monospace",
    brandMark: isLevin
      ? `<span style="font-family:'Playfair Display',serif;font-weight:900">Levin Capital <em style="font-weight:400;font-style:italic">Research</em></span>`
      : `<span style="font-family:'JetBrains Mono',monospace;font-weight:700"><span style="color:#2EBD6B">●</span> Stock Pitch</span>`,
  };
}

function authShell(brand: Brand, title: string, inner: string): string {
  const s = baseStyles(brand);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} · ${brand === 'levincap' ? 'Levin Capital Research' : 'Stock Pitch'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,900;1,400&family=Cormorant+Garamond:ital,wght@0,500&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:${s.body};background:${s.bg};color:${s.ink};line-height:1.55;-webkit-font-smoothing:antialiased;min-height:100vh;display:flex;flex-direction:column}
a{color:inherit;text-decoration:none}
header{padding:20px 32px;border-bottom:1px solid ${s.border};display:flex;justify-content:space-between;align-items:center}
.auth-wrap{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 24px}
.auth-card{width:100%;max-width:440px;background:${s.bg};border:1px solid ${s.border};padding:40px 36px;${brand === 'levincap' ? '' : 'border-radius:16px'}}
.auth-kicker{font-family:'Inter',sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${s.accent};font-weight:700;margin-bottom:12px}
h1{font-family:${s.display};font-weight:${brand === 'levincap' ? '900' : '800'};font-size:36px;color:${s.ink};letter-spacing:-0.025em;line-height:1.05;margin-bottom:12px}
h1 em{font-style:italic;font-weight:${brand === 'levincap' ? '400' : '500'};color:${s.accent}}
.auth-desc{font-family:${s.body};font-size:16px;color:${s.inkMuted};${brand === 'levincap' ? 'font-style:italic' : ''};margin-bottom:28px;line-height:1.55}
form{display:flex;flex-direction:column;gap:14px}
input[type=email]{padding:16px 18px;font-family:${s.body};font-size:16px;background:${s.surface};border:1.5px solid ${s.border};color:${s.ink};${brand === 'levincap' ? '' : 'border-radius:10px'};transition:border 0.12s}
input[type=email]:focus{outline:none;border-color:${s.accent}}
input[type=email]::placeholder{color:${s.inkMuted}}
button{padding:16px;background:${s.ink};color:${s.bg};font-family:'Inter',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.3px;border:none;cursor:pointer;${brand === 'levincap' ? '' : 'border-radius:10px'};transition:opacity 0.12s}
button:hover{opacity:0.9}
button:disabled{opacity:0.5;cursor:not-allowed}
.msg{margin-top:14px;padding:14px 16px;font-family:${s.body};font-size:14px;border-radius:${brand === 'levincap' ? '0' : '8px'};display:none}
.msg.show{display:block}
.msg.success{background:rgba(46,189,107,0.08);color:#1D9A54;border:1px solid rgba(46,189,107,0.25)}
.msg.error{background:rgba(224,71,89,0.08);color:#C03A4A;border:1px solid rgba(224,71,89,0.25)}
.fineprint{font-family:'Inter',sans-serif;font-size:12px;color:${s.inkMuted};margin-top:20px;padding-top:20px;border-top:1px solid ${s.border};line-height:1.6}
.fineprint a{color:${s.accent};font-weight:600}
footer{padding:24px 32px;text-align:center;font-family:'Inter',sans-serif;font-size:11px;color:${s.inkMuted};border-top:1px solid ${s.border}}
footer a{color:${s.accent};font-weight:600;margin:0 8px}
.brand{font-family:${brand === 'levincap' ? s.display : s.mono};font-weight:${brand === 'levincap' ? '900' : '700'};font-size:${brand === 'levincap' ? '20px' : '14px'};color:${s.ink}}
.brand em{font-weight:${brand === 'levincap' ? '400' : '500'};font-style:italic}
</style>
</head>
<body>

<header>
  <a href="/" class="brand">${s.brandMark}</a>
  <a href="/" style="font-size:12px;color:${s.inkMuted};font-family:'Inter',sans-serif;font-weight:500">← Back</a>
</header>

<main class="auth-wrap">
  <div class="auth-card">
    ${inner}
  </div>
</main>

<footer>
  <a href="/">Home</a> ·
  <a href="/leaderboard">Leaderboard</a> ·
  <a href="/p/top10">Top 10</a>
</footer>

</body>
</html>`;
}

export function renderAuthRequest(brand: Brand, prefilledEmail?: string): string {
  const inner = `
    <div class="auth-kicker">Magic Link Sign-In</div>
    <h1>Sign in <em>with email.</em></h1>
    <p class="auth-desc">We'll send you a one-time link. No passwords. Expires in 15 minutes.</p>
    <form id="authForm" onsubmit="submitEmail(event)">
      <input type="email" name="email" id="emailInput" placeholder="you@firm.com" required autocomplete="email" autofocus value="${escapeHtml(prefilledEmail || '')}">
      <button type="submit" id="submitBtn">Send me a sign-in link</button>
      <div class="msg" id="msg"></div>
    </form>
    <div class="fineprint">
      By signing in you agree to the way this works: your email is how we identify your calls. No marketing, no newsletter unless you opt in.
    </div>
    <script>
      async function submitEmail(e){
        e.preventDefault();
        const btn = document.getElementById('submitBtn');
        const msg = document.getElementById('msg');
        const email = document.getElementById('emailInput').value.trim();
        msg.className = 'msg';
        btn.disabled = true;
        btn.textContent = 'Sending...';
        try {
          const r = await fetch('/auth/request', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email }),
          });
          const j = await r.json();
          if (j.ok) {
            msg.textContent = 'Check your inbox for the sign-in link. It expires in 15 minutes.';
            msg.classList.add('msg', 'show', 'success');
            btn.textContent = 'Sent ✓';
          } else {
            msg.textContent = j.error || 'Could not send the link. Try again.';
            msg.classList.add('msg', 'show', 'error');
            btn.disabled = false;
            btn.textContent = 'Send me a sign-in link';
          }
        } catch(err) {
          msg.textContent = 'Network error. Try again.';
          msg.classList.add('msg', 'show', 'error');
          btn.disabled = false;
          btn.textContent = 'Send me a sign-in link';
        }
      }
    </script>
  `;
  return authShell(brand, 'Sign in', inner);
}

export function renderAuthVerifyError(brand: Brand, reason: string): string {
  const inner = `
    <div class="auth-kicker" style="color:#E04759">Link Issue</div>
    <h1>That link didn't <em>work.</em></h1>
    <p class="auth-desc">${escapeHtml(reason)}</p>
    <a href="/auth/request" style="display:inline-block;padding:14px 24px;background:#0A0F1F;color:#fff;font-family:'Inter',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.3px;border-radius:${brand === 'levincap' ? '0' : '10px'};text-decoration:none;margin-top:8px;">Request a new link</a>
  `;
  return authShell(brand, 'Sign-in failed', inner);
}
