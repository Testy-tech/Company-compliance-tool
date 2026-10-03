import type { FxTable, MoneyThreshold } from "@/lib/intake/money";

import { collectComparisons, thresholdInEffect } from "./rules";
import type { Jurisdiction, Threshold } from "./schema";

/*
 * What the (client-side) wizard needs from the KB and config. The server sends
 * every dated threshold entry (`WizardSource`); the wizard then picks the
 * amounts in effect on the assessment's own `assessmentDate`.
 */

export type WizardSource = {
  jurisdictions: { id: string; name: string }[];
  /** Monetary thresholds used by rules, with all their dated entries. */
  thresholdSeries: { id: string; jurisdiction: string; fact: string; entries: Threshold[] }[];
  fx: FxTable;
};

export type WizardConfig = {
  jurisdictions: { id: string; name: string }[];
  moneyThresholds: MoneyThreshold[];
  fx: FxTable;
  assessmentDate: string;
};

export function wizardSource(kb: readonly Jurisdiction[], fx: FxTable): WizardSource {
  const thresholdSeries: WizardSource["thresholdSeries"] = [];
  for (const j of kb) {
    // Which money fact is each threshold compared with?
    const used = new Map<string, string>();
    for (const o of j.obligations)
      for (const c of collectComparisons(o.appliesIf))
        if (c.thresholdId) used.set(c.thresholdId, c.fact);
    for (const [id, fact] of used)
      thresholdSeries.push({ id, jurisdiction: j.id, fact, entries: j.thresholds.filter((t) => t.id === id && t.currency === "USD") });
  }
  return { jurisdictions: kb.map((j) => ({ id: j.id, name: j.name })), thresholdSeries, fx };
}

/** Resolve the thresholds in effect on the assessment date. */
export function wizardConfigAt(source: WizardSource, assessmentDate: string): WizardConfig {
  const moneyThresholds = source.thresholdSeries.flatMap((s) => {
    const t = thresholdInEffect(s.entries, s.id, assessmentDate);
    return t
      ? [{ id: s.id, jurisdiction: s.jurisdiction, fact: s.fact, amount: t.amount, currency: "USD" as const, description: t.description, effectiveDate: t.effectiveDate }]
      : [];
  });
  return { jurisdictions: source.jurisdictions, moneyThresholds, fx: source.fx, assessmentDate };
}
