import type { WizardConfig } from "@/lib/kb/wizard-config";

import { bandInterval } from "./bands";
import { bandStraddles, type MoneyThreshold } from "./money";
import {
  frameworkKeys, intakeSchema, processingKeys, sensitiveKeys, subjectKeys,
  type Answer, type CoveredJurisdiction, type Intake,
} from "./schema";

/*
 * Wizard draft: the intake while it is being filled in. Same shape as the
 * intake schema, except that unanswered questions are `undefined`. `toIntake`
 * validates a finished draft against the real schema.
 */

type A<T> = Answer<T> | undefined;

export type EntityDraft = {
  jurisdiction: CoveredJurisdiction;
  role: "hq" | "current" | "target";
  entityType?: "hq" | "subsidiary" | "branch" | "rep_office" | "none";
  status?: "operating" | "planned";
  headcount: A<string>;
  dataStaff: A<string>;
  revenue: A<string>;
  revenueAbove: Record<string, Answer<boolean>>;
  employeeRep: A<string>;
  unionData: A<boolean>;
  smallBusinessSBA: A<boolean>;
  people: { staff: A<string>; business: A<string>; other: A<string>; sensitive: A<string>; soldShared: A<string> };
  transfers: { nonSensitive: A<string>; sensitive: A<string>; hrOnly: A<string> };
  cn: { ciio: A<boolean>; importantData: A<boolean> };
};

export type Draft = {
  version: 1;
  company: {
    anonymized: boolean;
    label: string;
    hqCountry: string;
    hqUsState?: "CA" | "TX" | "other";
    gdprBaseline?: "yes" | "no";
    industry?: string;
    groupHeadcount: A<string>;
    groupRevenue: A<string>;
    groupRevenueAbove: Record<string, Answer<boolean>>;
  };
  footprint: { entities: EntityDraft[]; otherCountries: string };
  data: { subjects: Record<string, boolean>; sensitive: Record<string, boolean> };
  processing: { processing: Record<string, boolean> };
  infrastructure: { hosting: string[]; groupAccessFromAbroad?: boolean; localProcessesForGroup?: boolean; vendors: string[] };
  website: {
    /** known [] = "None". */
    trackers: A<string[]>;
    consentBanner: A<string>;
    countrySitesChoice?: "yes" | "no" | "unknown";
    countrySites: string[];
  };
  framework: { framework: Record<string, boolean> };
  governance: { model?: string; localContacts?: boolean };
};

const allFalse = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, false]));

export function emptyDraft(): Draft {
  return {
    version: 1,
    company: { anonymized: false, label: "", hqCountry: "", groupHeadcount: undefined, groupRevenue: undefined, groupRevenueAbove: {} },
    footprint: { entities: [], otherCountries: "" },
    data: { subjects: allFalse(subjectKeys), sensitive: allFalse(sensitiveKeys) },
    processing: { processing: allFalse(processingKeys) },
    infrastructure: { hosting: [], vendors: [] },
    website: { trackers: undefined, consentBanner: undefined, countrySites: [] },
    framework: { framework: allFalse(frameworkKeys) },
    governance: {},
  };
}

export function emptyEntity(jurisdiction: CoveredJurisdiction, role: EntityDraft["role"]): EntityDraft {
  return {
    jurisdiction,
    role,
    entityType: role === "hq" ? "hq" : undefined,
    status: role === "hq" ? "operating" : undefined,
    headcount: undefined, dataStaff: undefined, revenue: undefined, revenueAbove: {},
    employeeRep: undefined, unionData: undefined, smallBusinessSBA: undefined,
    people: { staff: undefined, business: undefined, other: undefined, sensitive: undefined, soldShared: undefined },
    transfers: { nonSensitive: undefined, sensitive: undefined, hrOnly: undefined },
    cn: { ciio: undefined, importantData: undefined },
  };
}

