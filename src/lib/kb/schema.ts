import { z } from "zod";

/* Knowledge-base schema (brief: "Knowledge base schema"). Validated at build time
 * by scripts/validate-kb.ts; see also the cross-field checks there. */

const isoDate = z.iso.date();
const url = z.url({ protocol: /^https$/ });

/** JsonLogic expression. Structure is checked by the validator (known ops, known vars). */
export const jsonLogicSchema: z.ZodType<JsonLogic> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.number(),
    z.string(),
    z.null(),
    z.array(jsonLogicSchema),
    z.record(z.string(), jsonLogicSchema),
  ]),
);
export type JsonLogic =
  | boolean
  | number
  | string
  | null
  | JsonLogic[]
  | { [op: string]: JsonLogic };

export const obligationCategories = [
  "governance",
  "dpo_representative",
  "registration_filing",
  "legal_basis_consent",
  "notice",
  "data_subject_rights",
  "security",
  "breach_notification",
  "cross_border_transfer",
  "localization",
  "impact_assessment",
  "vendors_processors",
  "employee_data",
  "marketing",
  "sensitive_data",
  "children",
  "automated_decisions_ai",
  "records",
] as const;

export const sourceSchema = z.object({
  url,
  /** Article / section / paragraph, e.g. "Art. 38–40" */
  pinpoint: z.string().min(1),
});

export const obligationSchema = z.object({
  id: z.string().regex(/^[A-Z]{2}(-[A-Z]{2})?-[A-Z_]+-\d{2}$/, "e.g. CN-TRANSFER-01"),
  category: z.enum(obligationCategories),
  title: z.string().min(5).max(120),
  /** Plain-language, 2–4 sentences */
  requirement: z.string().min(40).max(900),
  appliesIf: jsonLogicSchema,
  /** One-line human explanation of appliesIf, shown as the marginal note */
  appliesIfNote: z.string().min(5).max(300),
  actionSteps: z.array(z.string().min(5)).min(1),
  deadlineOrTimeline: z.string().optional(),
  penaltyNote: z.string().optional(),
  owner: z.enum(["HQ", "local_entity", "both"]),
  priority: z.enum(["critical", "high", "medium", "low"]),
  gdprEquivalent: z.string().optional(),
  gdprDelta: z.enum(["covered", "partial", "new"]),
  sources: z.array(sourceSchema).min(1),
  /** Mutually exclusive tier group (e.g. China transfer mechanism). Only one tier per group is reported. */
  exclusiveGroup: z.string().regex(/^[A-Z]{2}(-[A-Z]{2})?-[A-Z_]+$/).optional(),
  /** Higher = stricter. When a group depends on unresolved answers, the strictest applicable tier is assumed. */
  strictness: z.number().int().min(1).optional(),
  lastVerified: isoDate,
  verifiedBy: z.string().min(1),
  /**
   * verified     = confirmed by qualified counsel (never set by automated research)
   * needs_review = checked against the official source text by research; awaiting counsel
   * unverified   = official text could not be confirmed; do not rely on it
   */
  confidence: z.enum(["verified", "needs_review", "unverified"]),
  /** Set when a reviewer flags the item in the review console: what still needs checking. Removed on verification. */
  reviewNote: z.string().min(5).max(1000).optional(),
});

export const lawSchema = z.object({
  title: z.string().min(3),
  shortName: z.string().min(2),
  citation: z.string().min(2),
  officialUrl: url,
  status: z.enum(["in_force", "enacted_not_in_force", "draft"]),
  effectiveDate: isoDate.optional(),
  /**
   * Set when the effective date itself is in doubt (e.g. amending legislation is
   * pending). Anything other than "verified" makes the report and exports show
   * `effectiveDateNote` next to the date instead of presenting it as firm.
   */
  effectiveDateConfidence: z.enum(["verified", "needs_review", "unverified"]).optional(),
  /** Where the effective date comes from (article and version of the text relied on). */
  effectiveDateSource: sourceSchema.optional(),
  /** Shown next to the date, e.g. a pending bill that would change it. */
  effectiveDateNote: z.string().min(10).optional(),
});

/** Practical context for a whole jurisdiction (not an obligation): shown above its items in the report, exports and library page. */
export const contextNoteSchema = z.object({
  title: z.string().min(5),
  text: z.string().min(20).max(700),
  source: sourceSchema,
  lastVerified: isoDate,
});

/**
 * Monetary threshold referenced from rules as { "threshold": "<id>" }. Several
 * entries with the same id and different effectiveDate model inflation
 * adjustments: the engine uses the latest entry effective on the assessment date.
 */
export const thresholdSchema = z.object({
  id: z.string().regex(/^[A-Z]{2}(-[A-Z]{2})?-[A-Z_]+$/, "e.g. US-CA-CCPA_REVENUE"),
  description: z.string().min(5),
  amount: z.number().positive(),
  currency: z.enum(["USD", "EUR"]),
  effectiveDate: isoDate,
  source: sourceSchema,
  /** Same scale as obligations; automated research never sets "verified". */
  confidence: z.enum(["verified", "needs_review", "unverified"]),
});

/**
 * A statutory term whose meaning differs between laws (e.g. "consumer"). The
 * report shows these as a glossary / tooltip next to `requirement` text.
 */
export const definedTermSchema = z.object({
  term: z.string().min(2),
  /** Short name of the law the definition comes from, e.g. "CCPA". */
  law: z.string().min(2),
  /** Plain-language meaning, in our own words. */
  definition: z.string().min(20).max(500),
  source: sourceSchema,
});

export const jurisdictionSchema = z.object({
  id: z.enum(["IT", "DE", "CN", "SG", "PE", "CL", "US-CA", "US-TX", "KR", "IN"]),
  name: z.string().min(2),
  laws: z.array(lawSchema).min(1),
  regulators: z.array(z.object({ name: z.string().min(2), url })).min(1),
  /**
   * Official sources for this jurisdiction (regulator, legislation, government).
   * A domain covers its subdomains. Used to check KB citations and to restrict
   * the "recent developments" web search.
   */
  officialDomains: z.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "bare domain, e.g. cac.gov.cn")).min(1),
  scopeNotes: z.string().min(40),
  thresholds: z.array(thresholdSchema).default([]),
  definedTerms: z.array(definedTermSchema).default([]),
  contextNotes: z.array(contextNoteSchema).default([]),
  obligations: z.array(obligationSchema).min(1),
  upcomingChanges: z.array(
    z.object({
      title: z.string().min(5),
      expectedDate: z.string().min(4),
      summary: z.string().min(20),
      sourceUrl: url,
      /** Shown next to the date, e.g. a pending bill that would change it. */
      dateNote: z.string().min(10).optional(),
      /** When this entry's status was last checked against its source. */
      lastVerified: isoDate.optional(),
    }),
  ),
  lastReviewed: isoDate,
});

export type ContextNote = z.infer<typeof contextNoteSchema>;
export type DefinedTerm = z.infer<typeof definedTermSchema>;
export type Threshold =z.infer<typeof thresholdSchema>;
export type Obligation = z.infer<typeof obligationSchema>;
export type Jurisdiction = z.infer<typeof jurisdictionSchema>;
export type JurisdictionId = Jurisdiction["id"];
export type ObligationCategory = (typeof obligationCategories)[number];
