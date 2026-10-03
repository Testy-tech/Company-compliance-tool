import type { Jurisdiction, Obligation } from "./schema";

/*
 * Publication gate for public pages. Until PUBLIC_LIBRARY=true, the public
 * library, the landing-page preview and the methodology figures show only
 * content that counsel has verified, and the library is kept out of search
 * engines and the sitemap. The assessment and report are not affected: they are
 * the user's own working tool and label unreviewed content themselves.
 */

export const libraryIsPublic = (env: Record<string, string | undefined> = process.env) => env.PUBLIC_LIBRARY === "true";

export const isReviewed = (o: Pick<Obligation, "confidence">) => o.confidence === "verified";

/** Obligations a public page may show, and how many are held back. */
export function publishable(obligations: readonly Obligation[], isPublic: boolean): { shown: Obligation[]; reviewed: number; pending: number } {
  const reviewed = obligations.filter(isReviewed).length;
  return { shown: isPublic ? [...obligations] : obligations.filter(isReviewed), reviewed, pending: obligations.length - reviewed };
}

export function reviewSplit(kb: readonly Jurisdiction[]): { total: number; reviewed: number; pending: number } {
  const all = kb.flatMap((j) => j.obligations);
  const reviewed = all.filter(isReviewed).length;
  return { total: all.length, reviewed, pending: all.length - reviewed };
}

/** Paths of the public library, for the sitemap; empty while the gate is closed. */
export const libraryPaths = (kb: readonly Pick<Jurisdiction, "id">[], isPublic: boolean) => (isPublic ? ["/jurisdictions", ...kb.map((j) => `/jurisdictions/${j.id}`)] : []);
