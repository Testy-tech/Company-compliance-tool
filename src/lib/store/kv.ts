/*
 * Shared key-value store for server-side state that must survive restarts and
 * be common to every server instance: stored developments results and rate-limit
 * counters. Same idea as the other storage boundaries (IntakeStore,
 * KnowledgeBaseRepository): callers depend on the interface, not the backend.
 *
 * Backends:
 *   - Upstash Redis / Vercel KV over their REST API (both speak the same protocol)
 *     when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or
 *     KV_REST_API_URL + KV_REST_API_TOKEN, are set;
 *   - an in-memory map otherwise (local development; not shared, not durable).
 */

export interface KeyValueStore {
  readonly kind: "upstash" | "memory";
  get<T>(key: string): Promise<T | null>;
  /** `ttlSeconds` omitted = keep until overwritten. */
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  /** Add one to a counter, creating it with the given lifetime; returns the new count. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

export class MemoryStore implements KeyValueStore {
  readonly kind = "memory" as const;
  private readonly data = new Map<string, { value: string; expires: number }>();
  constructor(private readonly now: () => number = Date.now) {}

  private read(key: string): string | null {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expires <= this.now()) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }
  async get<T>(key: string): Promise<T | null> {
    const raw = this.read(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.data.set(key, { value: JSON.stringify(value), expires: ttlSeconds ? this.now() + ttlSeconds * 1000 : Number.POSITIVE_INFINITY });
  }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const current = this.read(key);
    const next = (current === null ? 0 : Number(current)) + 1;
    // The lifetime is set when the counter is created, as with EXPIRE … NX.
    const expires = current === null ? this.now() + ttlSeconds * 1000 : this.data.get(key)!.expires;
    this.data.set(key, { value: String(next), expires });
    if (this.data.size > 10_000) for (const [k, v] of this.data) if (v.expires <= this.now()) this.data.delete(k);
    return next;
  }
}

/** Upstash Redis REST API, also served by Vercel KV. Commands are sent as JSON arrays. */
export class UpstashStore implements KeyValueStore {
  readonly kind = "upstash" as const;
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async call(path: string, body: unknown): Promise<unknown> {
    const res = await this.fetcher(`${this.url.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Key-value store request failed with status ${res.status}`);
    return res.json();
  }
  async get<T>(key: string): Promise<T | null> {
    const { result } = (await this.call("", ["GET", key])) as { result: string | null };
    return result === null ? null : (JSON.parse(result) as T);
  }
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.call("", ["SET", key, JSON.stringify(value), ...(ttlSeconds ? ["EX", ttlSeconds] : [])]);
  }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const [count] = (await this.call("/pipeline", [["INCR", key], ["EXPIRE", key, ttlSeconds, "NX"]])) as { result: number }[];
    return count!.result;
  }
}

let shared: KeyValueStore | null = null;

/** The store configured by the environment; one instance per server process. */
export function getStore(env: Record<string, string | undefined> = process.env): KeyValueStore {
  if (shared) return shared;
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  shared = url && token ? new UpstashStore(url, token) : new MemoryStore();
  return shared;
}
