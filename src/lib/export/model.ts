import type { ObligationResult, OpenQuestion, Report } from "@/lib/engine/types";
import type { Intake } from "@/lib/intake/schema";
import { obligationCategories, type Jurisdiction } from "@/lib/kb/schema";
import { deadlines, heatCell, mostUrgent } from "@/lib/report/derive";
import { categoryLabels, confidenceLabels, formatDate, governanceModelLabels, ownerLabels, priorityLabels, priorityRank } from "@/lib/report/labels";

/*
 * Format-neutral document model for the PDF and DOCX exports. The report and
 * the questionnaire are built once as a list of blocks; each renderer (pdf.ts,
 * docx.ts) turns the same blocks into its own format, so the two never drift.
 * Everything is generated in the browser: no assessment data leaves the device.
 */

export type Source = { text: string; url?: string };
export type Run = { text: string; bold?: boolean; italic?: boolean };

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string; pageBreak?: boolean }
  /** `sources` become real footnotes in Word and a numbered source list in the PDF. */
  | { kind: "paragraph"; runs: Run[]; style?: "body" | "small" | "assumption" | "tailored" | "reviewer" | "placeholder"; sources?: Source[] }
  | { kind: "list"; ordered: boolean; items: string[] }
  /** Column widths are percentages of the text width. */
  | { kind: "table"; columns: { header: string; width: number }[]; rows: string[][] }
  | { kind: "facts"; rows: [string, string][] };

export type ReportType = "Executive report" | "Full report" | "Client follow-up questionnaire";

export type ExportDoc = {
  title: string;
  reportType: ReportType;
  label: string;
  assessmentDate: string;
  /** Exported from reviewer mode: carries KB confidence fields and is labelled as internal. */
  internal: boolean;
  /** Short line for page headers. */
  running: string;
  blocks: Block[];
};

export type Tailored = Record<string, { explanation: string; steps: string[]; considerations?: string[] }>;

export type ExportInput = {
  report: Report;
  intake: Intake;
  kb: readonly Jurisdiction[];
  /** Present only if the user opted in to tailoring; items switched back to standard text are left out. */
  tailored?: Tailored;
  reviewer: boolean;
};

export const INTERNAL_LABEL = "Internal — reviewer copy";
export const ASSUMPTION = "[Assumption]";
export const TAILORED = "[Tailored]";
export const DISCLAIMER =
  "This report is an informational tool, not legal advice. It is generated from the answers given in the assessment and from a knowledge base that is awaiting review by qualified counsel. Verify every item with counsel in the jurisdiction concerned before acting on it.";
export const COVER_PLACEHOLDER = "[ LETTERHEAD / COVER — replace this block with the firm's letterhead, logo and cover details ]";

const p = (text: string, style?: Extract<Block, { kind: "paragraph" }>["style"]): Block => ({ kind: "paragraph", runs: [{ text }], style });
const h = (level: 1 | 2 | 3, text: string, pageBreak = false): Block => ({ kind: "heading", level, text, pageBreak });
const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "0%");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

const kbReviewDates = (report: Report) => report.jurisdictions.map((j) => `${j.jurisdiction} ${formatDate(j.lastReviewed)}`).join(" · ");
const all = (report: Report) => report.jurisdictions.flatMap((j) => j.results);
const ref = (r: ObligationResult) => `§ ${r.paragraph}`;
const titleOf = (r: ObligationResult) => `${r.obligation.title}${r.applicability === "assumed" ? ` ${ASSUMPTION}` : ""}`;

/* ── Shared parts ─────────────────────────────────────────────────────────── */

function cover(input: ExportInput, reportType: ReportType): Block[] {
  const { report, intake, reviewer } = input;
  return [
    p(COVER_PLACEHOLDER, "placeholder"),
    {
      kind: "facts",
      rows: [
        ["Prepared for", intake.company.label],
        ["Document", reportType],
        ["Assessed as of", formatDate(report.assessmentDate)],
        ["Knowledge base last reviewed", kbReviewDates(report)],
        ...(reviewer ? ([["Distribution", INTERNAL_LABEL]] as [string, string][]) : []),
      ],
    },
    p(DISCLAIMER, "small"),
  ];
}

