import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { aiConfig } from "./config";
import { classifyError, logAi, usageOf, type AiFailure, type AiUsage } from "./errors";
import { TAILOR_SYSTEM } from "./prompts";

/*
 * Tailoring: Claude may reword an obligation's explanation and steps for the
 * company in front of it, and nothing else. The deterministic report stays the
 * source of truth; anything that fails validation is dropped and the standard
 * text is shown.
 */

const short = (max: number) => z.string().trim().min(1).max(max);

/** What the browser sends: one jurisdiction's applicable obligations plus non-identifying facts. */
export const tailorRequestSchema = z
  .object({
    /** The user ticked the opt-in box. */
    consent: z.literal(true),
    jurisdiction: z.object({ id: short(8), name: short(80) }),
    company: z.object({
      /** Present only when the user marked the label as anonymised; a real company name is never sent. */
      anonymisedLabel: short(120).optional(),
      industry: short(60),
      hqCountry: z.string().regex(/^[A-Z]{2}$/),
      gdprBaseline: z.boolean(),
      governanceModel: short(40),
      localContacts: z.boolean(),
    }),
    entity: z.object({ role: short(20), entityType: short(20), status: short(20) }),
    facts: z.object({
      subjects: z.array(short(80)).max(12),
      sensitiveData: z.array(short(80)).max(12),
      processing: z.array(short(80)).max(12),
      gdprArtefactsInPlace: z.array(short(80)).max(16),
    }),
    obligations: z
      .array(
        z.object({
          id: z.string().regex(/^[A-Z]{2}(-[A-Z]{2})?-[A-Z_]+-\d{2}$/),
          title: short(200),
          requirement: short(1200),
          whyItApplies: short(400),
          actionSteps: z.array(short(600)).min(1).max(12),
          applicability: z.enum(["applies", "assumed"]),
          assumptions: z.array(short(400)).max(8),
          owner: short(40),
          gdprEquivalent: short(200).optional(),
        }),
      )
      .min(1)
      .max(aiConfig.tailor.maxObligations),
  })
  .strict();

export type TailorRequest = z.infer<typeof tailorRequestSchema>;

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

export type TailoredItem = { id: string; tailoredExplanation: string; tailoredSteps: string[] };

const LIMITS = { explanation: 900, step: 450, minSteps: 1, maxSteps: 8 };

/**
 * Accept the output only if every item refers to an obligation that was sent,
 * once, with its applicability unchanged and with usable text. One bad item
 * rejects the whole response: a model that broke one rule is not trusted on the rest.
 */
export function validateTailorOutput(request: TailorRequest, output: z.infer<typeof tailorOutputSchema>): { ok: true; items: TailoredItem[] } | { ok: false; problem: string } {
  const sent = new Map(request.obligations.map((o) => [o.id, o]));
  const seen = new Set<string>();
  const items: TailoredItem[] = [];
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
    items.push({ id: item.id, tailoredExplanation: explanation, tailoredSteps: steps });
  }
  return { ok: true, items };
}

export type TailorResult =
  | { ok: true; items: TailoredItem[]; usage: AiUsage; requestId: string | null; model: string }
  | { ok: false; failure: AiFailure; requestId?: string };

/** The part of the SDK client this module uses, so tests can pass a stub. */
export type AiClient = Pick<Anthropic, "messages">;

export async function runTailor(client: AiClient, request: TailorRequest): Promise<TailorResult> {
  const { model, tailor } = aiConfig;
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
    logAi({ ...log, ms: Date.now() - started, requestId, usage });
    return { ok: true, items: checked.items, usage, requestId, model };
  } catch (error) {
    const { failure, requestId, status } = classifyError(error);
    logAi({ ...log, ms: Date.now() - started, requestId, failure, detail: status ? `status=${status}` : undefined });
    return { ok: false, failure, requestId };
  }
}
