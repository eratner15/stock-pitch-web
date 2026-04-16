/**
 * Research Desk — dashboard page for the Levin Capital Research platform.
 * Lists all 10 workflows as cards, recent research, and ticker input.
 * Uses the Levin Capital design system (Fraunces, banker green, parchment).
 */

import { WORKFLOW_LIST, type WorkflowConfig } from '../lib/workflow-config';

interface RecentRun {
  id: string;
  workflow: string;
  ticker: string | null;
  output_summary: string | null;
  status: string;
  created_at: string;
  duration_ms: number | null;
}

function workflowCard(w: WorkflowConfig, mountPrefix: string): string {
  const categoryColors: Record<string, string> = {
    equity: 'var(--banker)',
    portfolio: 'var(--gold-deep)',
    macro: '#4A6741',
  };
  const color = categoryColors[w.category] || 'var(--banker)';
  return `
    <a class="wf-card" href="${mountPrefix}/research/${w.slug}" data-workflow="${w.slug}">
      <div class="wf-card-icon">${w.icon}</div>
      <div class="wf-card-body">
        <div class="wf-card-name">${w.name}</div>
        <div class="wf-card-desc">${w.description}</div>
      </div>
      <div class="wf-card-cat" style="color:${color}">${w.category}</div>
    </a>`;
}

function recentRow(r: RecentRun, mountPrefix: string): string {
  const statusClass = r.status === 'complete' ? 'st-done' : r.status === 'running' ? 'st-run' : 'st-fail';
  const dur = r.duration_ms ? `${(r.duration_ms / 1000).toFixed(0)}s` : '...';
  const summary = r.output_summary || 'Running...';
  const date = new Date(r.created_at + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `
    <a class="recent-row" href="${mountPrefix}/research/run/${r.id}">
      <span class="recent-wf">${r.workflow}</span>
      <span class="recent-ticker">${r.ticker || '—'}</span>
      <span class="recent-summary">${summary.slice(0, 80)}${summary.length > 80 ? '...' : ''}</span>
      <span class="recent-status ${statusClass}">${r.status}</span>
      <span class="recent-dur">${dur}</span>
      <span class="recent-date">${date}</span>
    </a>`;
}

export function renderResearchDesk(recentRuns: RecentRun[] = [], mountPrefix: string = ''): string {
  const cards = WORKFLOW_LIST.map(w => workflowCard(w, mountPrefix)).join('');
  const recent = recentRuns.length > 0
    ? recentRuns.map(r => recentRow(r, mountPrefix)).join('')
    : '<div class="recent-empty">No research yet. Pick a workflow above to get started.</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Levin Capital Research Desk — AI-powered equity research workflows">
<meta name="theme-color" content="#0F3B2E">
<title>Research Desk — Levin Capital</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,400;1,9..144,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=IM+Fell+English+SC&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --paper:#F3EAD5;
  --paper-deep:#E6DABF;
  --paper-warm:#F8F0DB;
  --ink:#0A0806;
  --ink-60:#5A5040;
  --ink-40:#847961;
  --ink-20:#B8AE95;
  --rule:#2E281D;
  --banker:#0F3B2E;
  --banker-deep:#082619;
  --gold:#B8973E;
  --gold-deep:#8B6F28;
  --ledger-green:#0F3B2E;
  --ledger-red:#8B2A1E;
  --display:'Fraunces','Source Serif 4',Georgia,serif;
  --body:'Source Serif 4','Lora',Georgia,serif;
  --smcp:'IM Fell English SC',serif;
}
html{background:var(--paper)}
body{
  font-family:var(--body);background:var(--paper);color:var(--ink);line-height:1.62;font-size:18px;
  -webkit-font-smoothing:antialiased;
  background-image:repeating-linear-gradient(0deg,transparent 0 31px,rgba(46,40,29,0.022) 31px 32px);
  background-attachment:fixed;
}
a{color:inherit;text-decoration:none}
.wrap{max-width:1000px;margin:0 auto;padding:0 28px}

/* MASTHEAD */
.mast{padding:24px 0;border-bottom:1px solid var(--ink)}
.mast .wrap{display:flex;justify-content:space-between;align-items:center;gap:20px}
.mast-brand{font-family:var(--display);font-weight:700;font-size:22px;line-height:1;letter-spacing:0.02em;text-transform:uppercase;color:var(--ink);font-variation-settings:"opsz" 40}
.mast-brand em{font-style:italic;font-weight:500;color:var(--banker);text-transform:none;letter-spacing:0.01em;margin-left:6px;font-variation-settings:"opsz" 40}
.mast-nav{display:flex;align-items:center;gap:28px;font-family:var(--smcp);font-size:12px;letter-spacing:4px;text-transform:uppercase;color:var(--ink-60)}
.mast-nav a{padding:4px 0;border-bottom:2px solid transparent;transition:border 0.2s,color 0.2s}
.mast-nav a:hover,.mast-nav a.active{color:var(--banker);border-bottom-color:var(--gold)}

/* HERO */
.hero{padding:56px 0 40px;text-align:center}
.hero h1{
  font-family:var(--display);font-weight:700;font-size:clamp(40px,6vw,64px);line-height:1.05;
  color:var(--ink);letter-spacing:-0.02em;margin-bottom:12px;
  font-variation-settings:"opsz" 144;
}
.hero h1 em{font-style:italic;font-weight:500;color:var(--banker)}
.hero-sub{
  font-family:var(--body);font-style:italic;font-size:19px;color:var(--ink-60);max-width:540px;margin:0 auto 32px;line-height:1.5;
}

/* TICKER QUICK-LAUNCH */
.ticker-bar{
  display:flex;gap:0;max-width:560px;margin:0 auto 20px;
  border:1px solid var(--ink);background:var(--paper-warm);
  box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 4px transparent,inset 0 0 0 5px var(--gold-deep);
  transition:box-shadow 0.15s;
}
.ticker-bar:focus-within{box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 4px transparent,inset 0 0 0 5px var(--banker)}
.ticker-bar input{
  flex:1;padding:16px 20px;border:none;background:transparent;
  font-family:var(--display);font-size:24px;font-weight:600;letter-spacing:3px;
  color:var(--ink);text-transform:uppercase;outline:none;min-width:0;
  font-variation-settings:"opsz" 60;
}
.ticker-bar input::placeholder{color:var(--ink-40);letter-spacing:3px;font-weight:400;font-style:italic}
.ticker-bar select{
  padding:16px 12px;border:none;border-left:1px solid var(--ink-20);background:transparent;
  font-family:var(--smcp);font-size:12px;letter-spacing:2px;color:var(--ink-60);
  cursor:pointer;outline:none;
}
.ticker-bar button{
  padding:16px 24px;background:var(--banker);color:var(--paper);border:none;cursor:pointer;
  font-family:var(--smcp);font-weight:400;font-size:12px;letter-spacing:4px;text-transform:uppercase;
  transition:background 0.15s;white-space:nowrap;
}
.ticker-bar button:hover{background:var(--banker-deep)}

/* SECTION */
.section{padding:36px 0 28px;border-top:1px solid var(--ink-20)}
.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:20px;margin-bottom:20px;flex-wrap:wrap}
.section-hed{font-family:var(--display);font-weight:500;font-style:italic;font-size:28px;line-height:1;color:var(--ink);letter-spacing:-0.01em;font-variation-settings:"opsz" 72}
.section-hed strong{font-weight:700;font-style:normal}
.section-link{font-family:var(--smcp);font-size:11px;letter-spacing:4px;text-transform:uppercase;color:var(--ink-60);border-bottom:1px solid var(--gold);padding-bottom:3px;transition:color 0.15s}
.section-link:hover{color:var(--banker)}

