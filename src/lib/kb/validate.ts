import jsonLogic from "json-logic-js";

import { buildContext, facts, factPaths, type EvaluationContext } from "./facts";
import { resolveThresholds, walkRule } from "./rules";
import { jurisdictionSchema, type Jurisdiction } from "./schema";

/* Cross-field checks that zod alone cannot express. Pure: used by the build
 * script and by unit tests. */

export type Issue = { level: "error" | "warning"; where: string; message: string };

/** A neutral context used to smoke-test that every rule evaluates without throwing. */
export const smokeContext: EvaluationContext = buildContext(
  Object.fromEntries(
    facts.map((f) => [
      f.path,
      f.kind === "bool" ? true
        : f.kind === "count" ? 1000
        : f.kind === "money" ? 1e9
        : f.kind === "enum" ? f.values[0]!
        : "XX",
    ]),
  ),
);

export function validateJurisdiction(
  raw: unknown,
  fileId: string,
  today = new Date().toISOString().slice(0, 10),
): { data?: Jurisdiction; issues: Issue[] } {
  const issues: Issue[] = [];
  const parsed = jurisdictionSchema.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues)
      issues.push({ level: "error", where: `${fileId}:${i.path.join(".")}`, message: i.message });
    return { issues };
  }
  const j = parsed.data;
  if (j.id !== fileId) issues.push({ level: "error", where: fileId, message: `id "${j.id}" does not match file name` });
  if (j.lastReviewed > today) issues.push({ level: "error", where: fileId, message: "lastReviewed is in the future" });

  const official = j.officialDomains;
  const isOfficial = (u: string) => {
    const host = new URL(u).hostname;
    return official.some((d) => host === d || host.endsWith(`.${d}`));
  };
  for (const law of j.laws)
    if (!isOfficial(law.officialUrl))
      issues.push({ level: "warning", where: `${fileId}:laws`, message: `non-official URL for ${law.shortName}: ${law.officialUrl}` });

  for (const d of j.definedTerms)
    if (!isOfficial(d.source.url))
      issues.push({ level: "warning", where: `${fileId}:definedTerms`, message: `non-official source for "${d.term}": ${d.source.url}` });

  const thresholdIds = new Set(j.thresholds.map((t) => t.id));
  for (const t of j.thresholds) {
    if (!t.id.startsWith(`${j.id}-`)) issues.push({ level: "error", where: `${fileId}:thresholds`, message: `threshold id "${t.id}" must start with "${j.id}-"` });
    if (t.currency !== "USD") issues.push({ level: "error", where: `${fileId}:thresholds`, message: `threshold ${t.id}: only USD is supported by money facts` });
  }

  const groups = new Map<string, number[]>();
  const seen = new Set<string>();
  for (const o of j.obligations) {
    const where = `${fileId}:${o.id}`;
    if (seen.has(o.id)) issues.push({ level: "error", where, message: "duplicate obligation id" });
    seen.add(o.id);
    if (!o.id.startsWith(`${j.id}-`)) issues.push({ level: "error", where, message: `id must start with "${j.id}-"` });
    if (o.lastVerified > today) issues.push({ level: "error", where, message: "lastVerified is in the future" });
    if (o.confidence === "verified" && /claude|automated|research/i.test(o.verifiedBy))
      issues.push({ level: "error", where, message: "confidence 'verified' is reserved for counsel review" });
    if (o.gdprDelta !== "new" && !o.gdprEquivalent)
      issues.push({ level: "error", where, message: "covered/partial obligations must name a gdprEquivalent" });

    if (o.exclusiveGroup) {
      if (o.strictness === undefined) issues.push({ level: "error", where, message: "exclusiveGroup requires strictness" });
      else groups.set(o.exclusiveGroup, [...(groups.get(o.exclusiveGroup) ?? []), o.strictness]);
    } else if (o.strictness !== undefined) {
      issues.push({ level: "error", where, message: "strictness without exclusiveGroup" });
    }

    const walk = walkRule(o.appliesIf);
    for (const op of walk.unknownOps) issues.push({ level: "error", where, message: `unknown JsonLogic operator "${op}"` });
    for (const v of walk.vars) if (!factPaths.has(v)) issues.push({ level: "error", where, message: `appliesIf references unknown fact "${v}"` });
    for (const id of walk.thresholdIds) if (!thresholdIds.has(id)) issues.push({ level: "error", where, message: `unknown threshold "${id}"` });

    try {
      const logic = resolveThresholds(o.appliesIf, j.thresholds, today);
      const r = jsonLogic.apply(logic as never, smokeContext);
      if (typeof r !== "boolean")
        issues.push({ level: "error", where, message: `appliesIf must evaluate to a boolean, got ${JSON.stringify(r)}` });
    } catch (e) {
      issues.push({ level: "error", where, message: `appliesIf failed to evaluate: ${String(e)}` });
    }

    const officialCount = o.sources.filter((s) => isOfficial(s.url)).length;
    if (officialCount === 0)
      issues.push({ level: o.confidence === "unverified" ? "warning" : "error", where, message: "no official source; mark unverified or add one" });
  }
  for (const [g, s] of groups) {
    if (s.length < 2) issues.push({ level: "error", where: `${fileId}:${g}`, message: "exclusiveGroup needs at least two tiers" });
    if (new Set(s).size !== s.length) issues.push({ level: "error", where: `${fileId}:${g}`, message: "strictness values in a group must be unique" });
  }
  return { data: j, issues };
}
