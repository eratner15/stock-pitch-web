export function renderSubmitV2(brand: 'stockpitch' | 'levincap', prefillTicker?: string): string {
  const pre = (prefillTicker || '').toUpperCase().replace(/[^A-Z.]/g, '').slice(0, 8);
  const isLevin = brand === 'levincap';
  const accent = isLevin ? '#B8973E' : '#2EBD6B';
  const accentDeep = isLevin ? '#8B6F28' : '#1D9A54';
  const bg = isLevin ? '#FAF7F0' : '#0A0F1F';
  const surface = isLevin ? '#FFFFFF' : '#13192C';
  const ink = isLevin ? '#0A0A0A' : '#FFFFFF';
  const inkMuted = isLevin ? '#5A5651' : '#8B93AD';
  const border = isLevin ? '#D4CFC3' : '#1E2638';
  const displayFont = isLevin ? "'Playfair Display',Georgia,serif" : "'Inter',system-ui,sans-serif";
  const brandMark = isLevin ? 'Levin Capital <em>Research</em>' : '<span style="color:' + accent + '">●</span>&nbsp;Stock Pitch';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="${bg}">
<title>Pitch a Stock · ${isLevin ? 'Levin Capital Research' : 'Stock Pitch'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:${bg};
  --surface:${surface};
  --ink:${ink};
  --ink-muted:${inkMuted};
  --border:${border};
  --accent:${accent};
  --accent-deep:${accentDeep};
  --green:#2EBD6B;
  --red:#E04759;
  --display:${displayFont};
  --sans:'Inter',system-ui,-apple-system,sans-serif;
  --mono:'JetBrains Mono',monospace;
}
html,body{height:100%;overflow-x:hidden}
body{font-family:var(--sans);background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;font-size:16px;line-height:1.55;position:relative}

/* ============== SHELL ============== */
.shell{min-height:100vh;display:flex;flex-direction:column}

.topbar{padding:16px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border)}
.topbar .brand{font-family:${isLevin ? 'var(--display)' : 'var(--mono)'};font-weight:${isLevin ? '900' : '700'};font-size:${isLevin ? '20px' : '14px'};color:var(--ink);letter-spacing:${isLevin ? '-0.01em' : 'normal'};display:flex;align-items:center;gap:6px}
.topbar .brand em{font-weight:${isLevin ? '400' : '500'};font-style:italic}
.topbar .close{font-family:var(--sans);font-size:12px;color:var(--ink-muted);padding:8px 14px;border:1px solid var(--border);border-radius:99px;letter-spacing:0.5px}
.topbar .close:hover{color:var(--ink);border-color:var(--ink)}

/* Progress bar */
.progress{height:3px;background:var(--border);position:relative;overflow:hidden}
.progress-bar{position:absolute;top:0;left:0;bottom:0;background:var(--accent);width:0;transition:width 0.35s cubic-bezier(0.22,1,0.36,1)}

/* ============== STEPS ============== */
.stage{flex:1;display:flex;align-items:flex-start;justify-content:center;padding:40px 24px 120px;position:relative;overflow-y:auto}
.step{width:100%;max-width:620px;display:none;animation:fadeSlide 0.45s cubic-bezier(0.22,1,0.36,1) both}
.step.active{display:block}
@keyframes fadeSlide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

.step-label{font-family:var(--mono);font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--accent);font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:10px}
.step-label::before{content:attr(data-num);display:inline-block;width:22px;height:22px;background:var(--accent);color:var(--bg);border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:700;letter-spacing:normal}
.step h2{font-family:var(--display);font-weight:${isLevin ? '900' : '800'};font-size:40px;color:var(--ink);line-height:1.05;letter-spacing:-0.025em;margin-bottom:10px}
.step h2 em{font-style:italic;font-weight:${isLevin ? '400' : '500'};color:var(--accent)}
.step p.hint{font-family:var(--sans);font-size:15px;color:var(--ink-muted);margin-bottom:32px;line-height:1.55}

