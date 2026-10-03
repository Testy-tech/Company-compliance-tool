import type { ObligationResult, Report } from "@/lib/engine/types";
import type { Jurisdiction } from "@/lib/kb/schema";
import type { TransferFlow } from "@/lib/report/derive";
import { governanceModelLabels, jurisdictionAnchor, ownerLabels } from "@/lib/report/labels";

import { AssumptionBadge, ItemLink } from "./parts";

/* ── A. Transfer map ──────────────────────────────────────────────────────── */

export function TransferMap({ flows }: { flows: TransferFlow[] }) {
  if (!flows.length) return <p className="text-sm text-muted-foreground">On your answers, no assessed entity sends personal data to another country.</p>;
  return (
    <div>
      <p className="max-w-prose text-sm text-muted-foreground">
        One row per country that sends personal data abroad. The assessment asks how much data leaves each country, not who receives each part of it, so the
        destination is described rather than listed entity by entity.
      </p>
      <div className="relative mt-4 overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Transfer map">
        <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b bg-secondary">
              <th scope="col" className="px-3 py-2 font-medium">From</th>
              <th scope="col" className="px-3 py-2 font-medium">To</th>
              <th scope="col" className="px-3 py-2 font-medium">Individuals per year</th>
              <th scope="col" className="px-3 py-2 font-medium">Mechanism required at origin</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((f) => (
              <tr key={f.jurisdiction} className="border-b align-top last:border-0">
                <th scope="row" className="px-3 py-3 font-medium">
                  <a href={`#${jurisdictionAnchor(f.jurisdiction)}`} className="underline decoration-brass-rule underline-offset-4">
                    {f.from}
                  </a>
                </th>
                <td className="px-3 py-3">{f.to}</td>
                <td className="px-3 py-3">
                  Non-sensitive: {f.nonSensitive}
                  <br />
                  Sensitive: {f.sensitive}
                </td>
                <td className="px-3 py-3">
                  {f.mechanisms.length ? (
                    <ul className="space-y-1.5">
                      {f.mechanisms.map((m) => (
                        <li key={m.obligation.id}>
                          <ItemLink result={m} /> {m.applicability === "assumed" ? <AssumptionBadge className="ml-1 align-middle" /> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">No transfer item applies on your answers</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── B. Governance findings ───────────────────────────────────────────────── */

export function GovernanceFindings({ report }: { report: Report }) {
  const { governance } = report;
  const byId = new Map(report.jurisdictions.flatMap((j) => j.results).map((r) => [r.obligation.id, r]));
  return (
    <div>
      <p className="max-w-prose text-sm text-muted-foreground">
        Your governance model: <span className="font-medium text-foreground">{governanceModelLabels[governance.model]}</span>. Named local privacy contacts:{" "}
        <span className="font-medium text-foreground">{governance.localContacts ? "yes" : "no"}</span>. The findings below follow from who owns each applicable item.
      </p>
      {governance.findings.length ? (
        <ol className="mt-5 space-y-4">
          {governance.findings.map((f, i) => (
            <li key={f.id} className="rounded-lg border bg-card p-4">
              <h3 className="font-sans text-base font-semibold">
                <span className="para-num mr-2">B.{i + 1}</span>
                {f.title}
              </h3>
              <p className="mt-2 max-w-prose text-sm">{f.detail}</p>
              <p className="mt-2 text-sm text-muted-foreground">Jurisdictions: {f.jurisdictions.join(", ")}</p>
              <details className="mt-2 text-sm">
                <summary className="text-muted-foreground">
                  {f.obligationIds.length} {f.obligationIds.length === 1 ? "item" : "items"}
                </summary>
                <ul className="mt-2 space-y-1">
                  {f.obligationIds.map((id) => (
                    <li key={id}>
                      <ItemLink result={byId.get(id)!} />
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No governance findings.</p>
      )}
    </div>
  );
}

/* ── C. Roadmap ───────────────────────────────────────────────────────────── */

const buckets = [
  { days: 30 as const, title: "First 30 days", note: "Critical and high-priority items" },
  { days: 60 as const, title: "By day 60", note: "Medium-priority items" },
  { days: 90 as const, title: "By day 90", note: "Low-priority items" },
];

export function Roadmap({ report, checklist }: { report: Report; checklist: Record<string, boolean> }) {
  const all: ObligationResult[] = report.jurisdictions.flatMap((j) => j.results);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {buckets.map((b) => {
        const items = all.filter((r) => r.roadmapBucket === b.days);
        const done = items.filter((r) => checklist[r.obligation.id]).length;
        return (
          <section key={b.days} className="rounded-lg border bg-card p-4" aria-labelledby={`roadmap-${b.days}`}>
            <h3 id={`roadmap-${b.days}`} className="text-lg font-semibold text-primary">
              {b.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {b.note} · {items.length} {items.length === 1 ? "item" : "items"}
              {done ? ` · ${done} done` : ""}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((r) => (
                <li key={r.obligation.id} className={checklist[r.obligation.id] ? "text-muted-foreground line-through decoration-1" : undefined}>
                  <span className="mr-1.5 text-xs text-muted-foreground">{r.jurisdiction}</span>
                  <ItemLink result={r} />
                  <span className="text-muted-foreground"> — {ownerLabels[r.obligation.owner]}</span>
                </li>
              ))}
              {items.length === 0 ? <li className="text-muted-foreground">Nothing in this period.</li> : null}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ── E. Glossary ──────────────────────────────────────────────────────────── */

export function Glossary({ report, kb }: { report: Report; kb: readonly Jurisdiction[] }) {
  const entries = report.jurisdictions.flatMap((j) => (kb.find((k) => k.id === j.jurisdiction)?.definedTerms ?? []).map((t) => ({ ...t, jurisdiction: j.name })));
  if (!entries.length) return <p className="text-sm text-muted-foreground">No defined terms are recorded for the assessed jurisdictions.</p>;
  return (
    <div>
      <p className="max-w-prose text-sm text-muted-foreground">
        The same word can mean different things under different laws. These are the meanings used in this report; in the text, defined terms are underlined with dots.
      </p>
      <dl className="mt-4 divide-y rounded-lg border bg-card">
        {entries.map((t) => (
          <div key={`${t.law}-${t.term}`} className="grid gap-1 p-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-6">
            <dt>
              <span className="font-medium">“{t.term}”</span>
              <span className="block text-sm text-muted-foreground">
                {t.law} · {t.jurisdiction}
              </span>
            </dt>
            <dd className="text-sm">
              {t.definition}
              <span className="mt-1 block text-xs text-muted-foreground">
                {t.source.pinpoint} —{" "}
                <a href={t.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {new URL(t.source.url).hostname.replace(/^www\./, "")}
                </a>
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
