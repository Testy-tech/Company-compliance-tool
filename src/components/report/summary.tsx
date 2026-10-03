import { DeltaBadge } from "@/components/legal/delta-badge";
import type { Report } from "@/lib/engine/types";
import type { Deadline } from "@/lib/report/derive";
import { mostUrgent } from "@/lib/report/derive";
import { formatDate, jurisdictionAnchor, priorityLabels, questionAnchor } from "@/lib/report/labels";

import { ItemLink, Stat, Tag } from "./parts";

const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "0%");
const isDated = (d: Deadline) => /^\d{4}-\d{2}-\d{2}/.test(d.date);

export function ExecutiveSummary({ report, upcoming }: { report: Report; upcoming: Deadline[] }) {
  const { summary } = report;
  const priority = report.openQuestions.filter((q) => q.priority);
  const dated = upcoming.filter(isDated);
  const pending = upcoming.filter((d) => !isDated(d));

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat value={report.jurisdictions.length} label="Jurisdictions assessed" note={report.notAssessed.length ? `Not assessed: ${report.notAssessed.join(", ")}` : undefined} />
        <Stat value={summary.obligations} label="Applicable obligations" />
        <Stat value={summary.assumed} label="Based on an assumption" note={summary.assumed ? "Marked “Assumption” below" : "Every item is settled by your answers"} />
        <Stat
          value={summary.openQuestions}
          label="Open questions"
          note={
            summary.openQuestions ? (
              <a href="#open-questions" className="underline underline-offset-4">
                See section D
              </a>
            ) : (
              "Nothing left to clarify"
            )
          }
        />
      </dl>

      {report.gdprBaseline ? (
        <div>
          <h3 className="text-lg font-semibold text-primary">Against your GDPR programme</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {(["covered", "partial", "new"] as const).map((d) => (
              <li key={d} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <DeltaBadge delta={d} />
                <span className="text-sm">
                  <span className="font-medium tabular-nums">{summary.byDelta[d]}</span> items
                  <span className="text-muted-foreground"> ({pct(summary.byDelta[d], summary.obligations)})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="marginal-note max-w-prose">You did not indicate a GDPR-based programme, so items are not compared with GDPR.</p>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-lg font-semibold text-primary">Most urgent items</h3>
          <ol className="mt-3 space-y-2 text-sm">
            {mostUrgent(report).map((r) => (
              <li key={r.obligation.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <Tag>{priorityLabels[r.obligation.priority]}</Tag>
                <span className="text-muted-foreground">{r.jurisdiction}</span>
                <ItemLink result={r} />
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-primary">
            Priority open questions{priority.length ? ` (top ${priority.length} of ${summary.openQuestions})` : ""}
          </h3>
          {priority.length ? (
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
              {priority.map((q) => (
                <li key={q.id}>
                  <a href={`#${questionAnchor(q.id)}`} className="underline decoration-brass-rule underline-offset-4 hover:text-primary">
                    {q.question}
                  </a>{" "}
                  <span className="text-muted-foreground">— affects {q.impact} {q.impact === 1 ? "item" : "items"}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">None. Every item in this report follows from your answers.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-primary">Dates to watch</h3>
        {dated.length ? (
          <ul className="mt-3 divide-y text-sm">
            {dated.map((d, i) => (
              <li key={i} className="grid gap-1 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                <span className="font-medium tabular-nums">{formatDate(d.date.slice(0, 10))}</span>
                <span>
                  <a href={`#${jurisdictionAnchor(d.jurisdiction)}`} className="text-muted-foreground underline underline-offset-4">
                    {d.name}
                  </a>
                  : {d.title}
                  {d.date.length > 10 ? <span className="text-muted-foreground"> — {d.date}</span> : null}{" "}
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-brass underline underline-offset-4">
                    source
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">The knowledge base records no dated changes for these jurisdictions.</p>
        )}
        {pending.length ? (
          <details className="mt-3 text-sm">
            <summary className="text-muted-foreground">Proposals without a fixed date ({pending.length})</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {pending.map((d, i) => (
                <li key={i}>
                  {d.name}: {d.title} <span className="text-muted-foreground">— {d.date}</span>{" "}
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-brass underline underline-offset-4">
                    source
                  </a>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