/* ============== TICKER SEARCH ============== */
.ticker-box{position:relative}
.ticker-input{width:100%;padding:24px 20px;background:var(--surface);border:2px solid var(--border);border-radius:14px;font-family:var(--mono);font-weight:700;font-size:32px;color:var(--ink);text-transform:uppercase;letter-spacing:3px;transition:border 0.15s;text-align:center;caret-color:var(--accent)}
.ticker-input:focus{outline:none;border-color:var(--accent)}
.ticker-input::placeholder{color:var(--ink-muted);letter-spacing:3px;font-weight:400}
.price-reveal{margin-top:20px;padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:14px;display:none;align-items:center;gap:20px;animation:fadeIn 0.3s both}
.price-reveal.show{display:flex}
@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.price-reveal .company-info{flex:1;min-width:0}
.price-reveal .company-info .company{font-family:${displayFont};font-weight:700;font-size:18px;color:var(--ink);line-height:1.2}
.price-reveal .company-info .label{font-family:var(--sans);font-size:11px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:1.5px;margin-top:2px}
.price-reveal .price-value{text-align:right}
.price-reveal .price-value .amount{font-family:var(--mono);font-weight:700;font-size:28px;color:var(--ink);letter-spacing:-0.01em}
.price-reveal .price-value .delta{font-family:var(--mono);font-size:12px;font-weight:600;margin-top:2px}
.price-reveal .price-value .delta.pos{color:var(--green)}
.price-reveal .price-value .delta.neg{color:var(--red)}
.entry-lock{margin-top:12px;font-family:var(--sans);font-size:12px;color:var(--accent);font-weight:600;letter-spacing:0.5px;text-align:center}

/* Suggestion chips */
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px;justify-content:center}
.chip{padding:8px 16px;background:var(--surface);border:1px solid var(--border);border-radius:99px;font-family:var(--mono);font-size:13px;font-weight:600;color:var(--ink-muted);letter-spacing:1px;cursor:pointer;transition:all 0.12s}
.chip:hover{border-color:var(--accent);color:var(--accent)}

/* ============== DIRECTION ============== */
.dir-choice{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}
.dir-btn{background:var(--surface);border:2px solid var(--border);border-radius:20px;padding:40px 24px;cursor:pointer;text-align:center;transition:all 0.18s}
.dir-btn:hover{border-color:var(--accent);transform:translateY(-2px)}
.dir-btn.selected{border-color:var(--accent);background:${isLevin ? '#FFF' : 'rgba(46,189,107,0.08)'};transform:translateY(-2px);box-shadow:0 8px 24px rgba(46,189,107,0.15)}
.dir-btn .emoji{font-size:56px;line-height:1;margin-bottom:12px;display:block}
.dir-btn .label{font-family:var(--display);font-weight:${isLevin ? '900' : '800'};font-size:26px;color:var(--ink);letter-spacing:-0.01em}
.dir-btn .sub{font-family:var(--sans);font-size:13px;color:var(--ink-muted);margin-top:4px}
.dir-btn.long.selected .label{color:var(--green)}
.dir-btn.short.selected .label{color:var(--red)}

/* ============== PRICE TARGET ============== */
.pt-box{background:var(--surface);border:2px solid var(--border);border-radius:20px;padding:32px;margin-top:12px}
.pt-label{font-family:var(--mono);font-size:11px;color:var(--ink-muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;font-weight:600}
.pt-input-row{display:flex;align-items:baseline;gap:8px;margin-bottom:16px}
.pt-dollar{font-family:var(--display);font-weight:${isLevin ? '900' : '800'};font-size:56px;color:var(--ink-muted)}
.pt-input{flex:1;background:none;border:none;outline:none;font-family:var(--display);font-weight:${isLevin ? '900' : '800'};font-size:56px;color:var(--ink);letter-spacing:-0.02em;min-width:0;width:100%;padding:0;caret-color:var(--accent)}
.pt-input::placeholder{color:var(--ink-muted)}
.pt-meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding-top:16px;border-top:1px solid var(--border)}
.pt-meta-col{font-family:var(--sans)}
.pt-meta-col .v{font-family:var(--mono);font-weight:700;font-size:22px;color:var(--accent);letter-spacing:-0.01em}
.pt-meta-col .l{font-size:11px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-top:2px}

.horizon-row{display:flex;gap:8px;margin-top:20px;justify-content:center;flex-wrap:wrap}
.h-chip{padding:10px 18px;background:var(--surface);border:1.5px solid var(--border);border-radius:99px;font-family:var(--sans);font-size:13px;font-weight:600;color:var(--ink-muted);cursor:pointer;transition:all 0.12s}
.h-chip.selected{border-color:var(--accent);color:var(--accent);background:${isLevin ? '#FFF' : 'rgba(46,189,107,0.08)'}}

