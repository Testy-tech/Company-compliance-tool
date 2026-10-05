import type { Obligation } from "@/lib/kb/schema";
import { confidenceLabels } from "@/lib/report/labels";

/*
 * Demonstration notice (DEMO_NOTICE, on unless set to "false"). While it is on,
 * the report, the exports and the jurisdiction pages carry a banner, and the
 * word "verified" is not shown to users: a verified entry is displayed as
 * "Preliminary review". Reviewer mode and reviewer exports say "Marked verified
 * (preliminary)" for such an entry. The knowledge base itself is not changed.
 */

export const DEMO_BANNER = "Preliminary review — content not yet verified by counsel. For demonstration only.";
export const PRELIMINARY = "Preliminary review";
export const MARKED_PRELIMINARY = "Marked verified (preliminary)";

export const demoNoticeOn = (env: Record<string, string | undefined> = process.env) => (env.DEMO_NOTICE ?? "").trim().toLowerCase() !== "false";

/** Confidence as shown to users. */
export const shownConfidence = (confidence: Obligation["confidence"], demo: boolean) => (demo && confidence === "verified" ? PRELIMINARY : confidenceLabels[confidence]);

/** Confidence as shown in reviewer mode and reviewer exports: the knowledge-base value, qualified while the notice is on. */
export const reviewerConfidence = (confidence: Obligation["confidence"], demo: boolean) => (demo && confidence === "verified" ? MARKED_PRELIMINARY : confidenceLabels[confidence]);
