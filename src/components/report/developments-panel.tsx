import type { StoredDevelopments } from "@/lib/ai/developments";
import { formatDate } from "@/lib/report/labels";

/*
 * "Recent developments, not yet reviewed": the stored result of the scheduled,
 * AI-assisted search of official sources since the KB's last review. Read-only:
 * report users cannot trigger a search. Kept apart from the checklist on
 * purpose; nothing here changes the report's items.
 */

export type DevelopmentsState = { status: "loading" } | { status: "unavailable" } | { status: "ready"; result: StoredDevelopments | null };

const isIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export function DevelopmentsPanel({ jurisdiction, name, lastReviewed, state }: { jurisdiction: string; name: string; lastReviewed: string; state: DevelopmentsState }) {
  const headingId = `dev-${jurisdiction}`;
  const result = state.status === "ready" ? state.result : null;
  return (
    <aside aria-labelledby={headingId} className={`mt-8 rounded-lg border border-dashed p-4 sm:p-5 ${result ? "" : "no-print"}`}>
      <h3 id={headingId} className="font-sans text-base font-semibold">
        Recent developments in {name} — not yet reviewed
      </h3>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        A scheduled, AI-assisted search of official sources for changes since the knowledge base was last reviewed ({formatDate(lastReviewed)}). Results are not
        checked by a lawyer and are not part of the checklist above.
      </p>

      {state.status === "loading" ? <p className="mt-3 text-sm text-muted-foreground">Loading the last check…</p> : null}
      {state.status === "unavailable" ? <p className="mt-3 text-sm font-medium">Developments check unavailable for {name}</p> : null}
      {state.status === "ready" && !result ? <p className="mt-3 text-sm">Last checked: not yet. The check runs on a schedule.</p> : null}

      {result ? (
        <>
          <p className="mt-3 text-sm font-medium">Last checked: {formatDate(result.checkedAt.slice(0, 10))}</p>
          {result.items.length ? (
            <ul className="mt-2 divide-y text-sm">
              {result.items.map((d) => (
                <li key={d.url} className="grid gap-1 py-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4">
                  <span className="font-medium tabular-nums">{isIsoDate(d.date) ? formatDate(d.date) : d.date}</span>
                  <span>
                    <span className="font-medium">{d.title}.</span> {d.summary}{" "}
                    <a href={d.url} target="_blank" rel="noreferrer" className="break-words text-brass underline underline-offset-4">
                      {new URL(d.url).hostname.replace(/^www\./, "")}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm">No developments since {formatDate(result.since)} were found on the official sources searched.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Looked for changes since {formatDate(result.since)} · searched: {result.searchedDomains.join(", ")}</p>
        </>
      ) : null}
    </aside>
  );
}
