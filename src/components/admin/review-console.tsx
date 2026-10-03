"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ExternalLink, Flag, Pencil, Plus, SkipForward, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { editFieldsSchema, type EditFields, type ReviewResult } from "@/lib/admin/actions";
import { logExcerpt, reviewQueue } from "@/lib/admin/queue";
import { obligationCategories, type Obligation } from "@/lib/kb/schema";
import { categoryLabels, confidenceLabels, formatDate, ownerLabels, priorityLabels, priorityRank } from "@/lib/report/labels";

/*
 * Review console (development only). Counsel works through the knowledge base:
 * verify, edit or flag each obligation. Every save goes through the server,
 * which validates, runs the engine tests and restores the file if they fail.
 */

type JurisdictionItems = { id: string; name: string; obligations: Obligation[] };
type Item = Obligation & { jurisdiction: string };
type Props = { jurisdictions: JurisdictionItems[]; researchLogs: Record<string, string>; reviewer: string | null; changes: number };

const controlClass =
  "w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";
const priorities = ["critical", "high", "medium", "low"] as const;
const states = ["verified", "needs_review", "unverified", "flagged"] as const;
type State = (typeof states)[number];
const stateLabels: Record<State, string> = { verified: "Verified", needs_review: "Needs review", unverified: "Unverified", flagged: "Flagged" };
const stageLabels = { config: "Configuration", input: "Input", validator: "Knowledge-base validator", tests: "Engine and KB tests" } as const;

/** Flagged is shown as its own state: needs review, with a reviewer's note attached. */
const stateOf = (o: Obligation): State => (o.reviewNote && o.confidence !== "verified" ? "flagged" : o.confidence);

type Outcome = { kind: "ok"; message: string } | { kind: "error"; stage: keyof typeof stageLabels; errors: string[] } | null;

