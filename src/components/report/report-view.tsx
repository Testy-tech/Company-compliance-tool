"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Pencil, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { evaluate } from "@/lib/engine/evaluate";
import { referenceIntake } from "@/lib/engine/fixtures";
import { emptyDraft, fromIntake, toAssessment, type Draft } from "@/lib/intake/draft";
import type { FxTable } from "@/lib/intake/money";
import { SessionIntakeStore, type IntakeDraft } from "@/lib/intake/store";
import type { Jurisdiction } from "@/lib/kb/schema";
import { deadlines, transferFlows } from "@/lib/report/derive";
import { formatDate, jurisdictionAnchor } from "@/lib/report/labels";

import { Glossary, GovernanceFindings, Roadmap, TransferMap } from "./appendices";
import { Heatmap } from "./heatmap";
import { JurisdictionSection } from "./jurisdiction-section";
import { OpenQuestions } from "./open-questions";
import { ReportHeading } from "./parts";
import { ExecutiveSummary } from "./summary";

const noopSubscribe = () => () => {};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Props = { kb: Jurisdiction[]; fx: FxTable };

export function ReportView(props: Props) {
  // The assessment lives in sessionStorage, so the report is computed on the client only.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return <p className="text-muted-foreground">Preparing your report…</p>;
  return <ReportBody {...props} />;
}

