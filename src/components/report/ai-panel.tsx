"use client";

import { Check, LoaderCircle, Minus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

/* Opt-in box and tailoring controls. Nothing is sent until the box is ticked and a button is pressed. */

export type TailorProgress = { jurisdiction: string; name: string; status: "waiting" | "working" | "done" | "standard"; tailored?: number };

export function AiPanel({
  consent, onConsent, anonymised, progress, running, hasTailoring, onTailor, onRemove,
}: {
  consent: boolean;
  onConsent: (v: boolean) => void;
  /** Whether the company label is marked as anonymised (only then is it sent). */
  anonymised: boolean;
  progress: TailorProgress[];
  running: boolean;
  hasTailoring: boolean;
  onTailor: () => void;
  onRemove: () => void;
}) {
  return (
    <section aria-labelledby="ai-heading" className="no-print mt-8 rounded-lg border bg-card p-4 sm:p-6">
      <h2 id="ai-heading" className="flex items-center gap-2 text-lg font-semibold text-primary">
        <Sparkles aria-hidden="true" className="size-4 text-brass" />
        Optional: AI assistance
      </h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        The report above is produced without AI. If you opt in, Claude (a model made by Anthropic) can reword each item&apos;s explanation and steps for your
        situation. It cannot add, remove or change an obligation. (The “recent developments” panels are filled by a scheduled check that sends nothing from your
        assessment.)
      </p>

      <label className="mt-4 flex items-start gap-2.5 text-sm font-medium">
        <input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} aria-describedby="ai-sent" className="mt-0.5 size-4 shrink-0 accent-primary" />
        I agree that this report may send the data described below to Anthropic when I press “Tailor the report”.
      </label>

      <div id="ai-sent" className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="font-medium">Sent when you tailor the report</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>The knowledge-base text of the items that apply to you, one country at a time</li>
            <li>Industry, headquarters country, entity type, governance model</li>
            <li>The kinds of people, sensitive data and processing you ticked, and the GDPR artefacts you have</li>
            <li>{anonymised ? "Your anonymised label" : "No company label: yours is not marked as anonymised, so it is left out"}</li>
          </ul>
        </div>
        <div>
          <p className="font-medium">Never sent</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>A company name</li>
            <li>Headcount, revenue, numbers of individuals or transfer volumes</li>
            <li>The other countries you listed, or your checklist ticks</li>
            <li>Anything about you for the developments panels: they show a scheduled check that runs without your data</li>
          </ul>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onTailor} disabled={!consent || running}>
          {running ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="animate-spin" /> : <Sparkles aria-hidden="true" data-icon="inline-start" />}
          {running ? "Tailoring…" : hasTailoring ? "Tailor again" : "Tailor the report"}
        </Button>
        {hasTailoring && !running ? (
          <Button type="button" variant="outline" onClick={onRemove}>
            Remove tailoring
          </Button>
        ) : null}
        {!consent ? <span className="text-sm text-muted-foreground">Tick the box to enable.</span> : null}
      </div>

      {progress.length ? (
        <ul className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2" aria-live="polite">
          {progress.map((p) => (
            <li key={p.jurisdiction} className="flex items-center gap-2">
              {p.status === "working" ? (
                <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-brass" />
              ) : p.status === "done" ? (
                <Check aria-hidden="true" className="size-3.5 text-status-covered" />
              ) : (
                <Minus aria-hidden="true" className="size-3.5 text-muted-foreground" />
              )}
              <span>{p.name}</span>
              <span className="text-muted-foreground">
                {p.status === "waiting" ? "waiting" : p.status === "working" ? "tailoring…" : p.status === "done" ? `${p.tailored} items tailored` : "standard text kept"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
