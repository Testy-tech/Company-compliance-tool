import { isEEA } from "@/lib/kb/eu-transfers";
import type { WizardConfig } from "@/lib/kb/wizard-config";

import { bandInterval } from "./bands";
import { bandStraddles, type MoneyThreshold } from "./money";
import {
  assessmentSchema, frameworkKeys, intakeSchema, processingKeys, sensitiveKeys, subjectKeys,
  type Answer, type CoveredJurisdiction, type Intake,
} from "./schema";

/*
 * Wizard draft: the intake while it is being filled in. Same shape as the
 * intake schema, except that unanswered questions are `undefined`. `toIntake`
 * validates a finished draft against the real schema.
 */

type A<T> = Answer<T> | undefined;

export type Destinations = { hq: boolean; group: string[]; providers: string[] };

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
  txSale: A<boolean>;
  people: { staff: A<string>; business: A<string>; other: A<string>; sensitive: A<string>; soldShared: A<string> };
  transfers: { nonSensitive: A<string>; sensitive: A<string>; hrOnly: A<string>; destinations: A<Destinations> };
  dpfCertified: A<boolean>;
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
  /** Answers to the report's inline threshold questions; see intakeSchema.thresholdAnswers. */
  thresholdAnswers: Record<string, Answer<boolean>>;
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
    thresholdAnswers: {},
  };
}

export function emptyEntity(jurisdiction: CoveredJurisdiction, role: EntityDraft["role"]): EntityDraft {
  return {
    jurisdiction,
    role,
    entityType: role === "hq" ? "hq" : undefined,
    status: role === "hq" ? "operating" : undefined,
    headcount: undefined, dataStaff: undefined, revenue: undefined, revenueAbove: {},
    employeeRep: undefined, unionData: undefined, smallBusinessSBA: undefined, txSale: undefined,
    people: { staff: undefined, business: undefined, other: undefined, sensitive: undefined, soldShared: undefined },
    transfers: { nonSensitive: undefined, sensitive: undefined, hrOnly: undefined, destinations: undefined },
    dpfCertified: undefined,
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

/** Texas: ask whether data is sold for consideration unless the sold/shared count is a known zero. */
export function needsTxSale(e: EntityDraft): boolean {
  const s = e.people.soldShared;
  return e.jurisdiction === "US-TX" && !!s && !(s.status === "known" && s.value === "0");
}

/** US entities of a group headquartered in the EEA are asked about Data Privacy Framework certification. */
export const needsDpf = (e: EntityDraft, draft: Draft) => isUS(e) && isEEA(draft.company.hqCountry);

/** A destinations answer with at least one destination chosen. */
export const hasDestination = (d: Destinations) => d.hq || d.group.length > 0 || d.providers.length > 0;

/** Drop destinations that no longer exist in the footprint (a country was removed after answering). */
function cleanDestinations(e: EntityDraft, draft: Draft): A<Destinations> {
  const d = e.transfers.destinations;
  if (d?.status !== "known") return d;
  const others = draft.footprint.entities.filter((x) => x.jurisdiction !== e.jurisdiction && x.role !== "hq").map((x) => x.jurisdiction as string);
  return { status: "known", value: { hq: d.value.hq && e.role !== "hq", group: d.value.group.filter((g) => others.includes(g)), providers: d.value.providers } };
}

/** Nothing leaves the country, so the "mainly HR data?" question is skipped. */
export const sendsNothing = (t: EntityDraft["transfers"]) =>
  t.nonSensitive?.status === "known" && t.nonSensitive.value === "0" && t.sensitive?.status === "known" && t.sensitive.value === "0";

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
    w.countrySitesChoice === "yes" ? { status: "known", value: w.countrySites.filter((c) => draft.footprint.entities.some((e) => e.jurisdiction === c)) }
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
        txSale: e.jurisdiction !== "US-TX" ? undefined : needsTxSale(e) ? e.txSale : e.people.soldShared ? { status: "not_asked" } : undefined,
        transfers: sendsNothing(e.transfers)
          ? { ...e.transfers, hrOnly: { status: "not_asked" }, destinations: { status: "not_asked" } }
          : { ...e.transfers, destinations: cleanDestinations(e, draft) },
        dpfCertified: needsDpf(e, draft) ? e.dpfCertified : undefined,
        cn: e.jurisdiction === "CN" ? e.cn : undefined,
      })),
    },
    website: { trackers: w.trackers, consentBanner: w.consentBanner, countrySites },
  });
}

/** A validated intake back to an editable draft (used to load the sample assessments). */
export function fromIntake(intake: Intake): Draft {
  const asked = <T,>(a: Answer<T> | undefined): A<T> => (a?.status === "not_asked" ? undefined : a);
  const sites = intake.website.countrySites;
  return {
    ...intake,
    footprint: {
      ...intake.footprint,
      entities: intake.footprint.entities.map((e) => ({
        ...emptyEntity(e.jurisdiction, e.role),
        ...e,
        dataStaff: e.dataStaff,
        unionData: e.unionData,
        smallBusinessSBA: e.smallBusinessSBA,
        txSale: asked(e.txSale),
        transfers: { ...e.transfers, hrOnly: asked(e.transfers.hrOnly), destinations: asked(e.transfers.destinations) },
        dpfCertified: e.dpfCertified,
        cn: e.cn ?? { ciio: undefined, importantData: undefined },
      })),
    },
    website: {
      trackers: intake.website.trackers,
      consentBanner: intake.website.consentBanner,
      countrySitesChoice: sites.status !== "known" ? "unknown" : sites.value.length ? "yes" : "no",
      countrySites: sites.status === "known" ? sites.value : [],
    },
  };
}

/** Finished draft → validated assessment (intake + the date it is assessed as of). */
export function toAssessment(draft: Draft, assessmentDate: string) {
  const intake = toIntake(draft);
  return intake.success ? assessmentSchema.safeParse({ version: 1, assessmentDate, intake: intake.data }) : intake;
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
