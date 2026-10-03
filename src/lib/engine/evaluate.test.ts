import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { FxTable } from "@/lib/intake/money";
import type { Assessment } from "@/lib/intake/schema";
import { facts as factRegistry } from "@/lib/kb/facts";
import { jurisdictionSchema, type Jurisdiction } from "@/lib/kb/schema";

import { deriveBaseFacts, derivedFacts } from "./derive";
import { evaluate } from "./evaluate";
import { entityOf, referenceAssessment, referenceIntake } from "./fixtures";
import type { Report } from "./types";

const content = path.join(process.cwd(), "content");
const readJson = (...p: string[]) => JSON.parse(readFileSync(path.join(content, ...p), "utf8"));
const kb: Jurisdiction[] = readdirSync(path.join(content, "jurisdictions"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => jurisdictionSchema.parse(readJson("jurisdictions", f)));
const fx = readJson("config", "fx.json") as FxTable;

const known = <T,>(value: T) => ({ status: "known", value }) as const;
const unknown = { status: "unknown" } as const;

const run = (a: Assessment) => evaluate(a, kb, fx);
const result = (r: Report, id: string) => r.jurisdictions.flatMap((j) => j.results).find((x) => x.obligation.id === id);
const question = (r: Report, id: string) => r.openQuestions.find((q) => q.id === id);
const ids = (r: Report) => r.jurisdictions.flatMap((j) => j.results.map((x) => x.obligation.id));

describe("fact derivation", () => {
  it("derives every fact in the registry", () => {
    const intake = referenceIntake("unknown");
    const base = deriveBaseFacts(intake, entityOf(intake, "CN"), { fx, thresholdAmount: () => undefined });
    const missing = factRegistry.map((f) => f.path).filter((p) => !(p in base) && !(p in derivedFacts));
    expect(missing).toEqual([]);
  });
});

describe("1. all answers known", () => {
  const report = run(referenceAssessment("low"));

  it("has no assumptions and no open questions", () => {
    expect(report.summary.assumed).toBe(0);
    expect(report.openQuestions).toEqual([]);
    expect(report.jurisdictions.flatMap((j) => j.results).every((r) => r.applicability === "applies" && r.assumptions.length === 0)).toBe(true);
  });

  it("covers all ten jurisdictions and lists other countries as not assessed", () => {
    expect(report.jurisdictions.map((j) => j.jurisdiction)).toEqual(["CL", "CN", "DE", "IN", "IT", "KR", "PE", "SG", "US-CA", "US-TX"]);
    expect(report.notAssessed).toEqual(["Brazil", "Japan"]);
  });

  it("known low values exclude the China transfer tiers and CCPA items, but keep California breach notification", () => {
    expect(result(report, "CN-TRANSFER-03")).toBeUndefined();
    expect(result(report, "CN-TRANSFER-04")).toBeUndefined();
    expect(result(report, "US-CA-NOTICE-01")).toBeUndefined();
    expect(result(report, "US-CA-RIGHTS-01")).toBeUndefined();
    expect(result(report, "US-CA-BREACH-01")?.applicability).toBe("applies");
  });
});

describe("2. a single unknown answer", () => {
  const report = run(
    referenceAssessment("low", (i) => {
      const cn = entityOf(i, "CN");
      cn.transfers = { nonSensitive: unknown, sensitive: known("0"), hrOnly: known("no") };
    }),
  );

  it("assumes the strictest case and says which value was assumed", () => {
    const r = result(report, "CN-TRANSFER-04")!;
    expect(r.applicability).toBe("assumed");
    expect(r.assumptions).toHaveLength(1);
    expect(r.assumptions[0]).toMatchObject({ fact: "j.transfers.nonSensitive", assumedValue: "≥ 1,000,000", openQuestionIds: ["transfers-nonsensitive:CN"] });
    expect(r.assumptions[0]!.sentence).toBe("Assumed number of individuals whose non-sensitive data China (mainland) sends abroad per year is at least 1,000,000");
  });

  it("produces exactly one open question, linked back to the wizard", () => {
    expect(report.openQuestions.map((q) => q.id)).toEqual(["transfers-nonsensitive:CN"]);
    const q = report.openQuestions[0]!;
    expect(q.resolveHref).toBe("/assess#q-transfers-nonsensitive-CN");
    expect(q.jurisdictions).toEqual(["CN"]);
    expect(q.obligationIds).toContain("CN-TRANSFER-04");
    expect(q.impact).toBe(q.obligationIds.length);
  });

  it("leaves everything else as in the all-known case", () => {
    const baseline = run(referenceAssessment("low", (i) => void (entityOf(i, "CN").transfers.hrOnly = known("no"))));
    const changed = ids(report).filter((id) => !ids(baseline).includes(id));
    expect(changed.every((id) => id.startsWith("CN-"))).toBe(true);
  });
});

describe("3. tiered group with unknown answers", () => {
  it("reports only the strictest tier, as assumed, with the lesser tier as an alternative", () => {
    const report = run(referenceAssessment("unknown"));
    const strict = result(report, "CN-TRANSFER-04")!;
    expect(strict.applicability).toBe("assumed");
    expect(result(report, "CN-TRANSFER-03")).toBeUndefined();
    expect(strict.alternatives.map((a) => a.obligationId)).toEqual(["CN-TRANSFER-03"]);
    expect(strict.alternatives[0]!.condition).toMatch(/^if /);
  });

  it("describes when the lesser tier would apply instead", () => {
    const report = run(
      referenceAssessment("low", (i) => void (entityOf(i, "CN").transfers = { nonSensitive: unknown, sensitive: known("0"), hrOnly: known("no") })),
    );
    expect(result(report, "CN-TRANSFER-04")!.alternatives[0]!.condition).toContain("is between 100,000 and 999,999");
  });

  it("reports the lesser tier on its own when the answers settle it", () => {
    const report = run(
      referenceAssessment("low", (i) => void (entityOf(i, "CN").transfers = { nonSensitive: known("100k-999999"), sensitive: known("0"), hrOnly: known("no") })),
    );
    expect(result(report, "CN-TRANSFER-03")).toMatchObject({ applicability: "applies", alternatives: [] });
    expect(result(report, "CN-TRANSFER-04")).toBeUndefined();
  });

  it("states one condition per fact even when it matters in more than one way", () => {
    const report = run(referenceAssessment("unknown"));
    const sold = result(report, "US-CA-MARKETING-01")!.assumptions.find((x) => x.fact === "j.people.soldShared");
    expect(sold?.assumedValue).toBe("≥ 100,000");
  });

  it("applies the strictest tier outright for a confirmed CIIO or important data", () => {
    const report = run(
      referenceAssessment("low", (i) => {
        const cn = entityOf(i, "CN");
        cn.cn = { ciio: known(false), importantData: known(true) };
      }),
    );
    expect(result(report, "CN-TRANSFER-04")).toMatchObject({ applicability: "applies", alternatives: [] });
  });
});

describe("4. exemption that depends on an unknown answer", () => {
  it("does not assume the Texas small-business exemption", () => {
    const report = run(
      referenceAssessment("low", (i) => {
        i.data.subjects.endUsers = true;
        const tx = entityOf(i, "US-TX");
        tx.people.other = known("1-9999");
        tx.smallBusinessSBA = unknown;
      }),
    );
    const r = result(report, "US-TX-RIGHTS-01")!;
    expect(r.applicability).toBe("assumed");
    expect(r.assumptions[0]).toMatchObject({ fact: "j.smallBusinessSBA", assumedValue: "no", openQuestionIds: ["entity-sba:US-TX"] });
    expect(question(report, "entity-sba:US-TX")!.obligationIds).toContain("US-TX-RIGHTS-01");
  });

  it("applies it when the answer is known", () => {
    const report = run(
      referenceAssessment("low", (i) => {
        i.data.subjects.endUsers = true;
        entityOf(i, "US-TX").people.other = known("1-9999");
      }),
    );
    expect(result(report, "US-TX-RIGHTS-01")).toBeUndefined();
  });

  it("does not assume China's HR-only transfer exemption", () => {
    const report = run(
      referenceAssessment("low", (i) => void (entityOf(i, "CN").transfers = { nonSensitive: known("100k-999999"), sensitive: known("0"), hrOnly: unknown })),
    );
    const r = result(report, "CN-TRANSFER-03")!;
    expect(r.applicability).toBe("assumed");
    expect(r.assumptions[0]).toMatchObject({ fact: "j.transfers.hrOnly", assumedValue: "Mixed or No" });
  });
});

describe("5. withheld revenue", () => {
  const report = run(referenceAssessment("low", (i) => void (i.company.groupRevenue = { status: "withheld" })));

  it("assumes revenue-dependent applicability", () => {
    const r = result(report, "US-CA-NOTICE-01")!;
    expect(r.applicability).toBe("assumed");
    expect(r.assumptions[0]).toMatchObject({ fact: "group.revenueUSD", assumedValue: "≥ US$26,625,000", openQuestionIds: ["group-revenue"] });
  });

  it("shows the statutory formula with \"Revenue not provided\" instead of a figure", () => {
    const penalty = result(report, "IT-TRANSFER-01")!.penalty!;
    expect(penalty).toMatchObject({ kind: "formula", reason: "revenue_not_provided", note: "Revenue not provided" });
    expect(penalty.kind === "formula" && penalty.formula).toContain("4%");
    expect(report.jurisdictions.flatMap((j) => j.results).every((r) => r.penalty?.kind !== "computed")).toBe(true);
  });

  it("asks for revenue once, however many obligations depend on it", () => {
    const q = report.openQuestions.filter((x) => x.questionId === "group-revenue");
    expect(q).toHaveLength(1);
    expect(q[0]!.impact).toBeGreaterThan(1);
    expect(q[0]!.jurisdictions).toEqual(["US-CA"]);
  });
});

describe("Germany: DPO threshold with headcount as the upper bound for data staff", () => {
  const de = (headcount: string | null, dataStaff: string | null | undefined) =>
    run(
      referenceAssessment("low", (i) => {
        const e = entityOf(i, "DE");
        e.headcount = headcount === null ? unknown : known(headcount);
        e.dataStaff = dataStaff === undefined ? undefined : dataStaff === null ? unknown : known(dataStaff);
      }),
    );

  it("excludes the DPO duty with certainty when headcount is 1–19", () => {
    const report = de("1-19", undefined);
    expect(result(report, "DE-DPO_REP-01")).toBeUndefined();
    expect(report.openQuestions).toEqual([]);
  });

  it("assumes it when headcount is 20 or more and data staff is unknown, with the data-staff follow-up", () => {
    const report = de("20-49", null);
    expect(result(report, "DE-DPO_REP-01")).toMatchObject({ applicability: "assumed" });
    expect(result(report, "DE-DPO_REP-01")!.assumptions[0]).toMatchObject({ fact: "j.dataStaff", assumedValue: "≥ 20", openQuestionIds: ["entity-data-staff:DE"] });
    expect(question(report, "entity-data-staff:DE")!.question).toBe("How many people at the Germany entity regularly work with personal data on computers?");
  });

  it("settles it from a known data-staff band", () => {
    expect(result(de("50-249", "20-49"), "DE-DPO_REP-01")).toMatchObject({ applicability: "applies" });
    expect(result(de("50-249", "1-19"), "DE-DPO_REP-01")).toBeUndefined();
  });
});

describe("Texas: sale of sensitive data follows the dedicated question", () => {
  const tx = (sale: boolean | null, soldShared = "1-9999") =>
    run(
      referenceAssessment("low", (i) => {
        i.data.subjects.endUsers = true;
        const e = entityOf(i, "US-TX");
        e.people.other = known("1-9999");
        e.people.soldShared = known(soldShared);
        e.txSale = soldShared === "0" ? { status: "not_asked" } : sale === null ? unknown : known(sale);
      }),
    );

  it("applies on Yes, is excluded on No, and is only assumed on Don't know", () => {
    expect(result(tx(true), "US-TX-SENSITIVE-03")).toMatchObject({ applicability: "applies" });
    expect(result(tx(false), "US-TX-SENSITIVE-03")).toBeUndefined();
    expect(result(tx(null), "US-TX-SENSITIVE-03")).toMatchObject({ applicability: "assumed" });
  });

  it("is excluded when the question was not asked", () => {
    expect(result(tx(null, "0"), "US-TX-SENSITIVE-03")).toBeUndefined();
  });
});

describe("bands and dated thresholds", () => {
  it("asks the yes/no revenue follow-up when a known band straddles the California threshold, using the amount in effect", () => {
    const straddle = (date: string) => run(referenceAssessment("low", (i) => void (i.company.groupRevenue = known("10m-25m")), date));
    const now = question(straddle("2026-10-03"), "revenue-above:US-CA-CCPA_REVENUE")!;
    expect(now.question).toBe("Is annual revenue above US$26,625,000?");
    expect(now.resolveHref).toBe("/assess#q-revenue-above-US-CA-CCPA_REVENUE");
    expect(question(straddle("2024-06-01"), "revenue-above:US-CA-CCPA_REVENUE")!.question).toBe("Is annual revenue above US$25,000,000?");
  });

  it("settles the straddle from the follow-up answer", () => {
    const withAnswer = (above: boolean) =>
      run(
        referenceAssessment("low", (i) => {
          i.company.groupRevenue = known("10m-25m");
          i.company.groupRevenueAbove = { "US-CA-CCPA_REVENUE": known(above) };
        }),
      );
    expect(result(withAnswer(true), "US-CA-NOTICE-01")).toMatchObject({ applicability: "applies" });
    expect(result(withAnswer(false), "US-CA-NOTICE-01")).toBeUndefined();
    expect(withAnswer(false).openQuestions).toEqual([]);
  });

  it("flags known bands that together straddle a count threshold as a precision question", () => {
    const report = run(
      referenceAssessment("low", (i) => {
        const pe = entityOf(i, "PE");
        pe.people = { ...pe.people, staff: known("10k-99999"), business: known("10k-99999"), sensitive: known("0") };
      }),
    );
    expect(result(report, "PE-DPO_REP-01")).toMatchObject({ applicability: "assumed" });
    const q = report.openQuestions.find((x) => x.kind === "precision")!;
    expect(q.question).toBe("Is it correct that the total number of individuals located in Peru is at least 100,000?");
    expect(q.resolveHref).toBeUndefined();
  });
});

describe("reference case: every threshold answer is \"Don't know\"", () => {
  const report = run(referenceAssessment("unknown"));

  it("produces a complete report for all ten jurisdictions", () => {
    expect(report.jurisdictions).toHaveLength(10);
    expect(report.jurisdictions.every((j) => j.results.length > 0)).toBe(true);
  });

  it("shows China's security assessment and California CCPA applicability as assumed", () => {
    expect(result(report, "CN-TRANSFER-04")!.applicability).toBe("assumed");
    expect(result(report, "US-CA-NOTICE-01")!.applicability).toBe("assumed");
  });

  it("lists every open question once, with a follow-up question and what it affects", () => {
    const qs = report.openQuestions;
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
    expect(qs.every((q) => q.question.length > 10 && q.whyItMatters.length > 10)).toBe(true);
    expect(qs.every((q) => q.impact === q.obligationIds.length)).toBe(true);
    expect(report.summary.openQuestions).toBe(qs.length);
    // every assumption points at open questions that exist
    const known = new Set(qs.map((q) => q.id));
    for (const r of report.jurisdictions.flatMap((j) => j.results))
      for (const a of r.assumptions) expect(a.openQuestionIds.every((id) => known.has(id)), `${r.obligation.id} ${a.fact}`).toBe(true);
  });

  it("sorts open questions by impact and marks the top ten as priority", () => {
    const qs = report.openQuestions;
    expect(qs.map((q) => q.impact)).toEqual([...qs.map((q) => q.impact)].sort((a, b) => b - a));
    expect(qs.filter((q) => q.priority)).toEqual(qs.slice(0, 10));
    expect(qs.slice(0, 10).every((q) => q.impact > 0)).toBe(true);
  });

  it("asks group-level questions once across jurisdictions", () => {
    expect(report.openQuestions.filter((q) => q.questionId === "web-trackers")).toHaveLength(1);
    expect(question(report, "web-trackers")!.facts.length).toBeGreaterThan(1);
    expect(question(report, "web-trackers")!.question).toMatch(/^Which trackers run on your website/);
  });
});

describe("determinism", () => {
  it("gives byte-identical output for the same assessment", () => {
    for (const variant of ["unknown", "low"] as const) {
      const a = referenceAssessment(variant);
      expect(JSON.stringify(run(a))).toBe(JSON.stringify(run(structuredClone(a))));
    }
  });

  it("does not depend on the order of the knowledge base or of the entities", () => {
    const a = referenceAssessment("unknown");
    const shuffled = structuredClone(a);
    shuffled.intake.footprint.entities.reverse();
    expect(JSON.stringify(evaluate(shuffled, [...kb].reverse(), fx))).toBe(JSON.stringify(run(a)));
  });

  it("does not modify its input", () => {
    const a = referenceAssessment("unknown");
    const before = JSON.stringify(a);
    run(a);
    expect(JSON.stringify(a)).toBe(before);
  });
});
