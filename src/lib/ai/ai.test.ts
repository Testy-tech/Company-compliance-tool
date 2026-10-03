import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Jurisdiction } from "@/lib/kb/schema";
import { MemoryStore, UpstashStore } from "@/lib/store/kv";

import { aiConfig, WEB_SEARCH_TOOL } from "./config";
import { isAuthorisedCron, readStoredDevelopments, runDevelopments, runScheduledDevelopments } from "./developments";
import { DEVELOPMENTS_SYSTEM, SOURCE_RULES, TAILOR_SYSTEM } from "./prompts";
import { rateLimit } from "./rate-limit";
import { introducesLegalContent, runTailor, tailorRequestSchema, type AiClient, type TailorRequest } from "./tailor";

/* The SDK is stubbed: these tests never call the API. */

const usage = { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 900, server_tool_use: { web_search_requests: 2, web_fetch_requests: 0 } };

function stub(...responses: unknown[]) {
  const parse = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) parse.mockRejectedValueOnce(r);
    else parse.mockResolvedValueOnce(r);
  }
  return { client: { messages: { parse } } as unknown as AiClient, parse };
}

const blocked = () =>
  new Anthropic.BadRequestError(
    400,
    { type: "error", error: { type: "invalid_request_error", message: "Output blocked by content filtering policy" } },
    "Output blocked by content filtering policy",
    new Headers({ "request-id": "req_blocked_123" }),
  );

let warn: ReturnType<typeof vi.spyOn>;
let info: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  info = vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

/* ── /api/tailor ──────────────────────────────────────────────────────────── */

const request: TailorRequest = tailorRequestSchema.parse({
  consent: true,
  jurisdiction: { id: "CN", name: "China (mainland)" },
  company: { anonymisedLabel: "Client A", industry: "engineering_construction", hqCountry: "IT", gdprBaseline: true, governanceModel: "centralized", localContacts: false },
  entity: { role: "current", entityType: "subsidiary", status: "operating" },
  facts: { subjects: ["Employees"], sensitiveData: ["Health data"], processing: ["HR & payroll"], gdprArtefactsInPlace: ["DPIA process and template"] },
  obligations: [
    { id: "CN-NOTICE-01", title: "Publish processing rules", requirement: "Individuals must be told how their data is handled before it is collected.", whyItApplies: "You have an entity in China.", actionSteps: ["Localise the privacy notice."], applicability: "applies", assumptions: [], owner: "Local entity" },
    { id: "CN-TRANSFER-04", title: "Apply for a security assessment", requirement: "High-volume transfers need an assessment before data leaves China.", whyItApplies: "Volumes are unknown.", actionSteps: ["Confirm volumes.", "File the application."], applicability: "assumed", assumptions: ["Assumed transfers are at least 1,000,000"], owner: "Headquarters + local entity" },
  ],
});

const message = (parsed_output: unknown, stop_reason = "end_turn") => ({ parsed_output, stop_reason, usage, content: [], _request_id: "req_ok_1" });
const item = (id: string, applicability: string, extra = {}) => ({ id, applicability, tailoredExplanation: "For your Chinese subsidiary this means localising the HR notice.", tailoredSteps: ["Reuse the group notice.", "Translate it."], ...extra });

describe("tailor request", () => {
  it("requires the opt-in flag and rejects unknown fields", () => {
    expect(tailorRequestSchema.safeParse({ ...request, consent: false }).success).toBe(false);
    expect(tailorRequestSchema.safeParse({ ...request, consent: undefined }).success).toBe(false);
    expect(tailorRequestSchema.safeParse({ ...request, companyName: "Acme SpA" }).success).toBe(false);
  });

  it("caps the number of obligations per request", () => {
    const many = Array.from({ length: aiConfig.tailor.maxObligations + 1 }, (_, i) => ({ ...request.obligations[0]!, id: `CN-NOTICE-${String(i).padStart(2, "0")}` }));
    expect(tailorRequestSchema.safeParse({ ...request, obligations: many }).success).toBe(false);
  });
});

