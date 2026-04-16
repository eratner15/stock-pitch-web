/**
 * Workflow Run Page — universal execution page for all 10 workflows.
 * Input panel → SSE progress → rendered output.
 * Uses Levin Capital design system.
 */
import { WORKFLOWS, type WorkflowConfig, type WorkflowSlug } from '../lib/workflow-config';
import { escapeHtml } from '../lib/security';

interface RunPageParams {
  workflow: WorkflowConfig;
  ticker?: string;
  mountPrefix?: string;
}

export function renderWorkflowRun({ workflow, ticker, mountPrefix = '' }: RunPageParams): string {
  const w = workflow;
  const tickerVal = ticker ? escapeHtml(ticker.toUpperCase()) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${w.name} — Levin Capital Research</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,400;1,9..144,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=IM+Fell+English+SC&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --paper:#F3EAD5;--paper-deep:#E6DABF;--paper-warm:#F8F0DB;
  --ink:#0A0806;--ink-60:#5A5040;--ink-40:#847961;--ink-20:#B8AE95;
  --banker:#0F3B2E;--banker-deep:#082619;--gold:#B8973E;--gold-deep:#8B6F28;
  --ledger-green:#0F3B2E;--ledger-red:#8B2A1E;
  --display:'Fraunces','Source Serif 4',Georgia,serif;
  --body:'Source Serif 4','Lora',Georgia,serif;
  --smcp:'IM Fell English SC',serif;
  --mono:'SF Mono','Fira Code',monospace;
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
.mast-brand em{font-style:italic;font-weight:500;color:var(--banker);text-transform:none;letter-spacing:0.01em;margin-left:6px}
.mast-nav{display:flex;align-items:center;gap:28px;font-family:var(--smcp);font-size:12px;letter-spacing:4px;text-transform:uppercase;color:var(--ink-60)}
.mast-nav a{padding:4px 0;border-bottom:2px solid transparent;transition:border 0.2s,color 0.2s}
.mast-nav a:hover{color:var(--banker);border-bottom-color:var(--gold)}

/* WORKFLOW HEADER */
.wf-header{padding:40px 0 28px;border-bottom:1px solid var(--ink-20)}
.wf-icon{font-size:36px;margin-bottom:8px}
.wf-title{font-family:var(--display);font-weight:700;font-size:clamp(28px,4vw,42px);line-height:1.1;color:var(--ink);font-variation-settings:"opsz" 72}
.wf-desc{font-size:17px;color:var(--ink-60);margin-top:6px;font-style:italic}

/* INPUT FORM */
.input-section{padding:28px 0;border-bottom:1px solid var(--ink-20)}
.input-row{display:flex;gap:12px;align-items:end;flex-wrap:wrap}
.input-group{display:flex;flex-direction:column;gap:6px}
.input-group label{font-family:var(--smcp);font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--ink-60)}
.input-group input,.input-group textarea{
  padding:14px 18px;border:1px solid var(--ink-20);background:var(--paper-warm);
  font-family:var(--display);font-size:22px;font-weight:600;letter-spacing:2px;
  color:var(--ink);text-transform:uppercase;outline:none;
  font-variation-settings:"opsz" 60;transition:border 0.15s;
}
.input-group input:focus,.input-group textarea:focus{border-color:var(--banker)}
.input-group textarea{
  font-family:var(--body);font-size:16px;font-weight:400;text-transform:none;letter-spacing:0;
  min-height:80px;resize:vertical;
}
.run-btn{
  padding:14px 28px;background:var(--banker);color:var(--paper);border:none;cursor:pointer;
  font-family:var(--smcp);font-size:12px;letter-spacing:4px;text-transform:uppercase;
  transition:background 0.15s;height:fit-content;white-space:nowrap;
}
.run-btn:hover{background:var(--banker-deep)}
.run-btn:disabled{opacity:0.5;cursor:not-allowed}