/* ============== THESIS ============== */
.thesis-container{position:relative}
.thesis-input{width:100%;background:var(--surface);border:2px solid var(--border);border-radius:20px;padding:24px;font-family:${isLevin ? "'Cormorant Garamond',Georgia,serif" : 'var(--sans)'};font-size:${isLevin ? '19px' : '16px'};color:var(--ink);line-height:1.65;min-height:240px;resize:vertical;transition:border 0.15s}
.thesis-input:focus{outline:none;border-color:var(--accent)}
.thesis-input::placeholder{color:var(--ink-muted)}
.thesis-meta{display:flex;justify-content:space-between;align-items:center;margin-top:12px}
.thesis-count{font-family:var(--mono);font-size:11px;color:var(--ink-muted)}
.thesis-count.ok{color:var(--accent)}
.thesis-assist{padding:8px 14px;background:var(--surface);border:1px solid var(--border);border-radius:99px;font-family:var(--sans);font-size:12px;font-weight:600;color:var(--accent);cursor:pointer;transition:all 0.12s}
.thesis-assist:hover{border-color:var(--accent)}
.thesis-prompts{margin-top:16px;display:grid;gap:8px}
.prompt-chip{padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;font-family:${isLevin ? "'Cormorant Garamond',serif" : 'var(--sans)'};font-size:14px;color:var(--ink-muted);cursor:pointer;transition:all 0.12s;text-align:left;${isLevin ? 'font-style:italic' : ''}}
.prompt-chip:hover{border-color:var(--accent);color:var(--ink)}
.prompt-chip::before{content:'\u2192 ';color:var(--accent);font-weight:700}

/* ============== IDENTITY ============== */
.id-row{display:grid;gap:16px;margin-top:12px}
.id-field input{width:100%;padding:22px 20px;background:var(--surface);border:2px solid var(--border);border-radius:14px;font-family:var(--sans);font-weight:500;font-size:18px;color:var(--ink);letter-spacing:-0.01em}
.id-field input:focus{outline:none;border-color:var(--accent)}
.id-field input::placeholder{color:var(--ink-muted)}
.id-field .label{font-family:var(--mono);font-size:11px;color:var(--ink-muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;font-weight:600}

/* ============== RATING (inline on target step) ============== */
.rating-choice{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:16px}
.rating-opt{padding:10px 6px;background:var(--surface);border:1.5px solid var(--border);border-radius:8px;text-align:center;font-family:var(--mono);font-size:11px;font-weight:700;color:var(--ink-muted);cursor:pointer;letter-spacing:0.5px;transition:all 0.12s}
.rating-opt.selected{border-color:var(--accent);color:var(--accent);background:${isLevin ? '#FFF' : 'rgba(46,189,107,0.08)'}}

/* ============== REVIEW (final step) ============== */
.review{background:var(--surface);border-radius:20px;padding:32px;border:1px solid var(--border)}
.review-row{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border);font-family:var(--sans)}
.review-row:last-child{border-bottom:none}
.review-row .lbl{font-family:var(--mono);font-size:11px;color:var(--ink-muted);letter-spacing:2px;text-transform:uppercase;font-weight:600}
.review-row .val{font-family:var(--display);font-weight:${isLevin ? '700' : '700'};font-size:18px;color:var(--ink);letter-spacing:-0.01em;text-align:right}
.review-row .val.pos{color:var(--green)}
.review-row .val.neg{color:var(--red)}

/* ============== SUCCESS ============== */
.success{text-align:center;padding:20px 0}
.success-emoji{font-size:72px;margin-bottom:24px;animation:pop 0.6s cubic-bezier(0.22,1,0.36,1) both}
@keyframes pop{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
.success h2{font-family:var(--display);font-weight:${isLevin ? '900' : '800'};font-size:44px;color:var(--ink);margin-bottom:14px;letter-spacing:-0.02em}
.success h2 em{font-style:italic;color:var(--accent);font-weight:${isLevin ? '400' : '500'}}
.success p.big{font-family:var(--sans);font-size:18px;color:var(--ink-muted);max-width:460px;margin:0 auto 32px;line-height:1.55}
.success-actions{display:grid;gap:12px;max-width:360px;margin:0 auto}
.share-btn{padding:18px 24px;background:var(--accent);color:${isLevin ? 'var(--ink)' : '#07122B'};border:none;border-radius:14px;font-family:var(--sans);font-weight:700;font-size:15px;cursor:pointer;letter-spacing:0.2px;transition:transform 0.12s,box-shadow 0.12s}
.share-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(46,189,107,0.3)}
.outline-btn{padding:18px 24px;background:transparent;color:var(--ink);border:2px solid var(--border);border-radius:14px;font-family:var(--sans);font-weight:600;font-size:15px;cursor:pointer;transition:border 0.12s;text-decoration:none;display:block}
.outline-btn:hover{border-color:var(--ink)}

