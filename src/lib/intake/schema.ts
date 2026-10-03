import { z } from "zod";

import { bandIds } from "./bands";

/* ── Answer model ──────────────────────────────────────────────────────────────
 * Every threshold question stores an Answer<T>. "unknown" (Don't know) and
 * "withheld" (Prefer not to say) are both *unresolved*; the engine then assumes
 * conservatively (see src/lib/engine/types.ts).
 * "not_asked" is derived, never chosen: the wizard skipped the question because
 * an earlier answer made it irrelevant. It is neither an answer nor unresolved;
 * the review step and exports show it as "Not applicable". */

export type Answer<T> =
  | { status: "known"; value: T }
  | { status: "unknown" }
  | { status: "withheld" }
  | { status: "not_asked" };

const known = <T extends z.ZodType>(value: T) => z.object({ status: z.literal("known"), value });
const unknown = z.object({ status: z.literal("unknown") });
const withheld = z.object({ status: z.literal("withheld") });
const notAsked = z.object({ status: z.literal("not_asked") });

/** Answer with a "Don't know" option. */
export const answer = <T extends z.ZodType>(value: T) => z.discriminatedUnion("status", [known(value), unknown]);
/** Answer with "Don't know" and "Prefer not to say" options. */
export const answerOrWithheld = <T extends z.ZodType>(value: T) =>
  z.discriminatedUnion("status", [known(value), unknown, withheld]);

/** Answer to a conditional question: "Don't know" is offered, and the wizard may skip it ("not_asked"). */
export const answerOrNotAsked = <T extends z.ZodType>(value: T) => z.discriminatedUnion("status", [known(value), unknown, notAsked]);

/** "Don't know" or "Prefer not to say": the engine has to assume. */
export const isUnresolved = (a: Answer<unknown> | undefined): boolean => a?.status === "unknown" || a?.status === "withheld";

export const isResolved = <T,>(a: Answer<T> | undefined): a is { status: "known"; value: T } => a?.status === "known";

/* ── Enumerations ─────────────────────────────────────────────────────────── */

export const coveredJurisdictions = ["IT", "DE", "CN", "SG", "PE", "CL", "US-CA", "US-TX", "KR", "IN"] as const;
export const jurisdictionIdSchema = z.enum(coveredJurisdictions);
export type CoveredJurisdiction = z.infer<typeof jurisdictionIdSchema>;

export const industries = ["engineering_construction", "manufacturing", "energy_utilities", "professional_services", "technology", "other"] as const;
export const entityTypes = ["subsidiary", "branch", "rep_office", "none"] as const;
export const employeeRepValues = ["works_council", "union", "both", "none"] as const;
export const hrOnlyValues = ["only_hr", "mixed", "no"] as const;
export const trackerValues = ["analytics", "ad_pixels", "session_replay", "chat", "embeds"] as const;
export const consentBannerValues = ["blocking", "informational", "none"] as const;
export const hostingValues = ["hq_eu", "local", "cloud_eu", "cloud_us", "cloud_other"] as const;
export const vendorValues = ["cloud_it", "payroll_hr", "recruiting", "security_cctv", "marketing", "travel", "other"] as const;

const headcountBand = z.enum(bandIds("headcount"));
const revenueBand = z.enum(bandIds("revenueEUR"));
const peopleBand = z.enum(bandIds("people"));

/** Answers to conditional "Is revenue above US$X?" follow-ups, keyed by KB threshold id. */
const aboveThresholds = z.record(z.string(), answer(z.boolean())).default({});

/* ── Steps ────────────────────────────────────────────────────────────────── */

export const companyStep = z.object({
  anonymized: z.boolean(),
  label: z.string().trim().max(120),
  hqCountry: z.string().regex(/^[A-Z]{2}$/, "Select the headquarters country"),
  /** Only when hqCountry is US: which state (covered states, or other). */
  hqUsState: z.enum(["CA", "TX", "other"]).optional(),
  gdprBaseline: z.enum(["yes", "no"]),
  industry: z.enum(industries),
  groupHeadcount: answer(headcountBand),
  groupRevenue: answerOrWithheld(revenueBand),
  groupRevenueAbove: aboveThresholds,
});

