import { describe, expect, it } from "vitest";

import { countUnresolved, emptyDraft, emptyEntity, needsDataStaff, syncHqEntity, toIntake, type Draft, type EntityDraft } from "./draft";

const covered = ["IT", "DE", "CN", "SG", "PE", "CL", "US-CA", "US-TX", "KR", "IN"];
const unknown = { status: "unknown" } as const;

function answerEntity(e: EntityDraft): EntityDraft {
  return {
    ...e,
    entityType: e.entityType ?? "subsidiary",
    status: e.status ?? "operating",
    headcount: unknown, dataStaff: unknown, revenue: unknown, employeeRep: unknown, smallBusinessSBA: unknown,
    people: { staff: unknown, business: unknown, other: unknown, sensitive: unknown, soldShared: unknown },
    transfers: { nonSensitive: unknown, sensitive: unknown, hrOnly: unknown },
    cn: { ciio: unknown, importantData: unknown },
  };
}

function allUnknownDraft(): Draft {
  const d = emptyDraft();
  Object.assign(d.company, { label: "Client A", hqCountry: "IT", gdprBaseline: "yes", industry: "engineering_construction", groupHeadcount: unknown, groupRevenue: { status: "withheld" } });
  syncHqEntity(d, covered);
  for (const id of ["DE", "CN", "US-CA", "US-TX"] as const) d.footprint.entities.push(emptyEntity(id, "current"));
  d.footprint.entities = d.footprint.entities.map(answerEntity);
  d.data.subjects.employees = true;
  d.infrastructure = { hosting: ["hq_eu"], groupAccessFromAbroad: true, localProcessesForGroup: false, vendors: [] };
  d.website = { trackers: unknown, consentBanner: unknown, countrySitesChoice: "unknown", countrySites: [] };
  d.governance = { model: "centralized", localContacts: false };
  return d;
}

describe("wizard draft", () => {
  it("keeps one headquarters entity in step with the HQ answer", () => {
    const d = emptyDraft();
    d.company.hqCountry = "IT";
    syncHqEntity(d, covered);
    expect(d.footprint.entities.map((e) => [e.jurisdiction, e.role])).toEqual([["IT", "hq"]]);

    d.company.hqCountry = "US";
    d.company.hqUsState = "TX";
    syncHqEntity(d, covered);
    expect(d.footprint.entities.map((e) => [e.jurisdiction, e.role])).toEqual([["US-TX", "hq"], ["IT", "current"]]);

    d.company.hqCountry = "FR"; // not a covered jurisdiction: no HQ entity
    syncHqEntity(d, covered);
    expect(d.footprint.entities.some((e) => e.role === "hq")).toBe(false);
  });

  it("asks Germany's data-staff question only when headcount could reach 20", () => {
    const de = emptyEntity("DE", "current");
    expect(needsDataStaff(de)).toBe(false); // headcount not answered yet
    expect(needsDataStaff({ ...de, headcount: { status: "known", value: "1-19" } })).toBe(false);
    expect(needsDataStaff({ ...de, headcount: { status: "known", value: "20-49" } })).toBe(true);
    expect(needsDataStaff({ ...de, headcount: unknown })).toBe(true);
    expect(needsDataStaff({ ...emptyEntity("CN", "current"), headcount: unknown })).toBe(false);
  });

  it("accepts a draft where every threshold answer is unresolved", () => {
    const result = toIntake(allUnknownDraft());
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    const intake = result.data!;
    expect(intake.footprint.entities.find((e) => e.jurisdiction === "IT")?.cn).toBeUndefined();
    expect(intake.footprint.entities.find((e) => e.jurisdiction === "CN")?.cn).toEqual({ ciio: unknown, importantData: unknown });
    expect(intake.footprint.entities.find((e) => e.jurisdiction === "DE")?.smallBusinessSBA).toBeUndefined();
    expect(countUnresolved(intake)).toBeGreaterThan(50);
  });

  it("rejects a draft with an unanswered question", () => {
    const d = allUnknownDraft();
    d.footprint.entities[0]!.headcount = undefined;
    expect(toIntake(d).success).toBe(false);
  });
});
