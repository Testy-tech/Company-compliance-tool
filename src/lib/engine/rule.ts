import jsonLogic from "json-logic-js";

import { buildContext } from "@/lib/kb/facts";
import { collectComparisons, walkRule, type Comparison } from "@/lib/kb/rules";
import type { JsonLogic } from "@/lib/kb/schema";

import { derivedFacts, type BaseFacts, type Scalar } from "./derive";

/*
 * Evaluate one applicability rule over every possible value of the facts that
 * are not exact (Phase 3 addendum, section D):
 *   true for every combination  → "applies"
 *   false for every combination → "excluded"
 *   otherwise                   → "mixed", with the facts the outcome hinges on
 * Because a mixed rule is reported (as "assumed"), an exemption that depends on
 * an unresolved answer never removes an obligation.
 */

/** Stand-in for "no upper limit" when picking a point in an open-ended range. */
const BIG = 1e15;

/** The values of a fact under which the rule applies, relative to those under which it does not. */
export type Condition =
  | { kind: "atLeast"; n: number; thresholdId?: string }
  | { kind: "below"; n: number; thresholdId?: string }
  | { kind: "between"; min: number; max: number }
  | { kind: "is"; values: Scalar[] }
  | { kind: "unspecified" };

export type Pivot = {
  /** Fact as the rule references it (may be a derived fact such as a total). */
  fact: string;
  /** The non-exact answers behind it. */
  sources: string[];
  condition: Condition;
};

/**
 * Answered threshold questions ("is the total 100,000 or more?"), per fact:
 * the value is kept on the answered side of each threshold.
 */
export type Clamps = Record<string, { n: number; atLeast: boolean }[]>;

export type RuleOutcome = { status: "applies" | "excluded" } | { status: "mixed"; pivots: Pivot[] };

const uniqueSorted = (xs: string[]) => [...new Set(xs)].sort();
const depsOf = (path: string) => derivedFacts[path]?.deps ?? [path];

/** Points to test for a non-exact fact: range edges plus both sides of every threshold inside the range. */
function candidates(path: string, facts: BaseFacts, comparisons: Comparison[]): Scalar[] {
  const f = facts[path]!;
  if (f.kind === "options") return f.values;
  if (f.kind === "exact") return [f.value];
  const max = Number.isFinite(f.max) ? f.max : BIG;
  const points = new Set([f.min, max]);
  for (const c of comparisons)
    if (c.fact === path && c.boundary !== undefined && c.boundary > f.min && c.boundary <= max) {
      points.add(c.boundary - 1);
      points.add(c.boundary);
    }
  return [...points].sort((a, b) => a - b);
}

/**
 * @param logic       rule with { threshold } references already replaced by amounts
 * @param rawLogic    the rule as written, to recover which threshold a boundary came from
 */
