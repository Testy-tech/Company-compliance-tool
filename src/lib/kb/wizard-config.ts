import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { FxTable, MoneyThreshold } from "@/lib/intake/money";

import { knowledgeBase } from "./repository";
import { collectComparisons, thresholdInEffect } from "./rules";

/** Everything the (client-side) wizard needs from the KB and config, computed on the server. */
export type WizardConfig = {
  jurisdictions: { id: string; name: string }[];
  moneyThresholds: MoneyThreshold[];
  fx: FxTable;
  assessmentDate: string;
};

export async function getWizardConfig(assessmentDate = new Date().toISOString().slice(0, 10)): Promise<WizardConfig> {
  const [kb, fxRaw] = await Promise.all([
    knowledgeBase.list(),
    readFile(path.join(process.cwd(), "content", "config", "fx.json"), "utf8"),
  ]);

  const moneyThresholds: MoneyThreshold[] = [];
  for (const j of kb) {
    // Which money fact is each threshold compared with?
    const used = new Map<string, string>();
    for (const o of j.obligations)
      for (const c of collectComparisons(o.appliesIf))
        if (c.thresholdId) used.set(c.thresholdId, c.fact);
    for (const [id, fact] of used) {
      const t = thresholdInEffect(j.thresholds, id, assessmentDate);
      if (t && t.currency === "USD")
        moneyThresholds.push({ id, jurisdiction: j.id, fact, amount: t.amount, currency: "USD", description: t.description, effectiveDate: t.effectiveDate });
    }
  }

  return {
    jurisdictions: kb.map((j) => ({ id: j.id, name: j.name })),
    moneyThresholds,
    fx: JSON.parse(fxRaw) as FxTable,
    assessmentDate,
  };
}
