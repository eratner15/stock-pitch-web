# Interactive Model Templates

The interactive model page is the highest-leverage deliverable. This file documents the shared architecture and sector-specific customizations.

## Shared Architecture

Every interactive model follows this JS architecture:

```js
// 1. Preset definitions (4 scenarios)
const PRESETS = {
  bull:   { /* slider values, optimistic */ },
  base:   { /* LCS base case */ },
  street: { /* matches consensus */ },
  bear:   { /* pessimistic */ },
};

// 2. Anchor constants (actuals, not assumptions)
const BASE = {
  // Year-end actuals from 10-K
  rev: X, ebitda: X, shares: X,
  // Sector-specific: AUM by segment, FRE, DE, etc.
};
const PRICE = /* current price */;

// 3. State reader
function getState() {
  return {
    slider1: +document.getElementById('slider1').value,
    // ...
  };
}

// 4. Preset application
function applyPreset(name) {
  const p = PRESETS[name];
  Object.keys(p).forEach(k => { document.getElementById(k).value = p[k] });
  document.querySelectorAll('.preset').forEach(b =>
    b.classList.toggle('active', b.dataset.preset === name)
  );
  update();
}

// 5. Pure compute function
function computeModel(state) {
  // Takes slider state + BASE constants
  // Returns all model outputs (pnl, valuation, sensitivities)
  return { /* model outputs */ };
}

// 6. DOM updater
function update() {
  const state = getState();
  updateSliderDisplays(state);
  const model = computeModel(state);
  updateValueCards(model);
  updateMainTables(model, state);
  updateSensitivities(model, state);
}

// 7. Wire events
['slider1', 'slider2', ...].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    document.querySelectorAll('.preset').forEach(b => b.classList.remove('active'));
    update();
  });
});

// 8. Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === '1') applyPreset('bull');
  else if (e.key === '2') applyPreset('base');
  else if (e.key === '3') applyPreset('street');
  else if (e.key === '4') applyPreset('bear');
  else if (e.key.toLowerCase() === 'r') applyPreset('base');
});

update(); // Initial render
```

## Slider Component Pattern

Every slider follows this HTML/CSS structure:

```html
<div class="slider-group">
  <div class="slider-label">
    <span class="lbl" title="Rationale: explanation of WHY this default, citing sources.">
      Slider Name
    </span>
    <span class="val" id="sliderNameVal">default%</span>
  </div>
  <input type="range" id="sliderName" min="..." max="..." value="..." step="..."
         aria-label="Slider Name">
</div>
```

**Key details:**
- Value units are scaled integers (e.g., `200` for 2.00%, `550` for 5.50%)
- `title` attribute is REQUIRED on label — this is the rationale tooltip
- `aria-label` on range input for accessibility
- Display formatter shows the human-readable value (e.g., `2.0%`)

## Preset Button Pattern

```html
<div class="presets">
  <button class="preset" data-preset="bull" onclick="applyPreset('bull')">Bull</button>
  <button class="preset active" data-preset="base" onclick="applyPreset('base')">Base</button>
  <button class="preset" data-preset="street" onclick="applyPreset('street')">Street</button>
  <button class="preset" data-preset="bear" onclick="applyPreset('bear')">Bear</button>
</div>
```

## Value Cards Pattern

Top of content area, 4 cards showing headline outputs:

```html
<div class="valcards">
  <div class="valcard">
    <div class="vl">Label</div>
    <div class="vv gold" id="primaryOutput">$X</div>
    <div class="vs" id="primaryDelta">vs comp</div>
  </div>
  <!-- x4 -->
</div>
```

Color codes on `.vv`:
- `.gold` — primary output (e.g., EPS)
- `.green` — positive signal (accretion, upside, strong IRR)
- `.red` — negative signal (dilution, downside)

## Sensitivity Table Pattern

```html
<table class="sens-table">
  <thead><tr><th class="corner">Y ↓ / X →</th><th>col1</th><th>col2</th>...</tr></thead>
  <tbody></tbody>  <!-- Populated by JS -->
</table>
```

Heat class logic (in JS):

```js
let heat = 'heat-3'; // neutral
if (value < threshold1) heat = 'heat-1';      // strong negative
else if (value < threshold2) heat = 'heat-2'; // mild negative
else if (value < threshold3) heat = 'heat-3'; // neutral
else if (value < threshold4) heat = 'heat-4'; // mild positive
else heat = 'heat-5';                          // strong positive

// Highlight current scenario
const highlight = (row === currentRow && col === currentCol) ? 'highlight' : heat;
```

## Sector-Specific Model Logic

### M&A / Merger Model