/* ============== STICKY FOOTER ============== */
.footer-nav{position:fixed;bottom:0;left:0;right:0;padding:16px 24px;background:${isLevin ? 'rgba(250,247,240,0.96)' : 'rgba(10,15,31,0.96)'};backdrop-filter:blur(12px);border-top:1px solid var(--border);display:flex;gap:12px;align-items:center;justify-content:space-between;z-index:100}
.back-btn{padding:14px 20px;background:transparent;color:var(--ink-muted);border:1px solid var(--border);border-radius:12px;font-family:var(--sans);font-weight:600;font-size:14px;cursor:pointer;transition:all 0.12s}
.back-btn:hover{color:var(--ink);border-color:var(--ink)}
.back-btn:disabled{opacity:0.3;cursor:not-allowed}
.next-btn{flex:1;padding:14px 24px;background:var(--accent);color:${isLevin ? 'var(--ink)' : '#07122B'};border:none;border-radius:12px;font-family:var(--sans);font-weight:700;font-size:15px;cursor:pointer;letter-spacing:0.2px;transition:transform 0.12s,box-shadow 0.12s;display:flex;align-items:center;justify-content:center;gap:8px}
.next-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(46,189,107,0.28)}
.next-btn:disabled{background:var(--border);color:var(--ink-muted);cursor:not-allowed;transform:none;box-shadow:none}
.next-btn .arrow{font-size:18px;font-weight:400}

.kbd-hint{position:fixed;bottom:88px;left:50%;transform:translateX(-50%);font-family:var(--mono);font-size:10px;color:var(--ink-muted);letter-spacing:1.5px;text-transform:uppercase;opacity:0.6}
.kbd-hint kbd{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:2px 6px;margin:0 2px;color:var(--ink)}

/* Mobile tweaks */
@media(max-width:640px){
  .step h2{font-size:30px}
  .step p.hint{font-size:14px}
  .ticker-input{font-size:28px;padding:20px}
  .pt-dollar,.pt-input{font-size:44px}
  .dir-btn{padding:32px 16px}
  .dir-btn .emoji{font-size:44px}
  .dir-btn .label{font-size:22px}
  .kbd-hint{display:none}
  .stage{padding:24px 16px 100px}
  .footer-nav{padding:12px 16px}
  .rating-choice{grid-template-columns:repeat(3,1fr)}
}

/* Confetti canvas */
#confetti{position:fixed;inset:0;pointer-events:none;z-index:999}
</style>
</head>
<body>

