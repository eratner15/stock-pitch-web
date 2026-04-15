import { escapeHtml } from '../lib/security';

export interface JobStatusInput {
  jobId: string;
  ticker: string;
  status: string;              // queued | researching | writing | complete | failed
  step: string | null;
  pages_complete: number;
  pages_total: number;
  error_message: string | null;
}

/**
 * Progress page shown while a portal generates. Polls /api/portal/jobs/:id
 * every 3 seconds; when status='complete', redirects to the portal.
 */
export function renderPortalJobStatus(input: JobStatusInput): string {
  const { jobId, ticker, status, step, pages_complete, pages_total, error_message } = input;
  const pct = Math.min(100, Math.round((pages_complete / pages_total) * 100));
  const failed = status === 'failed';
  const done = status === 'complete';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Building ${escapeHtml(ticker)} portal — LCS Research</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#FFFFFF;--surface:#F8F9FB;--border:#E2E5EB;--border-light:#ECEEF2;
  --gold:#B8973E;--navy:#0F1729;--green:#1A7A3A;--red:#C0392B;
  --text:#2D3748;--text-muted:#6B7280;--heading:#111827;
}
body{font-family:'Merriweather',Georgia,serif;background:var(--bg);color:var(--text);line-height:1.7;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px}
.wrap{max-width:520px;width:100%;text-align:center}
.brand{font-family:'Inter',sans-serif;font-size:11px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;font-weight:700;margin-bottom:24px}
h1{font-family:'Inter',sans-serif;font-size:30px;font-weight:800;color:var(--heading);letter-spacing:-0.02em;line-height:1.2;margin-bottom:10px}
.sub{font-family:'Merriweather',serif;font-style:italic;font-size:17px;color:var(--text-muted);margin-bottom:32px}
.ticker{color:var(--navy);font-style:normal;font-weight:700}

.progress{background:var(--surface);border:1px solid var(--border-light);border-radius:12px;padding:28px 24px;text-align:left;margin-bottom:20px}
.progress-bar{height:8px;background:var(--border-light);border-radius:4px;overflow:hidden;margin-bottom:14px}
.progress-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--navy));width:${pct}%;transition:width 0.6s ease;${failed ? 'background:var(--red)' : ''}${done ? 'background:var(--green)' : ''}}
.progress-meta{display:flex;justify-content:space-between;font-family:'Inter',sans-serif;font-size:12px;color:var(--text-muted)}
.progress-meta .pct{font-weight:700;color:var(--heading)}
.progress-step{margin-top:14px;font-family:'Inter',sans-serif;font-size:14px;color:var(--text);line-height:1.5}
.progress-step::before{content:"● ";color:var(--gold);${done ? 'color:var(--green)' : ''}${failed ? 'color:var(--red)' : ''}animation:pulse 1.6s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}

.error{background:rgba(192,57,43,0.06);border-left:3px solid var(--red);padding:16px 18px;margin-bottom:20px;font-family:'Inter',sans-serif;font-size:14px;color:var(--heading);text-align:left;border-radius:0 8px 8px 0}
.error strong{display:block;margin-bottom:4px;color:var(--red)}

.cta{display:inline-block;padding:14px 28px;font-family:'Inter',sans-serif;font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;background:var(--navy);color:#fff;border-radius:10px;text-decoration:none;transition:transform 0.15s;border:none;cursor:pointer}
.cta:hover{transform:translateY(-1px)}
.cta.secondary{background:transparent;color:var(--navy);border:1px solid var(--border);margin-left:8px}

.job-id{margin-top:24px;font-family:'Inter',sans-serif;font-size:11px;letter-spacing:1.5px;color:var(--text-muted);text-transform:uppercase}

@media(max-width:520px){
  h1{font-size:24px}
  .progress{padding:22px 18px}
}
</style>
</head>
<body>

<div class="wrap">
  <div class="brand">Levin Capital Strategies · Research</div>
  <h1>${done ? `${escapeHtml(ticker)} portal ready.` : `Building <span class="ticker">${escapeHtml(ticker)}</span> portal.`}</h1>
  <p class="sub">${done
    ? 'Redirecting now...'
    : failed
    ? 'Generation failed. See details below.'
    : 'Pulling the 10-K, forming the thesis, composing 5 pages. Takes about 2–3 minutes.'}
  </p>

  ${failed ? `
    <div class="error">
      <strong>Generation failed</strong>
      ${escapeHtml(error_message || 'Unknown error. Try re-submitting, or pick a more liquid ticker.')}
    </div>
    <a href="/stock-pitch" class="cta">Try another ticker</a>
  ` : `
    <div class="progress">
      <div class="progress-bar"><div class="progress-fill"></div></div>
      <div class="progress-meta">
        <span>${done ? 'Complete' : 'Working'}</span>
        <span class="pct">${pct}%</span>
      </div>
      <div class="progress-step" id="step">${escapeHtml(step || 'Queued…')}</div>
    </div>

    ${done
      ? `<a href="/stock-pitch/${escapeHtml(ticker)}/memo" class="cta">Open the memo →</a>`
      : `<a href="/stock-pitch" class="cta secondary">← Home</a>`
    }
  `}

  <div class="job-id">Job ${escapeHtml(jobId.slice(0, 8))}</div>
</div>

${!failed && !done ? `
<script>
(function(){
  const jobId = ${JSON.stringify(jobId)};
  const ticker = ${JSON.stringify(ticker)};
  async function poll(){
    try {
      const r = await fetch('/api/portal/jobs/' + encodeURIComponent(jobId));
      const j = await r.json();
      if (j.status === 'complete'){
        location.href = '/stock-pitch/' + ticker + '/memo';
        return;
      }
      if (j.status === 'failed'){
        location.reload();
        return;
      }
      const pct = Math.min(100, Math.round((j.pages_complete / j.pages_total) * 100));
      const fill = document.querySelector('.progress-fill');
      if (fill) fill.style.width = pct + '%';
      const pctEl = document.querySelector('.pct');
      if (pctEl) pctEl.textContent = pct + '%';
      const step = document.getElementById('step');
      if (step && j.step) step.textContent = j.step;
    } catch(e){}
    setTimeout(poll, 3000);
  }
  setTimeout(poll, 2000);
})();
</script>
` : ''}

</body>
</html>`;
}
