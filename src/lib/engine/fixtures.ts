import { assessmentSchema, type Assessment, type CoveredJurisdiction, type Intake } from "@/lib/intake/schema";

/*
 * Reference case (docs/build1.md): an Italy-headquartered industrial engineering
 * and project services group with entities in China, Singapore, Peru, Chile,
 * California, Texas, Germany, South Korea and India; GDPR-based framework,
 * centralised governance. Two variants:
 *   "unknown": every threshold answer is "Don't know"
 *   "low":     every threshold answer is known and small
 */

export type Entity = Intake["footprint"]["entities"][number];
export const ASSESSMENT_DATE = "2026-10-03";

const unknown = { status: "unknown" } as const;
const known = <const T,>(value: T) => ({ status: "known" as const, value });
const notAsked = { status: "not_asked" } as const;

const subsidiaries: CoveredJurisdiction[] = ["CN", "SG", "PE", "CL", "US-CA", "US-TX", "DE", "KR", "IN"];

function entity(jurisdiction: CoveredJurisdiction, variant: "unknown" | "low"): Entity {
  const isHq = jurisdiction === "IT";
  const us = jurisdiction.startsWith("US-");
  const base = {
    jurisdiction,
    role: isHq ? ("hq" as const) : ("current" as const),
    entityType: isHq ? ("hq" as const) : ("subsidiary" as const),
    status: "operating" as const,
    revenueAbove: {},
  };
  if (variant === "unknown")
    return {
      ...base,
      headcount: unknown,
      dataStaff: jurisdiction === "DE" ? unknown : undefined,
      revenue: unknown,
      employeeRep: unknown,
      smallBusinessSBA: us ? unknown : undefined,
      txSale: jurisdiction === "US-TX" ? unknown : undefined,
      people: { staff: unknown, business: unknown, other: unknown, sensitive: unknown, soldShared: unknown },
      transfers: { nonSensitive: unknown, sensitive: unknown, hrOnly: unknown, destinations: unknown },
      dpfCertified: us ? unknown : undefined,
      cn: jurisdiction === "CN" ? { ciio: unknown, importantData: unknown } : undefined,
    };
  return {
    ...base,
    headcount: known("1-19"),
    revenue: known("lt10m"),
    employeeRep: known("none"),
    smallBusinessSBA: us ? known(true) : undefined,
    txSale: jurisdiction === "US-TX" ? notAsked : undefined,
    people: { staff: known("1-9999"), business: known("1-9999"), other: known("0"), sensitive: known("1-9999"), soldShared: known("0") },
    transfers: {
      nonSensitive: known("1-9999"),
      sensitive: known("0"),
      hrOnly: known("only_hr"),
      // Headquarters shares HR data with every subsidiary and uses EU and US providers; subsidiaries report to headquarters.
      destinations: isHq ? known({ hq: false, group: [...subsidiaries], providers: ["EEA", "US"] }) : known({ hq: true, group: [], providers: [] }),
    },
    dpfCertified: us ? known(false) : undefined,
    cn: jurisdiction === "CN" ? { ciio: known(false), importantData: known(false) } : undefined,
  };
}

export function referenceIntake(variant: "unknown" | "low"): Intake {
  const low = variant === "low";
  return {
    version: 1,
    company: {
      anonymized: true,
      label: "Client A",
      hqCountry: "IT",
      gdprBaseline: "yes",
      industry: "engineering_construction",
      groupHeadcount: low ? known("500-4999") : unknown,
      groupRevenue: low ? known("lt10m") : unknown,
      groupRevenueAbove: {},
    },
    footprint: { entities: [entity("IT", variant), ...subsidiaries.map((j) => entity(j, variant))], otherCountries: "Brazil, Japan" },
    data: {
      subjects: { employees: true, contractors: true, applicants: true, b2bContacts: true, endUsers: false, siteVisitors: true },
      sensitive: { health: true, biometrics: false, criminal: false, union: false, children: false, preciseLocation: false, financialAccounts: true, nationalId: true },
    },
    processing: {
      processing: { hrPayroll: true, recruiting: true, siteAccess: true, cctv: true, marketing: false, crm: true, rnd: true, employeeMonitoring: false, automatedDecisions: false },
    },
    infrastructure: { hosting: ["hq_eu", "cloud_eu"], groupAccessFromAbroad: true, localProcessesForGroup: false, vendors: ["cloud_it", "payroll_hr"] },
    website: low
      ? { trackers: known(["analytics"]), consentBanner: known("blocking"), countrySites: known([]) }
      : { trackers: unknown, consentBanner: unknown, countrySites: unknown },
    framework: {
      framework: { ropa: true, dpia: true, sccs: true, tia: true, dpo: true, breachProcedure: true, dsarProcedure: true, vendorDpas: true, privacyNotices: true, training: true, retentionSchedule: true },
    },
    governance: { model: "centralized", localContacts: false },
    thresholdAnswers: {},
  };
}

/** A validated reference assessment; `change` may edit the intake first. */
export function referenceAssessment(variant: "unknown" | "low", change?: (intake: Intake) => void, assessmentDate = ASSESSMENT_DATE): Assessment {
  const intake = referenceIntake(variant);
  change?.(intake);
  return assessmentSchema.parse({ version: 1, assessmentDate, intake });
}

export const entityOf = (intake: Intake, jurisdiction: CoveredJurisdiction) => intake.footprint.entities.find((e) => e.jurisdiction === jurisdiction)!;