function ReportBody({ kb, fx }: Props) {
  const store = useMemo(() => new SessionIntakeStore(), []);
  const [saved, setSaved] = useState<IntakeDraft | null>(() => store.load());
  const [state, setState] = useState(() => store.loadReportState());

  const draft = useMemo<Draft | null>(() => (saved ? { ...emptyDraft(), ...(saved.values as Draft) } : null), [saved]);
  const assessment = useMemo(() => (draft && saved ? toAssessment(draft, saved.assessmentDate) : null), [draft, saved]);
  const report = useMemo(() => (assessment?.success ? evaluate(assessment.data, kb, fx) : null), [assessment, kb, fx]);

  const persist = useCallback(
    (next: IntakeDraft) => {
      store.save(next);
      setSaved(next);
    },
    [store],
  );

  const loadSample = (variant: "unknown" | "low") => {
    store.clear();
    setState(store.loadReportState());
    persist({ version: 1, assessmentDate: today(), step: 8, values: fromIntake(referenceIntake(variant)), updatedAt: new Date().toISOString() });
  };

  /** Store (or clear) a yes/no threshold answer as a known fact and recompute. */
  const answerThreshold = (key: string, value: boolean | null) => {
    if (!saved || !draft) return;
    const thresholdAnswers = { ...draft.thresholdAnswers };
    if (value === null) delete thresholdAnswers[key];
    else thresholdAnswers[key] = { status: "known", value };
    persist({ ...saved, values: { ...draft, thresholdAnswers }, updatedAt: new Date().toISOString() });
  };

  const updateState = (change: Partial<typeof state>) => {
    const next = { ...state, ...change };
    store.saveReportState(next);
    setState(next);
  };
  const toggleDone = (id: string, done: boolean) => updateState({ checklist: { ...state.checklist, [id]: done } });

  if (!report || !assessment?.success) {
    return (
      <div className="max-w-prose">
        <h1 className="text-3xl font-semibold text-primary sm:text-4xl">Report</h1>
        <hr className="rule-brass mt-5 w-16" />
        <p className="mt-6 text-lg text-muted-foreground">
          {saved ? "Your assessment is not complete yet. Finish the remaining questions to see the report." : "There is no assessment in this browser session yet."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/assess">{saved ? "Continue the assessment" : "Start the assessment"}</Link>
          </Button>
        </div>
        <h2 className="mt-12 text-lg font-semibold text-primary">Or look at a sample</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          An Italy-headquartered engineering group with entities in nine other jurisdictions. Loading a sample replaces any answers saved in this session.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => loadSample("unknown")}>
            Sample: every threshold “Don&apos;t know”
          </Button>
          <Button variant="outline" onClick={() => loadSample("low")}>
            Sample: known low values
          </Button>
        </div>
      </div>
    );
  }

  const { intake } = assessment.data;
  const kbOf = (id: string) => kb.find((j) => j.id === id)!;
  const reviewer = state.reviewerMode;
  const allIds = report.jurisdictions.flatMap((j) => j.results.map((r) => r.obligation.id));
  const doneCount = allIds.filter((id) => state.checklist[id]).length;

  return (
    <div>
      <header>
        <p className="eyebrow">Privacy obligations report · assessed as of {formatDate(report.assessmentDate)}</p>
        <h1 className="mt-3 text-3xl font-semibold text-primary sm:text-4xl">{intake.company.label}</h1>
        <hr className="rule-brass mt-5 w-16" />

        <aside aria-label="Not legal advice" className="mt-6 rounded-lg border border-brass-rule bg-card p-4 text-sm">
          <p>
            <strong className="font-semibold">This report is not legal advice.</strong> It is generated from your answers and a knowledge base that is still
            awaiting review by qualified counsel. Verify every item with counsel in the jurisdiction concerned before acting on it.
          </p>
          <p className="mt-2 text-muted-foreground">
            Knowledge base last reviewed:{" "}
            {report.jurisdictions.map((j, i) => (
              <span key={j.jurisdiction}>
                {i ? " · " : ""}
                {j.jurisdiction} {formatDate(j.lastReviewed)}
              </span>
            ))}
          </p>
        </aside>

        <div className="no-print mt-6 flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/assess">
              <Pencil aria-hidden="true" data-icon="inline-start" />
              Edit answers
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer aria-hidden="true" data-icon="inline-start" />
            Print
          </Button>
          <label className="ml-auto flex min-h-9 items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              role="switch"
              checked={reviewer}
              onChange={(e) => updateState({ reviewerMode: e.target.checked })}
              className="size-4 accent-primary"
            />
            Reviewer mode
          </label>
        </div>
        {reviewer ? (
          <p className="mt-3 rounded-lg border border-dashed p-3 text-sm">
            <span className="eyebrow mr-2">Reviewer</span>
            Showing knowledge-base confidence, verifier and research-log links on every item. Clients do not see these.
          </p>
        ) : null}
      </header>

      <nav aria-label="Report contents" className="no-print mt-8 rounded-lg border bg-card p-4 text-sm">
        <p className="eyebrow">Contents</p>
        <ol className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          <li><a className="underline underline-offset-4" href="#summary">Executive summary</a></li>
          <li><a className="underline underline-offset-4" href="#matrix">Coverage matrix</a></li>
          {report.jurisdictions.map((j, i) => (
            <li key={j.jurisdiction}>
              <a className="underline underline-offset-4" href={`#${jurisdictionAnchor(j.jurisdiction)}`}>
                § {i + 1} {j.name}
              </a>
            </li>
          ))}
          <li><a className="underline underline-offset-4" href="#transfers">A Transfer map</a></li>
          <li><a className="underline underline-offset-4" href="#governance">B Governance findings</a></li>
          <li><a className="underline underline-offset-4" href="#roadmap">C 30/60/90-day roadmap</a></li>
          <li><a className="underline underline-offset-4" href="#open-questions">D Assumptions &amp; open questions</a></li>
          <li><a className="underline underline-offset-4" href="#glossary">E Glossary</a></li>
        </ol>
      </nav>

      <div className="mt-12 space-y-16">
        <section aria-labelledby="summary">
          <ReportHeading id="summary" mark="§">Executive summary</ReportHeading>
          <div className="mt-6">
            <ExecutiveSummary report={report} upcoming={deadlines(report, kb)} />
          </div>
        </section>

        <section aria-labelledby="matrix">
          <ReportHeading id="matrix" mark="§">Coverage matrix</ReportHeading>
          <div className="mt-6">
            <Heatmap report={report} />
          </div>
        </section>

        <p className="text-sm text-muted-foreground" role="status">
          Checklist: {doneCount} of {allIds.length} items marked done. Ticks are kept in this browser session.
        </p>

        {report.jurisdictions.map((j, i) => (
          <JurisdictionSection
            key={j.jurisdiction}
            index={i + 1}
            section={j}
            kb={kbOf(j.jurisdiction)}
            gdprBaseline={report.gdprBaseline}
            reviewer={reviewer}
            checklist={state.checklist}
            onToggle={toggleDone}
          />
        ))}

        <section aria-labelledby="transfers">
          <ReportHeading id="transfers" mark="A" eyebrow="Appendix">Transfer map</ReportHeading>
          <div className="mt-6">
            <TransferMap flows={transferFlows(report, intake)} />
          </div>
        </section>

        <section aria-labelledby="governance">
          <ReportHeading id="governance" mark="B" eyebrow="Appendix">Governance findings</ReportHeading>
          <div className="mt-6">
            <GovernanceFindings report={report} />
          </div>
        </section>

        <section aria-labelledby="roadmap">
          <ReportHeading id="roadmap" mark="C" eyebrow="Appendix">30/60/90-day roadmap</ReportHeading>
          <div className="mt-6">
            <Roadmap report={report} checklist={state.checklist} />
          </div>
        </section>

        <section aria-labelledby="open-questions">
          <ReportHeading id="open-questions" mark="D" eyebrow="Appendix">Assumptions &amp; open questions</ReportHeading>
          <div className="mt-6">
            <OpenQuestions report={report} onAnswer={answerThreshold} />
          </div>
        </section>

        <section aria-labelledby="glossary">
          <ReportHeading id="glossary" mark="E" eyebrow="Appendix">Glossary of defined terms</ReportHeading>
          <div className="mt-6">
            <Glossary report={report} kb={kb} />
          </div>
        </section>

        <p className="border-t pt-6 text-sm text-muted-foreground">
          Informational tool, not legal advice. Generated from the answers saved in this browser session; nothing was sent to a server.
        </p>
      </div>
    </div>
  );
}
