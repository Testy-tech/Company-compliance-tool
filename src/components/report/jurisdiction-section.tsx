"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Popover } from "radix-ui";

import { DeltaBadge } from "@/components/legal/delta-badge";
import type { JurisdictionReport, ObligationResult } from "@/lib/engine/types";
import type { DefinedTerm, Jurisdiction } from "@/lib/kb/schema";
import {
  categoryLabels, confidenceLabels, formatDate, jurisdictionAnchor, obligationAnchor, ownerLabels, priorityLabels, questionAnchor,
} from "@/lib/report/labels";
import { cn } from "@/lib/utils";

import { DevelopmentsPanel, type DevelopmentsState } from "./developments-panel";
import { AssumptionBadge, ReportHeading, Tag } from "./parts";

export type Tailored = { explanation: string; steps: string[] };

/* ── Defined terms ────────────────────────────────────────────────────────── */

/** A statutory term with its plain-language meaning in a popover (click, tap or Enter; Esc closes). */
function Term({ term, children }: { term: DefinedTerm; children: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`${children}: defined term under the ${term.law}, show meaning`}
          className="cursor-help rounded-sm underline decoration-brass-rule decoration-dotted decoration-2 underline-offset-4 print:no-underline"
        >
          {children}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} collisionPadding={12} className="z-50 w-72 max-w-[calc(100vw-1.5rem)] rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-md">
          <p className="eyebrow">
            “{term.term}” · {term.law}
          </p>
          <p className="mt-1.5">{term.definition}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{term.source.pinpoint}</p>
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Text with the first occurrence of each defined term turned into a popover. */
function WithTerms({ text, terms }: { text: string; terms: readonly DefinedTerm[] }) {
  const usable = terms.filter((t) => !t.term.includes("/"));
  if (!usable.length) return <>{text}</>;
  const pattern = new RegExp(`\\b(${usable.map((t) => `${escapeRegex(t.term)}s?`).join("|")})\\b`, "gi");
  const seen = new Set<string>();
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const term = usable.find((t) => m[0].toLowerCase().startsWith(t.term.toLowerCase()));
    if (!term || seen.has(term.term)) continue;
    seen.add(term.term);
    out.push(text.slice(last, m.index));
    out.push(
      <Term key={m.index} term={term}>
        {m[0]}
      </Term>,
    );
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

/* ── One obligation ───────────────────────────────────────────────────────── */

type ItemProps = {
  result: ObligationResult;
  terms: readonly DefinedTerm[];
  gdprBaseline: boolean;
  reviewer: boolean;
  done: boolean;
  onToggle: (id: string, done: boolean) => void;
  /** AI-tailored wording for this item, if the user opted in and it passed validation. */
  tailored?: Tailored;
  showStandard: boolean;
  onShowStandard: (id: string, standard: boolean) => void;
};

function ObligationItem({ result, terms, gdprBaseline, reviewer, done, onToggle, tailored, showStandard, onShowStandard }: ItemProps) {
  const o = result.obligation;
  const anchor = obligationAnchor(o.id);
  const useTailored = !!tailored && !showStandard;
  return (
    <article id={anchor} tabIndex={-1} className="grid gap-x-8 gap-y-3 border-t py-6 outline-none lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id={`${anchor}-done`}
            checked={done}
            onChange={(e) => onToggle(o.id, e.target.checked)}
            className="mt-1.5 size-4 shrink-0 accent-primary"
          />
          <h4 className="text-lg leading-snug font-semibold text-primary">
            <label htmlFor={`${anchor}-done`}>
              <span className="para-num mr-2">§&nbsp;{result.paragraph}</span>
              <span className="sr-only">Mark as done: </span>
              <span className={cn(done && "text-muted-foreground line-through decoration-1")}>{o.title}</span>
            </label>
          </h4>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag className={cn((o.priority === "critical" || o.priority === "high") && "border-primary/40 text-primary")}>{priorityLabels[o.priority]} priority</Tag>
          <Tag>{ownerLabels[o.owner]}</Tag>
          <Tag>{categoryLabels[o.category]}</Tag>
          {gdprBaseline ? <DeltaBadge delta={o.gdprDelta} /> : null}
          {result.applicability === "assumed" ? <AssumptionBadge /> : null}
          {useTailored ? (
            <Tag className="border-brass-rule text-brass">
              <Sparkles aria-hidden="true" className="size-3.5" />
              Tailored
            </Tag>
          ) : null}
        </div>

        {result.applicability === "assumed" ? (
          <div className="mt-4 rounded-lg border border-status-partial/40 bg-status-partial/8 p-3 text-sm">
            <p className="font-medium text-status-partial">Included on an assumption, because an answer is open.</p>
            {result.assumptions.length ? (
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                {result.assumptions.map((a) => (
                  <li key={a.fact}>
                    {a.sentence}.
                    {a.openQuestionIds.map((id) => (
                      <a key={id} href={`#${questionAnchor(id)}`} className="no-print ml-1.5 underline underline-offset-4">
                        Open question
                      </a>
                    ))}
                  </li>
                ))}
              </ul>
            ) : null}
            {result.alternatives.map((alt) => (
              <p key={alt.obligationId} className="mt-2">
                <span className="font-medium">May apply instead:</span> {alt.title} — {alt.condition}.
              </p>
            ))}
          </div>
        ) : null}

        <p className="mt-4 max-w-prose">
          <WithTerms text={o.requirement} terms={terms} />
          {o.sources.map((_, i) => (
            <a key={i} href={`#${anchor}-fn-${i + 1}`} className="fn-ref ml-0.5 no-underline" aria-label={`Source ${i + 1}`}>
              {i + 1}
            </a>
          ))}
        </p>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
          {o.deadlineOrTimeline ? (
            <>
              <dt className="text-muted-foreground">Timeline</dt>
              <dd>{o.deadlineOrTimeline}</dd>
            </>
          ) : null}
          {gdprBaseline && o.gdprEquivalent ? (
            <>
              <dt className="text-muted-foreground">GDPR equivalent</dt>
              <dd>{o.gdprEquivalent}</dd>
            </>
          ) : null}
          {result.penalty?.kind === "formula" ? (
            <>
              <dt className="text-muted-foreground">Penalty</dt>
              <dd>
                {result.penalty.formula}
                {result.penalty.note ? <span className="ml-1.5 font-medium">({result.penalty.note}; no figure calculated.)</span> : null}
              </dd>
            </>
          ) : null}
        </dl>

        {useTailored ? (
          <div className="mt-4 rounded-lg border border-brass-rule bg-card p-3 text-sm">
            <p className="eyebrow">For your situation · AI-tailored, not reviewed</p>
            <p className="mt-1.5 max-w-prose">{tailored.explanation}</p>
          </div>
        ) : null}

        <h5 className="mt-4 font-sans text-sm font-semibold">Action steps{useTailored ? " (tailored)" : ""}</h5>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm">
          {(useTailored ? tailored.steps : o.actionSteps).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        {tailored ? (
          <button
            type="button"
            aria-pressed={showStandard}
            onClick={() => onShowStandard(o.id, !showStandard)}
            className="no-print mt-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {showStandard ? "Show tailored text" : "Show standard text"}
          </button>
        ) : null}

        <ol className="mt-4 space-y-1 border-t pt-3 text-xs text-muted-foreground" aria-label="Sources">
          {o.sources.map((s, i) => (
            <li key={i} id={`${anchor}-fn-${i + 1}`} className="flex gap-2">
              <span className="text-brass tabular-nums">{i + 1}</span>
              <span className="min-w-0 break-words">
                {s.pinpoint} —{" "}
                <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {new URL(s.url).hostname.replace(/^www\./, "")}
                </a>
              </span>
            </li>
          ))}
          <li className="pt-1">Last verified {formatDate(o.lastVerified)}</li>
        </ol>

        {reviewer ? (
          <div className="mt-3 rounded-lg border border-dashed p-3 text-xs">
            <p className="eyebrow">Reviewer</p>
            <p className="mt-1.5">
              <span className={cn("font-medium", o.confidence !== "verified" && "text-status-new")}>{confidenceLabels[o.confidence]}</span> · {o.id} · verified by {o.verifiedBy}
            </p>
            <p className="mt-1">
              <Link href={`/research-log/${result.jurisdiction}`} className="underline underline-offset-4">
                Research log for {result.jurisdiction}
              </Link>
            </p>
          </div>
        ) : null}
      </div>

      <aside className="marginal-note self-start lg:mt-10">
        <span className="sr-only">Why this applies: </span>
        {o.appliesIfNote}
      </aside>
    </article>
  );
}

/* ── One jurisdiction ─────────────────────────────────────────────────────── */

export function JurisdictionSection({
  index, section, kb, gdprBaseline, reviewer, checklist, onToggle, tailored, showStandard, onShowStandard, developments,
}: {
  tailored: Record<string, Tailored>;
  showStandard: Record<string, boolean>;
  onShowStandard: (id: string, standard: boolean) => void;
  developments: DevelopmentsState;
  index: number;
  section: JurisdictionReport;
  kb: Jurisdiction;
  gdprBaseline: boolean;
  reviewer: boolean;
  checklist: Record<string, boolean>;
  onToggle: (id: string, done: boolean) => void;
}) {
  const done = section.results.filter((r) => checklist[r.obligation.id]).length;
  const toReview = kb.obligations.filter((o) => o.confidence !== "verified").length;
  return (
    <section aria-labelledby={jurisdictionAnchor(section.jurisdiction)} className="scroll-mt-6">
      <ReportHeading
        id={jurisdictionAnchor(section.jurisdiction)}
        mark={`§ ${index}`}
        eyebrow={section.role === "hq" ? "Headquarters" : section.role === "target" ? "Planned entry" : "Current operations"}
      >
        {section.name}
      </ReportHeading>

      <p className="mt-5 max-w-prose text-sm text-muted-foreground">
        <WithTerms text={kb.scopeNotes} terms={kb.definedTerms} />
      </p>
      {kb.contextNotes.map((n) => (
        <aside key={n.title} className="mt-4 max-w-prose rounded-lg border border-status-partial/40 bg-status-partial/8 p-3 text-sm">
          <p className="font-medium text-status-partial">{n.title}</p>
          <p className="mt-1">{n.text}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {n.source.pinpoint} —{" "}
            <a href={n.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {new URL(n.source.url).hostname.replace(/^www\./, "")}
            </a>{" "}
            · checked {formatDate(n.lastVerified)}
          </p>
        </aside>
      ))}
      <p className="mt-3 text-sm">
        <span className="font-medium tabular-nums">{section.results.length}</span> items
        {gdprBaseline ? (
          <span className="text-muted-foreground">
            {" "}
            · {section.deltaCounts.covered} covered · {section.deltaCounts.partial} partial · {section.deltaCounts.new} new
          </span>
        ) : null}
        <span className="text-muted-foreground">
          {" "}
          · {done} of {section.results.length} marked done · knowledge base reviewed {formatDate(section.lastReviewed)}
        </span>
      </p>
      {reviewer ? (
        <p className="mt-2 text-xs">
          <span className="eyebrow mr-2">Reviewer</span>
          {toReview} of {kb.obligations.length} knowledge-base items for this jurisdiction await counsel review ·{" "}
          <Link href={`/research-log/${section.jurisdiction}`} className="underline underline-offset-4">
            research log
          </Link>
        </p>
      ) : null}

      <div className="mt-6 border-b">
        {section.results.map((r) => (
          <ObligationItem
            key={r.obligation.id}
            result={r}
            terms={kb.definedTerms}
            gdprBaseline={gdprBaseline}
            reviewer={reviewer}
            done={!!checklist[r.obligation.id]}
            onToggle={onToggle}
            tailored={tailored[r.obligation.id]}
            showStandard={!!showStandard[r.obligation.id]}
            onShowStandard={onShowStandard}
          />
        ))}
      </div>

      <DevelopmentsPanel jurisdiction={section.jurisdiction} name={section.name} lastReviewed={section.lastReviewed} state={developments} />
    </section>
  );
}