```js
function computeModel(s) {
  const synCap = s.synCap/100;
  const phases = [s.phase1/100, s.phase2/100, s.phase3/100, 1.0];
  const dissyn = s.dissyn/10000;

  // Standalone trajectories
  const acquirerStandalone = { /* grow anchor forward */ };
  const targetContribution = {
    26: KVUE_BASE.rev * (1 + g) * 0.5,  // Half-year in FY26 (mid-year close)
    27: KVUE_BASE.rev * (1+g)**2,
    // ...
  };

  // Synergies per year
  const synergies = {};
  [26,27,28,29].forEach((yr, i) => {
    synergies[yr] = SYNERGY_RUN_RATE * synCap * phases[i];
  });

  // Combined P&L
  const combined = {};
  [26,27,28,29].forEach((yr, i) => {
    const rev = acquirerStandalone[yr] + targetContribution[yr] + disSynRev[yr];
    const ebitda = baseEbitda + synergies[yr];
    const da = rev * 0.045 + ppaStepUp;
    const ebit = ebitda - da;
    const intExp = avgDebt * debtRate;
    const ni = (ebit - intExp) * (1 - taxRate);
    const shares = FY26 ? (acqShares + targetShares) * 0.5 : (acqShares + targetShares);
    const eps = ni / shares;
    combined[yr] = { rev, ebitda, ni, eps, shares };
  });

  // Accretion vs standalone
  const accretion = {};
  [26,27,28,29].forEach(yr => {
    const pf = combined[yr].eps;
    const sa = acquirerStandalone[yr].eps;
    accretion[yr] = { pf, sa, deltaDollar: pf-sa, deltaPct: (pf-sa)/sa };
  });

  return { acquirerStandalone, targetContribution, synergies, combined, accretion };
}
```

**Required outputs:**
- Pro-forma P&L table through FY29
- Accretion/dilution walk (4 rows: PF EPS, standalone EPS, delta $, delta %)
- Synergy schedule (cost + revenue − reinvestment = net)
- Sensitivity: synergy capture × debt cost → FY27 EPS
- Sensitivity: synergy capture × P/E → fair value
- Leverage bridge

### Alt Asset Manager (FRE / DE)

```js
function computeModel(s) {
  // AUM build by segment
  const aumSeg = { 26: {}, 27: {}, 28: {} };
  ['re', 'pe', 'credit', 'ma'].forEach(seg => {
    const g = growthBySegment[seg];
    aumSeg[26][seg] = BASE[seg] * (1+g);
    aumSeg[27][seg] = BASE[seg] * (1+g)**2;
    aumSeg[28][seg] = BASE[seg] * (1+g)**3;
  });

  // FEAUM = 72% of total
  const feaum = Object.fromEntries(
    [26,27,28].map(yr => [yr, sum(aumSeg[yr]) * 0.72])
  );

  // Fee revenues
  const mgmtFees = {};
  [26,27,28].forEach(yr => {
    const avgFeaum = (feaum[yr-1] + feaum[yr]) / 2;
    mgmtFees[yr] = avgFeaum * feeRate;
  });

  // FRE
  const fre = {};
  [26,27,28].forEach(yr => {
    const frePerf = BASE.frePerfRev * (1 + perfGrowth)**(yr-25);
    const feeRev = mgmtFees[yr] + frePerf;
    fre[yr] = feeRev * freMargin;
  });

  // Realizations
  const netRealizations = {};
  [26,27,28].forEach((yr, i) => {
    netRealizations[yr] = realBase * (1 + realGrowth)**i;
  });

  // DE
  const de = {};
  [26,27,28].forEach(yr => {
    de[yr] = (fre[yr] + netRealizations[yr]) * 0.95; // -5% for taxes/other
  });

  // DE/share
  const deSh = {};
  [26,27,28].forEach(yr => {
    deSh[yr] = de[yr] * 1000 / shares[yr];
  });

  return { aumSeg, mgmtFees, fre, netRealizations, de, deSh };
}
```

**Required outputs:**
- AUM build table (4 segment rows + total)
- FRE + DE trajectory table
- Sensitivity: AUM growth × FRE margin → DE/share
- Sensitivity: DE/share × P/DE multiple → fair value
- DCF cross-check (asset-light, minimal net debt)

### Operating Ratio (Trucking)

```js
function computeModel(s) {
  // TL: revenue × OR = OI
  const tlRev = tlBase * (1 + rateInflection) * (1 + volumeGrowth);
  const tlOr = tlBase.or - orImprovement;
  const tlOi = tlRev * (1 - tlOr);

  // LTL: revenue × OR = OI
  const ltlRev = ltlBase * (1 + ltlCagr);
  const ltlOr = ltlBase.or - ltlOrImprovement;
  const ltlOi = ltlRev * (1 - ltlOr);

  // Consolidated EPS
  const ebit = tlOi + ltlOi - gna;
  const ni = (ebit - intExp) * (1 - taxRate);
  const eps = ni / shares;

  return { tlRev, tlOr, tlOi, ltlRev, ltlOr, ltlOi, eps };
}
```

