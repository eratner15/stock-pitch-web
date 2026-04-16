/**
 * Workflow Config Registry — maps workflow slugs to system prompts, tools, and metadata.
 * Each workflow type gets its own skill markdown (imported as text via wrangler [[rules]]).
 */
import Anthropic from '@anthropic-ai/sdk';

// Skill markdowns imported as strings via wrangler [[rules]] type = "Text"
import screenSkill from '../skills/workflows/screen.md';
import dcfSkill from '../skills/workflows/dcf.md';
import compsSkill from '../skills/workflows/comps.md';
import earningsSkill from '../skills/workflows/earnings.md';
import coverageSkill from '../skills/workflows/coverage.md';
import conferenceSkill from '../skills/workflows/conference.md';
import sectorSkill from '../skills/workflows/sector.md';
import portfolioSkill from '../skills/workflows/portfolio.md';
import morningSkill from '../skills/workflows/morning.md';
import thesisSkill from '../skills/workflows/thesis.md';

export type WorkflowSlug =
  | 'screen' | 'dcf' | 'comps' | 'earnings' | 'coverage'
  | 'conference' | 'sector' | 'portfolio' | 'morning' | 'thesis';

export interface WorkflowConfig {
  slug: WorkflowSlug;
  name: string;
  description: string;
  icon: string;           // emoji for UI cards
  category: 'equity' | 'portfolio' | 'macro';
  requiresTicker: boolean;
  systemPrompt: string;
  tools: string[];        // tool names from the shared registry
  maxTokens: number;
  userPromptTemplate: (params: { ticker?: string; context?: string }) => string;
}

// -------------------------------------------------------------------
// Shared Tool Definitions (Anthropic format)
// -------------------------------------------------------------------

export const TOOL_DEFS: Record<string, Anthropic.Tool> = {
  fetch_stock_price: {
    name: 'fetch_stock_price',
    description: 'Get current stock price, company name, 1-day change',
    input_schema: {
      type: 'object' as const,
      properties: { ticker: { type: 'string', description: 'Ticker symbol (e.g. META, AAPL)' } },
      required: ['ticker'],
    },
  },
  fetch_sec_filing: {
    name: 'fetch_sec_filing',
    description: 'Fetch 10-K or 10-Q from SEC EDGAR (MD&A, risk factors, financials)',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string' },
        filing_type: { type: 'string', enum: ['10-K', '10-Q'] },
      },
      required: ['ticker', 'filing_type'],
    },
  },
  store_result: {
    name: 'store_result',
    description: 'Save workflow output to the research library',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string' },
        company: { type: 'string' },
        summary: { type: 'string', description: '1-2 sentence BLUF' },
        direction: { type: 'string', enum: ['long', 'short', 'neutral'] },
        price_target: { type: 'number', description: 'Price target (0 if not applicable)' },
        confidence: { type: 'number', description: '0-100 confidence score' },
      },
      required: ['summary'],
    },
  },
  get_lb_positions: {
    name: 'get_lb_positions',
    description: 'Get current portfolio positions from LiquidityBook (cached). Returns ticker, shares, market value, P&L.',
    input_schema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Account code filter (optional, returns all if omitted)' },
      },
      required: [],
    },
  },
};

// -------------------------------------------------------------------
// Workflow Configs
// -------------------------------------------------------------------

const CORE_TOOLS = ['fetch_stock_price', 'fetch_sec_filing', 'store_result'];
const PORTFOLIO_TOOLS = ['fetch_stock_price', 'get_lb_positions', 'store_result'];