function summary(input: ExportInput): Block[] {
  const { report } = input;
  const s = report.summary;
  const blocks: Block[] = [
    h(1, "Executive summary"),
    {
      kind: "facts",
      rows: [
        ["Jurisdictions assessed", `${report.jurisdictions.length}: ${report.jurisdictions.map((j) => j.name).join(", ")}`],
        ...(report.notAssessed.length ? ([["Not assessed", report.notAssessed.join(", ")]] as [string, string][]) : []),
        ["Applicable obligations", String(s.obligations)],
        ...(report.gdprBaseline
          ? ([
              ["Covered by the GDPR programme", `${s.byDelta.covered} (${pct(s.byDelta.covered, s.obligations)})`],
              ["Partly covered", `${s.byDelta.partial} (${pct(s.byDelta.partial, s.obligations)})`],
              ["New work", `${s.byDelta.new} (${pct(s.byDelta.new, s.obligations)})`],
            ] as [string, string][])
          : []),
        ["Based on an assumption", String(s.assumed)],
        ["Open questions", String(s.openQuestions)],
      ],
    },
  ];
  if (s.assumed)
    blocks.push(
      p(
        `Items marked ${ASSUMPTION} are included because an answer in the assessment was “Don't know” or “Prefer not to say”. The report then assumes the case that makes the obligation apply. The open questions listed at the end would settle them.`,
        "assumption",
      ),
    );
  if (input.tailored && Object.keys(input.tailored).length)
    blocks.push(p(`Text marked ${TAILORED} was reworded for this company by an AI model at the user's request. It has not been reviewed and does not change which obligations apply.`, "tailored"));
  return blocks;
}

function matrix(report: Report): Block[] {
  const categories = obligationCategories.filter((c) => report.summary.byCategory[c]);
  const width = 72 / Math.max(report.jurisdictions.length, 1);
  return [
    h(1, "Coverage matrix"),
    p(
      report.gdprBaseline
        ? "Number of applicable items per jurisdiction and category, with the least-covered status among them: C = covered by the GDPR programme, P = partly covered, N = new work. An asterisk means at least one item is an assumption."
        : "Number of applicable items per jurisdiction and category. An asterisk means at least one item is an assumption.",
      "small",
    ),
    {
      kind: "table",
      columns: [{ header: "Category", width: 28 }, ...report.jurisdictions.map((j) => ({ header: j.jurisdiction, width }))],
      rows: categories.map((c) => [
        categoryLabels[c],
        ...report.jurisdictions.map((j) => {
          const cell = heatCell(j.results.filter((r) => r.obligation.category === c));
          if (!cell) return "";
          return `${cell.results.length}${report.gdprBaseline ? ` ${cell.worst[0]!.toUpperCase()}` : ""}${cell.assumed ? "*" : ""}`;
        }),
      ]),
    },
  ];
}

function datesToWatch(input: ExportInput): Block[] {
  const dated = deadlines(input.report, input.kb).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d.date));
  if (!dated.length) return [];
  return [
    h(1, "Dates to watch"),
    {
      kind: "table",
      columns: [{ header: "Date", width: 18 }, { header: "Jurisdiction", width: 22 }, { header: "What changes", width: 60 }],
      rows: dated.map((d) => [`${formatDate(d.date.slice(0, 10))}${d.notFirm ? " *" : ""}`, d.name, `${d.title}${d.dateNote ? ` — Note: ${d.dateNote}.` : ""}`]),
    },
    ...(dated.some((d) => d.notFirm) ? [p("* Not a firm date: the knowledge base marks it for review.", "small")] : []),
  ];
}