/* PROGRESS */
.progress-section{padding:28px 0;display:none}
.progress-section.active{display:block}
.progress-bar{height:4px;background:var(--ink-20);margin-bottom:20px;overflow:hidden;position:relative}
.progress-fill{height:100%;background:var(--banker);width:0;transition:width 0.3s}
.tool-log{display:flex;flex-direction:column;gap:8px}
.tool-entry{
  display:flex;align-items:center;gap:12px;
  padding:10px 14px;background:var(--paper-warm);border-left:3px solid var(--gold);
  font-size:14px;
}
.tool-name{font-family:var(--mono);font-size:13px;font-weight:600;color:var(--banker);min-width:140px}
.tool-preview{color:var(--ink-60);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.tool-status{font-family:var(--smcp);font-size:10px;letter-spacing:2px;text-transform:uppercase}
.tool-status.running{color:var(--gold-deep)}
.tool-status.done{color:var(--banker)}

/* OUTPUT */
.output-section{padding:28px 0;display:none}
.output-section.active{display:block}
.output-meta{
  display:flex;gap:20px;align-items:center;margin-bottom:20px;padding:14px 18px;
  background:var(--paper-warm);border:1px solid var(--ink-20);
  font-family:var(--smcp);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-60);
}
.output-meta strong{color:var(--banker);font-weight:normal}
.output-body{
  background:var(--paper-warm);border:1px solid var(--ink);
  padding:32px 28px;
  font-family:var(--body);font-size:17px;line-height:1.7;color:var(--ink);
  box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 4px transparent,inset 0 0 0 5px var(--gold-deep);
}
.output-body h1,.output-body h2,.output-body h3{font-family:var(--display);font-variation-settings:"opsz" 60;margin:24px 0 10px;color:var(--ink)}
.output-body h1{font-size:28px;font-weight:700}
.output-body h2{font-size:22px;font-weight:600}
.output-body h3{font-size:18px;font-weight:600;font-style:italic}
.output-body p{margin:10px 0}
.output-body ul,.output-body ol{margin:10px 0 10px 24px}
.output-body li{margin:4px 0}
.output-body table{border-collapse:collapse;width:100%;margin:16px 0;font-size:15px}
.output-body th{text-align:left;padding:10px 12px;border-bottom:2px solid var(--ink);font-family:var(--smcp);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-60)}
.output-body td{padding:10px 12px;border-bottom:1px solid var(--ink-20)}
.output-body code{font-family:var(--mono);font-size:14px;background:rgba(15,59,46,0.06);padding:2px 6px}
.output-body strong{font-weight:600}
.output-body em{font-style:italic}

/* ACTIONS */
.action-bar{
  display:flex;gap:12px;padding:20px 0;margin-top:20px;border-top:1px solid var(--ink-20);
}
.action-btn{
  padding:10px 20px;border:1px solid var(--ink-20);background:var(--paper-warm);
  font-family:var(--smcp);font-size:11px;letter-spacing:3px;text-transform:uppercase;
  color:var(--ink-60);cursor:pointer;transition:all 0.15s;
}
.action-btn:hover{border-color:var(--banker);color:var(--banker)}
.action-btn.primary{background:var(--banker);color:var(--paper);border-color:var(--banker)}
.action-btn.primary:hover{background:var(--banker-deep)}

/* FOOTER */
.foot{padding:28px 0;border-top:1px solid var(--ink);margin-top:40px;text-align:center}
.foot-copy{font-family:var(--smcp);font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--ink-40)}
</style>
</head>
<body>

<header class="mast">
  <div class="wrap">
    <a href="${mountPrefix}/" class="mast-brand">Levin Capital <em>Research</em></a>
    <nav class="mast-nav">
      <a href="${mountPrefix}/research">Research Desk</a>
      <a href="${mountPrefix}/">Stock Pitch</a>
      <a href="${mountPrefix}/research/history">History</a>
    </nav>
  </div>