### REIT (NAV Model)

```js
function computeModel(s) {
  // Property NOI
  const officeNoi = baseOfficeNoi * (1 + officeNoiGrowth);
  const retailNoi = baseRetailNoi * (1 + retailNoiGrowth);

  // NAV = NOI / cap rate
  const grossAsset = (officeNoi + retailNoi) / capRate;
  const nav = grossAsset - mortgages - preferred - adminCost;
  const navPerSh = nav / shares;

  // AFFO
  const affo = noi - gna - interest;
  const affoPerSh = affo / shares;

  return { nav, navPerSh, affo, affoPerSh };
}
```

## HTML Escaping in Template Literals

When writing the model page as a JS-in-template-literal, watch these escape issues:

1. **Backticks inside inline script:** Prefer `\`` or break into separate HTML strings
2. **Template literal in JS:** Use `\${` inside the outer template literal to prevent interpolation
3. **Embedded single/double quotes:** Match carefully; prefer one style consistently
4. **Closing script tag inside string:** Use `<\/script>` instead of `</script>`

Example of proper escaping:

```ts
export const modelHTML = `<!DOCTYPE html>
<html>
<body>
<script>
const template = \`hello \${name}\`;
// ...
<\/script>
</body>
</html>`;
```

## Probability-Weighted Expected Value Panel (v1.1)

After the core model panels, add a probability-weighted expected value panel. The panel has:

1. **4 probability sliders** — Bull / Base / Street / Bear, each 0-60% range
2. **Sum indicator** — shows "Sum: 100%" in green when correct, red otherwise
3. **Scenario outcomes table** — for each scenario: probability, forward EPS, fair value, return, weighted PT contribution
4. **Expected value row** — Σ(probability × fair value), highlighted as total

The panel recomputes by temporarily applying each preset to compute its fair value, then restoring the user's current state. Key function:

```js
function computeScenarioPt(presetName){
  const p = PRESETS[presetName];
  const savedState = {...getState()};
  Object.keys(p).forEach(k=>{document.getElementById(k).value = p[k]});
  const s = getState();
  const m = computeModel(s);
  const pt = m.outputs.forwardEps * (s.pe/10);
  // Restore user state
  Object.keys(savedState).forEach(k=>{
    const el = document.getElementById(k);
    if(el) el.value = savedState[k];
  });
  return {pt, eps: m.outputs.forwardEps};
}
```

Wire the probability sliders to call `updateProbPanel()` (not the main `update()`) to avoid recomputing the full model on every probability change.

## URL-Encoded Scenario Sharing (v1.1)

Add a "Share This Scenario" button below the keyboard hint. Encode all slider state (including probability weights) as base64 JSON in the URL hash. On page load, check `location.hash` and apply if present.

```js
function stateToHash(){
  const s = getState();
  const probs = {
    pB:+document.getElementById('probBull').value,
    pBa:+document.getElementById('probBase').value,
    pS:+document.getElementById('probStreet').value,
    pBe:+document.getElementById('probBear').value,
  };
  return btoa(JSON.stringify({...s, ...probs}));
}

function hashToState(hash){
  try {
    const obj = JSON.parse(atob(hash));
    SLIDER_IDS.forEach(k=>{
      if(obj[k]!==undefined) document.getElementById(k).value = obj[k];
    });
    // Probability sliders
    if(obj.pB!==undefined) document.getElementById('probBull').value = obj.pB;
    // ... etc
  } catch(e){console.warn('Invalid shared state hash')}
}

function shareScenario(){
  const hash = stateToHash();
  const url = location.origin + location.pathname + '#' + hash;
  navigator.clipboard.writeText(url).then(()=>{
    // Show toast
  }).catch(()=>{prompt('Copy URL:', url)});
}

// On load
if(location.hash.length > 1){
  hashToState(location.hash.slice(1));
  document.querySelectorAll('.preset').forEach(b=>b.classList.remove('active'));
}
```

**Toast confirmation:**

```html
<span id="shareToast" style="display:none;font-size:11px;color:var(--green);font-weight:600">
  &check; Link copied to clipboard
</span>
```

## Testing Checklist

After building a model, verify:

- [ ] All 4 presets produce reasonable values (no NaN, no Infinity)
- [ ] Sliders move smoothly; no freezing
- [ ] Changing a slider immediately updates all dependent tables
- [ ] Keyboard shortcuts work from anywhere (except inside form inputs)
- [ ] Sensitivity tables have sensible heat coloring
- [ ] Highlight cell appears in sensitivity at current-state position
- [ ] Dark mode renders all table cells correctly
- [ ] Mobile: controls stack on top, content below
- [ ] No JS console errors