describe("runTailor", () => {
  it("returns tailored text for known obligations and reports token usage", async () => {
    const { client } = stub(message({ items: [item("CN-NOTICE-01", "applies"), item("CN-TRANSFER-04", "assumed")] }));
    const result = await runTailor(client, request);
    expect(result).toMatchObject({ ok: true, requestId: "req_ok_1", usage: { inputTokens: 1200, outputTokens: 300, cacheWriteTokens: 900 } });
    expect(result.ok && result.items.map((i) => i.id)).toEqual(["CN-NOTICE-01", "CN-TRANSFER-04"]);
    expect(result.ok && result.items[0]).toEqual({ id: "CN-NOTICE-01", tailoredExplanation: expect.any(String), tailoredSteps: ["Reuse the group notice.", "Translate it."] });
    expect(info.mock.calls.flat().join(" ")).toContain('"inputTokens":1200');
  });

  it("sends the content but not the consent flag, with the source-handling rules, a token cap and a timeout", async () => {
    const { client, parse } = stub(message({ items: [] }));
    await runTailor(client, request);
    const [params, options] = parse.mock.calls[0]!;
    expect(params.model).toBe(aiConfig.tailor.model);
    expect(params.max_tokens).toBe(aiConfig.tailor.maxTokens);
    expect(params.system[0].text).toContain(SOURCE_RULES);
    expect(params.system[0].text).toMatch(/under 15 words/);
    const sent = JSON.parse(params.messages[0].content);
    expect(sent.consent).toBeUndefined();
    expect(sent.company.anonymisedLabel).toBe("Client A");
    expect(sent.obligations).toHaveLength(2);
    expect(params.output_config.format.type).toBe("json_schema");
    expect(options).toMatchObject({ timeout: aiConfig.tailor.timeoutMs, maxRetries: 1 });
  });

  it("accepts a partial answer (an obligation left out keeps its standard text)", async () => {
    const { client } = stub(message({ items: [item("CN-NOTICE-01", "applies")] }));
    const result = await runTailor(client, request);
    expect(result.ok && result.items).toHaveLength(1);
  });

  it("rejects the whole output when it names an obligation that was not sent", async () => {
    const { client } = stub(message({ items: [item("CN-NOTICE-01", "applies"), item("CN-INVENTED-99", "applies")] }));
    expect(await runTailor(client, request)).toEqual({ ok: false, failure: "invalid_output", requestId: "req_ok_1" });
    expect(warn.mock.calls.flat().join(" ")).toContain('unknown obligation id \\"CN-INVENTED-99\\"');
  });

  it("rejects output that changes applicability", async () => {
    const { client } = stub(message({ items: [item("CN-TRANSFER-04", "applies")] }));
    expect(await runTailor(client, request)).toMatchObject({ ok: false, failure: "invalid_output" });
    expect(warn.mock.calls.flat().join(" ")).toContain("applicability changed");
  });

  it("tolerates a capitalised enum value", async () => {
    const { client } = stub(message({ items: [item("CN-TRANSFER-04", "Assumed")] }));
    expect((await runTailor(client, request)).ok).toBe(true);
  });

  it("rejects duplicates, empty text and oversized text", async () => {
    for (const items of [
      [item("CN-NOTICE-01", "applies"), item("CN-NOTICE-01", "applies")],
      [item("CN-NOTICE-01", "applies", { tailoredExplanation: "  " })],
      [item("CN-NOTICE-01", "applies", { tailoredSteps: [] })],
      [item("CN-NOTICE-01", "applies", { tailoredExplanation: "x".repeat(2000) })],
    ]) {
      const { client } = stub(message({ items }));
      expect((await runTailor(client, request)).ok).toBe(false);
    }
  });

  it("drops an item that cites an article or states a time limit its obligation does not contain", async () => {
    const { client } = stub(
      message({
        items: [
          item("CN-NOTICE-01", "applies", { tailoredExplanation: "Under Art. 17 PIPL you must publish the notice within 30 days." }),
          item("CN-TRANSFER-04", "assumed"),
        ],
      }),
    );
    const result = await runTailor(client, request);
    expect(result.ok && result.items.map((i) => i.id)).toEqual(["CN-TRANSFER-04"]);
    expect(info.mock.calls.flat().join(" ")).toContain("dropped for new legal content: CN-NOTICE-01");
  });

  it("allows articles and time limits that are in the obligation's own text", () => {
    const original = { ...request.obligations[0]!, actionSteps: ["Document the arrangement (Art. 26 or Art. 28 GDPR)."], requirement: "Notify the authority within 72 hours of becoming aware.", gdprEquivalent: "Arts. 5, 24, 30 GDPR" };
    expect(introducesLegalContent(original, "Put the Art. 28 arrangement in writing and keep the 72-hour clock in the playbook.", ["Check Arts. 5 and 30 are reflected."])).toBeUndefined();
    expect(introducesLegalContent(original, "Report within 48 hours.", [])).toBe("time:48 hour");
    expect(introducesLegalContent(original, "This follows from § 38 BDSG.", [])).toBe("art:38");
  });

  it("treats a refusal or a truncated answer as a failure", async () => {
    for (const stop of ["refusal", "max_tokens"]) {
      const { client } = stub(message({ items: [item("CN-NOTICE-01", "applies")] }, stop));
      expect(await runTailor(client, request)).toMatchObject({ ok: false, failure: "invalid_output" });
    }
    const { client } = stub(message(null));
    expect(await runTailor(client, request)).toMatchObject({ ok: false, failure: "invalid_output" });
  });

  it("catches the content-filter 400, logs the request id and does not retry", async () => {
    const { client, parse } = stub(blocked());
    expect(await runTailor(client, request)).toEqual({ ok: false, failure: "content_filter", requestId: "req_blocked_123" });
    expect(parse).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain('"failure":"content_filter"');
    expect(logged).toContain('"requestId":"req_blocked_123"');
  });

  it("distinguishes other 400s from the content filter", async () => {
    const other = new Anthropic.BadRequestError(400, { type: "error", error: { type: "invalid_request_error", message: "max_tokens: must be positive" } }, "max_tokens: must be positive", new Headers({ "request-id": "req_other" }));
    const { client } = stub(other);
    expect(await runTailor(client, request)).toEqual({ ok: false, failure: "api_error", requestId: "req_other" });
  });

  it("reports a timeout as a failure", async () => {
    const { client } = stub(new Anthropic.APIConnectionTimeoutError());
    expect(await runTailor(client, request)).toMatchObject({ ok: false, failure: "timeout" });
    expect(warn.mock.calls.flat().join(" ")).toContain('"failure":"timeout"');
  });
});