</header>

<div class="wrap">
  <section class="wf-header">
    <div class="wf-icon">${w.icon}</div>
    <h1 class="wf-title">${w.name}</h1>
    <p class="wf-desc">${w.description}</p>
  </section>

  <section class="input-section" id="input-section">
    <form class="input-row" id="run-form" onsubmit="return startRun(event)">
      ${w.requiresTicker ? `
      <div class="input-group" style="flex:0 0 160px">
        <label for="ticker-input">Ticker</label>
        <input type="text" id="ticker-input" placeholder="AAPL" maxlength="10" value="${tickerVal}" autocomplete="off" required>
      </div>` : ''}
      <div class="input-group" style="flex:1">
        <label for="context-input">Context <span style="color:var(--ink-40)">(optional)</span></label>
        <textarea id="context-input" placeholder="Additional context, notes, or data to include..."></textarea>
      </div>
      <button type="submit" class="run-btn" id="run-btn">Run ${w.name} &rarr;</button>
    </form>
  </section>

  <section class="progress-section" id="progress-section">
    <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
    <div class="tool-log" id="tool-log"></div>
  </section>

  <section class="output-section" id="output-section">
    <div class="output-meta" id="output-meta"></div>
    <div class="output-body" id="output-body"></div>
    <div class="action-bar">
      <button class="action-btn primary" onclick="copyOutput()">Copy</button>
      <a class="action-btn" href="${mountPrefix}/research" id="back-btn">Back to Desk</a>
      <button class="action-btn" onclick="runAgain()">Run Again</button>
    </div>
  </section>
</div>

<footer class="foot">
  <div class="wrap">
    <div class="foot-copy">&copy; 2026 Levin Capital Research</div>
  </div>
</footer>

<script>
const WORKFLOW = '${w.slug}';
const MOUNT = '${mountPrefix}';
let currentRunId = null;
let outputText = '';

async function startRun(e) {
  e.preventDefault();
  const ticker = document.getElementById('ticker-input')?.value?.trim()?.toUpperCase() || null;
  const context = document.getElementById('context-input')?.value?.trim() || null;

  if (${w.requiresTicker ? 'true' : 'false'} && !ticker) {
    document.getElementById('ticker-input').focus();
    return false;
  }

  // Disable form, show progress
  document.getElementById('run-btn').disabled = true;
  document.getElementById('run-btn').textContent = 'Running...';
  document.getElementById('progress-section').classList.add('active');
  document.getElementById('output-section').classList.remove('active');
  document.getElementById('tool-log').innerHTML = '';
  document.getElementById('progress-fill').style.width = '5%';

  try {
    // Create run record first
    const createRes = await fetch(MOUNT + '/research/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ workflow: WORKFLOW, ticker, context }),
    });
    const createData = await createRes.json();
    if (!createRes.ok || !createData.runId) {
      throw new Error(createData.error || 'Failed to create run');
    }
    currentRunId = createData.runId;

    // Connect SSE stream
    const streamRes = await fetch(MOUNT + '/research/api/run/' + currentRunId + '/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ workflow: WORKFLOW, ticker, context, runId: currentRunId }),
    });

    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let toolCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\\n');
      buffer = lines.pop();

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            handleEvent(eventType, data);
            if (eventType === 'tool_start' || eventType === 'tool_done') toolCount++;
            document.getElementById('progress-fill').style.width = Math.min(5 + toolCount * 12, 90) + '%';
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    addToolEntry('error', err.message, 'error');
  }

  document.getElementById('run-btn').disabled = false;
  document.getElementById('run-btn').textContent = 'Run ${w.name} \\u2192';
  return false;
}

