import type { ObligationResult, Report } from "@/lib/engine/types";
import type { Jurisdiction, JurisdictionId } from "@/lib/kb/schema";

import { priorityRank } from "./labels";

/*
 * View models the report builds from the engine output, the intake and the KB.
 * Presentation only: nothing here decides whether an obligation applies.
 */

/* ── Deadlines ────────────────────────────────────────────────────────────── */

export type Deadline = {
  jurisdiction: JurisdictionId;
  name: string;
  date: string;
  title: string;
  summary?: string;
  url: string;
  kind: "law" | "change";
  /** Shown next to the date, e.g. a pending bill that would change it. */
  dateNote?: string;
  /** The KB does not treat the date itself as settled. */
  notFirm: boolean;
};

/** Laws not yet in force and upcoming changes recorded in the KB, for the assessed countries, earliest first. */
export function deadlines(report: Report, kb: readonly Jurisdiction[]): Deadline[] {
  const assessed = new Set<string>(report.jurisdictions.map((j) => j.jurisdiction));
  const out: Deadline[] = [];
  for (const j of kb) {
    if (!assessed.has(j.id)) continue;
    for (const law of j.laws)
      if (law.status !== "in_force")
        out.push({
          jurisdiction: j.id, name: j.name, date: law.effectiveDate ?? "Date not set", title: `${law.shortName} enters into force`, url: law.officialUrl, kind: "law",
          dateNote: law.effectiveDateNote,
          notFirm: !!law.effectiveDateConfidence && law.effectiveDateConfidence !== "verified",
        });
    for (const c of j.upcomingChanges)
      out.push({ jurisdiction: j.id, name: j.name, date: c.expectedDate, title: c.title, summary: c.summary, url: c.sourceUrl, kind: "change", dateNote: c.dateNote, notFirm: false });
  }
  // A change entry that restates a law's entry into force is as firm as the law's own date.
  for (const d of out)
    if (d.kind === "change") d.notFirm = out.some((l) => l.kind === "law" && l.jurisdiction === d.jurisdiction && l.date.slice(0, 10) === d.date.slice(0, 10) && l.notFirm);
  // A law's entry into force is often also recorded as an upcoming change: keep the change, which says more.
  const changeDates = new Set(out.filter((d) => d.kind === "change").map((d) => `${d.jurisdiction}|${d.date.slice(0, 10)}`));
  const unique = out.filter((d) => d.kind === "change" || !changeDates.has(`${d.jurisdiction}|${d.date.slice(0, 10)}`));
  // ISO dates sort first and in order; free-text dates ("2027", "Q1 2027", "Date not set") keep KB order after them.
  const iso = (d: string) => /^\d{4}(-\d{2}){0,2}/.exec(d)?.[0] ?? "9999";
  return unique.map((d, i) => ({ d, i })).sort((a, b) => iso(a.d.date).localeCompare(iso(b.d.date)) || a.i - b.i).map((x) => x.d);
}

/* ── Most urgent items ────────────────────────────────────────────────────── */

export function mostUrgent(report: Report, n = 5): ObligationResult[] {
  return report.jurisdictions
    .flatMap((j) => j.results)
    .map((r, i) => ({ r, i }))
    .sort((a, b) => priorityRank[a.r.obligation.priority] - priorityRank[b.r.obligation.priority] || Number(b.r.obligation.gdprDelta === "new") - Number(a.r.obligation.gdprDelta === "new") || a.i - b.i)
    .slice(0, n)
    .map((x) => x.r);
}

/* ── Heatmap ──────────────────────────────────────────────────────────────── */

const worstOf = (results: ObligationResult[]) =>
  results.some((r) => r.obligation.gdprDelta === "new") ? "new" : results.some((r) => r.obligation.gdprDelta === "partial") ? "partial" : "covered";

export type HeatCell = { results: ObligationResult[]; worst: "covered" | "partial" | "new"; assumed: number };

export function heatCell(results: ObligationResult[]): HeatCell | undefined {
  return results.length ? { results, worst: worstOf(results), assumed: results.filter((r) => r.applicability === "assumed").length } : undefined;
}