<div class="shell">
  <div class="topbar">
    <a href="/" class="brand">${brandMark}</a>
    <a href="/leaderboard" class="close">&times; Cancel</a>
  </div>
  <div class="progress">
    <div class="progress-bar" id="progressBar"></div>
  </div>

  <main class="stage">

    <!-- STEP 1: Ticker -->
    <div class="step active" data-step="1">
      <div class="step-label" data-num="1">The Call</div>
      <h2>What's the <em>ticker?</em></h2>
      <p class="hint">Type a symbol. We'll lock in today's price as your entry.</p>

      <div class="ticker-box">
        <input type="text" class="ticker-input" id="ticker" placeholder="TICKER" maxlength="8" autocomplete="off" spellcheck="false" oninput="onTickerInput(this)" value="${pre}">
        <div class="price-reveal" id="priceReveal">
          <div class="company-info">
            <div class="company" id="company">—</div>
            <div class="label">Entry locked at today's close</div>
          </div>
          <div class="price-value">
            <div class="amount" id="priceAmount">—</div>
            <div class="delta" id="priceDelta">—</div>
          </div>
        </div>
        <div class="chips" id="tickerChips">
          <span class="chip" onclick="setTicker('NVDA')">NVDA</span>
          <span class="chip" onclick="setTicker('PLTR')">PLTR</span>
          <span class="chip" onclick="setTicker('TSLA')">TSLA</span>
          <span class="chip" onclick="setTicker('META')">META</span>
          <span class="chip" onclick="setTicker('BX')">BX</span>
          <span class="chip" onclick="setTicker('UBER')">UBER</span>
        </div>
      </div>
    </div>

    <!-- STEP 2: Direction -->
    <div class="step" data-step="2">
      <div class="step-label" data-num="2">The View</div>
      <h2>Bull or <em>Bear?</em></h2>
      <p class="hint">What's your direction on <span id="tickerEcho">this name</span>?</p>

      <div class="dir-choice">
        <div class="dir-btn long" onclick="selectDir('long', this)">
          <span class="emoji">&#128200;</span>
          <div class="label">Long</div>
          <div class="sub">You think it goes up</div>
        </div>
        <div class="dir-btn short" onclick="selectDir('short', this)">
          <span class="emoji">&#128201;</span>
          <div class="label">Short</div>
          <div class="sub">You think it drops</div>
        </div>
      </div>
    </div>

    <!-- STEP 3: Price Target + Horizon + Rating -->
    <div class="step" data-step="3">
      <div class="step-label" data-num="3">The Target</div>
      <h2>Where does it <em>go?</em></h2>
      <p class="hint">Your price target. We'll compute the implied return.</p>

      <div class="pt-box">
        <div class="pt-label">Price Target</div>
        <div class="pt-input-row">
          <span class="pt-dollar">$</span>
          <input type="number" class="pt-input" id="priceTarget" placeholder="0" step="0.01" min="0" oninput="updatePT()">
        </div>
        <div class="pt-meta">
          <div class="pt-meta-col">
            <div class="v" id="impliedUpside">—</div>
            <div class="l">Implied return</div>
          </div>
          <div class="pt-meta-col">
            <div class="v" id="ptCurrent">—</div>
            <div class="l">vs current price</div>
          </div>
        </div>
      </div>

      <div class="step-label" data-num="3b" style="margin-top:28px;background:none" title="Rating">
        <span style="opacity:0">0</span>Rating &middot; Time Horizon
      </div>
      <div class="rating-choice">
        <div class="rating-opt" data-r="buy" onclick="selectRating('buy',this)">Buy</div>
        <div class="rating-opt" data-r="overweight" onclick="selectRating('overweight',this)">Ovwt</div>
        <div class="rating-opt" data-r="hold" onclick="selectRating('hold',this)">Hold</div>
        <div class="rating-opt" data-r="underweight" onclick="selectRating('underweight',this)">Undwt</div>
        <div class="rating-opt" data-r="sell" onclick="selectRating('sell',this)">Sell</div>
      </div>
      <div class="horizon-row">
        <div class="h-chip" data-h="3" onclick="selectHorizon(3,this)">3 mo</div>
        <div class="h-chip" data-h="6" onclick="selectHorizon(6,this)">6 mo</div>
        <div class="h-chip selected" data-h="12" onclick="selectHorizon(12,this)">12 mo</div>
        <div class="h-chip" data-h="18" onclick="selectHorizon(18,this)">18 mo</div>
        <div class="h-chip" data-h="24" onclick="selectHorizon(24,this)">24 mo</div>
      </div>
    </div>

    <!-- STEP 4: Thesis -->
    <div class="step" data-step="4">
      <div class="step-label" data-num="4">The Thesis</div>
      <h2>Why are you <em>right?</em></h2>
      <p class="hint">What are you seeing that the market isn't? 2&ndash;4 sentences. We'll turn it into a full research brief.</p>

      <div class="thesis-container">
        <textarea class="thesis-input" id="thesis" placeholder="The variant perception. The catalyst. What you think compresses the gap between today's price and your target..." oninput="updateThesisCount()" minlength="100" maxlength="3000"></textarea>
        <div class="thesis-meta">
          <span class="thesis-count" id="thesisCount">0 / 100 min</span>
        </div>
      </div>

      <div class="thesis-prompts">
        <div class="prompt-chip" onclick="insertPrompt(this)">Street is discounting [X] but I think [Y]</div>
        <div class="prompt-chip" onclick="insertPrompt(this)">The next catalyst nobody's watching is [event]</div>
        <div class="prompt-chip" onclick="insertPrompt(this)">Management's guide is conservative because [reason]</div>
      </div>
    </div>

    <!-- STEP 5: Identity -->
    <div class="step" data-step="5">
      <div class="step-label" data-num="5">Your Name</div>
      <h2>Put your name <em>on it</em>.</h2>
      <p class="hint">Your call, your thesis, your credit. Short form — first name and last initial is fine.</p>

      <div class="id-row">
        <div class="id-field">
          <div class="label">Display Name</div>
          <input type="text" id="displayName" placeholder="e.g. Evan R." maxlength="40" autocomplete="name">
        </div>
        <div class="id-field">
          <div class="label">Email</div>
          <input type="email" id="email" placeholder="you@firm.com" autocomplete="email">
        </div>
      </div>
    </div>

    <!-- STEP 6: Review / Success -->
    <div class="step" data-step="6">
      <div class="success" id="successView" style="display:none">
        <div class="success-emoji">&#127919;</div>
        <h2>Your call is <em>live</em>.</h2>
        <p class="big">Your thesis is now on the leaderboard. We're generating your full research brief in the background &mdash; it'll be ready in a few seconds.</p>
        <div class="success-actions">
          <button class="share-btn" onclick="shareCall()">&#128279; Share Your Call</button>
          <a class="outline-btn" id="openCallLink" href="/leaderboard">View the Leaderboard &rarr;</a>
        </div>
      </div>

      <div id="reviewView">
        <div class="step-label" data-num="6">Review</div>
        <h2>Lock in your <em>call?</em></h2>
        <p class="hint">One last look. Entry price is locked when you submit.</p>

        <div class="review">
          <div class="review-row"><span class="lbl">Ticker</span><span class="val" id="rvTicker">—</span></div>
          <div class="review-row"><span class="lbl">Direction</span><span class="val" id="rvDir">—</span></div>
          <div class="review-row"><span class="lbl">Rating</span><span class="val" id="rvRating">—</span></div>
          <div class="review-row"><span class="lbl">Entry</span><span class="val" id="rvEntry">—</span></div>
          <div class="review-row"><span class="lbl">Target</span><span class="val" id="rvTarget">—</span></div>
          <div class="review-row"><span class="lbl">Implied Return</span><span class="val" id="rvImplied">—</span></div>
          <div class="review-row"><span class="lbl">Horizon</span><span class="val" id="rvHorizon">12 mo</span></div>
          <div class="review-row"><span class="lbl">Analyst</span><span class="val" id="rvName">—</span></div>
        </div>
      </div>
    </div>

  </main>

  <div class="kbd-hint">Press <kbd>Enter</kbd> to continue &middot; <kbd>Esc</kbd> to go back</div>

  <div class="footer-nav">
    <button class="back-btn" id="backBtn" onclick="goBack()">&larr; Back</button>
    <button class="next-btn" id="nextBtn" onclick="goNext()" disabled>
      <span id="nextLabel">Continue</span>
      <span class="arrow">&rarr;</span>
    </button>
  </div>
