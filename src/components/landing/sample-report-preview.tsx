import Link from "next/link";

import { DeltaBadge } from "@/components/legal/delta-badge";
import { evaluate } from "@/lib/engine/evaluate";
import { referenceAssessment } from "@/lib/engine/fixtures";
import { loadKnowledge } from "@/lib/kb/load";
import { demoNoticeOn } from "@/lib/demo";
import { isReviewed, libraryIsPublic } from "@/lib/kb/publication";
import { mostUrgent } from "@/lib/report/derive";
import { formatDate, ownerLabels, priorityLabels } from "@/lib/report/labels";

/*
 * A real preview, not a mock-up: the executive summary of the sample assessment
 * (an Italy-headquartered engineering group in ten jurisdictions, known low
 * volumes), produced at build time by the same engine and knowledge base as a
 * user's own report.
 */
export async function SampleReportPreview() {
  const { kb, fx } = await loadKnowledge();
  const assessment = referenceAssessment("low");
  const report = evaluate(assessment, kb, fx);
  const { summary } = report;
  const deltas = (["covered", "partial", "new"] as const).map((d) => ({ delta: d, value: summary.byDelta[d] }));
  // Publication gate: until the library is released, only counsel-reviewed items are shown by name.
  const isPublic = libraryIsPublic();
  const demo = demoNoticeOn();
  const all = report.jurisdictions.flatMap((j) => j.results);
  const reviewedCount = all.filter((r) => isReviewed(r.obligation)).length;
  const top = mostUrgent(report, all.length).filter((r) => isPublic || isReviewed(r.obligation)).slice(0, 3);
  const flows = isPublic ? report.flows.filter((f) => f.origin === "IT" && f.destination.kind === "group").slice(0, 2) : [];

  return (
    <figure
      aria-labelledby="sample-caption"
      className="relative rounded-md border border-border bg-card shadow-[0_1px_0_0_var(--border),0_12px_32px_-16px_color-mix(in_oklch,var(--primary)_25%,transparent)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <p className="eyebrow">Sample · executive report</p>
        <p className="rounded-sm border border-brass-rule px-2 py-0.5 text-[0.6875rem] font-medium text-brass">Generated, not mocked</p>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div>
          <p className="font-heading text-xl font-semibold text-primary">{assessment.intake.company.label}</p>
          <p className="text-xs text-muted-foreground">
            Engineering group, headquarters in Italy · {report.jurisdictions.length} jurisdictions · assessed {formatDate(report.assessmentDate)}
          </p>
        </div>

        <dl className="grid grid-cols-4 gap-2 border-y border-border py-3">
          <div className="min-w-0">
            <dt className="truncate text-[0.6875rem] text-muted-foreground">Obligations</dt>
            <dd className="font-heading text-xl text-brass tabular-nums">{summary.obligations}</dd>
          </div>
          {deltas.map((s) => (
            <div key={s.delta} className="min-w-0">
              <dt className="truncate text-[0.6875rem] text-muted-foreground capitalize">{s.delta}</dt>
              <dd className="font-heading text-xl text-foreground tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {deltas.map((s) => (
            <span
              key={s.delta}
              className={s.delta === "covered" ? "bg-status-covered" : s.delta === "partial" ? "bg-status-partial" : "bg-status-new"}
              style={{ width: `${(s.value / summary.obligations) * 100}%` }}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{reviewedCount}</span> of {all.length} items {demo ? "in preliminary review" : "reviewed by counsel"} ·{" "}
          <span className="font-medium text-foreground tabular-nums">{all.length - reviewedCount}</span> pending review
        </p>

        <div>
          <p className="eyebrow">Most urgent{isPublic ? "" : demo ? " (preliminary review)" : " (reviewed items)"}</p>
          {top.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Item titles appear here once counsel has reviewed them. Your own report lists every item, each marked with its review status.
            </p>
          ) : null}
          <ol className="mt-2 space-y-3">
            {top.map((r) => (
              <li key={r.obligation.id} className="grid grid-cols-[2.75rem_1fr] gap-x-2">
                <span className="para-num pt-0.5">§&nbsp;{r.paragraph}</span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-medium text-foreground">{r.obligation.title}</p>
                    <DeltaBadge delta={r.obligation.gdprDelta} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.jurisdiction} · {priorityLabels[r.obligation.priority]} priority · {ownerLabels[r.obligation.owner]}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {flows.length ? (
          <div>
            <p className="eyebrow">Transfer map (extract)</p>
            <ul className="mt-2 space-y-1.5 text-xs">
              {flows.map((f) => (
                <li key={f.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3">
                  <span className="text-muted-foreground">
                    {f.originName} → {f.destination.name}
                  </span>
                  <span>{f.mechanism}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="marginal-note">
          {report.flows.length} data flows, {report.governance.findings.length} governance findings and a 30/60/90-day roadmap follow in the full sample.
        </p>
      </div>

      <figcaption id="sample-caption" className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Executive summary of the sample assessment, produced by the same engine and knowledge base as your own report.{" "}
        <Link href="/report" className="font-medium text-primary underline decoration-brass-rule underline-offset-4">
          Open the sample report
        </Link>
      </figcaption>
    </figure>
  );
}
