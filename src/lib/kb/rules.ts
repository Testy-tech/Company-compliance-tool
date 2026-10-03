import type { JsonLogic, Threshold } from "./schema";

/*
 * Helpers for applicability rules (JsonLogic plus one extension):
 *   { "threshold": "US-CA-CCPA_REVENUE" }  → replaced by the monetary amount in effect.
 * Shared by the KB validator, the band-alignment test and the engine.
 */

export const JSONLOGIC_OPS = new Set([
  "var", "missing", "missing_some", "if", "==", "===", "!=", "!==", "!", "!!",
  "or", "and", ">", ">=", "<", "<=", "max", "min", "+", "-", "*", "/", "%",
  "in", "cat", "substr", "merge", "map", "filter", "reduce", "all", "none", "some",
]);
export const EXTENSION_OPS = new Set(["threshold"]);

const COMPARISON_OPS = new Set([">", ">=", "<", "<="]);

/** The threshold entry in effect on `onDate` (latest effectiveDate ≤ onDate). */
export function thresholdInEffect(thresholds: readonly Threshold[], id: string, onDate: string): Threshold | undefined {
  return thresholds
    .filter((t) => t.id === id && t.effectiveDate <= onDate)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
}

/** Replace every { threshold: id } with its numeric amount. Throws on unknown ids. */
export function resolveThresholds(logic: JsonLogic, thresholds: readonly Threshold[], onDate: string): JsonLogic {
  if (Array.isArray(logic)) return logic.map((l) => resolveThresholds(l, thresholds, onDate));
  if (logic && typeof logic === "object") {
    const entries = Object.entries(logic);
    if (entries.length === 1 && entries[0]![0] === "threshold") {
      const id = entries[0]![1];
      const t = typeof id === "string" ? thresholdInEffect(thresholds, id, onDate) : undefined;
      if (!t) throw new Error(`No threshold "${String(id)}" in effect on ${onDate}`);
      return t.amount;
    }
    return Object.fromEntries(entries.map(([op, arg]) => [op, resolveThresholds(arg, thresholds, onDate)]));
  }
  return logic;
}

export type RuleWalk = { vars: string[]; unknownOps: string[]; thresholdIds: string[] };

export function walkRule(logic: JsonLogic, acc: RuleWalk = { vars: [], unknownOps: [], thresholdIds: [] }): RuleWalk {
  if (Array.isArray(logic)) logic.forEach((l) => walkRule(l, acc));
  else if (logic && typeof logic === "object") {
    for (const [op, arg] of Object.entries(logic)) {
      if (op === "var") {
        const path = Array.isArray(arg) ? arg[0] : arg;
        if (typeof path === "string") acc.vars.push(path);
      } else if (op === "threshold") {
        if (typeof arg === "string") acc.thresholdIds.push(arg);
      } else {
        if (!JSONLOGIC_OPS.has(op)) acc.unknownOps.push(op);
        walkRule(arg, acc);
      }
    }
  }
  return acc;
}

/** A comparison between a fact and a constant, normalised to "fact ≥ boundary" semantics. */
export type Comparison = {
  fact: string;
  op: ">" | ">=" | "<" | "<=";
  /** Numeric literal, or undefined when the constant is a threshold reference. */
  value?: number;
  thresholdId?: string;
  /** Smallest value for which "fact ≥ boundary" flips — i.e. the band boundary the rule needs. */
  boundary?: number;
};

/** Every var-vs-constant comparison in a rule (either operand order). */
export function collectComparisons(logic: JsonLogic, out: Comparison[] = []): Comparison[] {
  if (Array.isArray(logic)) logic.forEach((l) => collectComparisons(l, out));
  else if (logic && typeof logic === "object") {
    for (const [op, arg] of Object.entries(logic)) {
      if (COMPARISON_OPS.has(op) && Array.isArray(arg) && arg.length === 2) {
        const [a, b] = arg as [JsonLogic, JsonLogic];
        const varOf = (x: JsonLogic) =>
          x && typeof x === "object" && !Array.isArray(x) && "var" in x && typeof x.var === "string" ? x.var : undefined;
        const constOf = (x: JsonLogic) =>
          typeof x === "number"
            ? { value: x }
            : x && typeof x === "object" && !Array.isArray(x) && typeof x.threshold === "string"
              ? { thresholdId: x.threshold }
              : undefined;
        let fact = varOf(a);
        let c = constOf(b);
        let o = op as Comparison["op"];
        if (!fact) {
          // constant on the left: flip the operator
          fact = varOf(b);
          c = constOf(a);
          o = ({ ">": "<", ">=": "<=", "<": ">", "<=": ">=" } as const)[o];
        }
        if (fact && c) {
          const boundary =
            c.value === undefined ? undefined : o === ">=" || o === "<" ? c.value : c.value + 1;
          out.push({ fact, op: o, ...c, boundary });
        }
      }
      if (op !== "var" && op !== "threshold") collectComparisons(arg, out);
    }
  }
  return out;
}