function transferMap(report: Report, withNotes: boolean): Block[] {
  if (!report.flows.length) return [h(1, "Transfer map"), p("On the answers given, no assessed entity sends personal data to another entity, provider or country.")];
  return [
    h(1, "Transfer map"),
    p("One row per flow. The mechanism is the one required by the exporting country.", "small"),
    {
      kind: "table",
      columns: [{ header: "From", width: 15 }, { header: "To", width: 20 }, { header: "Mechanism required by the exporting country", width: 39 }, { header: "Owner", width: 14 }, { header: "Status", width: 12 }],
      rows: report.flows.map((f) => [
        f.originName,
        `${f.destination.name}${f.destination.remoteAccess ? " (remote access)" : ""}`,
        `${f.mechanism}${f.obligationIds.length ? ` (${itemRefs(report, f.obligationIds)})` : ""}${withNotes && f.note ? ` — ${f.note}` : ""}`,
        f.owner ? ownerLabels[f.owner] : "—",
        f.status === "assumed" ? "Assumption" : f.status === "applies" ? "Required" : "Nothing required",
      ]),
    },
  ];
}

function itemRefs(report: Report, ids: readonly string[]): string {
  const byId = new Map(all(report).map((r) => [r.obligation.id, r]));
  return ids.map((id) => (byId.has(id) ? ref(byId.get(id)!) : id)).join(", ");
}

function governance(report: Report, withItems: boolean): Block[] {
  const g = report.governance;
  const blocks: Block[] = [
    h(1, "Governance findings"),
    p(`Governance model: ${governanceModelLabels[g.model]}. Named local privacy contacts: ${g.localContacts ? "yes" : "no"}.`),
  ];
  g.findings.forEach((f, i) => {
    blocks.push({ kind: "paragraph", runs: [{ text: `${i + 1}. ${f.title}. `, bold: true }, { text: f.detail }] });
    blocks.push(p(`Jurisdictions: ${f.jurisdictions.join(", ") || "—"}${withItems && f.obligationIds.length ? `. Items: ${itemRefs(report, f.obligationIds)}` : ""}`, "small"));
  });
  if (!g.findings.length) blocks.push(p("No governance findings."));
  return blocks;
}

const BUCKETS = [
  { days: 30 as const, title: "First 30 days", note: "critical and high priority" },
  { days: 60 as const, title: "By day 60", note: "medium priority" },
  { days: 90 as const, title: "By day 90", note: "low priority" },
];

function roadmap(report: Report, full: boolean): Block[] {
  const items = all(report);
  const blocks: Block[] = [h(1, "30/60/90-day roadmap")];
  blocks.push({
    kind: "table",
    columns: [{ header: "Period", width: 22 }, { header: "Items", width: 12 }, { header: "By jurisdiction", width: 66 }],
    rows: BUCKETS.map((b) => {
      const inBucket = items.filter((r) => r.roadmapBucket === b.days);
      const counts = report.jurisdictions.map((j) => [j.jurisdiction, inBucket.filter((r) => r.jurisdiction === j.jurisdiction).length] as const).filter(([, n]) => n);
      return [`${b.title} (${b.note})`, String(inBucket.length), counts.map(([j, n]) => `${j} ${n}`).join(" · ") || "—"];
    }),
  });
  const itemTable = (list: ObligationResult[]): Block => ({
    kind: "table",
    columns: [{ header: "", width: 9 }, { header: "§", width: 9 }, { header: "Item", width: 58 }, { header: "Owner", width: 24 }],
    rows: list.map((r) => [r.jurisdiction, ref(r), titleOf(r), ownerLabels[r.obligation.owner]]),
  });
  if (full) {
    for (const b of BUCKETS) {
      const list = items.filter((r) => r.roadmapBucket === b.days);
      blocks.push(h(2, `${b.title} — ${plural(list.length, "item")}`));
      blocks.push(list.length ? itemTable(list) : p("Nothing in this period."));
    }
  } else {
    // Executive view: the critical items only; the full list is in the full report and the workbook.
    const critical = items.filter((r) => r.obligation.priority === "critical");
    blocks.push(h(2, `Critical items for the first 30 days — ${critical.length}`));
    blocks.push(critical.length ? itemTable(critical.slice(0, 20)) : p("No item is rated critical."));
    if (critical.length > 20) blocks.push(p(`${critical.length - 20} more critical items are listed in the full report.`, "small"));
  }
  return blocks;
}

const affects = (q: OpenQuestion) => `${plural(q.impact, "item")} · ${q.jurisdictions.join(", ")}`;

