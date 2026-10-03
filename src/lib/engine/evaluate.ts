import { formatUSD, type FxTable } from "@/lib/intake/money";
import { consentBannerLabels, employeeRepLabels, hrOnlyLabels } from "@/lib/intake/options";
import { anchorId, copy, type QuestionId } from "@/lib/intake/questions";
import type { Assessment } from "@/lib/intake/schema";
import { facts as factRegistry, factsByPath, type FactDef } from "@/lib/kb/facts";
import { resolveThresholds, thresholdInEffect } from "@/lib/kb/rules";
import type { Jurisdiction, JurisdictionId, Obligation, ObligationCategory } from "@/lib/kb/schema";

import { deriveBaseFacts, type BaseFacts, type DeriveContext, type Scalar } from "./derive";
import { evaluateRule, type Condition, type Pivot, type RuleOutcome } from "./rule";
import type { Alternative, Assumption, JurisdictionReport, ObligationResult, OpenQuestion, PenaltyExposure, Report } from "./types";

const PRIORITY_QUESTIONS = 10;
const ROADMAP: Record<Obligation["priority"], 30 | 60 | 90> = { critical: 30, high: 30, medium: 60, low: 90 };

const optionLabels: Record<string, Record<string, string>> = {
  "j.transfers.hrOnly": hrOnlyLabels,
  "j.employeeRep": employeeRepLabels,
  "web.consentBanner": consentBannerLabels,
};

/** One follow-up wording per wizard question: the first fact in the registry that has one. */
const followUpByQuestion = new Map<string, string>();
for (const f of factRegistry) if (f.questionId && f.followUp && !followUpByQuestion.has(f.questionId)) followUpByQuestion.set(f.questionId, f.followUp);

const number = (n: number) => new Intl.NumberFormat("en-US").format(n);
const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/* ── Wording ──────────────────────────────────────────────────────────────── */

function phrase(def: FactDef | undefined, fact: string, c: Condition): { value: string; text: string } {
  const amount = (n: number) => (def?.kind === "money" ? formatUSD(n) : number(n));
  switch (c.kind) {
    case "atLeast":
      return { value: `≥ ${amount(c.n)}`, text: `is at least ${amount(c.n)}` };
    case "below":
      return { value: `< ${amount(c.n)}`, text: `is below ${amount(c.n)}` };
    case "between":
      return { value: `${amount(c.min)}–${amount(c.max)}`, text: `is between ${amount(c.min)} and ${amount(c.max)}` };
    case "is": {
      const label = (v: Scalar) => (v === true ? "yes" : v === false ? "no" : v === null ? "not applicable" : optionLabels[fact]?.[String(v)] ?? String(v));
      const value = c.values.map(label).join(" or ");
      return { value, text: `: ${value}` };
    }
    case "unspecified":
      return { value: "unresolved", text: "is in the range that triggers this obligation" };
  }
}

/** "{label} is at least 1,000,000" — shared by assumption sentences and "may apply instead if…" conditions. */
function describePivot(p: Pivot, country: string): { value: string; text: string } {
  const def = factsByPath.get(p.fact);
  const { value, text } = phrase(def, p.fact, p.condition);
  const label = (def?.label ?? p.fact).replaceAll("{country}", country);
  return { value, text: text.startsWith(":") ? `${label}${text}` : `${label} ${text}` };
}

/* ── Open questions ───────────────────────────────────────────────────────── */

type QuestionSeed = Omit<OpenQuestion, "obligationIds" | "jurisdictions" | "impact" | "priority">;

