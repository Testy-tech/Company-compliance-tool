import { z } from "zod";

/*
 * The evaluation context: what an obligation's `appliesIf` rule can see.
 *
 * The engine (Phase 4) builds one context per assessed jurisdiction from the
 * intake answers. Rules refer to these paths with JsonLogic `var`, e.g.
 *   { "==": [{ "var": "j.entityType" }, "subsidiary"] }
 * The KB validator rejects any `var` path not declared here, so rules cannot
 * silently depend on questions the wizard never asks. The wizard (Phase 3)
 * must collect every field below.
 */

const bool = z.boolean();

export const evaluationContextSchema = z.object({
  /** The jurisdiction being evaluated */
  j: z.object({
    id: z.string(),
    /** hq = group headquarters; current = operating footprint; target = planned entry */
    role: z.enum(["hq", "current", "target"]),
    entityType: z.enum(["hq", "subsidiary", "branch", "rep_office", "none"]),
    status: z.enum(["operating", "planned"]),
    /** Local headcount (employees of the local entity) */
    headcount: z.number().int().nonnegative(),
    /** Natural persons in this jurisdiction whose personal data the group processes (estimate) */
    individuals: z.number().int().nonnegative(),
    /** Of which, individuals whose sensitive data is processed */
    sensitiveIndividuals: z.number().int().nonnegative(),
    /** Consumers / end users (natural persons acting outside a business role) resident here */
    consumers: z.number().int().nonnegative(),
    /** Local entity's annual turnover in USD (null = unknown) */
    localRevenueUSD: z.number().nonnegative().nullable(),
    /** A works council, union representation or similar employee body exists locally */
    employeeRepresentation: bool,
  }),
  hq: z.object({
    country: z.string(),
    isEU: bool,
  }),
  group: z.object({
    headcount: z.number().int().nonnegative(),
    /** Worldwide annual turnover in USD (null = unknown) */
    revenueUSD: z.number().nonnegative().nullable(),
    industry: z.string(),
    /** Group sells to / offers services directly to consumers */
    b2c: bool,
  }),
  subjects: z.object({
    employees: bool,
    contractors: bool,
    applicants: bool,
    b2bContacts: bool,
    consumers: bool,
    siteVisitors: bool,
  }),
  sensitive: z.object({
    health: bool,
    biometrics: bool,
    criminal: bool,
    union: bool,
    children: bool,
    preciseLocation: bool,
    financialAccounts: bool,
    nationalId: bool,
  }),
  processing: z.object({
    hrPayroll: bool,
    recruiting: bool,
    siteAccess: bool,
    cctv: bool,
    marketing: bool,
    crm: bool,
    rnd: bool,
    employeeMonitoring: bool,
    automatedDecisions: bool,
    /** Sells or shares personal data with third parties for value / cross-context ads */
    sellsOrSharesData: bool,
    /** Website or app uses non-essential cookies, pixels or similar trackers */
    websiteTracking: bool,
  }),
  flows: z.object({
    /** Personal data collected in this jurisdiction is transferred to or accessed from abroad */
    exportsOut: bool,
    /** HQ (or another group entity abroad) accesses this entity's personal data */
    groupAccessFromAbroad: bool,
    /** The local entity processes personal data on behalf of HQ / other group entities */
    localProcessesForGroup: bool,
    /** Personal data of people in this jurisdiction is hosted inside the jurisdiction */
    hostedLocally: bool,
    /** Uses external processors / service providers (cloud, payroll, IT) */
    usesProcessors: bool,
  }),
  framework: z.object({
    ropa: bool,
    dpia: bool,
    sccs: bool,
    tia: bool,
    dpo: bool,
    breachProcedure: bool,
    dsarProcedure: bool,
    vendorDpas: bool,
    privacyNotices: bool,
    training: bool,
    retentionSchedule: bool,
  }),
  governance: z.object({
    model: z.enum(["centralized", "hub_and_spoke", "decentralized"]),
    localContacts: bool,
  }),
});

export type EvaluationContext = z.infer<typeof evaluationContextSchema>;

/** Every dotted path a JsonLogic `var` may reference, e.g. "j.entityType". */
export const factPaths: ReadonlySet<string> = (() => {
  const paths = new Set<string>();
  const walk = (schema: z.ZodType, prefix: string) => {
    if (schema instanceof z.ZodObject) {
      for (const [key, child] of Object.entries(schema.shape)) {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.add(path);
        walk(child as z.ZodType, path);
      }
    }
  };
  walk(evaluationContextSchema, "");
  return paths;
})();