export const WORKFLOWS: Record<WorkflowSlug, WorkflowConfig> = {
  screen: {
    slug: 'screen',
    name: 'Stock Screen',
    description: 'Screen against Graham, Buffett, Greenblatt & Klarman frameworks',
    icon: '🔍',
    category: 'equity',
    requiresTicker: true,
    systemPrompt: screenSkill,
    tools: CORE_TOOLS,
    maxTokens: 4096,
    userPromptTemplate: ({ ticker }) =>
      `Screen ${ticker}. Use your tools to gather real financial data from SEC filings, then apply all screening frameworks. Be thorough and specific with real numbers.`,
  },
  dcf: {
    slug: 'dcf',
    name: 'DCF Valuation',
    description: 'Build a 10-year discounted cash flow model with sensitivity analysis',
    icon: '📊',
    category: 'equity',
    requiresTicker: true,
    systemPrompt: dcfSkill,
    tools: CORE_TOOLS,
    maxTokens: 8192,
    userPromptTemplate: ({ ticker }) =>
      `Build a complete DCF valuation model for ${ticker}. Fetch the 10-K and 10-Q for real financials. Show all calculations, WACC derivation, and a 5×5 sensitivity table.`,
  },
  comps: {
    slug: 'comps',
    name: 'Comps Analysis',
    description: 'Comparable company analysis with 5-8 peers and trading multiples',
    icon: '⚖️',
    category: 'equity',
    requiresTicker: true,
    systemPrompt: compsSkill,
    tools: CORE_TOOLS,
    maxTokens: 6144,
    userPromptTemplate: ({ ticker }) =>
      `Build a comparable company analysis for ${ticker}. Identify 5-8 real peers, fetch prices for each, and construct a full comps table with implied valuation.`,
  },
  earnings: {
    slug: 'earnings',
    name: 'Earnings Analysis',
    description: 'Post-earnings beat/miss analysis with estimate revisions',
    icon: '📈',
    category: 'equity',
    requiresTicker: true,
    systemPrompt: earningsSkill,
    tools: CORE_TOOLS,
    maxTokens: 6144,
    userPromptTemplate: ({ ticker }) =>
      `Analyze the most recent quarterly earnings for ${ticker}. Fetch 10-Q and 10-K for real data. Focus on beat/miss, guidance, and what it means for the stock.`,
  },
  coverage: {
    slug: 'coverage',
    name: 'Initiating Coverage',
    description: 'Full initiation report with thesis, valuation, catalysts & risks',
    icon: '📋',
    category: 'equity',
    requiresTicker: true,
    systemPrompt: coverageSkill,
    tools: CORE_TOOLS,
    maxTokens: 8192,
    userPromptTemplate: ({ ticker }) =>
      `Initiate coverage on ${ticker}. This is the most comprehensive analysis — fetch all available filings and produce a full initiation report with rating, price target, and detailed thesis.`,
  },
  conference: {
    slug: 'conference',
    name: 'Conference Call Prep',
    description: 'Bull/base/bear scenarios and key questions for upcoming earnings',
    icon: '🎙️',
    category: 'equity',
    requiresTicker: true,
    systemPrompt: conferenceSkill,
    tools: CORE_TOOLS,
    maxTokens: 6144,
    userPromptTemplate: ({ ticker, context }) =>
      `Prepare for the upcoming earnings call for ${ticker}.${context ? ` Context: ${context}` : ''} Build bull/base/bear scenarios with specific targets and draft 5-7 key questions.`,
  },
  sector: {
    slug: 'sector',
    name: 'Sector Overview',
    description: 'Sector landscape with key players, themes, and top picks',
    icon: '🗺️',
    category: 'equity',
    requiresTicker: true,
    systemPrompt: sectorSkill,
    tools: CORE_TOOLS,
    maxTokens: 8192,
    userPromptTemplate: ({ ticker, context }) =>
      `Produce a sector overview anchored around ${ticker}.${context ? ` Sector context: ${context}` : ''} Map 8-12 companies in the space, compare valuations, and identify top picks.`,
  },
  portfolio: {
    slug: 'portfolio',
    name: 'Portfolio Review',
    description: 'Book analysis with concentration, risk metrics & rebalancing recs',
    icon: '💼',
    category: 'portfolio',
    requiresTicker: false,
    systemPrompt: portfolioSkill,
    tools: PORTFOLIO_TOOLS,
    maxTokens: 6144,
    userPromptTemplate: () =>
      `Review the current portfolio. Pull positions from LiquidityBook, analyze concentration and risk, and recommend rebalancing actions.`,
  },
  morning: {
    slug: 'morning',
    name: 'Morning Note',
    description: 'Daily market briefing personalized with portfolio holdings',
    icon: '☀️',
    category: 'macro',
    requiresTicker: false,
    systemPrompt: morningSkill,
    tools: PORTFOLIO_TOOLS,
    maxTokens: 4096,
    userPromptTemplate: () =>
      `Produce today's morning note. Check market indices (SPY, QQQ, IWM) and portfolio positions. Keep it concise and actionable.`,
  },
  thesis: {
    slug: 'thesis',
    name: 'Thesis Builder',
    description: 'Conviction-driven investment thesis with variant perception',
    icon: '🎯',
    category: 'equity',
    requiresTicker: true,
    systemPrompt: thesisSkill,
    tools: CORE_TOOLS,
    maxTokens: 6144,
    userPromptTemplate: ({ ticker, context }) =>
      `Build an investment thesis for ${ticker}.${context ? ` Additional context: ${context}` : ''} Focus on variant perception — what is the market missing? Include specific price targets and risk/reward.`,
  },
};

export const WORKFLOW_LIST = Object.values(WORKFLOWS);
export const WORKFLOW_SLUGS = Object.keys(WORKFLOWS) as WorkflowSlug[];

export function isValidWorkflow(slug: string): slug is WorkflowSlug {
  return slug in WORKFLOWS;
}
