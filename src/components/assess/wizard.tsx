"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronLeft, ChevronRight, CircleAlert, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { emptyDraft, type Draft } from "@/lib/intake/draft";
import { SessionIntakeStore } from "@/lib/intake/store";
import type { WizardConfig } from "@/lib/kb/wizard-config";
import { cn } from "@/lib/utils";

import { steps } from "./steps";
import type { StepIssue } from "./types";

const noopSubscribe = () => () => {};

/** Today's date in the user's time zone, as YYYY-MM-DD. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Scroll to a question and focus it: the group itself for radios/checkboxes, the control for single fields. */
function focusQuestion(anchor: string): boolean {
  const el = document.getElementById(anchor);
  if (!el) return false;
  el.scrollIntoView({ block: "start" });
  (el.matches("fieldset") ? el : el.querySelector<HTMLElement>("input, select") ?? el).focus({ preventScroll: true });
  return true;
}

/** Step that contains the question a "#q-<id>[-<jurisdiction>]" link points at. */
function stepForHash(hash: string): number {
  const anchor = hash.replace(/^#/, "");
  let best = -1;
  let bestLength = 0;
  steps.forEach((s, i) => {
    for (const q of s.questionIds) {
      const a = `q-${q}`;
      if ((anchor === a || anchor.startsWith(`${a}-`)) && a.length > bestLength) [best, bestLength] = [i, a.length];
    }
  });
  return best;
}

export function Wizard({ config }: { config: WizardConfig }) {
  // Answers live in sessionStorage, so the form is rendered on the client only.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return <p className="text-muted-foreground">Loading your saved answers…</p>;
  return <WizardForm config={config} />;
}

function WizardForm({ config }: { config: WizardConfig }) {
  const store = useMemo(() => new SessionIntakeStore(), []);
  const [initial] = useState(() => {
    const saved = store.load();
    const draft: Draft = saved ? { ...emptyDraft(), ...(saved.values as Draft) } : emptyDraft();
    const savedStep = Math.min(Math.max(saved?.step ?? 0, 0), steps.length - 1);
    const linked = stepForHash(window.location.hash);
    return { draft, assessmentDate: saved?.assessmentDate ?? today(), step: linked >= 0 ? linked : savedStep, reached: Math.max(savedStep, linked), anchor: linked >= 0 ? window.location.hash.slice(1) : null };
  });

  const [draft, setDraft] = useState(initial.draft);
  const [assessmentDate, setAssessmentDate] = useState(initial.assessmentDate);
  const [step, setStep] = useState(initial.step);
  const [reached, setReached] = useState(initial.reached);
  const [issues, setIssues] = useState<StepIssue[]>([]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const pendingAnchor = useRef<string | null>(initial.anchor);
  const shownStep = useRef(initial.step);

  useEffect(() => {
    store.save({ version: 1, assessmentDate, step, values: draft, updatedAt: new Date().toISOString() });
  }, [store, assessmentDate, draft, step]);

  // On a step change, move focus to the step heading — or to the question a "Resolve" link asked for.
  // Idempotent, because React runs effects twice in development.
  useEffect(() => {
    const anchor = pendingAnchor.current;
    if (anchor && focusQuestion(anchor)) {
      // focused the linked question
    } else if (shownStep.current !== step) {
      headingRef.current?.scrollIntoView({ block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    }
    shownStep.current = step;
  }, [step]);

  useEffect(() => {
    if (issues.length) errorRef.current?.focus();
  }, [issues]);

  const update = useCallback((change: (d: Draft) => void) => {
    setDraft((d) => {
      const next = structuredClone(d);
      change(next);
      return next;
    });
  }, []);

  const goTo = useCallback((i: number) => {
    pendingAnchor.current = null;
    setIssues([]);
    setStep(i);
    setReached((r) => Math.max(r, i));
  }, []);

  // A "Resolve" link followed while the wizard is already open only changes the hash.
  useEffect(() => {
    function onHashChange() {
      const linked = stepForHash(window.location.hash);
      if (linked < 0) return;
      const anchor = window.location.hash.slice(1);
      if (linked === step) {
        focusQuestion(anchor);
      } else {
        goTo(linked);
        pendingAnchor.current = anchor;
      }
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [step, goTo]);

  const current = steps[step]!;
  const isLast = step === steps.length - 1;
  // After a failed "Next", keep only the problems that are still open as the user answers them.
  const openIssues = useMemo(() => {
    if (!issues.length) return issues;
    const still = new Set(current.validate(draft, config).map((i) => i.anchor));
    return issues.filter((i) => still.has(i.anchor));
  }, [issues, current, draft, config]);
  const errors = useMemo(() => Object.fromEntries(openIssues.map((i) => [i.anchor, i.message])), [openIssues]);

  function next() {
    const found = current.validate(draft, config);
    if (found.length) setIssues(found);
    else goTo(step + 1);
  }

  function startOver() {
    if (!window.confirm("Clear all answers and start again?")) return;
    store.clear();
    setDraft(emptyDraft());
    setAssessmentDate(today());
    setReached(0);
    goTo(0);
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!isLast) next();
      }}
    >
      <nav aria-label="Assessment steps" className="no-print">
        <div
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step + 1}
          aria-valuetext={`Step ${step + 1} of ${steps.length}: ${current.title}`}
          className="h-1.5 overflow-hidden rounded-full bg-secondary"
        >
          <div className="h-full bg-brass-rule transition-[width]" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <ol className="mt-3 flex flex-wrap gap-x-1 gap-y-1 text-sm">
          {steps.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={i > reached}
                aria-current={i === step ? "step" : undefined}
                onClick={() => goTo(i)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded px-2 text-muted-foreground disabled:opacity-60",
                  i === step && "bg-secondary font-medium text-primary",
                  i <= reached && i !== step && "hover:text-foreground hover:underline",
                )}
              >
                {i < step ? <Check aria-hidden="true" className="size-3.5 text-status-covered" /> : <span className="tabular-nums">{i + 1}.</span>}
                {s.title}
                {i < step ? <span className="sr-only">(completed)</span> : null}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-8">
        <p className="eyebrow">
          Step {step + 1} of {steps.length}
        </p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-semibold text-primary outline-none sm:text-3xl">
          {current.title}
        </h2>
        <hr className="rule-brass mt-4 w-16" />
        <p className="mt-4 max-w-prose text-muted-foreground">{current.intro}</p>
      </div>

      {openIssues.length ? (
        <div ref={errorRef} tabIndex={-1} role="alert" className="mt-6 rounded-lg border border-destructive bg-card p-4 outline-none">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <CircleAlert aria-hidden="true" className="size-4" />
            {openIssues.length === 1 ? "1 question still needs an answer" : `${openIssues.length} questions still need an answer`}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
            {openIssues.map((i) => (
              <li key={i.anchor}>
                <a
                  href={`#${i.anchor}`}
                  className="underline underline-offset-4"
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById(i.anchor);
                    el?.scrollIntoView({ block: "start" });
                    (el?.querySelector<HTMLElement>("input:not(:disabled), select") ?? el)?.focus({ preventScroll: true });
                  }}
                >
                  {i.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8">
        <current.Component draft={draft} update={update} config={config} errors={errors} goTo={goTo} />
      </div>

      <div className="no-print mt-10 flex flex-wrap items-center gap-3 border-t pt-6">
        <Button type="button" variant="outline" disabled={step === 0} onClick={() => goTo(step - 1)}>
          <ChevronLeft aria-hidden="true" data-icon="inline-start" />
          Back
        </Button>
        {!isLast ? (
          <Button type="submit">
            Next
            <ChevronRight aria-hidden="true" data-icon="inline-end" />
          </Button>
        ) : null}
        <Button type="button" variant="ghost" className="ml-auto" onClick={startOver}>
          <RotateCcw aria-hidden="true" data-icon="inline-start" />
          Start over
        </Button>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Answers are kept in this browser session only and are not sent to a server.</p>
    </form>
  );
}
