import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { evaluate } from "@/lib/engine/evaluate";
import { referenceAssessment } from "@/lib/engine/fixtures";
import type { FxTable } from "@/lib/intake/money";
import { jurisdictionSchema } from "@/lib/kb/schema";

import { assessmentSignature, buildTailorRequests } from "./build-request";
import { tailorRequestSchema } from "./tailor-schema";

const content = path.join(process.cwd(), "content");
const kb = readdirSync(path.join(content, "jurisdictions")).map((f) => jurisdictionSchema.parse(JSON.parse(readFileSync(path.join(content, "jurisdictions", f), "utf8"))));
const fx = JSON.parse(readFileSync(path.join(content, "config", "fx.json"), "utf8")) as FxTable;

describe("tailor requests built in the browser", () => {
  for (const variant of ["unknown", "low"] as const) {
    const assessment = referenceAssessment(variant);
    const report = evaluate(assessment, kb, fx);
    const requests = report.jurisdictions.flatMap((j) => buildTailorRequests(j, assessment.intake));

    it(`pass the route's validation for every jurisdiction (${variant} fixture)`, () => {
      for (const r of requests) {
        const parsed = tailorRequestSchema.safeParse(r);
        expect(parsed.success, `${r.jurisdiction.id}: ${JSON.stringify(parsed.error?.issues.map((i) => i.path.join(".")))}`).toBe(true);
      }
      expect(requests.flatMap((r) => r.obligations)).toHaveLength(report.summary.obligations);
    });

    it(`carry no figures, bands or free-text countries (${variant} fixture)`, () => {
      const sent = JSON.stringify(requests);
      for (const leak of ["Brazil", "lt10m", "1-9999", "500-4999", "thresholdAnswers", "revenue\"", "headcount\""]) expect(sent.includes(leak), leak).toBe(false);
    });
  }

  it("send the label only when it is marked as anonymised", () => {
    const named = referenceAssessment("low", (i) => Object.assign(i.company, { anonymized: false, label: "Rossi Engineering SpA" }));
    const report = evaluate(named, kb, fx);
    const sent = JSON.stringify(report.jurisdictions.flatMap((j) => buildTailorRequests(j, named.intake)));
    expect(sent).not.toContain("Rossi");
    expect(sent).not.toContain("anonymisedLabel");
    const anonymous = referenceAssessment("low");
    expect(JSON.stringify(buildTailorRequests(evaluate(anonymous, kb, fx).jurisdictions[0]!, anonymous.intake))).toContain('"anonymisedLabel":"Client A"');
  });

  it("changes the signature when an answer changes", () => {
    const a = referenceAssessment("low");
    const b = referenceAssessment("low", (i) => void (i.processing.processing.marketing = true));
    expect(assessmentSignature(a.intake, a.assessmentDate)).toBe(assessmentSignature(structuredClone(a.intake), a.assessmentDate));
    expect(assessmentSignature(a.intake, a.assessmentDate)).not.toBe(assessmentSignature(b.intake, b.assessmentDate));
  });
});
