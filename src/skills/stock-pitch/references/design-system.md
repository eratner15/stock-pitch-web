# Design System

The skill produces portals with a consistent visual identity across all 5 pages. Copy this CSS block verbatim into every page as the base; page-specific styles layer on top.

## Color Tokens

```css
:root{
  /* Surfaces */
  --bg:#FFFFFF;           /* Main page background */
  --surface:#F8F9FB;       /* Section backgrounds, card fills */
  --surface-2:#F1F3F6;     /* Deeper surface (inputs, chips) */

  /* Accents */
  --navy:#0F1729;          /* Hero dark, table headers */
  --navy-soft:#1E3A5F;     /* Gradient companion to navy */
  --gold:#B8973E;          /* Primary accent (CTAs, highlights) */
  --gold-soft:rgba(184,151,62,0.08);   /* Gold tint for backgrounds */
  --gold-hover:#9A7D2E;    /* Interactive gold state */

  /* Financial status */
  --steel:#2C5F7C;         /* Neutral secondary */
  --green:#1A7A3A;         /* Positive (accretion, beat) */
  --red:#C0392B;           /* Negative (dilution, miss) */
  --forest:#1A5632;        /* Deeper green (success state) */

  /* Borders */
  --border:#E2E5EB;        /* Default border */
  --border-light:#ECEEF2;  /* Subtle divider */

  /* Text */
  --text:#2D3748;          /* Body copy */
  --text-muted:#6B7280;    /* Secondary text, captions */
  --heading:#111827;       /* Headlines, emphasized text */
}
```

## Dark Mode Overrides

```css
html.dark{
  --bg:#0F1218;
  --surface:#1A1E27;
  --surface-2:#242830;
  --border:#2D3340;
  --border-light:#252A35;
  --text:#D1D5DB;
  --text-muted:#9CA3AF;
  --heading:#F3F4F6;
  --navy:#0A0E16;
  --navy-soft:#1A2440;
}
```

Dark mode toggle (required on every page):

```html
<button class="dark-toggle" onclick="toggleDark()" aria-label="Toggle dark mode" title="Toggle dark mode">&#9790;</button>

<script>
function toggleDark(){
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  document.querySelector('.dark-toggle').innerHTML = isDark?'&#9788;':'&#9790;';
  try{localStorage.setItem('lcs-dark',isDark?'1':'0')}catch(e){}
}
try{if(localStorage.getItem('lcs-dark')==='1'){document.documentElement.classList.add('dark');const b=document.querySelector('.dark-toggle');if(b)b.innerHTML='&#9788;'}}catch(e){}
</script>
```

## Typography

### Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

- **Inter** — All UI, headlines, body (default)
- **Merriweather** — Memo body only (SCQA prose)
- **JetBrains Mono** — Numbers in tables, slider values, keyboard hints

### Scale

| Context | Size | Weight | Letter-Spacing |
|---------|------|--------|----------------|
| Hero H1 (index) | 40px | 800 | -0.02em |
| Memo H1 (serif) | 36px | 900 | -0.02em |
| Section H2 | 24px | 800 | -0.02em |
| Memo H2 (serif) | 24px | 900 | -0.01em |
| Card h3 | 16-17px | 700 | — |
| Metric value | 20px | 800 | -0.02em |
| Hero subtitle | 16-17px | 400 | — |
| Body | 15px | 400 | — |
| Caption | 11-12px | 400-500 | — |
| Eyebrow / label | 10-11px | 700 | 2-3px |

### Eyebrow pattern

```html
<div class="eyebrow">NYSE &middot; Sector &middot; Setup Descriptor</div>
```

```css
.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--gold);font-weight:700;margin-bottom:10px}
```

## Spacing

Base grid: 4px. Common rhythms: 8, 12, 16, 20, 24, 32, 40, 48, 72, 120px.

Page containers:
- Standard: `max-width:1080px; padding:0 32px`
- Model (wider): `max-width:1280px; padding:0 24px`
- Memo narrow: `max-width:720px; padding:0 24px` for prose; `max-width:920px` for framing

Section padding: `48px 0` (default), `80px 0` (hero-adjacent).

## Component Patterns

### Hero (gradient navy)

```html
<section class="hero">
  <div class="wrap">
    <div class="hero-eyebrow">NYSE &bull; Sector &bull; Context</div>
    <h1>Company: The <span>Setup Descriptor</span> Opportunity</h1>
    <p class="hero-subtitle">2-sentence thesis summary.</p>
    <div class="hero-badges">
      <span class="hero-badge street">STREET PT $X (+Y%)</span>
      <span class="hero-badge lcs">LCS PT $X (+Y%) &middot; BUY</span>
    </div>
  </div>
</section>
```

```css
.hero{background:linear-gradient(135deg,#0F1729 0%,#1E3A5F 100%);padding:120px 0 56px;color:#fff}
.hero h1{font-size:40px;font-weight:800;color:#fff;line-height:1.12}
.hero h1 span{color:var(--gold)}
.hero-subtitle{font-size:16px;color:rgba(255,255,255,0.78);line-height:1.6;max-width:760px;margin-bottom:22px}
.hero-badge.street{background:rgba(184,151,62,0.18);border:1px solid rgba(184,151,62,0.35);color:var(--gold)}
.hero-badge.lcs{background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.35);color:#4ade80}
```

### 7-Metric Bar

Offset 28px above subsequent content so it floats between hero and body:

