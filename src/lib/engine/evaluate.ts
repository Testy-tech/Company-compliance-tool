import { formatUSD, type FxTable } from "@/lib/intake/money";
import { consentBannerLabels, employeeRepLabels, hrOnlyLabels } from "@/lib/intake/options";
import { anchorId, copy, type QuestionId } from "@/lib/intake/questions";
import type { Assessment } from "@/lib/intake/schema";
import { facts as factRegistry, factsByPath, type FactDef } from "@/lib/kb/facts";
import { resolveThresholds, thresholdInEffect } from "@/lib/kb/rules";
import type { Jurisdiction, JurisdictionId, Obligation, ObligationCategory } from "@/lib/kb/schema";

import { deriveBaseFacts, derivedFacts, type BaseFacts, type DeriveContext, type FactValue, type Scalar } from "./derive";
import { governanceFindings } from "./governance";
import { evaluateRule, type Clamps, type Condition, type Pivot, type RuleOutcome } from "./rule";
import type { Alternative, Assumption, JurisdictionReport, ObligationResult, OpenQuestion, PenaltyExposure, Report, SubAnswer } from "./types";

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
const isUnresolved = (v: FactValue | undefined) => !!v && (v.kind === "options" || (v.kind === "range" && v.unresolved));

/** Key under which a report threshold answer is stored in intake.thresholdAnswers. */
export const thresholdKey = (fact: string, jurisdiction: string, n: number) => `${fact}|${jurisdiction}|${n}`;

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

const labelOf = (fact: string, country: string) => (factsByPath.get(fact)?.label ?? fact).replaceAll("{country}", country);

/** "{label} is at least 1,000,000" — shared by assumption sentences and "may apply instead if…" conditions. */
function describePivot(p: Pivot, country: string): { value: string; text: string } {
  const { value, text } = phrase(factsByPath.get(p.fact), p.fact, p.condition);
  const label = labelOf(p.fact, country);
  return { value, text: text.startsWith(":") ? `${label}${text}` : `${label} ${text}` };
}

/** How a fact's current answer reads in a grouped question. */
function answerText(fact: string, v: FactValue | undefined): string {
  if (!v) return "Not asked";
  if (isUnresolved(v)) return "Don't know";
  if (v.kind === "range") return `${number(v.min)}–${Number.isFinite(v.max) ? number(v.max) : "more"}`;
  if (v.kind === "exact") {
    if (typeof v.value === "number") return number(v.value);
    if (typeof v.value === "boolean") return v.value ? "Yes" : "No";
    return v.value === null ? "Not applicable" : optionLabels[fact]?.[v.value] ?? v.value;
  }
  return "Don't know";
}

/* ── Open questions ───────────────────────────────────────────────────────── */

type QuestionSeed = Omit<OpenQuestion, "obligationIds" | "jurisdictions" | "impact" | "priority"> & {
  /** Answers this question settles, as "<jurisdiction or *>|<fact>". */
  covers: string[];
};

const perCountry = (def: FactDef) => def.path.startsWith("j.") && def.scope !== "group";
const coverKey = (def: FactDef, j: Jurisdiction) => `${perCountry(def) ? j.id : "*"}|${def.path}`;

/** The wizard question behind one unresolved answer. */
function answerQuestion(source: string, j: Jurisdiction): QuestionSeed | undefined {
  const def = factsByPath.get(source);
  if (!def?.questionId) return undefined;
  const qid = def.questionId as QuestionId;
  const scoped = perCountry(def);
  const vars = { country: j.name };
  return {
    id: scoped ? `${qid}:${j.id}` : qid,
    kind: "unresolved",
    questionId: qid,
    facts: [source],
    jurisdiction: scoped ? j.id : undefined,
    question: (followUpByQuestion.get(qid) ?? copy(qid, vars).label).replaceAll("{country}", j.name),
    whyItMatters: copy(qid, vars).why,
    resolveHref: `/assess#${anchorId(qid, scoped ? j.id : undefined)}`,
    covers: [coverKey(def, j)],
  };
}

