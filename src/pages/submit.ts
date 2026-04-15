export function renderSubmit(brand: 'stockpitch' | 'levincap'): string {
  const isLevin = brand === 'levincap';
  const accentColor = isLevin ? '#B8973E' : '#2EBD6B';
  const bg = isLevin ? '#FAF7F0' : '#FFFFFF';
  const bg2 = isLevin ? '#F3EEE1' : '#F5F6F8';
  const ink = isLevin ? '#0A0A0A' : '#0A0F1F';
  const border = isLevin ? '#D4CFC3' : '#E2E4EA';
  const displaySerif = isLevin ? "'Playfair Display',Georgia,serif" : 'inherit';
  const bodyFont = isLevin ? "'Cormorant Garamond',Georgia,serif" : "'Inter',system-ui,sans-serif";
  const brandMark = isLevin ? 'Levin Capital <em>Research</em>' : 'Stock Pitch';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${isLevin ? 'Submit a Call · Levin Capital Research' : 'Submit a Call · Stock Pitch'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:${bg};--bg-2:${bg2};--ink:${ink};
  --ink-60:${isLevin ? '#5A5651' : '#5A6074'};
  --ink-40:${isLevin ? '#85817A' : '#8B90A0'};
  --border:${border};--accent:${accentColor};--green:#1A7A3A;--red:#C0392B;
}
body{font-family:${bodyFont};background:var(--bg);color:var(--ink);line-height:1.55;-webkit-font-smoothing:antialiased;font-size:${isLevin ? '17' : '15'}px}
a{color:inherit;text-decoration:none}
.wrap{max-width:820px;margin:0 auto;padding:0 32px}

nav{position:sticky;top:0;z-index:50;padding:14px 0;background:${isLevin ? 'rgba(250,247,240,0.92)' : 'rgba(255,255,255,0.88)'};backdrop-filter:blur(14px);border-bottom:${isLevin ? '3px double var(--ink)' : '1px solid var(--border)'}}
nav .wrap{display:flex;justify-content:space-between;align-items:center;max-width:1180px}
.brand{font-family:${isLevin ? displaySerif : "'JetBrains Mono',monospace"};font-weight:${isLevin ? '900' : '700'};font-size:${isLevin ? '22px' : '15px'};color:var(--ink)}
.brand em{font-weight:${isLevin ? '400' : '500'};font-style:italic}
.nav-links{display:flex;gap:24px;font-family:'Inter',sans-serif}
.nav-links a{font-size:12px;color:var(--ink-60);font-weight:500;${isLevin ? 'letter-spacing:2px;text-transform:uppercase' : ''}}

.hero{padding:64px 0 32px;text-align:center;background:linear-gradient(180deg,var(--bg) 0%,var(--bg-2) 100%);border-bottom:1px solid var(--border)}
.hero-kicker{font-family:${isLevin ? "'Inter',sans-serif" : "'JetBrains Mono',monospace"};font-size:${isLevin ? '10px' : '11px'};letter-spacing:${isLevin ? '5px' : '2px'};text-transform:uppercase;color:var(--accent);font-weight:${isLevin ? '800' : '600'};margin-bottom:14px}
.hero h1{font-family:${displaySerif};font-weight:${isLevin ? '900' : '800'};font-size:${isLevin ? '52px' : '44px'};color:var(--ink);letter-spacing:-0.025em;line-height:1;margin-bottom:14px}
.hero h1 em{font-style:italic;font-weight:${isLevin ? '400' : '500'};color:var(--accent)}
.hero p{font-family:${bodyFont};font-size:${isLevin ? '19px' : '16px'};color:var(--ink-60);${isLevin ? 'font-style:italic' : ''};max-width:620px;margin:0 auto}

.form-section{padding:56px 0 96px}
form{background:var(--bg);border:1px solid var(--border);padding:40px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
.row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:20px}
.field{margin-bottom:20px}
.field label{display:block;font-family:'Inter',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-60);font-weight:700;margin-bottom:8px}
.field label .req{color:var(--accent);margin-left:4px}
.field label .hint{font-family:${bodyFont};font-weight:400;font-size:13px;text-transform:none;letter-spacing:0;color:var(--ink-40);${isLevin ? 'font-style:italic' : ''};margin-left:8px}
.field input,.field select,.field textarea{width:100%;padding:14px 16px;font-family:${bodyFont};font-size:${isLevin ? '17px' : '15px'};background:var(--bg-2);border:1px solid var(--border);color:var(--ink);transition:border 0.15s}
.field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--accent)}
.field textarea{min-height:160px;resize:vertical;font-family:${bodyFont};line-height:1.55}
.field .thesis-counter{text-align:right;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink-40);margin-top:4px}

