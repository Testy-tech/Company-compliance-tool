import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import type { Jurisdiction } from "@/lib/kb/schema";
import type { KeyValueStore } from "@/lib/store/kv";

import { aiConfig, WEB_SEARCH_TOOL } from "./config";
import { addUsage, classifyError, logAi, usageOf, type AiFailure, type AiUsage } from "./errors";
import { DEVELOPMENTS_SYSTEM } from "./prompts";
import type { AiClient } from "./tailor";

/*
 * Recent developments: a web search restricted to the jurisdiction's official
 * domains (from the KB), looking for changes since the KB was last reviewed.
 * Run on a schedule, never by a report user; the result is stored and shown as
 * "not yet reviewed". It never touches the checklist.
 */

export const developmentsOutputSchema = z.object({
  items: z.array(z.object({ title: z.string(), date: z.string(), summary: z.string(), url: z.string() })),
});

export type Development = { title: string; date: string; summary: string; url: string };

export type DevelopmentsResult =
  | { ok: true; items: Development[]; checkedAt: string; since: string; usage: AiUsage; requestId: string | null; model: string }
  | { ok: false; failure: AiFailure; requestId?: string };

/** What is kept in the shared store for each jurisdiction, and what the report reads. */
export type StoredDevelopments = {
  jurisdiction: string;
  checkedAt: string;
  since: string;
  items: Development[];
  model: string;
  usage: AiUsage;
  searchedDomains: string[];
};

const normalise = (url: string) => url.trim().replace(/#.*$/, "").replace(/\/$/, "");

const onOfficialDomain = (url: string, domains: readonly string[]) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && domains.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
};

/** URLs the search actually returned in this response. */
function searchedUrls(content: readonly Anthropic.ContentBlock[]): Set<string> {
  const urls = new Set<string>();
  for (const block of content)
    // On an error the content is a single error object, not a list.
    if (block.type === "web_search_tool_result" && Array.isArray(block.content))
      for (const result of block.content) urls.add(normalise(result.url));
  return urls;
}

/**
 * Keep an item only if its URL is on an official domain, was returned by the
 * search, and the item is dated after `since` (or cannot be compared).
 */
export function validateDevelopments(
  output: z.infer<typeof developmentsOutputSchema>,
  officialDomains: readonly string[],
  since: string,
  found: ReadonlySet<string>,
): Development[] {
  const kept: Development[] = [];
  const seen = new Set<string>();
  for (const item of output.items) {
    const url = normalise(item.url);
    const title = item.title.trim();
    const summary = item.summary.trim();
    const date = item.date.trim();
    if (!title || !summary || title.length > 200 || summary.length > 400) continue;
    if (!onOfficialDomain(url, officialDomains) || !found.has(url) || seen.has(url)) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= since) continue;
    seen.add(url);
    kept.push({ title, date: date || "undated", summary, url });
  }
  return kept.slice(0, aiConfig.developments.maxItems);
}

export type DevelopmentsOptions = {
  now?: Date;
  /** Look for changes after this date instead of the KB's last review (verification runs only). */
  since?: string;
  model?: string;
};

export async function runDevelopments(client: AiClient, j: Jurisdiction, options: DevelopmentsOptions = {}): Promise<DevelopmentsResult> {
  const { developments } = aiConfig;
  const model = options.model ?? developments.model;
  const now = options.now ?? new Date();
  const since = options.since ?? j.lastReviewed;

  const started = Date.now();
  const log = { route: "developments" as const, model, jurisdiction: j.id };
  const brief = {
    jurisdiction: j.name,
    lawsAlreadyCovered: j.laws.map((l) => `${l.shortName} — ${l.citation}`),
    changesAlreadyRecorded: j.upcomingChanges.map((c) => c.title),
    lastReviewed: since,
    today: now.toISOString().slice(0, 10),
  };
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: JSON.stringify(brief) }];

  try {
    let usage: AiUsage = usageOf(undefined);
    const found = new Set<string>();
    // A long search turn can pause; resume it by sending the paused turn back (at most twice).
    for (let attempt = 0; ; attempt++) {
      const response = await client.messages.parse(
        {
          model,
          max_tokens: developments.maxTokens,
          system: [{ type: "text", text: DEVELOPMENTS_SYSTEM, cache_control: { type: "ephemeral" } }],
          messages,
          tools: [
            {
              type: WEB_SEARCH_TOOL,
              name: "web_search",
              max_uses: developments.maxSearches,
              allowed_domains: [...j.officialDomains],
              // Direct calls keep every search result in the response, so cited URLs can be checked against them.
              allowed_callers: ["direct"],
            },
          ],
          output_config: { effort: developments.effort, format: zodOutputFormat(developmentsOutputSchema) },
        },
        { timeout: developments.timeoutMs, maxRetries: 1 },
      );
      usage = addUsage(usage, usageOf(response.usage));
      for (const url of searchedUrls(response.content)) found.add(url);
      const requestId = response._request_id ?? null;

      if (response.stop_reason === "pause_turn" && attempt < 2) {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (response.stop_reason !== "end_turn" || !response.parsed_output) {
        logAi({ ...log, ms: Date.now() - started, requestId, usage, failure: "invalid_output", detail: `stop_reason=${response.stop_reason}` });
        return { ok: false, failure: "invalid_output", requestId: requestId ?? undefined };
      }
      const items = validateDevelopments(response.parsed_output, j.officialDomains, since, found);
      logAi({ ...log, ms: Date.now() - started, requestId, usage, detail: `items=${items.length}/${response.parsed_output.items.length}` });
      return { ok: true, items, checkedAt: now.toISOString(), since, usage, requestId, model };
    }
  } catch (error) {
    const { failure, requestId, status } = classifyError(error);
    logAi({ ...log, ms: Date.now() - started, requestId, failure, detail: status ? `status=${status}` : undefined });
    return { ok: false, failure, requestId };
  }
}

/* ── Scheduled job and stored results ─────────────────────────────────────── */

const key = (jurisdiction: string) => `developments:v1:${jurisdiction}`;

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". No secret configured = always refused. */
export function isAuthorisedCron(request: Request, secret: string | undefined = process.env.CRON_SECRET): boolean {
  return !!secret && secret.length >= 16 && request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Run the check for one jurisdiction and store the result. A failed check
 * leaves the previously stored result in place, so the report keeps showing the
 * last successful one with its date.
 */
export async function runScheduledDevelopments(store: KeyValueStore, client: AiClient, j: Jurisdiction, options: DevelopmentsOptions = {}): Promise<DevelopmentsResult> {
  const result = await runDevelopments(client, j, options);
  if (result.ok) {
    const stored: StoredDevelopments = {
      jurisdiction: j.id,
      checkedAt: result.checkedAt,
      since: result.since,
      items: result.items,
      model: result.model,
      usage: result.usage,
      searchedDomains: [...j.officialDomains],
    };
    await store.set(key(j.id), stored);
  }
  return result;
}

export const readStoredDevelopments = (store: KeyValueStore, jurisdiction: string) => store.get<StoredDevelopments>(key(jurisdiction));