export const entitySchema = z.object({
  jurisdiction: jurisdictionIdSchema,
  role: z.enum(["hq", "current", "target"]),
  entityType: z.enum(["hq", ...entityTypes]),
  status: z.enum(["operating", "planned"]),
  headcount: answer(headcountBand),
  /** Germany only: people regularly working with personal data on computers (BDSG § 38). */
  dataStaff: answer(headcountBand).optional(),
  revenue: answerOrWithheld(revenueBand),
  revenueAbove: aboveThresholds,
  employeeRep: answer(z.enum(employeeRepValues)),
  unionData: answer(z.boolean()).optional(),
  /** US entities only. */
  smallBusinessSBA: answer(z.boolean()).optional(),
  people: z.object({
    staff: answer(peopleBand),
    business: answer(peopleBand),
    other: answer(peopleBand),
    sensitive: answer(z.enum(bandIds("sensitiveHeld"))),
    soldShared: answer(peopleBand),
  }),
  transfers: z.object({
    nonSensitive: answer(z.enum(bandIds("transfersNonSensitive"))),
    sensitive: answer(z.enum(bandIds("transfersSensitive"))),
    /** Skipped ("not_asked") when nothing is sent abroad. */
    hrOnly: answerOrNotAsked(z.enum(hrOnlyValues)),
  }),
  /** Texas only; skipped ("not_asked") when no data is sold or shared. TDPSA § 541.001(28). */
  txSale: answerOrNotAsked(z.boolean()).optional(),
  /** China only. */
  cn: z.object({ ciio: answer(z.boolean()), importantData: answer(z.boolean()) }).optional(),
});
export type EntityAnswers = z.infer<typeof entitySchema>;

export const footprintStep = z.object({
  entities: z.array(entitySchema).min(1, "Select at least one country"),
  otherCountries: z.string().trim().max(500),
});

const flags = <K extends string>(keys: readonly K[]) =>
  z.object(Object.fromEntries(keys.map((k) => [k, z.boolean()])) as Record<K, z.ZodBoolean>);

export const subjectKeys = ["employees", "contractors", "applicants", "b2bContacts", "endUsers", "siteVisitors"] as const;
export const sensitiveKeys = ["health", "biometrics", "criminal", "union", "children", "preciseLocation", "financialAccounts", "nationalId"] as const;
export const processingKeys = ["hrPayroll", "recruiting", "siteAccess", "cctv", "marketing", "crm", "rnd", "employeeMonitoring", "automatedDecisions"] as const;
export const frameworkKeys = ["ropa", "dpia", "sccs", "tia", "dpo", "breachProcedure", "dsarProcedure", "vendorDpas", "privacyNotices", "training", "retentionSchedule"] as const;

export const dataStep = z.object({ subjects: flags(subjectKeys), sensitive: flags(sensitiveKeys) });
export const processingStep = z.object({ processing: flags(processingKeys) });
export const infrastructureStep = z.object({
  hosting: z.array(z.enum(hostingValues)).min(1, "Select at least one hosting location"),
  groupAccessFromAbroad: z.boolean(),
  localProcessesForGroup: z.boolean(),
  vendors: z.array(z.enum(vendorValues)),
});
export const websiteStep = z.object({
  /** known [] = "None". */
  trackers: answer(z.array(z.enum(trackerValues))),
  consentBanner: answer(z.enum(consentBannerValues)),
  /** known [] = "No". */
  countrySites: answer(z.array(jurisdictionIdSchema)),
});
export const frameworkStep = z.object({ framework: flags(frameworkKeys) });
export const governanceStep = z.object({
  model: z.enum(["centralized", "hub_and_spoke", "decentralized"]),
  localContacts: z.boolean(),
});

export const intakeSchema = z.object({
  version: z.literal(1),
  company: companyStep,
  footprint: footprintStep,
  data: dataStep,
  processing: processingStep,
  infrastructure: infrastructureStep,
  website: websiteStep,
  framework: frameworkStep,
  governance: governanceStep,
});

export type Intake = z.infer<typeof intakeSchema>;
export type IntakeInput = z.input<typeof intakeSchema>;