</div>

<canvas id="confetti"></canvas>

<script>
// --- State ---
const state = {
  step: 1,
  ticker: null,
  entryPrice: null,
  company: null,
  direction: null,
  rating: null,
  priceTarget: null,
  timeHorizonMonths: 12,
  thesis: '',
  displayName: '',
  email: '',
  callId: null,
};

const TOTAL_STEPS = 6;

function setProgress() {
  const pct = ((state.step - 1) / (TOTAL_STEPS - 1)) * 100;
  document.getElementById('progressBar').style.width = pct + '%';
}
function showStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.querySelector('.step[data-step="' + n + '"]').classList.add('active');
  state.step = n;
  setProgress();
  updateNav();
  // auto-focus first input
  setTimeout(() => {
    const focusMap = {1:'#ticker',3:'#priceTarget',4:'#thesis',5:'#displayName'};
    if(focusMap[n]) document.querySelector(focusMap[n])?.focus();
  }, 100);
}

function updateNav() {
  const back = document.getElementById('backBtn');
  const next = document.getElementById('nextBtn');
  const nextLabel = document.getElementById('nextLabel');
  back.disabled = state.step === 1;
  if (state.step === 6) {
    nextLabel.textContent = 'Submit Call';
  } else if (state.step === 5) {
    nextLabel.textContent = 'Review';
  } else {
    nextLabel.textContent = 'Continue';
  }
  next.disabled = !canAdvance();
}

