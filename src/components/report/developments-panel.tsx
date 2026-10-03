"use client";

import { LoaderCircle, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Development } from "@/lib/ai/developments";
import { formatDate } from "@/lib/report/labels";

/*
 * "Recent developments, not yet reviewed": AI-assisted search of official
 * sources since the KB's last review. Kept apart from the checklist on purpose:
 * nothing here changes the report's items.
 */

export type DevelopmentsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; items: Development[]; checkedAt: string; since: string; cached: boolean; searchedDomains: string[] }
  | { status: "unavailable"; message: string };

const isIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export function DevelopmentsPanel({
  jurisdiction, name, lastReviewed, consent, state, onCheck,
}: { jurisdiction: string; name: string; lastReviewed: string; consent: boolean; state: DevelopmentsState; onCheck: () => void }) {
  const headingId = `dev-${jurisdiction}`;
  return (
    <aside aria-labelledby={headingId} className={`mt-8 rounded-lg border border-dashed p-4 sm:p-5 ${state.status === "idle" ? "no-print" : ""}`}>
      <h3 id={headingId} className="font-sans text-base font-semibold">
        Recent developments in {name} — not yet reviewed
      </h3>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        An AI-assisted search of official sources for changes since the knowledge base was last reviewed ({formatDate(lastReviewed)}). Results are not checked by a
        lawyer and are not part of the checklist above.
      </p>

      {state.status === "idle" || state.status === "loading" ? (
        <div className="no-print mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onCheck} disabled={!consent || state.status === "loading"}>
            {state.status === "loading" ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="animate-spin" /> : <Search aria-hidden="true" data-icon="inline-start" />}
            {state.status === "loading" ? "Searching official sources…" : "Check official sources"}
          </Button>
          {!consent ? <span className="text-sm text-muted-foreground">Opt in under “Optional: AI assistance” to enable.</span> : null}
        </div>
      ) : null}

      <div aria-live="polite">
        {state.status === "unavailable" ? <p className="mt-3 text-sm font-medium">{state.message}</p> : null}

        {state.status === "ok" ? (
          <>
            {state.items.length ? (
              <ul className="mt-3 divide-y text-sm">
                {state.items.map((d) => (
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
              <p className="mt-3 text-sm">No developments since {formatDate(state.since)} were found on the official sources searched.</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Checked {formatDate(state.checkedAt.slice(0, 10))}
              {state.cached ? " (result reused; checks are repeated at most once every 24 hours)" : ""} · searched: {state.searchedDomains.join(", ")}
            </p>
          </>
        ) : null}
      </div>
    </aside>
  );
}
