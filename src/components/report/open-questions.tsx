"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import type { OpenQuestion, Report } from "@/lib/engine/types";
import { questionAnchor } from "@/lib/report/labels";

import { ItemLink, Tag } from "./parts";

type AnswerThreshold = (key: string, value: boolean | null) => void;

/** Yes / No radios for a threshold question; answering stores a known boolean and recomputes the report. */
function ThresholdAnswer({ name, value, onAnswer }: { name: string; value: boolean | undefined; onAnswer: (v: boolean) => void }) {
  return (
    <div className="no-print mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Answer">
      {[true, false].map((v) => (
        <label
          key={String(v)}
          className="flex min-h-11 items-center gap-2.5 rounded-lg border border-input bg-card px-3 py-2 text-sm has-checked:border-primary has-checked:bg-secondary has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
        >
          <input type="radio" name={name} checked={value === v} onChange={() => onAnswer(v)} className="size-4 accent-primary" />
          {v ? "Yes" : "No"}
        </label>
      ))}
    </div>
  );
}

function QuestionCard({ q, n, report, onAnswer }: { q: OpenQuestion; n: number; report: Report; onAnswer: AnswerThreshold }) {
  const byId = new Map(report.jurisdictions.flatMap((j) => j.results).map((r) => [r.obligation.id, r]));
  const anchor = questionAnchor(q.id);
  return (
    <li id={anchor} tabIndex={-1} className="rounded-lg border bg-card p-4 outline-none focus:outline-2 focus:outline-offset-4 focus:outline-ring">
      <div className="flex flex-wrap items-center gap-2">
        <span className="para-num">D.{n}</span>
        {q.priority ? <Tag className="border-primary/40 text-primary">Priority</Tag> : null}
        <Tag>
          Affects {q.impact} {q.impact === 1 ? "item" : "items"}
        </Tag>
        <span className="text-sm text-muted-foreground">{q.jurisdictions.join(", ")}</span>
      </div>
      <h3 className="mt-2 font-sans text-base font-semibold">{q.question}</h3>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">{q.whyItMatters}</p>

      {q.subAnswers ? (
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
          {q.subAnswers.map((s) => (
            <div key={s.fact} className="contents">
              <dt className="text-muted-foreground first-letter:uppercase">{s.label}</dt>
              <dd className={s.unresolved ? "font-medium text-status-partial" : undefined}>{s.answer}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {q.threshold ? <ThresholdAnswer name={anchor} value={undefined} onAnswer={(v) => onAnswer(q.threshold!.key, v)} /> : null}

      <details className="mt-3 text-sm">
        <summary className="text-muted-foreground">Items that depend on this answer</summary>
        <ul className="mt-2 space-y-1">
          {q.obligationIds.map((id) => (
            <li key={id}>
              <ItemLink result={byId.get(id)!} />
            </li>
          ))}
        </ul>
      </details>

      {q.resolveHref ? (
        <Link
          href={q.resolveHref}
          className="no-print mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary px-3 text-sm font-medium text-primary hover:bg-secondary"
        >
          Resolve in the assessment
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </li>
  );
}

export function OpenQuestions({ report, onAnswer }: { report: Report; onAnswer: AnswerThreshold }) {
  return (
    <div className="space-y-6">
      <p className="max-w-prose text-sm text-muted-foreground">
        Where an answer was “Don&apos;t know” or “Prefer not to say”, the report assumes the case that makes an obligation apply and marks the item “Assumption”.
        Each question below would settle one or more of those items. Resolving one takes you back to that question; the report is recalculated when you return.
      </p>

      {report.openQuestions.length ? (
        <ol className="space-y-4">
          {report.openQuestions.map((q, i) => (
            <QuestionCard key={q.id} q={q} n={i + 1} report={report} onAnswer={onAnswer} />
          ))}
        </ol>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border bg-card p-4 text-sm">
          <Check aria-hidden="true" className="size-4 text-status-covered" />
          No open questions. Every item in this report follows from your answers.
        </p>
      )}

      {report.answeredThresholds.length ? (
        <div>
          <h3 className="text-lg font-semibold text-primary">Threshold questions you answered here</h3>
          <ul className="mt-3 space-y-3">
            {report.answeredThresholds.map((t) => (
              <li key={t.key} className="rounded-lg border bg-card p-4">
                <p className="text-sm font-medium">{t.question}</p>
                <p className="mt-1 hidden text-sm print:block">Answer: {t.answer ? "Yes" : "No"}</p>
                <ThresholdAnswer name={`answered-${t.key}`} value={t.answer} onAnswer={(v) => onAnswer(t.key, v)} />
                <button type="button" onClick={() => onAnswer(t.key, null)} className="no-print mt-2 text-sm text-muted-foreground underline underline-offset-4">
                  Clear this answer
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.unansweredNoEffect.length ? (
        <details className="rounded-lg border p-4 text-sm">
          <summary className="font-medium">
            Unanswered, with no effect on this report ({report.unansweredNoEffect.length})
          </summary>
          <p className="no-print mt-2 max-w-prose text-muted-foreground">
            These answers are also open, but no item in this report depends on them. They are not counted as open questions and are left out of the follow-up
            questionnaire.
          </p>
          <ul className="no-print mt-3 space-y-1.5">
            {report.unansweredNoEffect.map((u) => (
              <li key={u.id}>
                {u.question}{" "}
                {u.resolveHref ? (
                  <Link href={u.resolveHref} className="no-print text-muted-foreground underline underline-offset-4">
                    answer
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