export function evaluateRule(logic: JsonLogic, rawLogic: JsonLogic, facts: BaseFacts, clamps: Clamps = {}): RuleOutcome {
  const vars = uniqueSorted(walkRule(logic).vars);
  const comparisons = collectComparisons(logic);
  const rawComparisons = collectComparisons(rawLogic);

  const base = uniqueSorted(vars.flatMap(depsOf));
  const open = base.filter((p) => facts[p] && facts[p].kind !== "exact");
  const openVars = vars.filter((v) => depsOf(v).some((d) => open.includes(d)));
  const points = open.map((p) => candidates(p, facts, comparisons));

  // Fixed part of the context; open facts are filled in per combination.
  const current: Record<string, Scalar> = {};
  for (const p of base) {
    const f = facts[p];
    current[p] = f?.kind === "exact" ? f.value : null;
  }
  const get = (p: string) => current[p] ?? null;

  const rows: { values: Scalar[]; result: boolean }[] = [];
  const index = open.map(() => 0);
  for (;;) {
    open.forEach((p, i) => (current[p] = points[i]![index[i]!]!));
    const flat: Record<string, Scalar> = {};
    for (const v of vars) {
      let value = derivedFacts[v] ? derivedFacts[v].compute(get) : get(v);
      if (typeof value === "number")
        for (const c of clamps[v] ?? []) value = c.atLeast ? Math.max(value, c.n) : Math.min(value, c.n - 1);
      flat[v] = value;
    }
    const result = Boolean(jsonLogic.apply(logic as never, buildContext(flat as Record<string, string | number | boolean>)));
    rows.push({ values: openVars.map((v) => flat[v]!), result });

    // advance the odometer
    let i = 0;
    for (; i < open.length; i++) {
      index[i] = index[i]! + 1;
      if (index[i]! < points[i]!.length) break;
      index[i] = 0;
    }
    if (i === open.length) break;
  }

  if (rows.every((r) => r.result)) return { status: "applies" };
  if (rows.every((r) => !r.result)) return { status: "excluded" };

  // A fact is pivotal if changing it alone flips the result for some values of the other facts.
  const pivots: Pivot[] = [];
  openVars.forEach((v, vi) => {
    const groups = new Map<string, { whenTrue: Scalar[]; whenFalse: Scalar[] }>();
    for (const r of rows) {
      const key = JSON.stringify(r.values.filter((_, i) => i !== vi));
      const g = groups.get(key) ?? { whenTrue: [], whenFalse: [] };
      (r.result ? g.whenTrue : g.whenFalse).push(r.values[vi]!);
      groups.set(key, g);
    }
    const boundaries = comparisons.flatMap((c, i) =>
      c.fact === v && c.boundary !== undefined ? [{ n: c.boundary, thresholdId: rawComparisons[i]?.thresholdId }] : [],
    );
    const conditions = [...groups.values()]
      .filter((g) => g.whenTrue.length && g.whenFalse.length)
      .map((g) => describe(g.whenTrue, g.whenFalse, boundaries));
    if (!conditions.length) return;
    pivots.push({ fact: v, sources: depsOf(v).filter((d) => open.includes(d)), condition: combine(conditions) });
  });

  // Correlated facts can hide each other; fall back to naming every open fact.
  if (!pivots.length)
    for (const v of openVars) pivots.push({ fact: v, sources: depsOf(v).filter((d) => open.includes(d)), condition: { kind: "unspecified" } });

  return { status: "mixed", pivots };
}

/**
 * The fact may matter in different ways depending on the other open facts.
 * Report the condition under which the rule applies whichever of those holds.
 */
function combine(conditions: Condition[]): Condition {
  const first = conditions[0]!;
  if (conditions.every((c) => JSON.stringify(c) === JSON.stringify(first))) return first;
  if (conditions.every((c) => c.kind === "atLeast")) return conditions.reduce((a, b) => (b.kind === "atLeast" && a.kind === "atLeast" && b.n > a.n ? b : a));
  if (conditions.every((c) => c.kind === "below")) return conditions.reduce((a, b) => (b.kind === "below" && a.kind === "below" && b.n < a.n ? b : a));
  if (conditions.every((c) => c.kind === "is")) {
    const sets = conditions.map((c) => (c.kind === "is" ? c.values : []));
    const common = sets[0]!.filter((v) => sets.every((s) => s.includes(v)));
    if (common.length) return { kind: "is", values: common };
  }
  return { kind: "unspecified" };
}

function describe(whenTrue: Scalar[], whenFalse: Scalar[], boundaries: { n: number; thresholdId?: string }[]): Condition {
  if (typeof whenTrue[0] !== "number") {
    const only = [...new Set(whenTrue)].filter((v) => !whenFalse.includes(v));
    const values = only.length ? only : [...new Set(whenTrue)];
    return { kind: "is", values: values.sort((a, b) => String(a).localeCompare(String(b))) };
  }
  const t = whenTrue as number[];
  const f = whenFalse as number[];
  const tMin = Math.min(...t);
  const tMax = Math.max(...t);
  const below = f.filter((x) => x < tMin);
  const above = f.filter((x) => x > tMax);
  if (below.length + above.length !== f.length) return { kind: "unspecified" };
  /** The legal threshold between a false value and a true value, if the rule states one. */
  const cut = (lo: number, hi: number) => boundaries.find((b) => b.n > lo && b.n <= hi) ?? { n: hi };
  if (below.length && !above.length) return { kind: "atLeast", ...cut(Math.max(...below), tMin) };
  if (above.length && !below.length) return { kind: "below", ...cut(tMax, Math.min(...above)) };
  return { kind: "between", min: cut(Math.max(...below), tMin).n, max: cut(tMax, Math.min(...above)).n - 1 };
}