/* ── /api/developments ────────────────────────────────────────────────────── */

const chile = {
  id: "CL",
  name: "Chile",
  laws: [{ title: "Law", shortName: "Law 21.719", citation: "Ley 21.719", officialUrl: "https://www.bcn.cl/leychile", status: "enacted_not_in_force" }],
  officialDomains: ["bcn.cl", "gob.cl"],
  upcomingChanges: [],
  lastReviewed: "2026-09-27",
} as unknown as Jurisdiction;

const results = (...urls: string[]) => ({ type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: urls.map((url) => ({ type: "web_search_result", url, title: "t", encrypted_content: "x", page_age: null })) });
const development = (url: string, date = "2026-10-01") => ({ title: "Agency publishes draft guidance", date, summary: "The agency opened a consultation on breach reporting.", url });
const searchMessage = (items: unknown[], content: unknown[], stop_reason = "end_turn") => ({ parsed_output: { items }, stop_reason, usage, content, _request_id: "req_dev_1" });

describe("runDevelopments", () => {
  const now = new Date("2026-10-03T10:00:00Z");

  it("restricts the search to the KB's official domains and caps searches and tokens", async () => {
    const { client, parse } = stub(searchMessage([], [results()]));
    await runDevelopments(client, chile, { now });
    const [params, options] = parse.mock.calls[0]!;
    expect(params.model).toBe(aiConfig.developments.model);
    expect(params.tools).toEqual([{ type: WEB_SEARCH_TOOL, name: "web_search", max_uses: aiConfig.developments.maxSearches, allowed_domains: ["bcn.cl", "gob.cl"], allowed_callers: ["direct"] }]);
    expect(params.max_tokens).toBe(aiConfig.developments.maxTokens);
    expect(params.system[0].text).toBe(DEVELOPMENTS_SYSTEM);
    expect(params.system[0].text).toContain(SOURCE_RULES);
    expect(TAILOR_SYSTEM).toContain(SOURCE_RULES);
    expect(JSON.parse(params.messages[0].content)).toMatchObject({ jurisdiction: "Chile", lastReviewed: "2026-09-27", today: "2026-10-03" });
    expect(options.timeout).toBe(aiConfig.developments.timeoutMs);
  });

  it("keeps items whose URL the search returned on an official domain, and counts searches in the usage", async () => {
    const url = "https://www.gob.cl/noticias/guia-brechas";
    const { client } = stub(searchMessage([development(url)], [results(url, "https://www.bcn.cl/otra")]));
    const result = await runDevelopments(client, chile, { now });
    expect(result).toMatchObject({ ok: true, since: "2026-09-27", usage: { webSearches: 2 } });
    expect(result.ok && result.items).toEqual([{ title: "Agency publishes draft guidance", date: "2026-10-01", summary: expect.any(String), url }]);
  });

  it("drops items with a URL the search did not return, off the official domains, or not after the last review", async () => {
    const good = "https://www.gob.cl/a";
    const { client } = stub(
      searchMessage(
        [
          development(good),
          development("https://www.gob.cl/invented"), // not among the results
          development("https://lawfirm.example.com/post"), // not official
          development("https://www.bcn.cl/old", "2026-09-01"), // before the last review
          development(good), // duplicate
        ],
        [results(good, "https://www.bcn.cl/old", "https://lawfirm.example.com/post")],
      ),
    );
    const result = await runDevelopments(client, chile, { now });
    expect(result.ok && result.items.map((i) => i.url)).toEqual([good]);
  });

  it("can look back to an arbitrary date and use another model (verification runs)", async () => {
    const old = "https://www.bcn.cl/old";
    const { client, parse } = stub(searchMessage([development(old, "2026-09-01")], [results(old)]));
    const result = await runDevelopments(client, chile, { now, since: "2025-01-01", model: "claude-sonnet-5" });
    expect(parse.mock.calls[0]![0].model).toBe("claude-sonnet-5");
    expect(JSON.parse(parse.mock.calls[0]![0].messages[0].content).lastReviewed).toBe("2025-01-01");
    expect(result).toMatchObject({ ok: true, since: "2025-01-01", model: "claude-sonnet-5" });
    expect(result.ok && result.items).toHaveLength(1);
  });

  it("returns an empty list when nothing is found, without failing", async () => {
    const { client } = stub(searchMessage([], [{ type: "web_search_tool_result", tool_use_id: "s", content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } }]));
    expect(await runDevelopments(client, chile, { now })).toMatchObject({ ok: true, items: [] });
  });

  it("resumes a paused search turn and adds up the usage", async () => {
    const url = "https://www.gob.cl/a";
    const { client, parse } = stub(searchMessage([], [results(url)], "pause_turn"), searchMessage([development(url)], []));
    const result = await runDevelopments(client, chile, { now });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[1]![0].messages).toHaveLength(2);
    expect(result).toMatchObject({ ok: true, usage: { inputTokens: 2400, webSearches: 4 } });
    expect(result.ok && result.items).toHaveLength(1); // the URL came from the first, paused response
  });

  it("catches the content-filter 400 without retrying, and logs the request id", async () => {
    const { client, parse } = stub(blocked());
    expect(await runDevelopments(client, chile, { now })).toEqual({ ok: false, failure: "content_filter", requestId: "req_blocked_123" });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls.flat().join(" ")).toContain('"requestId":"req_blocked_123"');
  });

  it("reports a timeout and a refusal as failures", async () => {
    const timedOut = stub(new Anthropic.APIConnectionTimeoutError());
    expect(await runDevelopments(timedOut.client, chile, { now })).toMatchObject({ ok: false, failure: "timeout" });
    const refused = stub(searchMessage([], [], "refusal"));
    expect(await runDevelopments(refused.client, chile, { now })).toMatchObject({ ok: false, failure: "invalid_output" });
  });
});

