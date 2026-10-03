/*
 * Dev-only: run the developments check for one jurisdiction with an arbitrary
 * "since" date, to verify that the search finds things. Makes a real API call
 * and stores nothing.
 *
 *   npm run dev:developments -- CL --since=2025-01-01 [--model=claude-sonnet-5]
 */
import { loadEnv, loadKb, client, arg } from "./lib/dev-env.mts";

loadEnv();
const { runDevelopments } = await import("../src/lib/ai/developments");

const id = process.argv[2];
const jurisdiction = loadKb().find((j) => j.id === id);
if (!jurisdiction) throw new Error(`Usage: developments-check <jurisdiction id> [--since=YYYY-MM-DD] [--model=…]. Unknown jurisdiction "${id}".`);
const since = arg("since") ?? jurisdiction.lastReviewed;
if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error(`--since must be YYYY-MM-DD, got "${since}"`);

console.log(`Developments check for ${jurisdiction.name}, changes since ${since}`);
console.log(`Searching only: ${jurisdiction.officialDomains.join(", ")}\n`);

// The route's log line goes to the console too; keep the report readable.
const info = console.info;
console.info = () => {};
const result = await runDevelopments(client(), jurisdiction, { since, model: arg("model") });
console.info = info;

if (!result.ok) {
  console.log(`FAILED: ${result.failure}${result.requestId ? ` (request ${result.requestId})` : ""}`);
  process.exit(1);
}
console.log(`${result.items.length} item(s) kept after validation (official domain, URL returned by the search, dated after ${since}):\n`);
for (const item of result.items) console.log(`- ${item.date}  ${item.title}\n  ${item.summary}\n  ${item.url}\n`);
const u = result.usage;
console.log(`Model ${result.model} · ${u.webSearches} searches · input ${u.inputTokens} + cache write ${u.cacheWriteTokens} + cache read ${u.cacheReadTokens} · output ${u.outputTokens} tokens`);
