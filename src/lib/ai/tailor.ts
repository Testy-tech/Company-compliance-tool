import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { aiConfig } from "./config";
import { classifyError, logAi, usageOf, type AiFailure, type AiUsage } from "./errors";
import { TAILOR_SYSTEM } from "./prompts";
import { tailorRequestSchema, type TailoredItem, type TailorRequest } from "./tailor-schema";

export { tailorRequestSchema, type TailoredItem, type TailorRequest };

/*
 * Tailoring: Claude may reword an obligation's explanation and steps for the
 * company in front of it, and nothing else. The deterministic report stays the
 * source of truth; anything that fails validation is dropped and the standard
 * text is shown.
 */

/** What Claude is asked to return. Structured outputs do not support length limits, so those are checked afterwards. */
export const tailorOutputSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      applicability: z.enum(["applies", "assumed"]),
      tailoredExplanation: z.string(),
      tailoredSteps: z.array(z.string()),
    }),
  ),
});

const LIMITS = { explanation: 900, step: 450, minSteps: 1, maxSteps: 8 };

/** Article / section numbers and time limits mentioned in a text, e.g. "art:28", "time:72 hour". */
function legalAnchors(text: string): Set<string> {
  const found = new Set<string>();
  for (const m of text.matchAll(/(?:\barts?\.?|\barticles?|§+|\bsec(?:tions?|s)?\.?)\s*((?:\d+[\w.()-]*(?:\s*(?:,|and|or|to|–|-)\s*)?)+)/gi))
    for (const n of m[1]!.matchAll(/\d+/g)) found.add(`art:${n[0]}`);
  for (const m of text.matchAll(/\b(\d+)\s*(?:calendar |working |business )?(hour|day|week|month|year)s?\b/gi)) found.add(`time:${m[1]} ${m[2]!.toLowerCase()}`);
  return found;
}

/**
 * An item may not cite an article or section, or state a time limit, that its
 * own obligation text does not contain. A deterministic backstop to the prompt:
 * such an item is dropped and keeps its standard text.
 */
export function introducesLegalContent(original: TailorRequest["obligations"][number], explanation: string, steps: string[]): string | undefined {
  const allowed = legalAnchors([original.title, original.requirement, original.whyItApplies, ...original.actionSteps, ...original.assumptions, original.gdprEquivalent ?? ""].join("\n"));
  for (const anchor of legalAnchors([explanation, ...steps].join("\n"))) if (!allowed.has(anchor)) return anchor;
  return undefined;
}

/**
 * Accept the output only if every item refers to an obligation that was sent,
 * once, with its applicability unchanged and with usable text. One bad item
 * rejects the whole response: a model that broke one rule is not trusted on the rest.
 * The exception is an item that mentions an article or time limit not in its
 * source text: that item alone is dropped (reported in `dropped`).
 */
export function validateTailorOutput(
  request: TailorRequest,
  output: z.infer<typeof tailorOutputSchema>,
): { ok: true; items: TailoredItem[]; dropped: string[] } | { ok: false; problem: string } {
  const sent = new Map(request.obligations.map((o) => [o.id, o]));
  const seen = new Set<string>();
  const items: TailoredItem[] = [];
  const dropped: string[] = [];
  for (const item of output.items) {
    const original = sent.get(item.id);
    if (!original) return { ok: false, problem: `unknown obligation id "${item.id}"` };
    if (seen.has(item.id)) return { ok: false, problem: `duplicate obligation id "${item.id}"` };
    seen.add(item.id);
    // Enum values may come back with different capitalisation; compare case-insensitively.
    if (item.applicability.toLowerCase() !== original.applicability) return { ok: false, problem: `applicability changed for "${item.id}"` };
    const explanation = item.tailoredExplanation.trim();
    const steps = item.tailoredSteps.map((s) => s.trim()).filter(Boolean);
    if (!explanation || explanation.length > LIMITS.explanation) return { ok: false, problem: `explanation missing or too long for "${item.id}"` };
    if (steps.length < LIMITS.minSteps || steps.length > LIMITS.maxSteps || steps.some((s) => s.length > LIMITS.step))
      return { ok: false, problem: `steps missing, too many or too long for "${item.id}"` };
    const added = introducesLegalContent(original, explanation, steps);
    if (added) {
      dropped.push(`${item.id} (${added})`);
      continue;
    }
    items.push({ id: item.id, tailoredExplanation: explanation, tailoredSteps: steps });
  }
  return { ok: true, items, dropped };
}

export type TailorResult =
  | { ok: true; items: TailoredItem[]; usage: AiUsage; requestId: string | null; model: string }
  | { ok: false; failure: AiFailure; requestId?: string };

/** The part of the SDK client this module uses, so tests can pass a stub. */
export type AiClient = Pick<Anthropic, "messages">;

export async function runTailor(client: AiClient, request: TailorRequest, options: { model?: string } = {}): Promise<TailorResult> {
  const { tailor } = aiConfig;
  const model = options.model ?? tailor.model;
  const started = Date.now();
  const log = { route: "tailor" as const, model, jurisdiction: request.jurisdiction.id };
  // The consent flag is for the route; Claude gets only the content.
  const payload = { jurisdiction: request.jurisdiction, company: request.company, entity: request.entity, facts: request.facts, obligations: request.obligations };

  try {
    const response = await client.messages.parse(
      {
        model,
        max_tokens: tailor.maxTokens,
        // Stable across requests, so it is cached; the per-company payload follows it.
        system: [{ type: "text", text: TAILOR_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: JSON.stringify(payload) }],
        output_config: { effort: tailor.effort, format: zodOutputFormat(tailorOutputSchema) },
      },
      // The SDK retries timeouts and 5xx once; a 400 (including a blocked output) is never retried.
      { timeout: tailor.timeoutMs, maxRetries: 1 },
    );
    const usage = usageOf(response.usage);
    const requestId = response._request_id ?? null;

    if (response.stop_reason !== "end_turn" || !response.parsed_output) {
      logAi({ ...log, ms: Date.now() - started, requestId, usage, failure: "invalid_output", detail: `stop_reason=${response.stop_reason}` });
      return { ok: false, failure: "invalid_output", requestId: requestId ?? undefined };
    }
    const checked = validateTailorOutput(request, response.parsed_output);
    if (!checked.ok) {
      logAi({ ...log, ms: Date.now() - started, requestId, usage, failure: "invalid_output", detail: checked.problem });
      return { ok: false, failure: "invalid_output", requestId: requestId ?? undefined };
    }
    logAi({ ...log, ms: Date.now() - started, requestId, usage, detail: checked.dropped.length ? `dropped for new legal content: ${checked.dropped.join(", ")}` : undefined });
    return { ok: true, items: checked.items, usage, requestId, model };
  } catch (error) {
    const { failure, requestId, status } = classifyError(error);
    logAi({ ...log, ms: Date.now() - started, requestId, failure, detail: status ? `status=${status}` : undefined });
    return { ok: false, failure, requestId };
  }
}