/** The open question behind one non-exact answer that a result hinges on. */
function questionFor(source: string, pivot: Pivot, facts: BaseFacts, j: Jurisdiction, thresholdAmount: DeriveContext["thresholdAmount"]): QuestionSeed | undefined {
  const def = factsByPath.get(source);
  const value = facts[source];
  if (!def?.questionId || !value || value.kind === "exact") return undefined;
  const perCountry = source.startsWith("j.") && def.scope !== "group";
  const vars = { country: j.name };
  const fill = (s: string) => s.replaceAll("{country}", j.name);

  const unresolved = value.kind === "options" || value.unresolved;
  if (unresolved) {
    const qid = def.questionId as QuestionId;
    return {
      id: perCountry ? `${qid}:${j.id}` : qid,
      kind: "unresolved",
      questionId: qid,
      facts: [source],
      jurisdiction: perCountry ? j.id : undefined,
      question: fill(followUpByQuestion.get(qid) ?? copy(qid, vars).label),
      whyItMatters: copy(qid, vars).why,
      resolveHref: `/assess#${anchorId(qid, perCountry ? j.id : undefined)}`,
    };
  }

  // Known revenue band that straddles a monetary threshold: the wizard has a yes/no follow-up for it.
  const c = pivot.condition;
  if (def.kind === "money" && (c.kind === "atLeast" || c.kind === "below") && c.thresholdId) {
    const amount = formatUSD(thresholdAmount(c.thresholdId) ?? c.n);
    return {
      id: `revenue-above:${c.thresholdId}`,
      kind: "unresolved",
      questionId: "revenue-above",
      facts: [source],
      question: copy("revenue-above", { amount }).label,
      whyItMatters: copy("revenue-above", { amount }).why,
      resolveHref: `/assess#${anchorId("revenue-above", c.thresholdId)}`,
    };
  }

  // Known bands that together straddle a threshold: no wizard question can settle it.
  const described = describePivot(pivot, j.name);
  return {
    id: `precision:${pivot.fact}:${j.id}:${described.value}`,
    kind: "precision",
    questionId: def.questionId,
    facts: [pivot.fact],
    jurisdiction: j.id,
    question: `Is it correct that the ${described.text}?`,
    whyItMatters: "The answer bands you chose straddle a legal threshold, so a band alone cannot settle it.",
  };
}

/* ── Evaluation ───────────────────────────────────────────────────────────── */

type Evaluated = { obligation: Obligation; outcome: RuleOutcome };

function penaltyFor(o: Obligation, revenue: Assessment["intake"]["company"]["groupRevenue"]): PenaltyExposure | undefined {
  if (!o.penaltyNote) return undefined;
  const revenueBased = /%|turnover|revenue|sales/i.test(o.penaltyNote);
  if (!revenueBased) return { kind: "formula", formula: o.penaltyNote, reason: "not_revenue_based" };
  if (revenue.status === "withheld") return { kind: "formula", formula: o.penaltyNote, reason: "revenue_not_provided", note: "Revenue not provided" };
  if (revenue.status === "unknown") return { kind: "formula", formula: o.penaltyNote, reason: "revenue_unknown", note: "Revenue not provided" };
  return { kind: "formula", formula: o.penaltyNote, reason: "not_computable" };
}

