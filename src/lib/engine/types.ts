import type { Obligation, ObligationCategory, JurisdictionId } from "@/lib/kb/schema";

/*
 * Engine contract: evaluate(intake, knowledgeBase, options) → Report.
 * Implemented in Phase 4; defined now so the KB, wizard and report agree on it.
 *
 * Unresolved answers ("Don't know" / "Prefer not to say") are handled
 * conservatively: numeric facts become intervals and each rule is evaluated at
 * the interval edges and at every threshold inside them.
 *   - true everywhere  → applicability "applies"
 *   - false everywhere → excluded
 *   - mixed            → applicability "assumed", with the triggering case
 *                        recorded as an Assumption
 * Exemptions are never assumed (a rule that is only excluded by an unresolved
 * exemption comes out "mixed", hence "assumed").
 * Within an exclusiveGroup, the strictest tier that applies or may apply is
 * reported; less strict tiers become `alternatives`.
 */

export type Applicability = "applies" | "assumed";

export type Assumption = {
  /** Fact path, e.g. "j.transfers.nonSensitive". */
  fact: string;
  /** Wizard question to revisit ("Resolve"). */
  questionId: string;
  /** The value (or range) assumed, in display form, e.g. "≥ 1,000,000". */
  assumedValue: string;
  /** Plain-English sentence, e.g. "Assumed China transfers exceed 1,000,000 individuals/year". */
  sentence: string;
};

export type Alternative = {
  obligationId: string;
  title: string;
  /** When this less strict tier would apply instead, e.g. "if China transfers are 100,000–999,999 individuals/year". */
  condition: string;
};

export type ObligationResult = {
  jurisdiction: JurisdictionId;
  obligation: Obligation;
  applicability: Applicability;
  assumptions: Assumption[];
  alternatives: Alternative[];
  /** Section numbering in the report, e.g. "3.4". */
  paragraph: string;
  roadmapBucket: 30 | 60 | 90;
};

export type OpenQuestion = {
  questionId: string;
  fact: string;
  /** Client-facing follow-up question. */
  question: string;
  whyItMatters: string;
  affects: { jurisdiction: JurisdictionId; obligationIds: string[] }[];
  /** Deep link back into the wizard. */
  resolveHref: string;
};

export type PenaltyExposure =
  | { kind: "computed"; amount: number; currency: string; basis: string }
  | { kind: "formula"; formula: string; reason: "revenue_not_provided" | "revenue_unknown" | "not_revenue_based" };

export type JurisdictionReport = {
  jurisdiction: JurisdictionId;
  name: string;
  role: "hq" | "current" | "target";
  results: ObligationResult[];
  deltaCounts: { covered: number; partial: number; new: number };
  lastReviewed: string;
};

export type Report = {
  generatedAt: string;
  assessmentDate: string;
  /** GDPR-delta columns are shown only when the user indicated a GDPR baseline. */
  gdprBaseline: boolean;
  jurisdictions: JurisdictionReport[];
  notAssessed: string[];
  openQuestions: OpenQuestion[];
  summary: {
    obligations: number;
    assumed: number;
    openQuestions: number;
    byDelta: { covered: number; partial: number; new: number };
    byCategory: Partial<Record<ObligationCategory, number>>;
  };
};
