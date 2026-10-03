"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Pencil, Printer } from "lucide-react";
import { AlertDialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { assessmentSignature, buildTailorRequests } from "@/lib/ai/build-request";
import type { TailoredItem } from "@/lib/ai/tailor-schema";
import { evaluate } from "@/lib/engine/evaluate";
import { referenceIntake } from "@/lib/engine/fixtures";
import { emptyDraft, fromIntake, toAssessment, type Draft } from "@/lib/intake/draft";
import type { FxTable } from "@/lib/intake/money";
import { SessionIntakeStore, type IntakeDraft } from "@/lib/intake/store";
import type { Jurisdiction } from "@/lib/kb/schema";
import { deadlines } from "@/lib/report/derive";
import { formatDate, jurisdictionAnchor } from "@/lib/report/labels";

import { AiPanel, type TailorProgress } from "./ai-panel";
import { Glossary, GovernanceFindings, Roadmap, TransferMap } from "./appendices";
import type { DevelopmentsState } from "./developments-panel";
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

  // Loading a sample replaces the session's answers, so ask first when there are any.
  const [pendingSample, setPendingSample] = useState<"unknown" | "low" | null>(null);
  const requestSample = (variant: "unknown" | "low") => (saved ? setPendingSample(variant) : loadSample(variant));

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

  /* ── Optional AI assistance (opt-in) ── */
  const [progress, setProgress] = useState<TailorProgress[]>([]);
  const [tailoring, setTailoring] = useState(false);
  const [developments, setDevelopments] = useState<Record<string, DevelopmentsState>>({});
  const signature = assessment?.success ? assessmentSignature(assessment.data.intake, assessment.data.assessmentDate) : "";
  // Tailored text is only shown for the assessment it was written for.
  const tailored = state.tailored?.signature === signature ? state.tailored.items : {};

  async function post(url: string, body: unknown): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /** One request per jurisdiction. A failed jurisdiction silently keeps its standard text. */
  async function tailorReport() {
    if (!report || !assessment?.success || !state.aiConsent || tailoring) return;
    setTailoring(true);
    const items: Record<string, { explanation: string; steps: string[] }> = {};
    let model = "";
    let status: TailorProgress[] = report.jurisdictions.map((j) => ({ jurisdiction: j.jurisdiction, name: j.name, status: "waiting" }));
    const mark = (id: string, change: Partial<TailorProgress>) => {
      status = status.map((p) => (p.jurisdiction === id ? { ...p, ...change } : p));
      setProgress(status);
    };
    setProgress(status);
    for (const section of report.jurisdictions) {
      mark(section.jurisdiction, { status: "working" });
      let count = 0;
      for (const request of buildTailorRequests(section, assessment.data.intake)) {
        const result = await post("/api/tailor", request);
        if (result?.ok !== true) continue;
        const known = new Set(request.obligations.map((o) => o.id));
        for (const item of result.items as TailoredItem[]) {
          if (!known.has(item.id)) continue;
          items[item.id] = { explanation: item.tailoredExplanation, steps: item.tailoredSteps };
          count++;
        }
        model = String(result.model ?? model);
      }
      mark(section.jurisdiction, count ? { status: "done", tailored: count } : { status: "standard" });
    }
    if (Object.keys(items).length) updateState({ tailored: { signature, model, items }, showStandard: {} });
    setTailoring(false);
  }

  async function checkDevelopments(jurisdiction: string, name: string) {
    if (!state.aiConsent) return;
    setDevelopments((d) => ({ ...d, [jurisdiction]: { status: "loading" } }));
    const result = await post("/api/developments", { consent: true, jurisdiction });
    setDevelopments((d) => ({
      ...d,
      [jurisdiction]:
        result?.ok === true
          ? {
              status: "ok",
              items: result.items as never,
              checkedAt: String(result.checkedAt),
              since: String(result.since),
              cached: result.cached === true,
              searchedDomains: (result.searchedDomains as string[]) ?? [],
            }
          : { status: "unavailable", message: typeof result?.message === "string" ? result.message : `Developments check unavailable for ${name}` },
    }));
  }

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
          <Button variant="outline" onClick={() => requestSample("unknown")}>
            Sample: every threshold “Don&apos;t know”
          </Button>
          <Button variant="outline" onClick={() => requestSample("low")}>
            Sample: known low values
          </Button>
        </div>

        <AlertDialog.Root open={pendingSample !== null} onOpenChange={(open) => !open && setPendingSample(null)}>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
            <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-6 shadow-lg">
              <AlertDialog.Title className="text-xl font-semibold text-primary">Replace your answers?</AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
                This browser session already has assessment answers. Loading the sample deletes them, together with any checklist ticks. This cannot be undone.
              </AlertDialog.Description>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <AlertDialog.Cancel asChild>
                  <Button variant="outline">Keep my answers</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button onClick={() => pendingSample && loadSample(pendingSample)}>Replace with the sample</Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
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

      <AiPanel
        consent={state.aiConsent}
        onConsent={(aiConsent) => updateState({ aiConsent })}
        anonymised={intake.company.anonymized}
        progress={progress}
        running={tailoring}
        hasTailoring={Object.keys(tailored).length > 0}
        onTailor={tailorReport}
        onRemove={() => {
          updateState({ tailored: undefined, showStandard: {} });
          setProgress([]);
        }}
      />

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
            tailored={tailored}
            showStandard={state.showStandard}
            onShowStandard={(id, standard) => updateState({ showStandard: { ...state.showStandard, [id]: standard } })}
            aiConsent={state.aiConsent}
            developments={developments[j.jurisdiction] ?? { status: "idle" }}
            onCheckDevelopments={() => checkDevelopments(j.jurisdiction, j.name)}
          />
        ))}

        <section aria-labelledby="transfers">
          <ReportHeading id="transfers" mark="A" eyebrow="Appendix">Transfer map</ReportHeading>
          <div className="mt-6">
            <TransferMap report={report} />
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
