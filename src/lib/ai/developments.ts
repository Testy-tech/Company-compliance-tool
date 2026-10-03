import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import type { Jurisdiction } from "@/lib/kb/schema";

import { aiConfig, WEB_SEARCH_TOOL } from "./config";
import { addUsage, classifyError, logAi, usageOf, type AiFailure, type AiUsage } from "./errors";
import { DEVELOPMENTS_SYSTEM } from "./prompts";
import type { AiClient } from "./tailor";

/*
 * Recent developments: a web search restricted to the jurisdiction's official
 * domains (from the KB), looking for changes since the KB was last reviewed.
 * The result is shown as "not yet reviewed" and never touches the checklist.
 */

export const developmentsOutputSchema = z.object({
  items: z.array(z.object({ title: z.string(), date: z.string(), summary: z.string(), url: z.string() })),
});

export type Development = { title: string; date: string; summary: string; url: string };

export type DevelopmentsResult =
  | { ok: true; items: Development[]; checkedAt: string; since: string; cached: boolean; usage: AiUsage; requestId: string | null; model: string }
  | { ok: false; failure: AiFailure; requestId?: string };

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
 * search, and the item is dated after the last review (or cannot be compared).
 */
export function validateDevelopments(output: z.infer<typeof developmentsOutputSchema>, j: Pick<Jurisdiction, "officialDomains" | "lastReviewed">, found: ReadonlySet<string>): Development[] {
  const kept: Development[] = [];
  const seen = new Set<string>();
  for (const item of output.items) {
    const url = normalise(item.url);
    const title = item.title.trim();
    const summary = item.summary.trim();
    const date = item.date.trim();
    if (!title || !summary || title.length > 200 || summary.length > 400) continue;
    if (!onOfficialDomain(url, j.officialDomains) || !found.has(url) || seen.has(url)) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= j.lastReviewed) continue;
    seen.add(url);
    kept.push({ title, date: date || "undated", summary, url });
  }
  return kept.slice(0, aiConfig.developments.maxItems);
}

/* ── 24-hour cache per jurisdiction (in memory; per server instance) ───────── */

type Cached = { at: number; lastReviewed: string; result: Extract<DevelopmentsResult, { ok: true }> };
const cache = new Map<string, Cached>();
export const clearDevelopmentsCache = () => cache.clear();

export async function runDevelopments(client: AiClient, j: Jurisdiction, now: Date = new Date()): Promise<DevelopmentsResult> {
  const { model, developments } = aiConfig;
  const hit = cache.get(j.id);
  if (hit && hit.lastReviewed === j.lastReviewed && now.getTime() - hit.at < developments.cacheMs) return { ...hit.result, cached: true };

  const started = Date.now();
  const log = { route: "developments" as const, model, jurisdiction: j.id };
  const today = now.toISOString().slice(0, 10);
  const brief = {
    jurisdiction: j.name,
    lawsAlreadyCovered: j.laws.map((l) => `${l.shortName} — ${l.citation}`),
    changesAlreadyRecorded: j.upcomingChanges.map((c) => c.title),
    lastReviewed: j.lastReviewed,
    today,
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
      const items = validateDevelopments(response.parsed_output, j, found);
      logAi({ ...log, ms: Date.now() - started, requestId, usage, detail: `items=${items.length}/${response.parsed_output.items.length}` });
      const result = { ok: true as const, items, checkedAt: now.toISOString(), since: j.lastReviewed, cached: false, usage, requestId, model };
      cache.set(j.id, { at: now.getTime(), lastReviewed: j.lastReviewed, result });
      return result;
    }
  } catch (error) {
    const { failure, requestId, status } = classifyError(error);
    logAi({ ...log, ms: Date.now() - started, requestId, failure, detail: status ? `status=${status}` : undefined });
    return { ok: false, failure, requestId };
  }
}