/* ── Executive report ─────────────────────────────────────────────────────── */

function topActions(report: Report): Block[] {
  const rows = report.jurisdictions.flatMap((j) =>
    j.results
      .map((r, i) => ({ r, i }))
      .sort((a, b) => priorityRank[a.r.obligation.priority] - priorityRank[b.r.obligation.priority] || a.i - b.i)
      .slice(0, 3)
      .map(({ r }) => [j.jurisdiction, ref(r), titleOf(r), priorityLabels[r.obligation.priority], ownerLabels[r.obligation.owner], r.obligation.deadlineOrTimeline ?? "—"]),
  );
  return [
    h(1, "Top actions per jurisdiction"),
    p("The three highest-priority items in each jurisdiction. Section numbers refer to the full report.", "small"),
    {
      kind: "table",
      columns: [{ header: "", width: 8 }, { header: "§", width: 7 }, { header: "Action", width: 39 }, { header: "Priority", width: 10 }, { header: "Owner", width: 15 }, { header: "Timeline", width: 21 }],
      rows,
    },
  ];
}

function topQuestions(report: Report): Block[] {
  const top = report.openQuestions.filter((q) => q.priority);
  if (!top.length) return [h(1, "Open questions"), p("None. Every item in this report follows from the answers given.")];
  return [
    h(1, `Open questions — top ${top.length} of ${report.openQuestions.length}`),
    p("Each answer would settle one or more items that are currently included on an assumption. The follow-up questionnaire lists all of them.", "small"),
    {
      kind: "table",
      columns: [{ header: "#", width: 5 }, { header: "Question", width: 67 }, { header: "Affects", width: 28 }],
      rows: top.map((q, i) => [String(i + 1), q.question, affects(q)]),
    },
  ];
}

/* ── Full report ──────────────────────────────────────────────────────────── */

function itemBlocks(r: ObligationResult, input: ExportInput): Block[] {
  const o = r.obligation;
  const tailored = input.tailored?.[o.id];
  const tags = [
    `${priorityLabels[o.priority]} priority`,
    ownerLabels[o.owner],
    categoryLabels[o.category],
    ...(input.report.gdprBaseline ? [{ covered: "Covered by GDPR programme", partial: "Partly covered", new: "New work" }[o.gdprDelta]] : []),
    ...(r.applicability === "assumed" ? [ASSUMPTION] : []),
    ...(tailored ? [TAILORED] : []),
  ];
  const blocks: Block[] = [h(2, `${ref(r)}  ${o.title}`), p(tags.join(" · "), "small")];

  if (r.applicability === "assumed") {
    const lines = [...r.assumptions.map((a) => `${a.sentence}.`), ...r.alternatives.map((a) => `May apply instead: ${a.title} — ${a.condition}.`)];
    blocks.push({
      kind: "paragraph",
      style: "assumption",
      runs: [{ text: `${ASSUMPTION} Included because an answer is open. `, bold: true }, { text: lines.join(" ") }],
    });
  }

  blocks.push({
    kind: "paragraph",
    runs: [{ text: o.requirement }],
    sources: o.sources.map((s) => ({ text: `${s.pinpoint} — ${host(s.url)}`, url: s.url })),
  });

  const facts: [string, string][] = [];
  if (o.deadlineOrTimeline) facts.push(["Timeline", o.deadlineOrTimeline]);
  if (input.report.gdprBaseline && o.gdprEquivalent) facts.push(["GDPR equivalent", o.gdprEquivalent]);
  if (r.penalty?.kind === "formula") facts.push(["Penalty", `${r.penalty.formula}${r.penalty.note ? ` (${r.penalty.note}; no figure calculated.)` : ""}`]);
  facts.push(["Why it applies", o.appliesIfNote]);
  blocks.push({ kind: "facts", rows: facts });

  if (tailored)
    blocks.push({ kind: "paragraph", style: "tailored", runs: [{ text: `${TAILORED} For your situation (AI-generated, not reviewed): `, bold: true }, { text: tailored.explanation }] });
  blocks.push({ kind: "paragraph", runs: [{ text: tailored ? `Action steps ${TAILORED}` : "Action steps", bold: true }] });
  blocks.push({ kind: "list", ordered: true, items: tailored ? tailored.steps : o.actionSteps });
  if (tailored?.considerations?.length) {
    blocks.push({ kind: "paragraph", style: "tailored", runs: [{ text: `${TAILORED} Points to discuss with counsel (AI-generated, not part of the action steps):`, bold: true }] });
    blocks.push({ kind: "list", ordered: false, items: tailored.considerations });
  }
  blocks.push(p(`Last verified ${formatDate(o.lastVerified)}`, "small"));
  if (input.reviewer) blocks.push(p(`Reviewer: ${confidenceLabels[o.confidence]} · ${o.id} · verified by ${o.verifiedBy}`, "reviewer"));
  return blocks;
}