/** The open questions behind one fact that a result hinges on. */
function questionsFor(pivot: Pivot, facts: BaseFacts, j: Jurisdiction, thresholdAmount: DeriveContext["thresholdAmount"]): QuestionSeed[] {
  const unresolved = pivot.sources.filter((s) => isUnresolved(facts[s]) && factsByPath.get(s)?.questionId);
  const derived = derivedFacts[pivot.fact];
  const derivedDef = factsByPath.get(pivot.fact);

  // A total (or other derived fact) built from several unresolved answers: one grouped question.
  if (derived && derivedDef && new Set(unresolved.map((s) => factsByPath.get(s)!.questionId)).size > 1) {
    const first = factsByPath.get(unresolved[0]!)!;
    const subAnswers: SubAnswer[] = derived.deps.map((d) => ({
      fact: d,
      questionId: factsByPath.get(d)?.questionId ?? "",
      label: labelOf(d, j.name),
      answer: answerText(d, facts[d]),
      unresolved: isUnresolved(facts[d]),
    }));
    return [
      {
        id: `group:${pivot.fact}:${j.id}`,
        kind: "group",
        questionId: first.questionId!,
        facts: unresolved,
        jurisdiction: j.id,
        question: (derivedDef.followUp ?? `What is the ${derivedDef.label}?`).replaceAll("{country}", j.name),
        whyItMatters: copy(first.questionId as QuestionId, { country: j.name }).why,
        subAnswers,
        resolveHref: `/assess#${anchorId(first.questionId!, j.id)}`,
        covers: unresolved.map((s) => coverKey(factsByPath.get(s)!, j)),
      },
    ];
  }
  if (unresolved.length) return unresolved.flatMap((s) => answerQuestion(s, j) ?? []);

  // From here on every answer behind the fact is a known band, yet the result is not settled.
  const c = pivot.condition;
  const n = c.kind === "atLeast" || c.kind === "below" ? c.n : c.kind === "between" ? c.min : undefined;
  const def = factsByPath.get(pivot.sources[0] ?? pivot.fact);

  // Revenue band that straddles a monetary threshold: the wizard has a yes/no follow-up for it.
  if (def?.kind === "money" && (c.kind === "atLeast" || c.kind === "below") && c.thresholdId) {
    const amount = formatUSD(thresholdAmount(c.thresholdId) ?? c.n);
    return [
      {
        id: `revenue-above:${c.thresholdId}`,
        kind: "unresolved",
        questionId: "revenue-above",
        facts: [pivot.fact],
        question: copy("revenue-above", { amount }).label,
        whyItMatters: copy("revenue-above", { amount }).why,
        resolveHref: `/assess#${anchorId("revenue-above", c.thresholdId)}`,
        covers: [],
      },
    ];
  }

  // Bands that together straddle a count threshold: asked as a yes/no question in the report itself.
  const label = labelOf(pivot.fact, j.name);
  return [
    {
      id: `precision:${pivot.fact}:${j.id}:${n ?? "range"}`,
      kind: "precision",
      questionId: def?.questionId ?? "",
      facts: [pivot.fact],
      jurisdiction: j.id,
      question: n === undefined ? `Is it correct that the ${describePivot(pivot, j.name).text}?` : `Is the ${label} ${number(n)} or more?`,
      whyItMatters: "The answer bands you chose straddle a legal threshold, so the bands alone cannot settle it. A yes or no is enough.",
      threshold: n === undefined ? undefined : { key: thresholdKey(pivot.fact, j.id, n), fact: pivot.fact, n },
      covers: [],
    },
  ];
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

/** Answered report threshold questions for one jurisdiction. */
function clampsFor(answers: Assessment["intake"]["thresholdAnswers"], jurisdiction: string): Clamps {
  const clamps: Clamps = {};
  for (const key of Object.keys(answers).sort(byString)) {
    const [fact, j, n] = key.split("|");
    const answer = answers[key]!;
    if (!fact || j !== jurisdiction || answer.status !== "known" || !Number.isFinite(Number(n))) continue;
    (clamps[fact] ??= []).push({ n: Number(n), atLeast: answer.value });
  }
  return clamps;
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
    if (existing) {
      existing.facts = [...new Set([...existing.facts, ...seed.facts])].sort(byString);
      existing.covers = [...new Set([...existing.covers, ...seed.covers])];
    } else seeds.set(seed.id, seed);
    if (!affected.has(seed.id)) affected.set(seed.id, new Set());
    if (obligationId) affected.get(seed.id)!.add(obligationId);
  };

  const jurisdictions: JurisdictionReport[] = [];
  const assessed = [...kb].sort((a, b) => byString(a.id, b.id)).filter((j) => intake.footprint.entities.some((e) => e.jurisdiction === j.id));

  assessed.forEach((j, ji) => {
    const entity = intake.footprint.entities.find((e) => e.jurisdiction === j.id)!;
    const facts = deriveBaseFacts(intake, entity, { fx, thresholdAmount });
    const clamps = clampsFor(intake.thresholdAnswers, j.id);

    const evaluated: Evaluated[] = j.obligations.map((obligation) => ({
      obligation,
      outcome: evaluateRule(resolveThresholds(obligation.appliesIf, j.thresholds, assessmentDate), obligation.appliesIf, facts, clamps),
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
              const questions = questionsFor(pivot, facts, j, thresholdAmount);
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

    // Unresolved answers nothing hinges on are tracked too, so they can be listed separately.
    for (const path of Object.keys(facts).sort(byString)) {
      if (!factsByPath.get(path)?.resolvable || !isUnresolved(facts[path])) continue;
      const seed = answerQuestion(path, j);
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

  const all = jurisdictions.flatMap((jr) => jr.results);
  const jurisdictionOf = new Map(all.map((r) => [r.obligation.id, r.jurisdiction]));

  const ranked = [...seeds.values()].map((seed) => ({ seed, obligationIds: [...affected.get(seed.id)!].sort(byString) }));
  const openQuestions: OpenQuestion[] = ranked
    .filter((r) => r.obligationIds.length > 0)
    .map(({ seed, obligationIds }) => {
      const { covers, ...question } = seed;
      void covers;
      return {
        ...question,
        obligationIds,
        jurisdictions: [...new Set(obligationIds.map((id) => jurisdictionOf.get(id)!))].sort(byString) as JurisdictionId[],
        impact: obligationIds.length,
        priority: false,
      };
    })
    .sort((a, b) => b.impact - a.impact || byString(a.id, b.id));
  openQuestions.forEach((q, i) => (q.priority = i < PRIORITY_QUESTIONS));

  // Unresolved answers with no effect, unless an open question (e.g. a grouped one) already covers them.
  const covered = new Set(ranked.filter((r) => r.obligationIds.length > 0).flatMap((r) => r.seed.covers));
  const unansweredNoEffect = ranked
    .filter((r) => r.obligationIds.length === 0 && !r.seed.covers.every((c) => covered.has(c)))
    .map(({ seed }) => ({ id: seed.id, questionId: seed.questionId, jurisdiction: seed.jurisdiction, question: seed.question, resolveHref: seed.resolveHref }))
    .sort((a, b) => byString(a.id, b.id));

  const byCategory: Partial<Record<ObligationCategory, number>> = {};
  for (const r of all) byCategory[r.obligation.category] = (byCategory[r.obligation.category] ?? 0) + 1;

  const coveredIds = new Set<string>(kb.map((j) => j.id));
  const hq = intake.company.hqCountry;
  const hqAssessed = hq === "US" ? intake.footprint.entities.some((e) => e.role === "hq") : coveredIds.has(hq);
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
    unansweredNoEffect,
    governance: {
      model: intake.governance.model,
      localContacts: intake.governance.localContacts,
      findings: governanceFindings(all, intake.governance),
    },
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