.ticker-input{display:flex;gap:12px;align-items:start}
.ticker-input .ticker-col{flex:1}
.ticker-input .preview{min-width:200px;background:var(--bg-2);border:1px dashed var(--border);padding:14px;font-family:'Inter',sans-serif;font-size:12px;color:var(--ink-60);display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:58px}
.ticker-input .preview .preview-price{font-family:'JetBrains Mono',monospace;font-size:20px;color:var(--ink);font-weight:700;letter-spacing:-0.01em}
.ticker-input .preview .preview-co{font-size:11px;color:var(--ink-40);margin-top:2px}

.direction-group{display:flex;gap:12px}
.direction-btn{flex:1;padding:14px;background:var(--bg-2);border:2px solid var(--border);cursor:pointer;text-align:center;font-family:'Inter',sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--ink-60);transition:all 0.15s}
.direction-btn.selected{border-color:var(--accent);color:var(--ink);background:var(--bg)}
.direction-btn.long.selected{border-color:var(--green);color:var(--green)}
.direction-btn.short.selected{border-color:var(--red);color:var(--red)}

.rating-group{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.rating-btn{padding:10px 8px;background:var(--bg-2);border:1px solid var(--border);cursor:pointer;text-align:center;font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-60);transition:all 0.15s}
.rating-btn.selected{border-color:var(--accent);color:var(--ink);background:var(--bg)}