function jurisdictionBlocks(input: ExportInput): Block[] {
  const { report, kb } = input;
  return report.jurisdictions.flatMap((j, i) => {
    const k = kb.find((x) => x.id === j.jurisdiction)!;
    const role = j.role === "hq" ? "Headquarters" : j.role === "target" ? "Planned entry" : "Current operations";
    return [
      h(1, `§ ${i + 1}  ${j.name}`, true),
      p(
        `${role} · ${plural(j.results.length, "item")}${report.gdprBaseline ? ` · ${j.deltaCounts.covered} covered · ${j.deltaCounts.partial} partial · ${j.deltaCounts.new} new` : ""} · knowledge base reviewed ${formatDate(j.lastReviewed)}`,
        "small",
      ),
      p(k.scopeNotes),
      ...k.contextNotes.map((n): Block => ({ kind: "paragraph", style: "assumption", runs: [{ text: `Note — ${n.title}. `, bold: true }, { text: `${n.text} (${n.source.pinpoint}; checked ${formatDate(n.lastVerified)}.)` }] })),
      ...j.results.flatMap((r) => itemBlocks(r, input)),
    ];
  });
}

function openQuestions(report: Report): Block[] {
  const blocks: Block[] = [h(1, "Assumptions and open questions", true)];
  if (!report.openQuestions.length) blocks.push(p("No open questions. Every item in this report follows from the answers given."));
  report.openQuestions.forEach((q, i) => {
    blocks.push({ kind: "paragraph", runs: [{ text: `${i + 1}. ${q.question}`, bold: true }] });
    blocks.push(p(`${q.whyItMatters} Affects ${affects(q)} (${itemRefs(report, q.obligationIds)}).`, "small"));
    if (q.subAnswers) blocks.push({ kind: "list", ordered: false, items: q.subAnswers.map((s) => `${s.label}: ${s.answer}`) });
  });
  if (report.answeredThresholds.length) {
    blocks.push(h(2, "Threshold questions answered in the report"));
    blocks.push({ kind: "list", ordered: false, items: report.answeredThresholds.map((t) => `${t.question} — ${t.answer ? "Yes" : "No"}`) });
  }
  if (report.unansweredNoEffect.length)
    blocks.push(p(`${plural(report.unansweredNoEffect.length, "further answer")} left open in the assessment ${report.unansweredNoEffect.length === 1 ? "has" : "have"} no effect on this report and ${report.unansweredNoEffect.length === 1 ? "is" : "are"} not listed.`, "small"));
  return blocks;
}

function glossary(input: ExportInput): Block[] {
  const entries = input.report.jurisdictions.flatMap((j) => (input.kb.find((k) => k.id === j.jurisdiction)?.definedTerms ?? []).map((t) => ({ ...t, jurisdiction: j.name })));
  if (!entries.length) return [];
  return [
    h(1, "Glossary of defined terms"),
    {
      kind: "table",
      columns: [{ header: "Term", width: 22 }, { header: "Law", width: 16 }, { header: "Meaning in this report", width: 62 }],
      rows: entries.map((t) => [`“${t.term}”`, `${t.law} (${t.jurisdiction})`, `${t.definition} [${t.source.pinpoint}]`]),
    },
  ];
}

/* ── Documents ────────────────────────────────────────────────────────────── */

