import { factsByPath } from "./facts";
import { thresholdInEffect } from "./rules";
import type { JsonLogic, Threshold } from "./schema";

/*
 * An applicability rule as a plain-English sentence, for reviewers:
 *   "type of entity in China is one of: subsidiary, branch AND (… ≥ 1,000,000 OR … = yes)"
 * Uses the labels of the fact registry. Anything it does not recognise is
 * shown as JSON rather than guessed at.
 */

export type DescribeOptions = { country: string; thresholds?: readonly Threshold[]; onDate?: string };

const SYMBOLS: Record<string, string> = { ">": ">", ">=": "≥", "<": "<", "<=": "≤", "==": "=", "===": "=", "!=": "≠", "!==": "≠" };
const number = (n: number) => new Intl.NumberFormat("en-GB").format(n);
const isObject = (l: JsonLogic): l is { [op: string]: JsonLogic } => l !== null && typeof l === "object" && !Array.isArray(l);
const single = (l: JsonLogic): [string, JsonLogic] | undefined => (isObject(l) && Object.keys(l).length === 1 ? Object.entries(l)[0] : undefined);
const varPath = (l: JsonLogic): string | undefined => {
  const entry = single(l);
  if (entry?.[0] !== "var") return undefined;
  const path = Array.isArray(entry[1]) ? entry[1][0] : entry[1];
  return typeof path === "string" ? path : undefined;
};

export function describeRule(logic: JsonLogic, options: DescribeOptions): string {
  const label = (path: string) => (factsByPath.get(path)?.label ?? path).replaceAll("{country}", options.country);

  /** A constant, formatted for the fact it is compared with. */
  const value = (l: JsonLogic, path?: string): string => {
    const fact = path ? factsByPath.get(path) : undefined;
    const entry = single(l);
    if (entry?.[0] === "threshold" && typeof entry[1] === "string") {
      const t = options.thresholds && thresholdInEffect(options.thresholds, entry[1], options.onDate ?? new Date().toISOString().slice(0, 10));
      return t ? `${t.currency} ${number(t.amount)} (threshold ${entry[1]}, in effect from ${t.effectiveDate})` : `threshold ${entry[1]}`;
    }
    const other = varPath(l);
    if (other) return label(other);
    if (typeof l === "number") return fact?.kind === "money" ? `${fact.currency} ${number(l)}` : number(l);
    if (typeof l === "boolean") return l ? "yes" : "no";
    if (typeof l === "string") return l.replaceAll("_", " ");
    if (Array.isArray(l)) return l.map((x) => value(x, path)).join(", ");
    return JSON.stringify(l);
  };

  const describe = (l: JsonLogic, parent?: "and" | "or"): string => {
    if (typeof l === "boolean") return l ? "always" : "never";
    const path = varPath(l);
    if (path) return `${label(path)} = yes`;
    const entry = single(l);
    if (!entry) return JSON.stringify(l);
    const [op, arg] = entry;
    const args = Array.isArray(arg) ? arg : [arg];

    if (op === "and" || op === "or") {
      if (args.length === 1) return describe(args[0]!, parent);
      const text = args.map((a) => describe(a, op)).join(op === "and" ? " AND " : " OR ");
      return parent && parent !== op ? `(${text})` : text;
    }
    if (op === "!" && args.length === 1) {
      const negated = varPath(args[0]!);
      return negated ? `${label(negated)} = no` : `NOT (${describe(args[0]!)})`;
    }
    if (op === "!!" && args.length === 1) return describe(args[0]!, parent);
    if (op in SYMBOLS && args.length === 2) {
      const [a, b] = args as [JsonLogic, JsonLogic];
      const left = varPath(a);
      if (left) return `${label(left)} ${SYMBOLS[op]} ${value(b, left)}`;
      const right = varPath(b);
      // constant on the left: keep the order, the symbol reads the same way
      return `${value(a, right)} ${SYMBOLS[op]} ${right ? label(right) : value(b)}`;
    }
    if (op === "in" && args.length === 2) {
      const [a, b] = args as [JsonLogic, JsonLogic];
      const left = varPath(a);
      if (left && Array.isArray(b)) return b.length === 1 ? `${label(left)} = ${value(b[0]!, left)}` : `${label(left)} is one of: ${value(b, left)}`;
      const list = varPath(b);
      if (list) return `${label(list)} includes ${value(a, list)}`;
    }
    return JSON.stringify(l);
  };

  return describe(logic);
}