/* ── Scheduled job and shared store ───────────────────────────────────────── */

describe("scheduled developments check", () => {
  const now = new Date("2026-10-05T05:25:00Z");
  const url = "https://www.gob.cl/a";

  it("stores jurisdiction, check time, items, model and token usage for the report to read", async () => {
    const store = new MemoryStore();
    const { client } = stub(searchMessage([development(url)], [results(url)]));
    expect(await readStoredDevelopments(store, "CL")).toBeNull();
    await runScheduledDevelopments(store, client, chile, { now });
    expect(await readStoredDevelopments(store, "CL")).toEqual({
      jurisdiction: "CL",
      checkedAt: "2026-10-05T05:25:00.000Z",
      since: "2026-09-27",
      items: [expect.objectContaining({ url })],
      model: aiConfig.developments.model,
      usage: expect.objectContaining({ inputTokens: 1200, outputTokens: 300, webSearches: 2 }),
      searchedDomains: ["bcn.cl", "gob.cl"],
    });
  });

  it("keeps the last successful result when a later check fails", async () => {
    const store = new MemoryStore();
    const { client } = stub(searchMessage([development(url)], [results(url)]), blocked());
    await runScheduledDevelopments(store, client, chile, { now });
    const failed = await runScheduledDevelopments(store, client, chile, { now: new Date("2026-10-12T05:25:00Z") });
    expect(failed.ok).toBe(false);
    expect((await readStoredDevelopments(store, "CL"))?.checkedAt).toBe("2026-10-05T05:25:00.000Z");
  });

  it("only runs for a request carrying the cron secret", () => {
    const secret = "s3cret-value-of-at-least-16";
    const call = (authorization?: string) => new Request("https://app.example/api/cron/developments/CL", { headers: authorization ? { authorization } : {} });
    expect(isAuthorisedCron(call(`Bearer ${secret}`), secret)).toBe(true);
    expect(isAuthorisedCron(call("Bearer wrong"), secret)).toBe(false);
    expect(isAuthorisedCron(call(secret), secret)).toBe(false);
    expect(isAuthorisedCron(call(), secret)).toBe(false);
    expect(isAuthorisedCron(call("Bearer undefined"), undefined)).toBe(false); // no secret configured: always refused
    expect(isAuthorisedCron(call("Bearer short"), "short")).toBe(false); // too short to be a secret
  });
});