const running = (input: ExportInput, type: ReportType) => `${input.intake.company.label} · ${type} · assessed ${formatDate(input.report.assessmentDate)}${input.reviewer ? ` · ${INTERNAL_LABEL}` : ""}`;

const base = (input: ExportInput, reportType: ReportType, blocks: Block[]): ExportDoc => ({
  title: "Privacy obligations report",
  reportType,
  label: input.intake.company.label,
  assessmentDate: input.report.assessmentDate,
  internal: input.reviewer,
  running: running(input, reportType),
  blocks,
});

export function buildExecutiveReport(input: ExportInput): ExportDoc {
  const { report } = input;
  return base(input, "Executive report", [
    ...cover(input, "Executive report"),
    ...summary(input),
    ...matrix(report),
    ...topActions(report),
    ...datesToWatch(input),
    ...transferMap(report, false),
    ...governance(report, false),
    ...roadmap(report, false),
    ...topQuestions(report),
    h(1, "Disclaimer"),
    p(DISCLAIMER),
  ]);
}

export function buildFullReport(input: ExportInput): ExportDoc {
  const { report } = input;
  const urgent = mostUrgent(report);
  return base(input, "Full report", [
    ...cover(input, "Full report"),
    ...summary(input),
    { kind: "paragraph", runs: [{ text: "Most urgent items: ", bold: true }, { text: urgent.map((r) => `${ref(r)} ${titleOf(r)} (${r.jurisdiction})`).join("; ") + "." }] },
    ...matrix(report),
    ...datesToWatch(input),
    ...jurisdictionBlocks(input),
    { ...(transferMap(report, true)[0] as Extract<Block, { kind: "heading" }>), pageBreak: true },
    ...transferMap(report, true).slice(1),
    ...governance(report, true),
    ...roadmap(report, true),
    ...openQuestions(report),
    ...glossary(input),
    h(1, "Disclaimer"),
    p(DISCLAIMER),
  ]);
}

/** The questions a client still has to answer: impact > 0 only, grouped totals asked once, precision questions as yes/no. */
export type QuestionnaireRow = { n: number; question: string; answerType: "yes_no" | "text"; why: string; countries: string; items: number; parts: string[] };

export function questionnaireRows(report: Report): QuestionnaireRow[] {
  return report.openQuestions.map((q, i) => ({
    n: i + 1,
    question: q.question,
    answerType: q.kind === "precision" || /^(Is|Has|Does|Do) /.test(q.question) ? "yes_no" : "text",
    why: q.whyItMatters,
    countries: q.jurisdictions.map((id) => report.jurisdictions.find((j) => j.jurisdiction === id)?.name ?? id).join(", "),
    items: q.impact,
    parts: (q.subAnswers ?? []).map((s) => s.label),
  }));
}

export function buildQuestionnaire(input: ExportInput): ExportDoc {
  const rows = questionnaireRows(input.report);
  const blocks: Block[] = [
    ...cover(input, "Client follow-up questionnaire"),
    h(1, "Follow-up questions"),
    p(
      rows.length
        ? `The assessment left ${plural(rows.length, "question")} open that ${rows.length === 1 ? "affects" : "affect"} which obligations apply. Until they are answered, the report assumes the stricter case. Approximate answers are enough; exact figures are not needed.`
        : "There are no open questions: every item in the report follows from the answers already given.",
    ),
  ];
  for (const r of rows) {
    blocks.push(h(2, `Question ${r.n}`));
    blocks.push({
      kind: "facts",
      rows: [
        ["Question", r.question],
        ...(r.parts.length ? ([["Please give", r.parts.map((x) => `${x[0]!.toUpperCase()}${x.slice(1)}`).join("; ")]] as [string, string][]) : []),
        ["Why it matters", r.why],
        ["Affects", `${r.countries} (${plural(r.items, "item")})`],
        ["Answer", r.answerType === "yes_no" ? "☐ Yes      ☐ No" : "________________________________________________________"],
      ],
    });
  }
  return { ...base(input, "Client follow-up questionnaire", blocks), title: "Client follow-up questionnaire" };
}