/* WORKFLOW CARDS */
.wf-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:640px){.wf-grid{grid-template-columns:1fr}}
.wf-card{
  display:flex;align-items:center;gap:16px;
  padding:18px 20px;
  background:var(--paper-warm);
  border:1px solid var(--ink-20);
  transition:border 0.15s,box-shadow 0.15s;
  cursor:pointer;
}
.wf-card:hover{
  border-color:var(--banker);
  box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 3px transparent,inset 0 0 0 4px var(--gold-deep);
}
.wf-card-icon{font-size:28px;flex-shrink:0;width:44px;text-align:center}
.wf-card-body{flex:1;min-width:0}
.wf-card-name{font-family:var(--display);font-weight:600;font-size:18px;color:var(--ink);line-height:1.2;font-variation-settings:"opsz" 36}
.wf-card-desc{font-size:14px;color:var(--ink-60);line-height:1.4;margin-top:3px}
.wf-card-cat{
  font-family:var(--smcp);font-size:10px;letter-spacing:3px;text-transform:uppercase;
  flex-shrink:0;
}

/* RECENT RESEARCH */
.recent-list{display:flex;flex-direction:column;gap:0}
.recent-row{
  display:grid;grid-template-columns:100px 70px 1fr 80px 50px 70px;
  gap:12px;align-items:center;padding:14px 16px;
  border-bottom:1px solid var(--ink-20);
  font-size:14px;transition:background 0.1s;
}
.recent-row:hover{background:var(--paper-warm)}
.recent-wf{font-family:var(--smcp);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-60)}
.recent-ticker{font-family:var(--display);font-weight:600;font-size:16px;color:var(--ink);font-variation-settings:"opsz" 36}
.recent-summary{color:var(--ink-60);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.recent-status{font-family:var(--smcp);font-size:10px;letter-spacing:2px;text-transform:uppercase;text-align:center;padding:3px 8px}
.st-done{color:var(--banker);background:rgba(15,59,46,0.08)}
.st-run{color:var(--gold-deep);background:rgba(184,151,62,0.1)}
.st-fail{color:var(--ledger-red);background:rgba(139,42,30,0.08)}
.recent-dur{font-family:var(--smcp);font-size:11px;letter-spacing:1px;color:var(--ink-40);text-align:right}
.recent-date{font-size:13px;color:var(--ink-40);text-align:right}
.recent-empty{text-align:center;padding:40px 0;color:var(--ink-40);font-style:italic}

/* FOOTER */
.foot{padding:28px 0;border-top:1px solid var(--ink);margin-top:40px;text-align:center}
.foot-copy{font-family:var(--smcp);font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--ink-40)}
.foot-links{margin-top:6px;font-family:var(--smcp);font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--ink-40)}
.foot-links a{color:var(--ink-60);border-bottom:1px solid var(--gold);padding-bottom:1px}

