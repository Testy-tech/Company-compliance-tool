import Anthropic from "@anthropic-ai/sdk";

/* Classifying Claude API failures, and logging usage. Nothing here is shown to the user verbatim. */

export type AiFailure =
  /** HTTP 400 "Output blocked by content filtering policy": never retried. */
  | "content_filter"
  | "timeout"
  | "rate_limited"
  | "not_configured"
  /** The model declined, ran out of tokens, or returned something that failed validation. */
  | "invalid_output"
  | "api_error";

/** The API's wording for a blocked output; there is no dedicated error type for it. */
const CONTENT_FILTER = /output blocked by content filtering policy/i;

export function classifyError(error: unknown): { failure: AiFailure; requestId?: string; status?: number } {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return { failure: "timeout" };
  if (error instanceof Anthropic.BadRequestError)
    return { failure: CONTENT_FILTER.test(error.message) ? "content_filter" : "api_error", requestId: error.requestID ?? undefined, status: 400 };
  if (error instanceof Anthropic.RateLimitError) return { failure: "rate_limited", requestId: error.requestID ?? undefined, status: 429 };
  if (error instanceof Anthropic.AuthenticationError) return { failure: "not_configured", requestId: error.requestID ?? undefined, status: 401 };
  if (error instanceof Anthropic.APIError) return { failure: "api_error", requestId: error.requestID ?? undefined, status: error.status };
  return { failure: "api_error" };
}

/** Retries are pointless for a blocked output and for our own validation failures. */
export const isRetryable = (failure: AiFailure) => failure === "timeout" || failure === "rate_limited" || failure === "api_error";

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
};

export function usageOf(usage: Anthropic.Usage | undefined): AiUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
    webSearches: usage?.server_tool_use?.web_search_requests ?? 0,
  };
}

export const addUsage = (a: AiUsage, b: AiUsage): AiUsage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
  cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  webSearches: a.webSearches + b.webSearches,
});

/** One structured log line per Claude call: token usage on success, the request id on failure. No prompt or output text. */
export function logAi(entry: {
  route: "tailor" | "developments";
  model: string;
  jurisdiction: string;
  ms: number;
  requestId?: string | null;
  usage?: AiUsage;
  failure?: AiFailure;
  detail?: string;
  /** Tailoring only: obligations sent, items accepted, and items dropped by the guard with a reason code. */
  sent?: number;
  tailored?: number;
  dropped?: { id: string; reason: string }[];
}) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
  if (entry.failure) console.warn(`[ai] ${line}`);
  else console.info(`[ai] ${line}`);
}
