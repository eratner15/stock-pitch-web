// Shared portfolio metadata — powers the gallery on both brand variants.
// Portals live at research.levincap.com/<ticker>/ (public read-only research site).

export interface PortalEntry {
  ticker: string;
  company: string;
  category: string;
  pattern: string;
  thesis: string;
  rating: string;
  rating_class: 'buy' | 'ow' | 'part' | 'hold';
  headline_stat: string;
  headline_label: string;
  url: string;
  date: string;
  featured?: boolean;
}

export const PORTFOLIO: PortalEntry[] = [
  {
    ticker: 'MSGS',
    company: 'Madison Square Garden Sports',
    category: 'Special Situation',
    pattern: 'Sum-of-Parts',
    thesis: 'The Dolan family\'s fifth spin-off splits the Knicks and Rangers. $4.6B of trapped value comes unlocked over an 18-month spin process.',
    rating: 'OVERWEIGHT',
    rating_class: 'ow',
    headline_stat: '+43%',
    headline_label: 'LCS PT upside',
    url: 'https://research.levincap.com/msgs/',
    date: 'April 2026',
    featured: true,
  },
  {
    ticker: 'KMB',
    company: 'Kimberly-Clark + Kenvue',
    category: 'M&A',
    pattern: 'Accretion/Dilution',
    thesis: '$48.7B consumer-health merger. Front-loaded synergy curve the Street is underwriting conservatively. +26% FY29 accretion in our base case.',
    rating: 'BUY',
    rating_class: 'buy',
    headline_stat: '+26%',
    headline_label: 'FY29 accretion',
    url: 'https://research.levincap.com/kmb/',
    date: 'April 2026',
    featured: true,
  },
  {
    ticker: 'BX',
    company: 'Blackstone',
    category: 'Compounder',
    pattern: 'FRE/DE Algorithm',
    thesis: '$1.28T AUM trading like a credit shop. 12% YTD drawdown is the setup. Perpetual-capital mix above 40% warrants compounder multiple.',
    rating: 'BUY',
    rating_class: 'buy',
    headline_stat: '$150',
    headline_label: 'LCS PT',
    url: 'https://research.levincap.com/bx/',
    date: 'April 2026',
    featured: true,
  },
  {
    ticker: 'PETE',
    company: 'Pete & Gerry\'s Organics',
    category: 'Pre-IPO',
    pattern: 'TTW Analysis',
    thesis: 'Confidentially filed S-1. $462M revenue, 18% organic, three premium egg brands, 300 family farms. Only second pure-play premium egg IPO since Vital Farms.',
    rating: 'PARTICIPATE',
    rating_class: 'part',
    headline_stat: '$1.8B',
    headline_label: 'Implied IPO EV',
    url: 'https://research.levincap.com/pete/',
    date: 'April 2026',
  },
  {
    ticker: 'AMZN',
    company: 'Amazon',
    category: 'Mega-Cap Tech',
    pattern: 'Multi-Segment SOTP',
    thesis: 'AWS + Retail + Ads triptych. Reverse-DCF on consumer retail business; AWS as the anchor. Multi-year SOTP.',
    rating: 'BUY',
    rating_class: 'buy',
    headline_stat: 'SOTP',
    headline_label: 'Multi-segment',
    url: 'https://research.levincap.com/amzn/',
    date: 'March 2026',
  },
  {
    ticker: 'KNX',
    company: 'Knight-Swift Transportation',
    category: 'Trucking',
    pattern: 'Operating Ratio',
    thesis: 'Cyclical trough with 5x EPS recovery visible. Freight cycle turning, LTL buildout underway. Operating ratio model.',
    rating: 'BUY',
    rating_class: 'buy',
    headline_stat: '5x',
    headline_label: 'EPS recovery',
    url: 'https://research.levincap.com/knx/',
    date: 'March 2026',
  },
  {
    ticker: 'RRX',
    company: 'Regal Rexnord',
    category: 'Industrial',
    pattern: 'Segment EBITDA',
    thesis: 'Power transmission consolidator post carve-out. Integration synergy capture visible in segment margins.',
    rating: 'BUY',
    rating_class: 'buy',
    headline_stat: 'Carve-out',
    headline_label: 'Integration',
    url: 'https://research.levincap.com/rrx/',
    date: 'February 2026',
  },
  {
    ticker: 'FLR',
    company: 'Fluor',
    category: 'E&C',
    pattern: 'Backlog Conversion',
    thesis: 'EPC turnaround. Backlog-to-revenue conversion improving as contract margins normalize.',
    rating: 'BUY',
    rating_class: 'buy',
    headline_stat: 'Backlog',
    headline_label: 'Conversion',
    url: 'https://research.levincap.com/flr/',
    date: 'February 2026',
  },
];

export const CATEGORIES = Array.from(new Set(PORTFOLIO.map(p => p.category)));