/** The covered jurisdiction the headquarters sits in, if any. */
export function hqJurisdiction(company: Draft["company"], covered: readonly string[]): CoveredJurisdiction | undefined {
  const id =
    company.hqCountry === "US"
      ? company.hqUsState && company.hqUsState !== "other" ? `US-${company.hqUsState}` : undefined
      : company.hqCountry;
  return id && covered.includes(id) ? (id as CoveredJurisdiction) : undefined;
}

/** Keep exactly one "hq" entity in the footprint, matching the headquarters answer. Mutates the draft. */
export function syncHqEntity(draft: Draft, covered: readonly string[]): void {
  const hq = hqJurisdiction(draft.company, covered);
  const entities = draft.footprint.entities;
  for (const e of entities)
    if (e.role === "hq" && e.jurisdiction !== hq) Object.assign(e, { role: "current", entityType: undefined, status: "operating" });
  if (!hq) return;
  const existing = entities.find((e) => e.jurisdiction === hq);
  if (existing) Object.assign(existing, { role: "hq", entityType: "hq", status: "operating" });
  else entities.unshift(emptyEntity(hq, "hq"));
}

/* ── Conditional questions ────────────────────────────────────────────────── */

export const isUS = (e: EntityDraft) => e.jurisdiction.startsWith("US-");
export const needsUnionQuestion = (e: EntityDraft) =>
  e.employeeRep?.status === "known" && (e.employeeRep.value === "union" || e.employeeRep.value === "both");

/** Germany: ask for data staff unless headcount already rules out the 20-person threshold. */
export function needsDataStaff(e: EntityDraft): boolean {
  if (e.jurisdiction !== "DE" || !e.headcount) return false;
  return e.headcount.status !== "known" || bandInterval("headcount", e.headcount.value)[1] >= 20;
}

/** "Is revenue above US$X?" follow-ups to show under a jurisdiction: its thresholds that the answered band straddles. */
export function straddledThresholds(draft: Draft, e: EntityDraft, config: WizardConfig): { threshold: MoneyThreshold; scope: "group" | "entity" }[] {
  return config.moneyThresholds
    .filter((t) => t.jurisdiction === e.jurisdiction)
    .flatMap((threshold) => {
      const scope = threshold.fact === "group.revenueUSD" ? ("group" as const) : ("entity" as const);
      const revenue = scope === "group" ? draft.company.groupRevenue : e.revenue;
      return revenue?.status === "known" && bandStraddles(revenue.value, threshold, config.fx) ? [{ threshold, scope }] : [];
    });
}

/* ── Finished draft → validated intake ────────────────────────────────────── */

export function toIntake(draft: Draft) {
  const w = draft.website;
  const countrySites: A<string[]> =
    w.countrySitesChoice === "yes" ? { status: "known", value: w.countrySites }
      : w.countrySitesChoice === "no" ? { status: "known", value: [] }
      : w.countrySitesChoice === "unknown" ? { status: "unknown" }
      : undefined;
  return intakeSchema.safeParse({
    ...draft,
    footprint: {
      ...draft.footprint,
      entities: draft.footprint.entities.map((e) => ({
        ...e,
        dataStaff: needsDataStaff(e) ? e.dataStaff : undefined,
        unionData: needsUnionQuestion(e) ? e.unionData : undefined,
        smallBusinessSBA: isUS(e) ? e.smallBusinessSBA : undefined,
        cn: e.jurisdiction === "CN" ? e.cn : undefined,
      })),
    },
    website: { trackers: w.trackers, consentBanner: w.consentBanner, countrySites },
  });
}

/** Number of "Don't know" / "Prefer not to say" answers in a validated intake. */
export function countUnresolved(intake: Intake): number {
  let n = 0;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const status = (v as { status?: unknown }).status;
      if (status === "unknown" || status === "withheld") n++;
      else Object.values(v).forEach(walk);
    }
  };
  walk(intake);
  return n;
}
