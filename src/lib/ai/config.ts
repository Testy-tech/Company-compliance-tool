/*
 * Limits and model choice for tailoring and for the scheduled developments
 * check. Server-only values. Each has its own model variable: TAILOR_MODEL and
 * DEVELOPMENTS_MODEL.
 *
 * Checked against the Claude docs on 2026-10-03:
 *   - model ids:            the supported-model list on the structured outputs page below
 *   - structured outputs:   https://platform.claude.com/docs/en/build-with-claude/structured-outputs
 *   - web search tool:      https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
 */

import { MAX_OBLIGATIONS_PER_REQUEST } from "./tailor-schema";

const DEFAULT_TAILOR_MODEL = "claude-sonnet-5";
const DEFAULT_DEVELOPMENTS_MODEL = "claude-opus-5";

export const aiConfig = {
  tailor: {
    model: process.env.TAILOR_MODEL || DEFAULT_TAILOR_MODEL,
    /** Hard cap on output (and thinking) tokens for one request. */
    maxTokens: 8000,
    effort: "medium" as const,
    timeoutMs: 120_000,
    /** One request tailors one jurisdiction. */
    maxObligations: MAX_OBLIGATIONS_PER_REQUEST,
    maxBodyBytes: 80_000,
    rateLimit: { max: 30, windowMs: 10 * 60_000 },
  },

  developments: {
    model: process.env.DEVELOPMENTS_MODEL || DEFAULT_DEVELOPMENTS_MODEL,
    maxTokens: 6000,
    effort: "medium" as const,
    /** Hard cap on web searches for one request. */
    maxSearches: 4,
    timeoutMs: 180_000,
    maxItems: 6,
    /** Reading stored results is cheap, but still limited per client. */
    readRateLimit: { max: 120, windowMs: 10 * 60_000 },
  },
} as const;

/** Web search tool version; the docs list this one for Claude Opus 5 with domain filtering. */
export const WEB_SEARCH_TOOL = "web_search_20260209" as const;
