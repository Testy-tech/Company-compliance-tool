import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { bandBoundaries, bandSets, type BandSetId } from "@/lib/intake/bands";
import { bandStraddles, type FxTable, type MoneyThreshold } from "@/lib/intake/money";

import { factsByPath } from "./facts";
import { collectComparisons, thresholdInEffect } from "./rules";
import { jurisdictionSchema, type Jurisdiction } from "./schema";

/*
 * Band / threshold alignment (Phase 3 addendum, section B).
 * Every numeric threshold a KB rule compares a fact with must be decidable from
 * a band answer: count thresholds sit exactly on a band boundary; monetary
 * thresholds are dated KB data, and any EUR band that straddles one is listed
 * in content/config/revenue-straddles.json.
 */

const content = path.join(process.cwd(), "content");
const readJson = (...p: string[]) => JSON.parse(readFileSync(path.join(content, ...p), "utf8"));

const kb: Jurisdiction[] = readdirSync(path.join(content, "jurisdictions"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => jurisdictionSchema.parse(readJson("jurisdictions", f)));

const fx = readJson("config", "fx.json") as FxTable;
const allowlist = readJson("config", "revenue-straddles.json") as { straddles: { thresholdId: string; bands: string[] }[] };
const today = new Date().toISOString().slice(0, 10);

const comparisons = kb.flatMap((j) =>
  j.obligations.flatMap((o) => collectComparisons(o.appliesIf).map((c) => ({ j, where: `${j.id}:${o.id}`, ...c }))),
);

describe("answer bands", () => {
  it.each(Object.keys(bandSets) as BandSetId[])("%s bands are contiguous and start at 0", (set) => {
    const { bands } = bandSets[set];
    expect(bands[0]?.min).toBe(0);
    bands.forEach((b, i) => {
      const next = bands[i + 1];
      if (next) expect(next.min, `${set}: gap or overlap after "${b.id}"`).toBe((b.max ?? NaN) + 1);
      else expect(b.max, `${set}: last band must be open-ended`).toBeNull();
    });
  });
});

describe("KB thresholds align with bands", () => {
  it("finds numeric comparisons to check", () => {
    expect(comparisons.length).toBeGreaterThan(0);
  });

  it("every compared fact is a declared count or money fact", () => {
    const bad = comparisons.filter((c) => !["count", "money"].includes(factsByPath.get(c.fact)?.kind ?? ""));
    expect(bad.map((c) => `${c.where} ${c.fact}`)).toEqual([]);
  });

  it("every count threshold falls exactly on a band boundary", () => {
    const misaligned: string[] = [];
    for (const c of comparisons) {
      const fact = factsByPath.get(c.fact);
      if (fact?.kind !== "count") continue;
      if (c.boundary === undefined) misaligned.push(`${c.where}: ${c.fact} must be compared with a literal number`);
      else if (!bandBoundaries(fact.bandSet).includes(c.boundary))
        misaligned.push(`${c.where}: ${c.fact} ${c.op} ${c.value} needs a "${fact.bandSet}" band starting at ${c.boundary}`);
    }
    expect(misaligned).toEqual([]);
  });

  it("monetary thresholds are dated KB data, never literals in rules", () => {
    const literals = comparisons.filter((c) => factsByPath.get(c.fact)?.kind === "money" && !c.thresholdId);
    expect(literals.map((c) => `${c.where} ${c.fact} ${c.op} ${c.value}`)).toEqual([]);
  });

  it("revenue bands that straddle a monetary threshold match the documented allowlist", () => {
    const computed = new Map<string, string[]>();
    for (const c of comparisons) {
      if (!c.thresholdId || computed.has(c.thresholdId)) continue;
      const t = thresholdInEffect(c.j.thresholds, c.thresholdId, today);
      expect(t, `${c.where}: threshold ${c.thresholdId} not in effect on ${today}`).toBeDefined();
      const threshold = { ...t!, jurisdiction: c.j.id, fact: c.fact } as MoneyThreshold;
      computed.set(
        c.thresholdId,
        bandSets.revenueEUR.bands.filter((b) => bandStraddles(b.id, threshold, fx)).map((b) => b.id),
      );
    }
    const documented = new Map(allowlist.straddles.map((s) => [s.thresholdId, s.bands]));
    expect(Object.fromEntries(computed)).toEqual(Object.fromEntries(documented));
  });
});