@media(max-width:700px){
  .recent-row{grid-template-columns:80px 60px 1fr 60px;font-size:13px}
  .recent-dur,.recent-date{display:none}
}
</style>
</head>
<body>

<header class="mast">
  <div class="wrap">
    <a href="${mountPrefix}/" class="mast-brand">Levin Capital <em>Research</em></a>
    <nav class="mast-nav">
      <a href="${mountPrefix}/research" class="active">Research Desk</a>
      <a href="${mountPrefix}/">Stock Pitch</a>
      <a href="${mountPrefix}/research/history">History</a>
      <a href="${mountPrefix}/auth/logout" id="signout-link">Sign Out</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="wrap">
    <h1>The Research <em>Desk.</em></h1>
    <p class="hero-sub">Ten AI workflows, one ticker. From screen to thesis in minutes.</p>
    <form class="ticker-bar" id="quick-launch" onsubmit="return handleQuickLaunch(event)">
      <input type="text" id="ql-ticker" placeholder="Ticker" maxlength="10" autocomplete="off" autofocus>
      <select id="ql-workflow">
        ${WORKFLOW_LIST.filter(w => w.requiresTicker).map(w => `<option value="${w.slug}">${w.name}</option>`).join('')}
      </select>
      <button type="submit">Run &rarr;</button>
    </form>
  </div>
</section>

<main class="wrap">
  <section class="section">
    <div class="section-head">
      <h2 class="section-hed"><strong>Workflows</strong></h2>
    </div>
    <div class="wf-grid">
      ${cards}
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2 class="section-hed"><em>Recent</em> <strong>research</strong></h2>
      <a href="${mountPrefix}/research/history" class="section-link">View all &rarr;</a>
    </div>
    <div class="recent-list">
      ${recent}
    </div>
  </section>
</main>

<footer class="foot">
  <div class="wrap">
    <div class="foot-copy">&copy; 2026 Levin Capital Research</div>
    <div class="foot-links">
      <a href="${mountPrefix}/">Stock Pitch</a> &middot;
      <a href="https://research.levincap.com">Portals</a>
    </div>
  </div>
</footer>

<script>
function handleQuickLaunch(e) {
  e.preventDefault();
  const ticker = document.getElementById('ql-ticker').value.trim().toUpperCase();
  const workflow = document.getElementById('ql-workflow').value;
  if (!ticker) { document.getElementById('ql-ticker').focus(); return false; }
  window.location.href = '${mountPrefix}/research/' + workflow + '?ticker=' + encodeURIComponent(ticker);
  return false;
}

// Workflow card click with ticker pre-fill
document.querySelectorAll('.wf-card').forEach(card => {
  card.addEventListener('click', function(e) {
    const wf = this.dataset.workflow;
    const ticker = document.getElementById('ql-ticker').value.trim().toUpperCase();
    if (ticker) {
      e.preventDefault();
      window.location.href = this.href + '?ticker=' + encodeURIComponent(ticker);
    }
  });
});
</script>
</body>
</html>`;
}
