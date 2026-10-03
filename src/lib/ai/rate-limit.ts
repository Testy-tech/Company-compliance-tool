import type { KeyValueStore } from "@/lib/store/kv";

/*
 * Fixed-window rate limit per client IP. The counter lives in the shared
 * key-value store, so the limit holds across server instances.
 */

export async function rateLimit(
  store: KeyValueStore,
  key: string,
  limit: { max: number; windowMs: number },
  now = Date.now(),
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const window = Math.floor(now / limit.windowMs);
  const count = await store.incr(`rl:${key}:${window}`, Math.ceil(limit.windowMs / 1000));
  if (count <= limit.max) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.ceil(((window + 1) * limit.windowMs - now) / 1000) };
}

/** Client address as reported by the proxy in front of the app. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
