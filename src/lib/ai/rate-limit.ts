/*
 * Fixed-window rate limit per client IP, in memory. Enough for a single server
 * instance; a shared store (e.g. Redis) is needed once the app runs on several.
 */

type Window = { start: number; count: number };
const windows = new Map<string, Window>();

export function rateLimit(key: string, limit: { max: number; windowMs: number }, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
  const w = windows.get(key);
  if (!w || now - w.start >= limit.windowMs) {
    windows.set(key, { start: now, count: 1 });
    // Keep the map from growing without bound.
    if (windows.size > 5000) for (const [k, v] of windows) if (now - v.start >= limit.windowMs) windows.delete(k);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (w.count >= limit.max) return { allowed: false, retryAfterSeconds: Math.ceil((w.start + limit.windowMs - now) / 1000) };
  w.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

export const resetRateLimits = () => windows.clear();

/** Client address as reported by the proxy in front of the app. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
