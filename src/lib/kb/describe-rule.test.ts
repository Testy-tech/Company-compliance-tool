import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { describeRule } from "./describe-rule";
import { jurisdictionSchema, type JsonLogic, type Threshold } from "./schema";

const cn = { country: "China" };

describe("describeRule", () => {
  it("writes a rule as a sentence with fact labels, AND/OR and brackets", () => {
    const rule: JsonLogic = {
      and: [
        { in: [{ var: "j.entityType" }, ["subsidiary", "branch", "rep_office"]] },
        { or: [{ ">=": [{ var: "j.transfers.nonSensitive" }, 1000000] }, { var: "j.cn.ciio" }] },
      ],
    };
    const text = describeRule(rule, cn);
    expect(text).toMatch(/^type of entity in China is one of: subsidiary, branch, rep office AND \(number of individuals whose non-sensitive data China sends abroad per year ≥ 1,000,000 OR .+ = yes\)$/);
  });

  it("handles negation, inequality, single-value lists and literals", () => {
    expect(describeRule({ "!": { var: "j.cn.ciio" } }, cn)).toMatch(/ = no$/);
    expect(describeRule({ "!=": [{ var: "j.transfers.hrOnly" }, "only_hr"] }, cn)).toBe("whether data sent abroad from China is only HR data ≠ only hr");
    expect(describeRule({ in: [{ var: "j.entityType" }, ["subsidiary"]] }, cn)).toBe("type of entity in China = subsidiary");
    expect(describeRule({ "!": { and: [{ var: "j.cn.ciio" }, { ">": [{ var: "j.transfers.sensitive" }, 0] }] } }, cn)).toMatch(/^NOT \(.+ AND .+ > 0\)$/);
    expect(describeRule(true, cn)).toBe("always");
  });

  it("shows the monetary threshold in effect on the given date, or its id when none is", () => {
    const base = { description: "Revenue threshold", currency: "USD" as const, source: { url: "https://example.gov/x", pinpoint: "s. 1" }, confidence: "needs_review" as const };
    const thresholds: Threshold[] = [
      { ...base, id: "US-CA-CCPA_REVENUE", amount: 25000000, effectiveDate: "2023-01-01" },
      { ...base, id: "US-CA-CCPA_REVENUE", amount: 26625000, effectiveDate: "2025-01-01" },
    ];
    const rule: JsonLogic = { ">=": [{ var: "group.revenueUSD" }, { threshold: "US-CA-CCPA_REVENUE" }] };
    expect(describeRule(rule, { country: "California", thresholds, onDate: "2026-10-04" })).toBe("worldwide annual revenue of the group ≥ USD 26,625,000 (threshold US-CA-CCPA_REVENUE, in effect from 2025-01-01)");
    expect(describeRule(rule, { country: "California", thresholds, onDate: "2024-06-01" })).toContain("USD 25,000,000");
    expect(describeRule(rule, { country: "California" })).toBe("worldwide annual revenue of the group ≥ threshold US-CA-CCPA_REVENUE");
  });

  it("falls back to JSON for shapes it does not know, instead of guessing", () => {
    expect(describeRule({ some: [{ var: "j.id" }, true] }, cn)).toBe('{"some":[{"var":"j.id"},true]}');
  });

  it("describes every rule in the knowledge base without falling back to JSON or a raw fact path", () => {
    const dir = path.join(process.cwd(), "content", "jurisdictions");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const j = jurisdictionSchema.parse(JSON.parse(readFileSync(path.join(dir, file), "utf8")));
      for (const o of j.obligations) {
        const text = describeRule(o.appliesIf, { country: j.name, thresholds: j.thresholds, onDate: "2026-10-04" });
        expect(text, o.id).not.toMatch(/[{}]|\bj\.[a-z]|"var"/);
      }
    }
  });
});