function handleEvent(type, data) {
  switch (type) {
    case 'start':
      addToolEntry('system', 'Starting ' + WORKFLOW + (data.ticker ? ' for ' + data.ticker : ''), 'running');
      break;
    case 'tool_start':
      addToolEntry(data.tool, 'Calling ' + data.tool + '...', 'running');
      break;
    case 'tool_done':
      updateLastTool(data.tool, data.preview, 'done');
      break;
    case 'thinking':
      addToolEntry('system', data.message || 'Analyzing...', 'running');
      break;
    case 'complete':
      document.getElementById('progress-fill').style.width = '100%';
      outputText = data.analysis || '';
      showOutput(data);
      break;
    case 'error':
      addToolEntry('error', data.message, 'error');
      break;
  }
}

function addToolEntry(name, preview, status) {
  const log = document.getElementById('tool-log');
  const el = document.createElement('div');
  el.className = 'tool-entry';
  el.dataset.tool = name;
  el.innerHTML = '<span class="tool-name">' + name + '</span><span class="tool-preview">' + escapeHtml(preview) + '</span><span class="tool-status ' + status + '">' + status + '</span>';
  log.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateLastTool(name, preview, status) {
  const entries = document.querySelectorAll('.tool-entry[data-tool="' + name + '"]');
  const last = entries[entries.length - 1];
  if (last) {
    last.querySelector('.tool-preview').textContent = preview;
    last.querySelector('.tool-status').className = 'tool-status ' + status;
    last.querySelector('.tool-status').textContent = status;
  }
}

function showOutput(data) {
  document.getElementById('output-section').classList.add('active');
  const meta = document.getElementById('output-meta');
  meta.innerHTML = '<span><strong>' + (data.words || 0) + '</strong> words</span><span><strong>' + (data.tool_loops || 0) + '</strong> tool loops</span><span><strong>' + ((data.duration_ms || 0) / 1000).toFixed(1) + 's</strong></span>';

  // Render markdown-ish output as HTML
  const body = document.getElementById('output-body');
  body.innerHTML = renderMarkdown(data.analysis || '');
}

function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
    .replace(/\`(.+?)\`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>')
    .replace(/\\n\\n/g, '</p><p>')
    .replace(/^(.+)$/gm, function(m) { return m.startsWith('<') ? m : '<p>' + m + '</p>'; });
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function copyOutput() {
  navigator.clipboard.writeText(outputText).then(() => {
    const btn = document.querySelector('.action-btn.primary');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 1500);
  });
}

function runAgain() {
  document.getElementById('progress-section').classList.remove('active');
  document.getElementById('output-section').classList.remove('active');
  document.getElementById('tool-log').innerHTML = '';
  document.getElementById('progress-fill').style.width = '0';
  ${w.requiresTicker ? "document.getElementById('ticker-input').focus();" : ''}
}

// Auto-run if ticker in URL
const urlTicker = new URLSearchParams(window.location.search).get('ticker');
if (urlTicker && ${w.requiresTicker ? 'true' : 'false'}) {
  document.getElementById('ticker-input').value = urlTicker.toUpperCase();
}
</script>
</body>
</html>`;
}

/**
 * Render a completed workflow run (read-only view from history).
 */
export function renderRunDetail(run: any, mountPrefix: string = ''): string {
  const w = WORKFLOWS[run.workflow as WorkflowSlug];
  const wName = w?.name || run.workflow;
  const statusClass = run.status === 'complete' ? 'st-done' : run.status === 'running' ? 'st-run' : 'st-fail';
  const dur = run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—';
  const date = new Date(run.created_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${wName}${run.ticker ? ' — ' + escapeHtml(run.ticker) : ''} — Levin Capital Research</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,400;1,9..144,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=IM+Fell+English+SC&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--paper:#F3EAD5;--paper-deep:#E6DABF;--paper-warm:#F8F0DB;--ink:#0A0806;--ink-60:#5A5040;--ink-40:#847961;--ink-20:#B8AE95;--banker:#0F3B2E;--banker-deep:#082619;--gold:#B8973E;--gold-deep:#8B6F28;--ledger-green:#0F3B2E;--ledger-red:#8B2A1E;--display:'Fraunces','Source Serif 4',Georgia,serif;--body:'Source Serif 4','Lora',Georgia,serif;--smcp:'IM Fell English SC',serif;--mono:'SF Mono','Fira Code',monospace}
html{background:var(--paper)}body{font-family:var(--body);background:var(--paper);color:var(--ink);line-height:1.62;font-size:18px;-webkit-font-smoothing:antialiased;background-image:repeating-linear-gradient(0deg,transparent 0 31px,rgba(46,40,29,0.022) 31px 32px);background-attachment:fixed}
a{color:inherit;text-decoration:none}.wrap{max-width:1000px;margin:0 auto;padding:0 28px}
.mast{padding:24px 0;border-bottom:1px solid var(--ink)}.mast .wrap{display:flex;justify-content:space-between;align-items:center;gap:20px}.mast-brand{font-family:var(--display);font-weight:700;font-size:22px;line-height:1;letter-spacing:0.02em;text-transform:uppercase;color:var(--ink);font-variation-settings:"opsz" 40}.mast-brand em{font-style:italic;font-weight:500;color:var(--banker);text-transform:none;letter-spacing:0.01em;margin-left:6px}.mast-nav{display:flex;align-items:center;gap:28px;font-family:var(--smcp);font-size:12px;letter-spacing:4px;text-transform:uppercase;color:var(--ink-60)}.mast-nav a{padding:4px 0;border-bottom:2px solid transparent;transition:border 0.2s,color 0.2s}.mast-nav a:hover{color:var(--banker);border-bottom-color:var(--gold)}
.run-header{padding:40px 0 24px;border-bottom:1px solid var(--ink-20)}.run-header h1{font-family:var(--display);font-weight:700;font-size:32px;color:var(--ink);font-variation-settings:"opsz" 72;margin-bottom:8px}.run-meta{display:flex;gap:20px;font-family:var(--smcp);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-60);flex-wrap:wrap}.run-meta strong{color:var(--banker);font-weight:normal}
.st-done{color:var(--banker)}.st-run{color:var(--gold-deep)}.st-fail{color:var(--ledger-red)}
.output-body{background:var(--paper-warm);border:1px solid var(--ink);padding:32px 28px;margin-top:28px;font-family:var(--body);font-size:17px;line-height:1.7;color:var(--ink);box-shadow:inset 0 0 0 1px var(--paper-warm),inset 0 0 0 4px transparent,inset 0 0 0 5px var(--gold-deep);white-space:pre-wrap;word-break:break-word}
.foot{padding:28px 0;border-top:1px solid var(--ink);margin-top:40px;text-align:center}.foot-copy{font-family:var(--smcp);font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--ink-40)}
</style>
</head>
<body>
<header class="mast"><div class="wrap"><a href="${mountPrefix}/" class="mast-brand">Levin Capital <em>Research</em></a><nav class="mast-nav"><a href="${mountPrefix}/research">Research Desk</a><a href="${mountPrefix}/research/history">History</a></nav></div></header>
<div class="wrap">
  <section class="run-header">
    <h1>${wName}${run.ticker ? ' — ' + escapeHtml(run.ticker) : ''}</h1>
    <div class="run-meta">
      <span class="${statusClass}"><strong>${run.status}</strong></span>
      <span>${date}</span>
      <span><strong>${dur}</strong></span>
      <span><strong>${run.tool_calls || 0}</strong> tools</span>
      <span><strong>${run.tokens_used || 0}</strong> tokens</span>
    </div>
  </section>
  <div class="output-body">${run.output_json ? escapeHtml(run.output_json) : run.error_message ? escapeHtml(run.error_message) : 'No output yet.'}</div>
</div>
<footer class="foot"><div class="wrap"><div class="foot-copy">&copy; 2026 Levin Capital Research</div></div></footer>
</body>
</html>`;
}