function canAdvance() {
  switch(state.step) {
    case 1: return !!state.ticker && !!state.entryPrice;
    case 2: return !!state.direction;
    case 3: return !!state.priceTarget && state.priceTarget > 0 && !!state.rating;
    case 4: return state.thesis.length >= 100;
    case 5: return !!state.displayName.trim() && /@/.test(state.email);
    case 6: return true;
    default: return false;
  }
}

function goNext() {
  if (!canAdvance()) return;
  if (state.step === 5) {
    populateReview();
    showStep(6);
    return;
  }
  if (state.step === 6) {
    submitFinal();
    return;
  }
  showStep(state.step + 1);
}
function goBack() {
  if (state.step > 1) showStep(state.step - 1);
}

// --- Step 1: Ticker ---
let tickerDebounce;
function onTickerInput(el) {
  el.value = el.value.toUpperCase().replace(/[^A-Z.]/g, '');
  const v = el.value.trim();
  clearTimeout(tickerDebounce);
  if (!v) {
    document.getElementById('priceReveal').classList.remove('show');
    state.ticker = null;
    state.entryPrice = null;
    updateNav();
    return;
  }
  tickerDebounce = setTimeout(() => lookupTicker(v), 250);
}
function setTicker(t) {
  const el = document.getElementById('ticker');
  el.value = t;
  lookupTicker(t);
}
async function lookupTicker(v) {
  try {
    const r = await fetch('/api/price?ticker=' + encodeURIComponent(v));
    if (!r.ok) {
      state.ticker = null; state.entryPrice = null;
      document.getElementById('priceReveal').classList.remove('show');
      updateNav();
      return;
    }
    const j = await r.json();
    state.ticker = j.ticker;
    state.entryPrice = j.price;
    state.company = j.company || v;
    document.getElementById('company').textContent = j.company || v;
    document.getElementById('priceAmount').textContent = '$' + j.price.toFixed(2);
    const dEl = document.getElementById('priceDelta');
    const d = j.change_1d || 0;
    dEl.textContent = (d >= 0 ? '+' : '') + d.toFixed(2) + '% today';
    dEl.className = 'delta ' + (d >= 0 ? 'pos' : 'neg');
    document.getElementById('priceReveal').classList.add('show');
    document.getElementById('tickerEcho').textContent = (j.company || v);
    updateNav();
  } catch (e) {
    state.ticker = null; state.entryPrice = null;
    updateNav();
  }
}

// --- Step 2: Direction ---
function selectDir(d, el) {
  document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  state.direction = d;
  updateNav();
  setTimeout(() => goNext(), 280);
}

// --- Step 3: Target + Rating + Horizon ---
function updatePT() {
  const v = parseFloat(document.getElementById('priceTarget').value);
  if (!v || !state.entryPrice) {
    document.getElementById('impliedUpside').textContent = '—';
    document.getElementById('ptCurrent').textContent = state.entryPrice ? '$' + state.entryPrice.toFixed(2) : '—';
    state.priceTarget = null;
    updateNav();
    return;
  }
  state.priceTarget = v;
  const ret = state.direction === 'short' ? (state.entryPrice - v) / state.entryPrice : (v - state.entryPrice) / state.entryPrice;
  const up = document.getElementById('impliedUpside');
  up.textContent = (ret >= 0 ? '+' : '') + (ret * 100).toFixed(1) + '%';
  up.style.color = ret >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('ptCurrent').textContent = '$' + state.entryPrice.toFixed(2);
  updateNav();
}
function selectRating(r, el) {
  document.querySelectorAll('.rating-opt').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  state.rating = r;
  updateNav();
}
function selectHorizon(h, el) {
  document.querySelectorAll('.h-chip').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  state.timeHorizonMonths = h;
  updateNav();
}

// --- Step 4: Thesis ---
function updateThesisCount() {
  const el = document.getElementById('thesis');
  state.thesis = el.value;
  const n = el.value.length;
  const c = document.getElementById('thesisCount');
  c.textContent = n + ' / 100 min';
  c.className = 'thesis-count' + (n >= 100 ? ' ok' : '');
  updateNav();
}
function insertPrompt(el) {
  const ta = document.getElementById('thesis');
  if (ta.value.length > 0) ta.value += ' ';
  ta.value += el.textContent;
  ta.focus();
  updateThesisCount();
}

