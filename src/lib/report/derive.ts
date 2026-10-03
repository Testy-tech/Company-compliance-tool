import type { ObligationResult, Report } from "@/lib/engine/types";
import { bandSets, type BandSetId } from "@/lib/intake/bands";
import type { Answer, Intake } from "@/lib/intake/schema";
import type { Jurisdiction, JurisdictionId } from "@/lib/kb/schema";

import { priorityRank } from "./labels";

/*
 * View models the report builds from the engine output, the intake and the KB.
 * Presentation only: nothing here decides whether an obligation applies.
 */

const bandLabel = (set: BandSetId, a: Answer<string>): string =>
  a.status === "known" ? bandSets[set].bands.find((b) => b.id === a.value)?.label ?? a.value : a.status === "not_asked" ? "Not applicable" : "Don't know";

/* ── Transfer map ─────────────────────────────────────────────────────────── */

export type TransferFlow = {
  jurisdiction: JurisdictionId;
  from: string;
  to: string;
  nonSensitive: string;
  sensitive: string;
  /** Cross-border transfer items that apply at the origin. */
  mechanisms: ObligationResult[];
};

/**
 * One row per assessed country that sends data abroad (or may do). The intake
 * asks how much leaves each country, not who receives it, so the destination is
 * described rather than listed entity by entity.
 */
export function transferFlows(report: Report, intake: Intake): TransferFlow[] {
  const hq = report.jurisdictions.find((j) => j.role === "hq");
  const remote = intake.infrastructure.groupAccessFromAbroad;
  return report.jurisdictions.flatMap((j) => {
    const e = intake.footprint.entities.find((x) => x.jurisdiction === j.jurisdiction)!;
    const none = (a: Answer<string>) => a.status === "known" && a.value === "0";
    if (none(e.transfers.nonSensitive) && none(e.transfers.sensitive) && !remote) return [];
    const to =
      j.role === "hq"
        ? "Group entities and service providers in other countries"
        : `${hq ? `${hq.name} (headquarters)` : "Headquarters"}${remote ? ", including remote access to local systems" : ""}, and other recipients abroad`;
    return [
      {
        jurisdiction: j.jurisdiction,
        from: `${j.name}${j.role === "hq" ? " (headquarters)" : ""}`,
        to,
        nonSensitive: bandLabel("transfersNonSensitive", e.transfers.nonSensitive),
        sensitive: bandLabel("transfersSensitive", e.transfers.sensitive),
        mechanisms: j.results.filter((r) => r.obligation.category === "cross_border_transfer"),
      },
    ];
  });
}

/* ── Deadlines ────────────────────────────────────────────────────────────── */

export type Deadline = { jurisdiction: JurisdictionId; name: string; date: string; title: string; summary?: string; url: string; kind: "law" | "change" };

/** Laws not yet in force and upcoming changes recorded in the KB, for the assessed countries, earliest first. */
export function deadlines(report: Report, kb: readonly Jurisdiction[]): Deadline[] {
  const assessed = new Set<string>(report.jurisdictions.map((j) => j.jurisdiction));
  const out: Deadline[] = [];
  for (const j of kb) {
    if (!assessed.has(j.id)) continue;
    for (const law of j.laws)
      if (law.status !== "in_force")
        out.push({ jurisdiction: j.id, name: j.name, date: law.effectiveDate ?? "Date not set", title: `${law.shortName} enters into force`, url: law.officialUrl, kind: "law" });
    for (const c of j.upcomingChanges)
      out.push({ jurisdiction: j.id, name: j.name, date: c.expectedDate, title: c.title, summary: c.summary, url: c.sourceUrl, kind: "change" });
  }
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