.submit-row{margin-top:32px;padding-top:24px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
.submit-info{font-family:${bodyFont};font-size:14px;color:var(--ink-60);${isLevin ? 'font-style:italic' : ''};max-width:420px;line-height:1.5}
.submit-btn{padding:16px 36px;background:var(--ink);color:var(--bg);font-family:'Inter',sans-serif;font-size:${isLevin ? '11px' : '13px'};font-weight:${isLevin ? '800' : '700'};letter-spacing:${isLevin ? '3px' : '1px'};text-transform:uppercase;border:none;cursor:pointer;transition:opacity 0.15s}
.submit-btn:hover{opacity:0.9}
.submit-btn:disabled{opacity:0.5;cursor:not-allowed}

.result{margin-top:20px;padding:20px;background:var(--bg-2);border:1px solid var(--accent);display:none}
.result.show{display:block}
.result.err{border-color:var(--red)}
.result h4{font-family:${displaySerif};font-size:20px;color:var(--ink);margin-bottom:6px}
.result p{font-family:${bodyFont};font-size:15px;color:var(--ink-60);${isLevin ? 'font-style:italic' : ''}}
.result a{color:var(--accent);font-weight:700;text-decoration:underline}

.free-badge{display:inline-block;padding:4px 10px;background:rgba(46,189,107,0.12);color:var(--green);font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-left:8px;border-radius:${isLevin ? '0' : '99px'}}

footer{padding:32px 0;border-top:1px solid var(--border);text-align:center;font-family:'Inter',sans-serif;font-size:11px;color:var(--ink-40)}

@media(max-width:700px){
  .row,.row-3{grid-template-columns:1fr}
  .hero h1{font-size:32px}
  .ticker-input{flex-direction:column}
  .nav-links{display:none}
  form{padding:24px}
}
</style>
</head>
<body>

<nav>
  <div class="wrap">
    <a href="/" class="brand">${brandMark}</a>
    <div class="nav-links">
      <a href="/">Home</a>
      <a href="/leaderboard">Leaderboard</a>
      <a href="/submit" style="color:var(--ink);font-weight:700">Submit a Call</a>
    </div>
  </div>
</nav>

<section class="hero">
  <div class="wrap">
    <div class="hero-kicker">Free &middot; No Signup Required for First Call</div>
    <h1>Submit your <em>call</em>.<br/>Let the market <em>score</em> it.</h1>
    <p>Pick a ticker, a direction, a price target, and write 100–500 words of thesis. We lock in today's price as your entry and track performance forward. Your first call is free.</p>
  </div>
</section>

<section class="form-section">
  <div class="wrap">
    <form id="callForm" onsubmit="submitCall(event)">

      <div class="field">
        <label>Ticker <span class="req">*</span><span class="hint">e.g. PLTR, UBER, BX</span></label>
        <div class="ticker-input">
          <div class="ticker-col">
            <input type="text" name="ticker" id="ticker" required maxlength="8" placeholder="TICKER" style="text-transform:uppercase;font-family:'JetBrains Mono',monospace;font-weight:700;letter-spacing:2px" oninput="lookupTicker(this.value)">
          </div>
          <div class="preview" id="pricePreview">
            Enter a ticker to lock in entry price
          </div>
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label>Direction <span class="req">*</span></label>
          <div class="direction-group">
            <button type="button" class="direction-btn long" data-dir="long" onclick="selectDirection(this)">&uarr; Long</button>
            <button type="button" class="direction-btn short" data-dir="short" onclick="selectDirection(this)">&darr; Short</button>
          </div>
          <input type="hidden" name="direction" id="direction">
        </div>
        <div class="field">
          <label>Rating <span class="req">*</span></label>
          <div class="rating-group">
            <button type="button" class="rating-btn" data-rating="buy" onclick="selectRating(this)">Buy</button>
            <button type="button" class="rating-btn" data-rating="overweight" onclick="selectRating(this)">OW</button>
            <button type="button" class="rating-btn" data-rating="hold" onclick="selectRating(this)">Hold</button>
            <button type="button" class="rating-btn" data-rating="underweight" onclick="selectRating(this)">UW</button>
            <button type="button" class="rating-btn" data-rating="sell" onclick="selectRating(this)">Sell</button>
          </div>
          <input type="hidden" name="rating" id="rating">
        </div>
      </div>

      <div class="row-3">
        <div class="field">
          <label>Price Target <span class="req">*</span></label>
          <input type="number" step="0.01" min="0" name="price_target" required placeholder="0.00">
        </div>
        <div class="field">
          <label>Time Horizon <span class="hint">months</span></label>
          <select name="time_horizon_months">
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12" selected>12 months</option>
            <option value="18">18 months</option>
            <option value="24">24 months</option>
          </select>
        </div>
        <div class="field">
          <label>Catalyst <span class="hint">optional</span></label>
          <input type="text" name="catalyst" maxlength="80" placeholder="e.g. Q2 earnings">
        </div>
      </div>

      <div class="field">
        <label>Thesis <span class="req">*</span><span class="hint">100–500 words &middot; what you see that the market doesn't</span></label>
        <textarea name="thesis" id="thesis" required minlength="100" maxlength="3000" placeholder="Why this trade? What's the variant perception? What's the catalyst that closes the gap between today's price and your target?" oninput="updateCount()"></textarea>
        <div class="thesis-counter"><span id="thesisCount">0</span> chars &middot; min 100</div>
      </div>

      <div class="row">
        <div class="field">
          <label>Your Display Name <span class="req">*</span></label>
          <input type="text" name="display_name" required maxlength="40" placeholder="Jane Analyst">
        </div>
        <div class="field">
          <label>Email <span class="req">*</span><span class="hint">we'll track your calls under this</span></label>
          <input type="email" name="email" required placeholder="you@firm.com">
        </div>
      </div>

      <div class="submit-row">
        <div class="submit-info">
          Your entry price is locked at submission. Current price updates daily. Your call lives on the public leaderboard from today forward.
        </div>
        <button type="submit" class="submit-btn" id="submitBtn">Submit Call &middot; Free</button>
      </div>

      <div class="result" id="result"></div>
    </form>
  </div>
</section>

<footer>
  <div class="wrap">
    &copy; 2026 ${isLevin ? 'Levin Capital Research' : 'Stock Pitch'} &middot;
    <a href="/leaderboard">Back to Leaderboard</a>
  </div>
</footer>

<script>
let currentPrice = null;

async function lookupTicker(v){
  v = v.trim().toUpperCase();
  const preview = document.getElementById('pricePreview');
  if(v.length < 1){
    preview.innerHTML = 'Enter a ticker to lock in entry price';
    currentPrice = null;
    return;
  }
  try {
    const r = await fetch('/api/price?ticker=' + encodeURIComponent(v));
    if(!r.ok){ preview.innerHTML = 'Price unavailable'; return; }
    const j = await r.json();
    if(j.price){
      currentPrice = j.price;
      preview.innerHTML = '<div class="preview-price">$' + j.price.toFixed(2) + '</div>'
        + (j.company ? '<div class="preview-co">' + j.company + '</div>' : '')
        + '<div class="preview-co" style="margin-top:4px;color:var(--accent);font-weight:700">Entry price &middot; locked at submission</div>';
    } else {
      preview.innerHTML = 'Ticker not found';
    }
  } catch(e){ preview.innerHTML = 'Price service error'; }
}

function selectDirection(btn){
  document.querySelectorAll('.direction-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('direction').value = btn.dataset.dir;
}
function selectRating(btn){
  document.querySelectorAll('.rating-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('rating').value = btn.dataset.rating;
}
function updateCount(){
  const n = document.getElementById('thesis').value.length;
  document.getElementById('thesisCount').textContent = n;
}

async function submitCall(e){
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('submitBtn');
  const result = document.getElementById('result');
  result.classList.remove('show','err');

  const data = Object.fromEntries(new FormData(form));
  if(!data.direction || !data.rating){
    result.innerHTML = '<h4>Required fields missing</h4><p>Select a direction and a rating.</p>';
    result.classList.add('show','err');
    return;
  }
  if(!currentPrice){
    result.innerHTML = '<h4>No entry price locked</h4><p>Enter a valid ticker first; we need to lock in entry price.</p>';
    result.classList.add('show','err');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'SUBMITTING...';
  try {
    const r = await fetch('/api/calls', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({...data, entry_price: currentPrice}),
    });
    const j = await r.json();
    if(j.success){
      result.innerHTML = '<h4>Call submitted &middot; you\\'re on the board</h4><p>Your ' + data.ticker.toUpperCase() + ' ' + data.direction + ' call is now tracked against entry price $' + currentPrice.toFixed(2) + '. <a href="/leaderboard">View the leaderboard \u2192</a></p>';
      result.classList.add('show');
      form.reset();
      document.querySelectorAll('.direction-btn,.rating-btn').forEach(b=>b.classList.remove('selected'));
      document.getElementById('pricePreview').innerHTML = 'Enter a ticker to lock in entry price';
      currentPrice = null;
      updateCount();
    } else {
      result.innerHTML = '<h4>Submission failed</h4><p>' + (j.error || 'Please try again.') + '</p>';
      result.classList.add('show','err');
    }
  } catch(err){
    result.innerHTML = '<h4>Network error</h4><p>Please try again.</p>';
    result.classList.add('show','err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Call · Free';
  }
}
</script>

</body>
</html>`;
}
