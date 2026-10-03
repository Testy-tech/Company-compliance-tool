import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { clientIp, rateLimit } from "./rate-limit";

/* Shared request plumbing for the two Claude routes. */

let client: Anthropic | null = null;

/** The SDK client, or null when no API key is configured on the server. */
export function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return (client ??= new Anthropic());
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/**
 * Size limit, rate limit and JSON parsing. Returns the parsed body, or the
 * error response to send.
 */
export async function readJson(
  request: Request,
  route: string,
  limits: { maxBodyBytes: number; rateLimit: { max: number; windowMs: number } },
): Promise<{ body: unknown } | { response: Response }> {
  const limited = rateLimit(`${route}:${clientIp(request)}`, limits.rateLimit);
  if (!limited.allowed)
    return { response: json({ ok: false, failure: "rate_limited" }, 429, { "Retry-After": String(limited.retryAfterSeconds) }) };

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > limits.maxBodyBytes) return { response: json({ ok: false, failure: "too_large" }, 413) };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > limits.maxBodyBytes) return { response: json({ ok: false, failure: "too_large" }, 413) };

  try {
    return { body: JSON.parse(text) };
  } catch {
    return { response: json({ ok: false, failure: "bad_request" }, 400) };
  }
}

export { json };
