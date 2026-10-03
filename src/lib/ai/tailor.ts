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
      considerations: z.array(z.string()),
    }),
  ),
});

const LIMITS = { explanation: 900, step: 450, minSteps: 1, consideration: 350, maxConsiderations: 3 };

/** Article / section numbers, time limits and years mentioned in a text, e.g. "art:28", "time:72 hour", "year:2027". */
function legalAnchors(text: string): Set<string> {
  const found = new Set<string>();
  for (const m of text.matchAll(/(?:\barts?\.?|\barticles?|§+|\bsec(?:tions?|s)?\.?)\s*((?:\d+[\w.()-]*(?:\s*(?:,|and|or|to|–|-)\s*)?)+)/gi))
    for (const n of m[1]!.matchAll(/\d+/g)) found.add(`art:${n[0]}`);
  for (const m of text.matchAll(/\b(\d+)[\s-]*(?:calendar |working |business )?(hour|day|week|month|year)s?\b/gi)) found.add(`time:${m[1]} ${m[2]!.toLowerCase()}`);
  for (const m of text.matchAll(/\b(?:19|20)\d{2}\b/g)) found.add(`year:${m[0]}`);
  return found;
}

type SentObligation = TailorRequest["obligations"][number];
const ownText = (o: SentObligation) => [o.title, o.requirement, o.whyItApplies, ...o.actionSteps, ...o.assumptions, o.gdprEquivalent ?? ""].join("\n");

/**
 * An item may not cite an article or section, or state a time limit or a year,
 * that its own obligation text does not contain. A deterministic backstop to
 * the prompt: such an item is dropped and keeps its standard text.
 */
export function introducesLegalContent(original: SentObligation, explanation: string, steps: string[]): string | undefined {
  const allowed = legalAnchors(ownText(original));
  for (const anchor of legalAnchors([explanation, ...steps].join("\n"))) if (!allowed.has(anchor)) return anchor;
  return undefined;
}

/* ── Steps: one-to-one with the standard steps, and nothing new in them ────── */

const STOP = new Set("with that this from they them their there where which while when what will would should could have been being into onto over under than then also each every your yours ours such only more most some any other same both either neither about after before within without between against during including include includes".split(" "));
/** Significant words of a text, lower-cased and roughly stemmed, for comparing a tailored step with its standard step. */
function words(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().match(/[a-zà-ÿ]{4,}/g) ?? []) if (!STOP.has(w)) out.add(w.replace(/(ies|es|s|ing|ed)$/, ""));
  return out;
}

/** Words that name a kind of document or record. */
const DOCUMENT_WORDS = /\b(polic(?:y|ies)|notices?|registers?|registr(?:y|ation)s?|records?|agreements?|contracts?|clauses?|addend(?:um|a)|assessments?|certificat(?:e|es|ion)|filings?|forms?|reports?|templates?|procedures?|playbooks?|schedules?|logs?|inventor(?:y|ies)|audits?|handbooks?|statements?|declarations?|licen[cs]es?|permits?|mandates?|charters?|manuals?|protocols?|questionnaires?)\b/gi;
/** Words that name an authority or other body. */
const AUTHORITY_WORDS = /\b(authorit(?:y|ies)|regulators?|agenc(?:y|ies)|commissions?|commissioners?|boards?|ministr(?:y|ies)|courts?|tribunals?|inspectorates?|ombuds\w*|attorney general|prosecutors?|councils?|unions?|committees?|bureaus?|offices?)\b/gi;

const stem = (w: string) => w.toLowerCase().replace(/(ies|es|s)$/, "");
const collect = (text: string, pattern: RegExp) => new Set([...text.matchAll(pattern)].map((m) => stem(m[0])));
/** Acronyms and proper abbreviations (DPIA, CAC, PIPL): a new one usually means a new document, law or authority. */
const acronyms = (text: string) => new Set(text.match(/\b[A-Z][A-Z0-9]{1,}s?\b/g)?.map((a) => a.replace(/s$/, "")) ?? []);

/**
 * Why a set of tailored steps is not acceptable, or undefined if it is.
 *  - same number of steps as the standard text, each recognisably the same step (shares its key words);
 *  - no document, authority, body or abbreviation that is not in the obligation's own text
 *    (the company's existing GDPR artefacts, sent with the request, may be named).
 * New deadlines, dates and article references are caught by introducesLegalContent.
 */
export function stepsProblem(original: SentObligation, steps: string[], artefacts: readonly string[] = []): string | undefined {
  if (steps.length !== original.actionSteps.length) return `${steps.length} steps for ${original.actionSteps.length} standard steps`;
  const source = `${ownText(original)}\n${artefacts.join("\n")}`;
  const allowedDocs = collect(source, DOCUMENT_WORDS);
  const allowedAuthorities = collect(source, AUTHORITY_WORDS);
  const allowedAcronyms = acronyms(source);
  for (let i = 0; i < steps.length; i++) {
    const standard = words(original.actionSteps[i]!);
    const tailored = words(steps[i]!);
    const shared = [...standard].filter((w) => tailored.has(w)).length;
    if (standard.size && shared / standard.size < 0.3) return `step ${i + 1} does not correspond to standard step ${i + 1}`;
    for (const d of collect(steps[i]!, DOCUMENT_WORDS)) if (!allowedDocs.has(d)) return `step ${i + 1} introduces a document ("${d}")`;
    for (const a of collect(steps[i]!, AUTHORITY_WORDS)) if (!allowedAuthorities.has(a)) return `step ${i + 1} introduces an authority or body ("${a}")`;
    for (const a of acronyms(steps[i]!)) if (!allowedAcronyms.has(a)) return `step ${i + 1} introduces "${a}"`;
  }
  return undefined;
}

/**
 * Accept the output only if every item refers to an obligation that was sent,
 * once, with its applicability unchanged and with usable text. One bad item
 * rejects the whole response: a model that broke one rule is not trusted on the rest.
 * The exception is an item whose text adds something (an article, a deadline, a
 * document, an authority, an extra or unrelated step): that item alone is
 * dropped and keeps its standard text (reported in `dropped`).
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
    if (steps.length < LIMITS.minSteps || steps.some((s) => s.length > LIMITS.step)) return { ok: false, problem: `steps missing or too long for "${item.id}"` };
    const added = introducesLegalContent(original, explanation, steps) ?? stepsProblem(original, steps, request.facts.gdprArtefactsInPlace);
    if (added) {
      dropped.push(`${item.id} (${added})`);
      continue;
    }
    // Considerations are shown apart from the steps, as points for counsel; over-long or surplus ones are cut, not fatal.
    const considerations = (item.considerations ?? []).map((c) => c.trim()).filter((c) => c && c.length <= LIMITS.consideration).slice(0, LIMITS.maxConsiderations);
    items.push({ id: item.id, tailoredExplanation: explanation, tailoredSteps: steps, considerations });
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