// --- Step 5: Identity ---
['displayName','email'].forEach(id => {
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById(id).addEventListener('input', (e) => {
      state[id] = e.target.value.trim();
      updateNav();
    });
  });
});
document.getElementById('displayName').addEventListener('input', (e) => {
  state.displayName = e.target.value.trim();
  updateNav();
});
document.getElementById('email').addEventListener('input', (e) => {
  state.email = e.target.value.trim();
  updateNav();
});

// --- Review ---
function populateReview() {
  document.getElementById('rvTicker').textContent = state.ticker;
  document.getElementById('rvDir').textContent = state.direction.toUpperCase();
  document.getElementById('rvDir').className = 'val ' + (state.direction === 'long' ? 'pos' : 'neg');
  document.getElementById('rvRating').textContent = state.rating.toUpperCase();
  document.getElementById('rvEntry').textContent = '$' + state.entryPrice.toFixed(2);
  document.getElementById('rvTarget').textContent = '$' + state.priceTarget.toFixed(2);
  const ret = state.direction === 'short' ? (state.entryPrice - state.priceTarget)/state.entryPrice : (state.priceTarget - state.entryPrice)/state.entryPrice;
  const imp = document.getElementById('rvImplied');
  imp.textContent = (ret >= 0 ? '+' : '') + (ret * 100).toFixed(1) + '%';
  imp.className = 'val ' + (ret >= 0 ? 'pos' : 'neg');
  document.getElementById('rvHorizon').textContent = state.timeHorizonMonths + ' months';
  document.getElementById('rvName').textContent = state.displayName;
}

// --- Submit ---
async function submitFinal() {
  document.getElementById('nextBtn').disabled = true;
  document.getElementById('nextLabel').textContent = 'Submitting...';
  try {
    const r = await fetch('/api/calls', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        ticker: state.ticker,
        direction: state.direction,
        rating: state.rating,
        price_target: state.priceTarget,
        entry_price: state.entryPrice,
        time_horizon_months: state.timeHorizonMonths,
        thesis: state.thesis,
        display_name: state.displayName,
        email: state.email,
      }),
    });
    const j = await r.json();
    if (!j.success) throw new Error(j.error || 'Submit failed');
    state.callId = j.id;
    document.getElementById('reviewView').style.display = 'none';
    document.getElementById('successView').style.display = 'block';
    document.querySelector('.footer-nav').style.display = 'none';
    document.querySelector('.kbd-hint').style.display = 'none';
    document.getElementById('openCallLink').href = '/c/' + j.id;
    fireConfetti();
  } catch (e) {
    alert('Error submitting. Try again.');
    document.getElementById('nextBtn').disabled = false;
    document.getElementById('nextLabel').textContent = 'Submit Call';
  }
}

async function shareCall() {
  if (!state.callId) return;
  const url = location.origin + '/c/' + state.callId;
  const text = state.ticker + ' ' + state.direction.toUpperCase() + ' — my call on ' + (state.company || state.ticker) + '. Entry $' + state.entryPrice.toFixed(2) + ', target $' + state.priceTarget.toFixed(2) + '. Tracked live:';
  if (navigator.share) {
    try {
      await navigator.share({ title: state.ticker + ' — my call', text, url });
    } catch(e) {}
  } else {
    const twitter = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
    window.open(twitter, '_blank');
  }
}

// --- Keyboard ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    if (canAdvance()) goNext();
  } else if (e.key === 'Escape') {
    goBack();
  }
});

// --- Confetti ---
function fireConfetti() {
  const c = document.getElementById('confetti');
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  const ctx = c.getContext('2d');
  const colors = ['${accent}', '#2EBD6B', '#F5B800', '#3A6FB5', '#E04759', '#FFFFFF'];
  const parts = [];
  for (let i = 0; i < 120; i++) {
    parts.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() - 0.9) * 18,
      r: 3 + Math.random() * 5,
      color: colors[(Math.random() * colors.length) | 0],
      a: 1,
    });
  }
  function loop() {
    ctx.clearRect(0, 0, c.width, c.height);
    let alive = 0;
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.5; p.a -= 0.015;
      if (p.a > 0) {
        alive++;
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    if (alive > 0) requestAnimationFrame(loop);
  }
  loop();
}

// Init
setProgress();
updateNav();
// Kick off prefill lookup if server rendered a ticker value
(function(){
  const t = document.getElementById('ticker');
  if (t && t.value && t.value.trim()) {
    lookupTicker(t.value.trim().toUpperCase());
  }
})();
</script>

</body>
</html>`;
}
