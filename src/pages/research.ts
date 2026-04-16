import { escapeHtml } from '../lib/security';

/**
 * Research progress page — the core UX of the infinite research desk.
 * User enters a ticker → this page shows generation progress → redirects to memo.
 * No manual thesis, direction, or price target. AI decides everything.
 */
export function renderResearchPage(
  brand: 'stockpitch' | 'levincap',
  ticker: string,
): string {
  const isLevin = brand === 'levincap';
  const t = escapeHtml(ticker);

  const steps = [
    { label: 'Pricing', detail: `Fetching live quote for ${t}` },
    { label: 'SEC Filing', detail: 'Pulling 10-K + 10-Q from EDGAR' },
    { label: 'Research', detail: 'Analyzing financials, risks, competitive position' },
    { label: 'Writing', detail: 'Composing 15-section institutional memo' },
    { label: 'Verification', detail: 'Checking claims against source filings' },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="${isLevin ? '#FAF7F0' : '#F4EEE1'}">
<title>${t} Research — ${isLevin ? 'Levin Capital' : 'Stock Pitch'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Fraunces:ital,wght@0,500;0,700;1,500&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --paper:${isLevin ? '#FAF7F0' : '#F4EEE1'};
  --ink:${isLevin ? '#1A1510' : '#1A1814'};
  --ink-60:${isLevin ? '#5A5043' : '#4E463D'};
  --ink-40:${isLevin ? '#8A7E6F' : '#7E7468'};
  --accent:${isLevin ? '#1A4D3E' : '#B7141F'};
  --accent-light:${isLevin ? 'rgba(26,77,62,0.08)' : 'rgba(183,20,31,0.06)'};
  --gold:#B8973E;
  --border:${isLevin ? '#D4CFC3' : '#B9AE9C'};
  --display:${isLevin ? "'Fraunces','Source Serif 4',Georgia,serif" : "'Abril Fatface',Georgia,serif"};
  --body:${isLevin ? "'Source Serif 4','Lora',Georgia,serif" : "'Lora',Georgia,serif"};
  --mono:'IBM Plex Mono',ui-monospace,monospace;
}
html,body{height:100%}
body{
  font-family:var(--body);background:var(--paper);color:var(--ink);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:32px;text-align:center;
}
.ticker-hero{
  font-family:var(--display);font-size:clamp(64px,15vw,120px);line-height:1;
  color:var(--ink);letter-spacing:-0.03em;margin-bottom:8px;
}
.company{font-family:var(--body);font-style:italic;font-size:18px;color:var(--ink-60);margin-bottom:48px}
.steps{max-width:400px;width:100%;text-align:left;margin-bottom:40px}
.step{
  display:flex;align-items:flex-start;gap:14px;padding:14px 0;
  border-bottom:1px solid var(--border);opacity:0.3;
  transition:opacity 0.4s;
}
.step.active{opacity:1}
.step.done{opacity:0.6}
.step-dot{
  width:24px;height:24px;border-radius:50%;
  border:2px solid var(--border);flex-shrink:0;margin-top:2px;
  display:flex;align-items:center;justify-content:center;
  transition:border-color 0.3s,background 0.3s;
}
.step.active .step-dot{border-color:var(--accent);background:var(--accent-light)}
.step.done .step-dot{border-color:var(--accent);background:var(--accent)}
.step.done .step-dot::after{content:'✓';color:#fff;font-size:12px;font-weight:700}
.step-text .label{font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--ink)}
.step-text .detail{font-family:var(--body);font-size:14px;color:var(--ink-60);margin-top:2px}
.step.active .step-text .label{color:var(--accent)}

.spinner{
  width:32px;height:32px;border:3px solid var(--border);
  border-top-color:var(--accent);border-radius:50%;
  animation:spin 0.8s linear infinite;margin:0 auto 16px;
}
@keyframes spin{to{transform:rotate(360deg)}}
.status-msg{font-family:var(--mono);font-size:13px;color:var(--ink-40);letter-spacing:1px}
.error-msg{
  display:none;padding:20px;background:rgba(183,20,31,0.06);
  border:1px solid rgba(183,20,31,0.2);border-radius:8px;
  font-family:var(--body);font-size:15px;color:#8E1218;
  max-width:400px;margin-top:20px;
}
.error-msg.visible{display:block}
.retry-btn{
  display:inline-block;margin-top:12px;padding:10px 20px;
  background:var(--accent);color:var(--paper);border:none;border-radius:6px;
  font-family:var(--mono);font-size:13px;font-weight:700;letter-spacing:1px;
  cursor:pointer;text-transform:uppercase;
}
.back-link{
  display:inline-block;margin-top:24px;
  font-family:var(--mono);font-size:12px;letter-spacing:2px;
  text-transform:uppercase;color:var(--ink-40);text-decoration:none;
  border-bottom:1px solid var(--border);padding-bottom:2px;
}
.back-link:hover{color:var(--accent);border-color:var(--accent)}
</style>
</head>
<body>

<div class="ticker-hero">${t}</div>
<div class="company" id="company">Researching...</div>

<div class="steps" id="steps">
  ${steps.map((s, i) => `
    <div class="step${i === 0 ? ' active' : ''}" data-step="${i}">
      <div class="step-dot"></div>
      <div class="step-text">
        <div class="label">${s.label}</div>
        <div class="detail">${s.detail}</div>
      </div>
    </div>
  `).join('')}
</div>

<div class="spinner" id="spinner"></div>
<div class="status-msg" id="statusMsg">Starting research...</div>
<div class="error-msg" id="errorMsg">
  <div id="errorText"></div>
  <button class="retry-btn" onclick="startGeneration()">Retry</button>
</div>

<a href="/" class="back-link">← Back</a>

<script>
const TICKER = ${JSON.stringify(ticker)};
const BASE = (window.__BASE_PATH__ || '');
let currentStep = 0;

function setStep(n) {
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < n) el.classList.add('done');
    else if (i === n) el.classList.add('active');
  });
  currentStep = n;
}

function showError(msg) {
  document.getElementById('spinner').style.display = 'none';
  document.getElementById('statusMsg').style.display = 'none';
  document.getElementById('errorText').textContent = msg;
  document.getElementById('errorMsg').classList.add('visible');
}

async function startGeneration() {
  document.getElementById('spinner').style.display = 'block';
  document.getElementById('statusMsg').style.display = 'block';
  document.getElementById('errorMsg').classList.remove('visible');
  setStep(0);
  document.getElementById('statusMsg').textContent = 'Fetching price...';

  try {
    const res = await fetch(BASE + '/generate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ ticker: TICKER }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Generation failed' }));
      showError(err.error || 'Generation failed');
      return;
    }

    const data = await res.json();
    if (data.company) {
      document.getElementById('company').textContent = data.company;
    }

    // All done — redirect to memo
    setStep(5);
    document.getElementById('statusMsg').textContent = 'Research complete — loading memo...';
    document.getElementById('spinner').style.display = 'none';
    setTimeout(() => {
      window.location.href = BASE + '/' + TICKER + '/memo';
    }, 800);

  } catch (e) {
    showError('Network error: ' + e.message);
  }
}

// Simulate step progression while waiting (the actual generation is one long request)
let stepTimer = setInterval(() => {
  if (currentStep < 4) {
    setStep(currentStep + 1);
    const msgs = ['Pulling SEC filings...', 'Analyzing financials...', 'Writing memo sections...', 'Verifying claims...'];
    document.getElementById('statusMsg').textContent = msgs[currentStep - 1] || '';
  }
}, 12000);

startGeneration().finally(() => clearInterval(stepTimer));
</script>

</body>
</html>`;
}