export function ReviewConsole({ jurisdictions, researchLogs, reviewer, changes }: Props) {
  const router = useRouter();
  const all = useMemo<Item[]>(() => jurisdictions.flatMap((j) => j.obligations.map((o) => ({ ...o, jurisdiction: j.id }))), [jurisdictions]);
  const names = useMemo(() => Object.fromEntries(jurisdictions.map((j) => [j.id, j.name])), [jurisdictions]);

  const [mode, setMode] = useState<"table" | "queue">("table");
  const [filters, setFilters] = useState({ jurisdiction: "", priority: "", state: "", category: "" });
  const [descending, setDescending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [panel, setPanel] = useState<"none" | "edit" | "flag">("none");
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);

  // Queue: items nobody has looked at yet. Flagged items have been looked at, so they leave the queue.
  const queue = useMemo(() => reviewQueue(all.filter((o) => stateOf(o) !== "flagged")), [all]);
  const at = Math.min(cursor, Math.max(queue.length - 1, 0));

  const rows = useMemo(() => {
    const list = all.filter(
      (o) =>
        (!filters.jurisdiction || o.jurisdiction === filters.jurisdiction) &&
        (!filters.priority || o.priority === filters.priority) &&
        (!filters.state || stateOf(o) === filters.state) &&
        (!filters.category || o.category === filters.category),
    );
    const order = all.map((o) => o.id);
    return list.sort((a, b) => (priorityRank[a.priority] - priorityRank[b.priority]) * (descending ? -1 : 1) || order.indexOf(a.id) - order.indexOf(b.id));
  }, [all, filters, descending]);

  const current: Item | undefined = mode === "queue" ? queue[at] : all.find((o) => o.id === selected);

  const show = (id: string | null) => {
    setSelected(id);
    setPanel("none");
    setOutcome(null);
  };
  const next = (step = 1) => {
    if (!queue.length) return;
    setCursor((at + step + queue.length) % queue.length);
    setPanel("none");
    setOutcome(null);
  };

  async function send(body: { action: "verify"; id: string } | { action: "flag"; id: string; note: string } | { action: "edit"; id: string; fields: EditFields }) {
    if (busy) return;
    setBusy(body.action);
    setOutcome(null);
    try {
      const response = await fetch("/api/admin/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json()) as ReviewResult;
      if (result.ok) {
        const done = { verify: "Verified", flag: "Flagged", edit: "Saved" }[body.action];
        setOutcome({ kind: "ok", message: `${done} ${body.id}. Validator and tests passed; change recorded in the review log.` });
        setPanel("none");
        router.refresh();
      } else {
        setOutcome({ kind: "error", stage: result.stage, errors: result.errors });
      }
    } catch (e) {
      setOutcome({ kind: "error", stage: "input", errors: [`The request failed: ${String(e)}`] });
    } finally {
      setBusy(null);
    }
  }

  async function exportLog() {
    if (busy) return;
    setBusy("export");
    try {
      const response = await fetch("/api/admin/review/export", { method: "POST" });
      const result = (await response.json()) as { path: string; entries: number };
      setOutcome({ kind: "ok", message: `Review log written to ${result.path} (${result.entries} ${result.entries === 1 ? "change" : "changes"}).` });
    } catch (e) {
      setOutcome({ kind: "error", stage: "input", errors: [`The export failed: ${String(e)}`] });
    } finally {
      setBusy(null);
    }
  }

  const canAct = Boolean(reviewer) && !busy;
  const verify = () => current && canAct && current.confidence !== "verified" && send({ action: "verify", id: current.id });

  // Queue shortcuts: V verify, F flag, N next, P previous. Off while typing and outside queue mode.
  useEffect(() => {
    if (mode !== "queue") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable))) return;
      const key = e.key.toLowerCase();
      if (key === "v") verify();
      else if (key === "f" && current && canAct) setPanel("flag");
      else if (key === "n") next(1);
      else if (key === "p") next(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const filter = (key: keyof typeof filters, label: string, options: readonly (readonly [string, string])[]) => (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} className={`${controlClass} h-10`}>
        <option value="">All</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Development only</p>
          <h1 className="mt-2 text-3xl font-semibold text-primary">Review console</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {reviewer ? (
              <>
                Reviewing as <strong className="text-foreground">{reviewer}</strong> · {changes} {changes === 1 ? "change" : "changes"} recorded
              </>
            ) : (
              "No reviewer configured"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="View" className="flex rounded-lg border p-0.5">
            <Button size="sm" variant={mode === "table" ? "default" : "ghost"} aria-pressed={mode === "table"} onClick={() => (setMode("table"), setOutcome(null), setPanel("none"))}>
              All items
            </Button>
            <Button size="sm" variant={mode === "queue" ? "default" : "ghost"} aria-pressed={mode === "queue"} onClick={() => (setMode("queue"), setOutcome(null), setPanel("none"))}>
              Review queue ({queue.length})
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={exportLog} disabled={Boolean(busy)}>
            Export review log
          </Button>
        </div>
      </div>

      {!reviewer ? (
        <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Set <code>REVIEWER_NAME</code> in <code>.env.local</code> and restart the dev server. The name is recorded as <code>verifiedBy</code> and in the review log; nothing
          can be saved without it.
        </p>
      ) : null}

      <Counts jurisdictions={jurisdictions} onPick={(id) => (setMode("table"), setFilters({ jurisdiction: id, priority: "", state: "", category: "" }))} />

      {mode === "table" ? (
        <section aria-labelledby="items-heading" className="mt-8">
          <h2 id="items-heading" className="text-xl font-semibold text-primary">
            Obligations
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filter("jurisdiction", "Jurisdiction", jurisdictions.map((j) => [j.id, j.name] as const))}
            {filter("priority", "Priority", priorities.map((p) => [p, priorityLabels[p]] as const))}
            {filter("state", "Confidence", states.map((s) => [s, stateLabels[s]] as const))}
            {filter("category", "Category", obligationCategories.map((c) => [c, categoryLabels[c]] as const))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
            {rows.length} of {all.length} obligations
          </p>
          <div className="relative mt-2 max-h-[26rem] overflow-auto rounded-lg border" tabIndex={0} role="region" aria-label="Obligations table">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="sticky top-0 bg-secondary text-secondary-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Id</th>
                  <th scope="col" className="px-3 py-2 font-medium">Obligation</th>
                  <th scope="col" className="px-3 py-2 font-medium">Category</th>
                  <th scope="col" className="px-3 py-2 font-medium" aria-sort={descending ? "descending" : "ascending"}>
                    <button type="button" onClick={() => setDescending(!descending)} className="inline-flex items-center gap-1 rounded underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                      Priority {descending ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className={`border-t ${o.id === selected ? "bg-secondary" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{o.id}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => show(o.id)} aria-current={o.id === selected ? "true" : undefined} className="rounded text-left text-primary underline decoration-brass-rule underline-offset-4 hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50">
                        {o.title}
                      </button>
                    </td>
                    <td className="px-3 py-2">{categoryLabels[o.category]}</td>
                    <td className="px-3 py-2">{priorityLabels[o.priority]}</td>
                    <td className="px-3 py-2">
                      <StateBadge state={stateOf(o)} />
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No obligations match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section aria-labelledby="queue-heading" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="queue-heading" className="text-xl font-semibold text-primary">
              Review queue
            </h2>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {queue.length ? `Item ${at + 1} of ${queue.length} unreviewed` : "Nothing left to review"}
            </p>
          </div>
          <p className="marginal-note mt-2">
            By priority; within a priority China, Chile and California come first. Shortcuts: <kbd>V</kbd> verify · <kbd>F</kbd> flag · <kbd>N</kbd> next · <kbd>P</kbd>{" "}
            previous. They are off while you type in a field.
          </p>
        </section>
      )}

      <div aria-live="polite" className="mt-6">
        {outcome?.kind === "ok" ? <p className="rounded-lg border border-status-covered/40 bg-status-covered/10 p-3 text-sm">{outcome.message}</p> : null}
        {busy && busy !== "export" ? <p className="rounded-lg border p-3 text-sm text-muted-foreground">Saving, then running the validator and the engine tests…</p> : null}
      </div>
      {outcome?.kind === "error" ? (
        <div role="alert" className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p className="font-medium">Not saved — {stageLabels[outcome.stage]} reported a problem. The knowledge-base file is unchanged.</p>
          <ul className="mt-2 grid gap-1">
            {outcome.errors.map((e, i) => (e.includes("\n") ? <li key={i}><pre className="max-h-64 overflow-auto rounded bg-card p-2 text-xs whitespace-pre-wrap">{e}</pre></li> : <li key={i}>{e}</li>))}
          </ul>
        </div>
      ) : null}

      {current ? (
        <ItemView
          key={current.id}
          item={current}
          jurisdictionName={names[current.jurisdiction] ?? current.jurisdiction}
          log={researchLogs[current.jurisdiction] ?? ""}
          panel={panel}
          setPanel={setPanel}
          canAct={canAct}
          busy={busy}
          onVerify={verify}
          onFlag={(note) => send({ action: "flag", id: current.id, note })}
          onEdit={(fields) => send({ action: "edit", id: current.id, fields })}
          onNext={mode === "queue" ? () => next(1) : undefined}
        />
      ) : mode === "table" ? (
        <p className="mt-6 text-sm text-muted-foreground">Select an obligation to see its fields, sources and research notes.</p>
      ) : null}
    </div>
  );
}

function StateBadge({ state }: { state: State }) {
  const tone = { verified: "border-status-covered/50 text-status-covered", needs_review: "border-status-partial/50 text-status-partial", unverified: "border-status-new/50 text-status-new", flagged: "border-status-new/50 bg-status-new/10 text-status-new" }[state];
  return (
    <Badge variant="outline" className={tone}>
      {stateLabels[state]}
    </Badge>
  );
}

function Counts({ jurisdictions, onPick }: { jurisdictions: JurisdictionItems[]; onPick: (id: string) => void }) {
  const count = (list: Obligation[]) => Object.fromEntries(states.map((s) => [s, list.filter((o) => stateOf(o) === s).length])) as Record<State, number>;
  const total = count(jurisdictions.flatMap((j) => j.obligations));
  return (
    <section aria-labelledby="counts-heading" className="mt-8">
      <h2 id="counts-heading" className="text-xl font-semibold text-primary">
        Confidence by jurisdiction
      </h2>
      <div className="relative mt-3 overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Confidence counts">
        <table className="w-full min-w-[34rem] text-left text-sm tabular-nums">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Jurisdiction</th>
              {states.map((s) => (
                <th key={s} scope="col" className="px-3 py-2 text-right font-medium">{stateLabels[s]}</th>
              ))}
              <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {jurisdictions.map((j) => {
              const c = count(j.obligations);
              return (
                <tr key={j.id} className="border-t">
                  <th scope="row" className="px-3 py-1.5 font-normal">
                    <button type="button" onClick={() => onPick(j.id)} className="rounded text-primary underline decoration-brass-rule underline-offset-4 hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50">
                      {j.name}
                    </button>
                  </th>
                  {states.map((s) => (
                    <td key={s} className="px-3 py-1.5 text-right">{c[s]}</td>
                  ))}
                  <td className="px-3 py-1.5 text-right">{j.obligations.length}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <th scope="row" className="px-3 py-1.5">All</th>
              {states.map((s) => (
                <td key={s} className="px-3 py-1.5 text-right">{total[s]}</td>
              ))}
              <td className="px-3 py-1.5 text-right">{jurisdictions.reduce((n, j) => n + j.obligations.length, 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

type ItemViewProps = {
  item: Item;
  jurisdictionName: string;
  log: string;
  panel: "none" | "edit" | "flag";
  setPanel: (p: "none" | "edit" | "flag") => void;
  canAct: boolean;
  busy: string | null;
  onVerify: () => void;
  onFlag: (note: string) => void;
  onEdit: (fields: EditFields) => void;
  onNext?: () => void;
};

function ItemView({ item, jurisdictionName, log, panel, setPanel, canAct, busy, onVerify, onFlag, onEdit, onNext }: ItemViewProps) {
  const excerpt = useMemo(() => logExcerpt(log, item.id), [log, item.id]);
  const state = stateOf(item);
  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <>
        <dt className="text-muted-foreground">{label}</dt>
        <dd>{value}</dd>
      </>
    ) : null;

  return (
    <article aria-labelledby="item-heading" className="mt-6 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {item.id} · {jurisdictionName}
          </p>
          <h3 id="item-heading" className="mt-1 text-2xl font-semibold text-primary">
            {item.title}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <StateBadge state={state} />
            <Badge variant="outline">{priorityLabels[item.priority]} priority</Badge>
            <Badge variant="outline">{categoryLabels[item.category]}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onVerify} disabled={!canAct || item.confidence === "verified"} aria-keyshortcuts={onNext ? "V" : undefined}>
            <Check aria-hidden /> {busy === "verify" ? "Verifying…" : "Verify"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPanel(panel === "edit" ? "none" : "edit")} disabled={!canAct} aria-expanded={panel === "edit"}>
            <Pencil aria-hidden /> Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPanel(panel === "flag" ? "none" : "flag")} disabled={!canAct} aria-expanded={panel === "flag"} aria-keyshortcuts={onNext ? "F" : undefined}>
            <Flag aria-hidden /> Flag
          </Button>
          {onNext ? (
            <Button size="sm" variant="ghost" onClick={onNext} aria-keyshortcuts="N">
              <SkipForward aria-hidden /> Next
            </Button>
          ) : null}
        </div>
      </div>

      {item.reviewNote ? (
        <p className="mt-4 rounded-lg border border-status-new/40 bg-status-new/10 p-3 text-sm">
          <strong>Flagged:</strong> {item.reviewNote}
        </p>
      ) : null}

      {panel === "flag" ? <FlagForm initial={item.reviewNote ?? ""} busy={busy === "flag"} onCancel={() => setPanel("none")} onSubmit={onFlag} /> : null}
      {panel === "edit" ? <EditForm item={item} busy={busy === "edit"} onCancel={() => setPanel("none")} onSubmit={onEdit} /> : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <h4 className="eyebrow">Obligation</h4>
          <p className="mt-3 max-w-prose">{item.requirement}</p>
          <h5 className="mt-5 text-sm font-semibold">Action steps</h5>
          <ol className="mt-2 grid max-w-prose list-decimal gap-1.5 pl-5 text-sm">
            {item.actionSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <dl className="mt-5 grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            {row("Applies if", item.appliesIfNote)}
            {row("Timeline", item.deadlineOrTimeline)}
            {row("Penalty", item.penaltyNote)}
            {row("Owner", ownerLabels[item.owner])}
            {row("GDPR comparison", `${item.gdprDelta}${item.gdprEquivalent ? ` — ${item.gdprEquivalent}` : ""}`)}
            {row("Exclusive tier", item.exclusiveGroup ? `${item.exclusiveGroup} (strictness ${item.strictness ?? "–"})` : null)}
            {row("Confidence", confidenceLabels[item.confidence])}
            {row("Last verified", `${formatDate(item.lastVerified)} by ${item.verifiedBy}`)}
          </dl>
          <details className="mt-5 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Rule (appliesIf)</summary>
            <pre className="mt-2 overflow-auto rounded border bg-background p-3 text-xs" tabIndex={0}>{JSON.stringify(item.appliesIf, null, 2)}</pre>
          </details>
        </div>

        <div>
          <h4 className="eyebrow">Sources</h4>
          <ul className="mt-3 grid gap-3 text-sm">
            {item.sources.map((s, i) => (
              <li key={i}>
                <span className="font-medium">{s.pinpoint}</span>
                <br />
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 break-all text-primary underline decoration-brass-rule underline-offset-4 hover:decoration-2">
                  {s.url}
                  <ExternalLink className="mt-1 size-3 shrink-0" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
          <h4 className="eyebrow mt-8">Research log</h4>
          <pre className="mt-3 max-h-[28rem] overflow-auto rounded border bg-background p-3 font-sans text-xs leading-relaxed whitespace-pre-wrap" tabIndex={0}>
            {excerpt || "No research log for this jurisdiction."}
          </pre>
        </div>
      </div>
    </article>
  );
}

function FlagForm({ initial, busy, onCancel, onSubmit }: { initial: string; busy: boolean; onCancel: () => void; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState(initial);
  const tooShort = note.trim().length < 5;
  return (
    <form
      className="mt-4 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tooShort) onSubmit(note.trim());
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <label htmlFor="flag-note" className="text-sm font-medium">
        What needs checking?
      </label>
      <p id="flag-help" className="text-sm text-muted-foreground">
        The item is set to needs review and leaves the queue; the note stays on it until it is verified.
      </p>
      {/* Opened on request (button or F), so moving focus here is expected. */}
      <textarea id="flag-note" autoFocus rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby="flag-help" className={`${controlClass} mt-2 py-2`} />
      <div className="mt-3 flex gap-2">
        <Button size="sm" type="submit" disabled={busy || tooShort}>
          {busy ? "Flagging…" : "Flag for review"}
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function EditForm({ item, busy, onCancel, onSubmit }: { item: Obligation; busy: boolean; onCancel: () => void; onSubmit: (fields: EditFields) => void }) {
  const [requirement, setRequirement] = useState(item.requirement);
  const [steps, setSteps] = useState(item.actionSteps.join("\n"));
  const [timeline, setTimeline] = useState(item.deadlineOrTimeline ?? "");
  const [penalty, setPenalty] = useState(item.penaltyNote ?? "");
  const [sources, setSources] = useState(item.sources.map((s) => ({ ...s })));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = editFieldsSchema.safeParse({
      requirement: requirement.trim(),
      actionSteps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
      deadlineOrTimeline: timeline,
      penaltyNote: penalty,
      sources: sources.map((s) => ({ url: s.url.trim(), pinpoint: s.pinpoint.trim() })),
    });
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const issue of parsed.error.issues) found[String(issue.path[0])] ??= `${issue.path.length > 1 ? `Entry ${Number(issue.path[1]) + 1}: ` : ""}${issue.message}`;
      setErrors(found);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  const field = (id: string, label: string, hint: string, control: React.ReactNode) => (
    <div>
      <label htmlFor={`edit-${id}`} className="text-sm font-medium">
        {label}
      </label>
      <p id={`edit-${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
      {control}
      {errors[id] ? (
        <p id={`edit-${id}-error`} role="alert" className="mt-1 text-sm text-destructive">
          {errors[id]}
        </p>
      ) : null}
    </div>
  );
  const described = (id: string) => ({ id: `edit-${id}`, "aria-invalid": errors[id] ? true : undefined, "aria-describedby": `edit-${id}-hint${errors[id] ? ` edit-${id}-error` : ""}` });

  return (
    <form className="mt-4 grid gap-4 rounded-lg border p-4" onSubmit={submit} noValidate>
      {field("requirement", "Requirement", "Plain language, in your own words; 40 to 900 characters.", <textarea rows={5} value={requirement} onChange={(e) => setRequirement(e.target.value)} {...described("requirement")} className={`${controlClass} mt-1 py-2`} />)}
      {field("actionSteps", "Action steps", "One step per line.", <textarea rows={Math.max(4, item.actionSteps.length + 1)} value={steps} onChange={(e) => setSteps(e.target.value)} {...described("actionSteps")} className={`${controlClass} mt-1 py-2`} />)}
      <div className="grid gap-4 lg:grid-cols-2">
        {field("deadlineOrTimeline", "Timeline", "Optional. Leave empty to remove.", <input type="text" value={timeline} onChange={(e) => setTimeline(e.target.value)} {...described("deadlineOrTimeline")} className={`${controlClass} mt-1 h-10`} />)}
        {field("penaltyNote", "Penalty", "Optional. Leave empty to remove.", <textarea rows={2} value={penalty} onChange={(e) => setPenalty(e.target.value)} {...described("penaltyNote")} className={`${controlClass} mt-1 py-2`} />)}
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Sources</legend>
        <p className="text-xs text-muted-foreground">Official https URL and the article or section. At least one source must be on an official domain of the jurisdiction.</p>
        <ul className="mt-2 grid gap-2">
          {sources.map((s, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
              <input type="url" aria-label={`Source ${i + 1} URL`} value={s.url} onChange={(e) => setSources(sources.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} className={`${controlClass} h-10`} />
              <input type="text" aria-label={`Source ${i + 1} pinpoint`} value={s.pinpoint} onChange={(e) => setSources(sources.map((x, k) => (k === i ? { ...x, pinpoint: e.target.value } : x)))} className={`${controlClass} h-10`} />
              <Button type="button" size="icon" variant="ghost" aria-label={`Remove source ${i + 1}`} disabled={sources.length === 1} onClick={() => setSources(sources.filter((_, k) => k !== i))}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        {errors.sources ? (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {errors.sources}
          </p>
        ) : null}
        <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setSources([...sources, { url: "", pinpoint: "" }])}>
          <Plus aria-hidden /> Add a source
        </Button>
      </fieldset>
      <p className="text-xs text-muted-foreground">Saving does not verify the item: confidence, verifiedBy and the verification date stay as they are.</p>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