describe("key-value store", () => {
  it("in-memory: values expire, counters keep the lifetime they were created with", async () => {
    let t = 0;
    const store = new MemoryStore(() => t);
    await store.set("a", { x: 1 }, 10);
    expect(await store.get("a")).toEqual({ x: 1 });
    expect(await store.incr("n", 60)).toBe(1);
    t = 30_000;
    expect(await store.get("a")).toBeNull();
    expect(await store.incr("n", 60)).toBe(2);
    t = 61_000;
    expect(await store.incr("n", 60)).toBe(1);
    await store.set("forever", "v");
    t = 1e12;
    expect(await store.get("forever")).toBe("v");
  });

  it("Upstash / Vercel KV: sends REST commands with the bearer token", async () => {
    const calls: { url: string; auth: string; body: unknown }[] = [];
    const replies: unknown[] = [{ result: "OK" }, { result: JSON.stringify({ x: 1 }) }, { result: null }, [{ result: 3 }, { result: 0 }]];
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push({ url, auth: (init.headers as Record<string, string>).Authorization!, body: JSON.parse(init.body as string) });
      return new Response(JSON.stringify(replies.shift()), { status: 200 });
    }) as unknown as typeof fetch;
    const store = new UpstashStore("https://kv.example/", "tok", fetcher);
    await store.set("k", { x: 1 }, 30);
    expect(await store.get("k")).toEqual({ x: 1 });
    expect(await store.get("missing")).toBeNull();
    expect(await store.incr("n", 600)).toBe(3);
    expect(calls.map((c) => c.body)).toEqual([["SET", "k", '{"x":1}', "EX", 30], ["GET", "k"], ["GET", "missing"], [["INCR", "n"], ["EXPIRE", "n", 600, "NX"]]]);
    expect(calls.map((c) => c.url)).toEqual(["https://kv.example", "https://kv.example", "https://kv.example", "https://kv.example/pipeline"]);
    expect(calls.every((c) => c.auth === "Bearer tok")).toBe(true);
  });

  it("Upstash / Vercel KV: a failed request throws instead of pretending the key is absent", async () => {
    const store = new UpstashStore("https://kv.example", "tok", (async () => new Response("no", { status: 500 })) as unknown as typeof fetch);
    await expect(store.get("k")).rejects.toThrow(/status 500/);
  });
});

/* ── Rate limit ───────────────────────────────────────────────────────────── */

describe("rateLimit", () => {
  const limit = { max: 3, windowMs: 60_000 };

  it("counts in the shared store: up to the limit per key and window, then says when to retry", async () => {
    let t = 1000;
    const store = new MemoryStore(() => t);
    const hit = (key: string) => rateLimit(store, key, limit, t);
    expect([(await hit("tailor:1.2.3.4")).allowed, (await hit("tailor:1.2.3.4")).allowed, (await hit("tailor:1.2.3.4")).allowed]).toEqual([true, true, true]);
    t = 31_000;
    expect(await hit("tailor:1.2.3.4")).toEqual({ allowed: false, retryAfterSeconds: 29 });
    expect((await hit("tailor:5.6.7.8")).allowed).toBe(true); // another client
    expect((await hit("developments-read:1.2.3.4")).allowed).toBe(true); // another route
    t = 60_001;
    expect((await hit("tailor:1.2.3.4")).allowed).toBe(true); // next window
  });

  it("is shared between two server instances using the same store", async () => {
    const store = new MemoryStore(() => 5000);
    const a = [await rateLimit(store, "tailor:9.9.9.9", limit, 5000), await rateLimit(store, "tailor:9.9.9.9", limit, 5000)];
    const b = [await rateLimit(store, "tailor:9.9.9.9", limit, 5000), await rateLimit(store, "tailor:9.9.9.9", limit, 5000)];
    expect([...a, ...b].map((r) => r.allowed)).toEqual([true, true, true, false]);
  });
});
