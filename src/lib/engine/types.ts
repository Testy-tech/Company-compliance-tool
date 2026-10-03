import type { Obligation, ObligationCategory, JurisdictionId } from "@/lib/kb/schema";

/*
 * Engine contract: evaluate(assessment, knowledgeBase, fx) → Report. A pure
 * function: no clock, no I/O, so the same assessment always gives the same report.
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
  /** The value (or range) assumed, in display form, e.g. "≥ 1,000,000". */
  assumedValue: string;
  /** Plain-English sentence, e.g. "Assumed number of individuals whose non-sensitive data China sends abroad per year is at least 1,000,000". */
  sentence: string;
  /** Open questions (by id) that would settle this assumption. */
  openQuestionIds: string[];
};

export type Alternative = {
  obligationId: string;
  title: string;
  /** When this less strict tier would apply instead, e.g. "if … is between 100,000 and 999,999". */
  condition: string;
};

export type PenaltyExposure =
  | { kind: "computed"; amount: number; currency: string; basis: string }
  | {
      kind: "formula";
      /** The statutory maximum as stated in the KB. */
      formula: string;
      /**
       * Why no figure is computed. `not_computable`: revenue is known, but the KB
       * holds penalties as text only (no structured percentage to apply).
       */
      reason: "revenue_not_provided" | "revenue_unknown" | "not_revenue_based" | "not_computable";
      /** Shown next to the formula, e.g. "Revenue not provided". */
      note?: string;
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
  penalty?: PenaltyExposure;
};

export type OpenQuestion = {
  /** Stable key: one per unresolved answer, however many obligations or facts depend on it. */
  id: string;
  /**
   * `unresolved`: a "Don't know" / "Prefer not to say" answer.
   * `precision`: the answers are known bands, but together they straddle a threshold.
   */
  kind: "unresolved" | "precision";
  questionId: string;
  /** Fact paths this answer feeds. */
  facts: string[];
  /** Set for per-country questions. */
  jurisdiction?: JurisdictionId;
  /** Client-facing follow-up question. */
  question: string;
  whyItMatters: string;
  /** Obligations reported as "assumed" that hinge on this answer. */
  obligationIds: string[];
  jurisdictions: JurisdictionId[];
  /** Number of obligations whose applicability this answer bears on (= obligationIds.length). */
  impact: number;
  /** The ten highest-impact questions, for the executive summary. */
  priority: boolean;
  /** Deep link back into the wizard; absent when no wizard question can settle it. */
  resolveHref?: string;
};

export type JurisdictionReport = {
  jurisdiction: JurisdictionId;
  name: string;
  role: "hq" | "current" | "target";
  results: ObligationResult[];
  deltaCounts: { covered: number; partial: number; new: number };
  lastReviewed: string;
};

export type Report = {
  assessmentDate: string;
  /** GDPR-delta columns are shown only when the user indicated a GDPR baseline. */
  gdprBaseline: boolean;
  jurisdictions: JurisdictionReport[];
  notAssessed: string[];
  /** Sorted by impact, highest first. */
  openQuestions: OpenQuestion[];
  summary: {
    obligations: number;
    assumed: number;
    openQuestions: number;
    byDelta: { covered: number; partial: number; new: number };
    byCategory: Partial<Record<ObligationCategory, number>>;
  };
};
