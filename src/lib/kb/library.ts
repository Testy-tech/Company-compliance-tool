import { categoryLabels, formatDate } from "@/lib/report/labels";

import { obligationCategories, type Jurisdiction, type Obligation } from "./schema";

/* View models for the public jurisdiction library pages, built from the KB only. */

export type LibraryDate = { date: string; firm: boolean; title: string; summary?: string; note?: string; url: string };

const isIso = (d: string) => /^\d{4}-\d{2}-\d{2}/.test(d);

/** Laws not yet in force and upcoming changes, dated ones first in date order. */
export function datesToWatch(j: Jurisdiction): LibraryDate[] {
  const out: LibraryDate[] = [];
  const changeDates = new Set(j.upcomingChanges.map((c) => c.expectedDate.slice(0, 10)));
  for (const law of j.laws)
    if (law.status !== "in_force" && !(law.effectiveDate && changeDates.has(law.effectiveDate)))
      out.push({
        date: law.effectiveDate ?? "Date not set",
        firm: !!law.effectiveDate && (!law.effectiveDateConfidence || law.effectiveDateConfidence === "verified"),
        title: `${law.shortName} enters into force`,
        note: law.effectiveDateConfidence && law.effectiveDateConfidence !== "verified" ? law.effectiveDateNote : undefined,
        url: law.officialUrl,
      });
  for (const c of j.upcomingChanges)
    out.push({ date: c.expectedDate, firm: isIso(c.expectedDate) && !c.dateNote, title: c.title, summary: c.summary, note: c.dateNote, url: c.sourceUrl });
  return out
    .map((d, i) => ({ d, i }))
    .sort((a, b) => Number(isIso(b.d.date)) - Number(isIso(a.d.date)) || (isIso(a.d.date) ? a.d.date.localeCompare(b.d.date) : 0) || a.i - b.i)
    .map((x) => x.d);
}

export const displayDate = (d: LibraryDate) => (isIso(d.date) ? formatDate(d.date.slice(0, 10)) + (d.date.length > 10 ? ` (${d.date.slice(10).trim()})` : "") : d.date);

export function obligationsByCategory(j: Jurisdiction): { category: string; items: Obligation[] }[] {
  return obligationCategories
    .map((c) => ({ category: categoryLabels[c], items: j.obligations.filter((o) => o.category === c) }))
    .filter((g) => g.items.length);
}

/** Every source cited for the jurisdiction, one entry per URL with its pinpoints. */
export function sources(j: Jurisdiction): { url: string; host: string; pinpoints: string[]; official: boolean }[] {
  const byUrl = new Map<string, Set<string>>();
  const add = (url: string, pinpoint: string) => byUrl.set(url, (byUrl.get(url) ?? new Set()).add(pinpoint));
  for (const law of j.laws) add(law.officialUrl, `${law.shortName} — ${law.citation}`);
  for (const o of j.obligations) for (const s of o.sources) add(s.url, s.pinpoint);
  for (const t of j.definedTerms) add(t.source.url, t.source.pinpoint);
  for (const n of j.contextNotes) add(n.source.url, n.source.pinpoint);
  for (const t of j.thresholds) add(t.source.url, t.source.pinpoint);
  return [...byUrl].map(([url, pinpoints]) => {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return { url, host, pinpoints: [...pinpoints], official: j.officialDomains.some((d) => host === d || host.endsWith(`.${d}`)) };
  });
}

export const lawStatusLabels = { in_force: "In force", enacted_not_in_force: "Enacted, not yet in force", draft: "Draft" } as const;

/** One-line description for metadata. */
export const describe = (j: Jurisdiction) =>
  `Data protection in ${j.name}: ${j.laws.map((l) => l.shortName).join(", ")}. ${j.obligations.length} obligations with official sources, last reviewed ${formatDate(j.lastReviewed)}. Informational, not legal advice.`;