export function evaluate(assessment: Assessment, kb: readonly Jurisdiction[], fx: FxTable): Report {
  const { intake, assessmentDate } = assessment;

  const thresholdAmount: DeriveContext["thresholdAmount"] = (id) => {
    for (const j of kb) {
      const t = thresholdInEffect(j.thresholds, id, assessmentDate);
      if (t) return t.amount;
    }
    return undefined;
  };

  const seeds = new Map<string, QuestionSeed>();
  const affected = new Map<string, Set<string>>();
  const addQuestion = (seed: QuestionSeed, obligationId?: string) => {
    const existing = seeds.get(seed.id);
    if (existing) existing.facts = [...new Set([...existing.facts, ...seed.facts])].sort(byString);
    else seeds.set(seed.id, seed);
    if (!affected.has(seed.id)) affected.set(seed.id, new Set());
    if (obligationId) affected.get(seed.id)!.add(obligationId);
  };

  const jurisdictions: JurisdictionReport[] = [];
  const assessed = [...kb].sort((a, b) => byString(a.id, b.id)).filter((j) => intake.footprint.entities.some((e) => e.jurisdiction === j.id));

  assessed.forEach((j, ji) => {
    const entity = intake.footprint.entities.find((e) => e.jurisdiction === j.id)!;
    const facts = deriveBaseFacts(intake, entity, { fx, thresholdAmount });

    const evaluated: Evaluated[] = j.obligations.map((obligation) => ({
      obligation,
      outcome: evaluateRule(resolveThresholds(obligation.appliesIf, j.thresholds, assessmentDate), obligation.appliesIf, facts),
    }));

    // Tiered groups: report only the strictest tier that applies or may apply.
    const alternativesOf = new Map<string, Alternative[]>();
    const dropped = new Set<string>();
    const forcedAssumed = new Set<string>();
    const groups = new Map<string, Evaluated[]>();
    for (const ev of evaluated)
      if (ev.obligation.exclusiveGroup) groups.set(ev.obligation.exclusiveGroup, [...(groups.get(ev.obligation.exclusiveGroup) ?? []), ev]);
    for (const tiers of groups.values()) {
      const live = tiers.filter((t) => t.outcome.status !== "excluded").sort((a, b) => (b.obligation.strictness ?? 0) - (a.obligation.strictness ?? 0));
      const [winner, ...others] = live;
      if (!winner) continue;
      for (const o of others) dropped.add(o.obligation.id);
      if (winner.outcome.status === "applies") continue;
      if (others.length) forcedAssumed.add(winner.obligation.id);
      alternativesOf.set(
        winner.obligation.id,
        others.map((o) => ({
          obligationId: o.obligation.id,
          title: o.obligation.title,
          condition:
            o.outcome.status === "mixed"
              ? `if ${o.outcome.pivots.map((p) => describePivot(p, j.name).text).join(", and ")}`
              : "if the conditions for the stricter tier are not met",
        })),
      );
    }

    const results: ObligationResult[] = [];
    for (const { obligation, outcome } of evaluated) {
      if (outcome.status === "excluded" || dropped.has(obligation.id)) continue;
      const assumptions: Assumption[] =
        outcome.status !== "mixed"
          ? []
          : outcome.pivots.map((pivot) => {
              const questions = pivot.sources.flatMap((s) => questionFor(s, pivot, facts, j, thresholdAmount) ?? []);
              for (const q of questions) addQuestion(q, obligation.id);
              const { value, text } = describePivot(pivot, j.name);
              return { fact: pivot.fact, assumedValue: value, sentence: `Assumed ${text}`, openQuestionIds: [...new Set(questions.map((q) => q.id))].sort(byString) };
            });
      results.push({
        jurisdiction: j.id,
        obligation,
        applicability: outcome.status === "mixed" || forcedAssumed.has(obligation.id) ? "assumed" : "applies",
        assumptions,
        alternatives: alternativesOf.get(obligation.id) ?? [],
        paragraph: `${ji + 1}.${results.length + 1}`,
        roadmapBucket: ROADMAP[obligation.priority],
        penalty: penaltyFor(obligation, intake.company.groupRevenue),
      });
    }

    // Every unresolved answer is an open question, even if nothing hinges on it yet.
    for (const path of Object.keys(facts).sort(byString)) {
      const def = factsByPath.get(path);
      const value = facts[path]!;
      if (!def?.resolvable || value.kind === "exact" || (value.kind === "range" && !value.unresolved)) continue;
      const seed = questionFor(path, { fact: path, sources: [path], condition: { kind: "unspecified" } }, facts, j, thresholdAmount);
      if (seed) addQuestion(seed);
    }

    const count = (delta: Obligation["gdprDelta"]) => results.filter((r) => r.obligation.gdprDelta === delta).length;
    jurisdictions.push({
      jurisdiction: j.id,
      name: j.name,
      role: entity.role,
      results,
      deltaCounts: { covered: count("covered"), partial: count("partial"), new: count("new") },
      lastReviewed: j.lastReviewed,
    });
  });

  const openQuestions: OpenQuestion[] = [...seeds.values()]
    .map((seed) => {
      const obligationIds = [...affected.get(seed.id)!].sort(byString);
      const hit = jurisdictions.filter((jr) => jr.results.some((r) => obligationIds.includes(r.obligation.id))).map((jr) => jr.jurisdiction);
      return { ...seed, obligationIds, jurisdictions: hit as JurisdictionId[], impact: obligationIds.length, priority: false };
    })
    .sort((a, b) => b.impact - a.impact || byString(a.id, b.id));
  openQuestions.forEach((q, i) => (q.priority = i < PRIORITY_QUESTIONS && q.impact > 0));

  const all = jurisdictions.flatMap((jr) => jr.results);
  const byCategory: Partial<Record<ObligationCategory, number>> = {};
  for (const r of all) byCategory[r.obligation.category] = (byCategory[r.obligation.category] ?? 0) + 1;

  const covered = new Set<string>(kb.map((j) => j.id));
  const hq = intake.company.hqCountry;
  const hqAssessed = hq === "US" ? intake.footprint.entities.some((e) => e.role === "hq") : covered.has(hq);
  const notAssessed = [
    ...(hqAssessed ? [] : [`${hq} (headquarters)`]),
    ...intake.footprint.otherCountries.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean),
  ];

  return {
    assessmentDate,
    gdprBaseline: intake.company.gdprBaseline === "yes",
    jurisdictions,
    notAssessed,
    openQuestions,
    summary: {
      obligations: all.length,
      assumed: all.filter((r) => r.applicability === "assumed").length,
      openQuestions: openQuestions.length,
      byDelta: {
        covered: all.filter((r) => r.obligation.gdprDelta === "covered").length,
        partial: all.filter((r) => r.obligation.gdprDelta === "partial").length,
        new: all.filter((r) => r.obligation.gdprDelta === "new").length,
      },
      byCategory,
    },
  };
}
