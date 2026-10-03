import { describe, expect, it } from "vitest";

import { countUnresolved, emptyDraft, emptyEntity, needsDataStaff, needsTxSale, syncHqEntity, toIntake, type Draft, type EntityDraft } from "./draft";

const covered = ["IT", "DE", "CN", "SG", "PE", "CL", "US-CA", "US-TX", "KR", "IN"];
const unknown = { status: "unknown" } as const;

function answerEntity(e: EntityDraft): EntityDraft {
  return {
    ...e,
    entityType: e.entityType ?? "subsidiary",
    status: e.status ?? "operating",
    headcount: unknown, dataStaff: unknown, revenue: unknown, employeeRep: unknown, smallBusinessSBA: unknown, txSale: unknown,
    people: { staff: unknown, business: unknown, other: unknown, sensitive: unknown, soldShared: unknown },
    transfers: { nonSensitive: unknown, sensitive: unknown, hrOnly: unknown, destinations: unknown },
    dpfCertified: unknown,
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

describe("skipped questions", () => {
  it("stores \"Mainly HR data?\" as not_asked, not as an answer, when nothing is sent abroad", () => {
    const d = allUnknownDraft();
    const zero = { status: "known", value: "0" } as const;
    d.footprint.entities[0]!.transfers = { nonSensitive: zero, sensitive: zero, hrOnly: undefined, destinations: undefined };
    const result = toIntake(d);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    expect(result.data!.footprint.entities[0]!.transfers.hrOnly).toEqual({ status: "not_asked" });
    expect(result.data!.footprint.entities[0]!.transfers.destinations).toEqual({ status: "not_asked" });
  });

  it("does not count not_asked as an open question", () => {
    const d = allUnknownDraft();
    const before = countUnresolved(toIntake(d).data!);
    const zero = { status: "known", value: "0" } as const;
    d.footprint.entities[0]!.transfers = { nonSensitive: zero, sensitive: zero, hrOnly: undefined, destinations: undefined };
    expect(countUnresolved(toIntake(d).data!)).toBe(before - 4);
  });
});

describe("Texas sale follow-up", () => {
  const tx = emptyEntity("US-TX", "current");
  const sold = (value: string) => ({ ...tx, people: { ...tx.people, soldShared: { status: "known", value } as const } });

  it("is asked only for Texas, when the sold/shared count is above zero or unknown", () => {
    expect(needsTxSale(tx)).toBe(false); // sold/shared not answered yet
    expect(needsTxSale(sold("0"))).toBe(false);
    expect(needsTxSale(sold("1-9999"))).toBe(true);
    expect(needsTxSale({ ...tx, people: { ...tx.people, soldShared: unknown } })).toBe(true);
    expect(needsTxSale({ ...sold("1-9999"), jurisdiction: "US-CA" })).toBe(false);
  });

  it("is stored as not_asked when the sold/shared count is zero, and left out for other countries", () => {
    const d = allUnknownDraft();
    const texas = d.footprint.entities.find((e) => e.jurisdiction === "US-TX")!;
    texas.people.soldShared = { status: "known", value: "0" };
    texas.txSale = undefined;
    const intake = toIntake(d).data!;
    expect(intake.footprint.entities.find((e) => e.jurisdiction === "US-TX")?.txSale).toEqual({ status: "not_asked" });
    expect(intake.footprint.entities.find((e) => e.jurisdiction === "US-CA")?.txSale).toBeUndefined();
  });
});

describe("transfer destinations", () => {
  it("asks US entities about Data Privacy Framework certification only when headquarters is in the EEA", () => {
    const d = allUnknownDraft();
    const us = d.footprint.entities.find((e) => e.jurisdiction === "US-CA")!;
    const intakeOf = (x: Draft) => toIntake(x).data!.footprint.entities.find((e) => e.jurisdiction === "US-CA")!;
    expect(intakeOf(d).dpfCertified).toEqual(unknown);
    d.company.hqCountry = "JP"; // not in the EEA (and not an assessed country)
    syncHqEntity(d, covered);
    d.footprint.entities.find((e) => e.jurisdiction === "IT")!.entityType = "subsidiary";
    expect(us.dpfCertified).toEqual(unknown); // still in the draft…
    expect(intakeOf(d).dpfCertified).toBeUndefined(); // …but not part of the intake
  });

  it("drops destinations for countries no longer in the footprint", () => {
    const d = allUnknownDraft();
    const cn = d.footprint.entities.find((e) => e.jurisdiction === "CN")!;
    cn.transfers.destinations = { status: "known", value: { hq: true, group: ["DE", "SG"], providers: ["US"] } };
    const out = toIntake(d).data!.footprint.entities.find((e) => e.jurisdiction === "CN")!.transfers.destinations;
    expect(out).toEqual({ status: "known", value: { hq: true, group: ["DE"], providers: ["US"] } });
  });
});