```html
<div class="metrics-wrap wrap">
  <div class="metrics">
    <div class="metric"><div class="metric-val" title="Source tag">$X</div><div class="metric-lbl">Label</div></div>
    <!-- x7 -->
  </div>
  <p style="text-align:center;font-size:10px;color:var(--text-muted);margin-top:6px;opacity:0.6">Hover any metric for data source</p>
</div>
```

```css
.metrics-wrap{margin:-28px auto 48px;position:relative;z-index:2}
.metrics{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--border);border-radius:10px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.04)}
.metric{background:var(--bg);padding:18px 12px;text-align:center}
.metric-val{font-size:20px;font-weight:800;color:var(--heading);letter-spacing:-0.02em}
.metric-lbl{font-size:8px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:1.2px;font-weight:600}
```

### Navy Box (for P&L, earnings setup)

```html
<div class="earnings-box">
  <div class="earnings-box-header">
    <h3>Q1 2026 Earnings Setup</h3>
    <span class="earnings-badge">Reports April 24</span>
  </div>
  <div class="earnings-grid">
    <!-- 4 stat cells -->
  </div>
  <div class="earnings-whisper">
    <div class="whisper-card"><h4>What to Watch</h4><p>...</p></div>
    <div class="whisper-card"><h4>Key Risks</h4><p>...</p></div>
  </div>
</div>
```

```css
.earnings-box{background:var(--navy);border-radius:12px;padding:32px;color:#fff}
.earnings-stat{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:16px;text-align:center}
```

### Thesis Cards (3-up)

```html
<div class="thesis-grid">
  <div class="thesis-card">
    <div class="thesis-num">01</div>
    <h3>Pillar Title</h3>
    <p>Thesis narrative.</p>
    <span class="thesis-stat green">Key stat</span>
  </div>
  <!-- x3, with different ::before colors -->
</div>
```

```css
.thesis-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
.thesis-card:nth-child(1)::before{background:var(--forest)}
.thesis-card:nth-child(2)::before{background:var(--steel)}
.thesis-card:nth-child(3)::before{background:var(--gold)}
```

### Table — Financial Data

```css
table.grid{width:100%;border-collapse:collapse;font-size:12px;font-family:'JetBrains Mono',monospace}
table.grid th{background:var(--navy);color:#fff;padding:10px 8px;text-align:right;font-family:Inter,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700}
table.grid td:first-child{text-align:left;color:var(--heading);font-family:Inter,sans-serif;font-size:12px;font-weight:500}
table.grid tr.total td{font-weight:800;color:var(--gold);background:var(--gold-soft);border-top:2px solid var(--gold)}
```

### Sensitivity Heatmap

Five heat levels plus a highlight for the current model state:

```css
.sens-table td.heat-1{background:rgba(192,57,43,0.12);color:var(--red)}  /* Strong negative */
.sens-table td.heat-2{background:rgba(192,57,43,0.06)}                    /* Mild negative */
.sens-table td.heat-3{background:var(--bg)}                               /* Neutral */
.sens-table td.heat-4{background:rgba(26,122,58,0.06)}                    /* Mild positive */
.sens-table td.heat-5{background:rgba(26,122,58,0.14);color:var(--green);font-weight:700}  /* Strong positive */
.sens-table td.highlight{background:var(--gold-soft);font-weight:800;color:var(--gold);border:2px solid var(--gold)}  /* Current scenario */
```

## Navigation

Fixed-top, blur backdrop, subtle shadow on scroll:

```html
<nav id="nav" aria-label="Main navigation">
<div class="wrap">
  <a href="/lcs/" class="nav-brand">Levin Capital Strategies</a>
  <div class="nav-links">
    <a href="/lcs/{ticker}/" class="active">Overview</a>
    <a href="/lcs/{ticker}/memo.html">Memo</a>
    <a href="/lcs/{ticker}/presentation.html">Deck</a>
    <a href="/lcs/{ticker}/model.html">Model</a>
    <a href="/lcs/{ticker}/consensus.html">Consensus</a>
  </div>
  <div class="nav-right">
    <button class="dark-toggle" onclick="toggleDark()" aria-label="Toggle dark mode">&#9790;</button>
    <span class="nav-ticker">NYSE: <strong>{TICKER}</strong> ${PRICE}</span>
    <a href="/lcs/{ticker}/model.html" class="nav-cta">View Model</a>
  </div>
</div>
</nav>
```

## Accessibility Checklist

- Skip-to-content link as first element after `<body>`:
  ```html
  <a href="#main-content" style="position:absolute;left:-9999px;top:0;padding:8px 16px;background:var(--navy);color:#fff;z-index:999" onfocus="this.style.left='0'" onblur="this.style.left='-9999px'">Skip to content</a>
  ```
- `<main id="main-content">` wrapping all content
- `aria-label` on every `<nav>` element (required when multiple navs on page)
- `aria-label` on dark mode toggle
- Semantic H1 on every page
- Slider ARIA labels
- Carousel dots with `role="tablist"`, individual dots with `role="tab"` and `aria-selected`

## Mobile Responsive Rules

```css
@media(max-width:900px){
  .metrics{grid-template-columns:repeat(4,1fr)}
  .thesis-grid,.quote-grid{grid-template-columns:1fr}
  .module-grid{grid-template-columns:1fr}
}
@media(max-width:600px){
  .metrics{grid-template-columns:repeat(2,1fr)}
  .nav-links,.nav-ticker{display:none}
}
```

Model page specifically needs single-column at `max-width:1100px`:

```css
@media(max-width:1100px){
  .main-grid{grid-template-columns:1fr}
  .controls{position:static;max-height:none}
  .valcards{grid-template-columns:repeat(2,1fr)}
}
```
