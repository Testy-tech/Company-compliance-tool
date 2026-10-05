import ExcelJS from "exceljs";

import { deadlines } from "@/lib/report/derive";
import { DEMO_BANNER, reviewerConfidence } from "@/lib/demo";
import { categoryLabels, formatDate, ownerLabels, priorityLabels } from "@/lib/report/labels";

import { ASSUMPTION, DISCLAIMER, INTERNAL_LABEL, questionnaireRows, TAILORED, type ExportInput } from "./model";

/*
 * Excel exports: the working checklist (one sheet per jurisdiction) and the
 * client follow-up questionnaire. Built in the browser with exceljs.
 */

export const STATUS_OPTIONS = ["Not started", "In progress", "Done", "Not applicable"] as const;

type Column = { header: string; width: number; wrap?: boolean };

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B2A4A" } };
const colLetter = (n: number) => {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** A sheet with a frozen, filterable header row and sensible widths. */
function tableSheet(wb: ExcelJS.Workbook, name: string, columns: Column[], rows: (string | number)[][]): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width, style: { alignment: { vertical: "top", wrapText: c.wrap ?? true } } }));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: "A1", to: `${colLetter(columns.length)}1` };
  return ws;
}

function listValidation(ws: ExcelJS.Worksheet, column: number, rows: number, options: readonly string[], firstRow = 2) {
  for (let r = firstRow; r < firstRow + rows; r++)
    ws.getCell(r, column).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${options.join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Choose from the list",
      error: `Use one of: ${options.join(", ")}`,
    };
}

function aboutRows(input: ExportInput, document: string): [string, string][] {
  const { report, intake, reviewer } = input;
  return [
    ...(input.demo ? ([["Notice", DEMO_BANNER]] as [string, string][]) : []),
    ["Prepared for", intake.company.label],
    ["Document", document],
    ["Assessed as of", formatDate(report.assessmentDate)],
    ["Knowledge base last reviewed", report.jurisdictions.map((j) => `${j.jurisdiction} ${formatDate(j.lastReviewed)}`).join(" · ")],
    ...(reviewer ? ([["Distribution", INTERNAL_LABEL]] as [string, string][]) : []),
    ["Disclaimer", DISCLAIMER],
    ["Assumptions", `Items marked ${ASSUMPTION} are included because an answer in the assessment was open; the report assumes the case that makes the obligation apply.`],
    ...(input.tailored && Object.keys(input.tailored).length
      ? ([["Tailored text", `Columns marked ${TAILORED} were reworded by an AI model at the user's request and have not been reviewed.`]] as [string, string][])
      : []),
  ];
}

function aboutSheet(wb: ExcelJS.Workbook, name: string, rows: [string, string | number][]): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name);
  ws.columns = [{ width: 34 }, { width: 110 }];
  for (const [k, v] of rows) {
    const row = ws.addRow([k, v]);
    row.getCell(1).font = { bold: true };
    row.alignment = { vertical: "top", wrapText: true };
  }
  return ws;
}

export function buildWorkbook(input: ExportInput): ExcelJS.Workbook {
  const { report, reviewer } = input;
  const tailored = input.tailored ?? {};
  const hasTailored = Object.keys(tailored).length > 0;
  const wb = new ExcelJS.Workbook();
  wb.creator = "DataBorders";
  wb.created = new Date(`${report.assessmentDate}T00:00:00Z`);

  const s = report.summary;
  const summary = aboutSheet(wb, "Summary", [
    ...aboutRows(input, "Workbook (checklist)"),
    ["", ""],
    ["Jurisdictions assessed", report.jurisdictions.length],
    ...(report.notAssessed.length ? ([["Not assessed", report.notAssessed.join(", ")]] as [string, string][]) : []),
    ["Applicable obligations", s.obligations],
    ...(report.gdprBaseline ? ([["Covered / partly covered / new", `${s.byDelta.covered} / ${s.byDelta.partial} / ${s.byDelta.new}`]] as [string, string][]) : []),
    ["Based on an assumption", s.assumed],
    ["Open questions", s.openQuestions],
    ["", ""],
  ]);
  for (const j of report.jurisdictions)
    for (const n of input.kb.find((k) => k.id === j.jurisdiction)?.contextNotes ?? []) {
      const row = summary.addRow([`Note — ${j.name}`, `${n.title}. ${n.text} (${n.source.pinpoint}; checked ${formatDate(n.lastVerified)}.)`]);
      row.getCell(1).font = { bold: true };
      row.alignment = { vertical: "top", wrapText: true };
    }
  for (const d of deadlines(report, input.kb).filter((x) => x.dateNote)) {
    const row = summary.addRow([`Date to watch — ${d.name}`, `${d.date.slice(0, 10)}${d.notFirm ? " (not firm)" : ""}: ${d.title} — Note: ${d.dateNote}.`]);
    row.getCell(1).font = { bold: true };
    row.alignment = { vertical: "top", wrapText: true };
  }
  summary.addRow(["", ""]);
  const head = summary.addRow(["Jurisdiction", "Items · covered · partial · new · assumed"]);
  head.font = { bold: true };
  for (const j of report.jurisdictions)
    summary.addRow([`${j.jurisdiction} — ${j.name}`, `${j.results.length} · ${j.deltaCounts.covered} · ${j.deltaCounts.partial} · ${j.deltaCounts.new} · ${j.results.filter((r) => r.applicability === "assumed").length}`]);

  const columns: Column[] = [
    { header: "ID", width: 20, wrap: false },
    { header: "§", width: 7, wrap: false },
    { header: "Title", width: 46 },
    { header: "Category", width: 22 },
    { header: "Priority", width: 10 },
    { header: "Owner", width: 22 },
    { header: "Timeline", width: 28 },
    { header: "GDPR equivalent", width: 24 },
    { header: "Delta vs GDPR", width: 14 },
    { header: "Applicability", width: 14 },
    { header: "Assumption", width: 44 },
    { header: "Status", width: 15 },
    { header: "Notes", width: 36 },
    { header: "Source URL", width: 48, wrap: false },
    { header: "Action steps", width: 60 },
    ...(hasTailored ? [{ header: `${TAILORED} Explanation`, width: 60 }, { header: `${TAILORED} Action steps`, width: 60 }, { header: `${TAILORED} Points to discuss with counsel`, width: 50 }] : []),
    ...(reviewer ? [{ header: "KB confidence", width: 24 }, { header: "Verified by", width: 30 }, { header: "Last verified", width: 14 }] : []),
  ];
  const STATUS_COLUMN = 12;
  const numbered = (steps: string[]) => steps.map((x, i) => `${i + 1}. ${x}`).join("\n");

  for (const j of report.jurisdictions) {
    const rows = j.results.map((r) => {
      const o = r.obligation;
      const t = tailored[o.id];
      return [
        o.id,
        r.paragraph,
        o.title,
        categoryLabels[o.category],
        priorityLabels[o.priority],
        ownerLabels[o.owner],
        o.deadlineOrTimeline ?? "",
        report.gdprBaseline ? o.gdprEquivalent ?? "" : "",
        report.gdprBaseline ? { covered: "Covered", partial: "Partial", new: "New" }[o.gdprDelta] : "",
        r.applicability === "assumed" ? "Assumed" : "Applies",
        r.applicability === "assumed" ? [...r.assumptions.map((a) => a.sentence), ...r.alternatives.map((a) => `May apply instead: ${a.title} — ${a.condition}`)].join("\n") : "",
        STATUS_OPTIONS[0],
        "",
        o.sources.map((x) => x.url).join("\n"),
        numbered(o.actionSteps),
        ...(hasTailored ? [t?.explanation ?? "", t ? numbered(t.steps) : "", (t?.considerations ?? []).map((x) => `• ${x}`).join("\n")] : []),
        ...(reviewer ? [reviewerConfidence(o.confidence, Boolean(input.demo)), o.verifiedBy, o.lastVerified] : []),
      ];
    });
    const ws = tableSheet(wb, j.jurisdiction, columns, rows);
    listValidation(ws, STATUS_COLUMN, rows.length, STATUS_OPTIONS);
    // First source as a clickable link.
    j.results.forEach((r, i) => {
      const url = r.obligation.sources[0]?.url;
      if (url && r.obligation.sources.length === 1) ws.getCell(i + 2, 14).value = { text: url, hyperlink: url };
    });
  }

  const byId = new Map(report.jurisdictions.flatMap((j) => j.results).map((r) => [r.obligation.id, r]));
  const refs = (ids: readonly string[]) => ids.map((id) => (byId.has(id) ? `§ ${byId.get(id)!.paragraph}` : id)).join(", ");

  tableSheet(
    wb,
    "Transfer map",
    [
      { header: "From", width: 24 },
      { header: "To", width: 34 },
      { header: "Mechanism required by the exporting country", width: 60 },
      { header: "Note", width: 50 },
      { header: "Items", width: 16 },
      { header: "Owner", width: 24 },
      { header: "Status", width: 16 },
    ],
    report.flows.map((f) => [
      f.originName,
      `${f.destination.name}${f.destination.remoteAccess ? " (remote access)" : ""}`,
      f.mechanism,
      f.note ?? "",
      refs(f.obligationIds),
      f.owner ? ownerLabels[f.owner] : "",
      f.status === "assumed" ? "Assumption" : f.status === "applies" ? "Required" : "Nothing required",
    ]),
  );

  const questions = questionnaireRows(report);
  const qs = tableSheet(
    wb,
    "Open questions",
    [
      { header: "#", width: 5, wrap: false },
      { header: "Question", width: 70 },
      { header: "Why it matters", width: 60 },
      { header: "Affected countries", width: 30 },
      { header: "Items affected", width: 10 },
      { header: "Items", width: 26 },
      { header: "Priority", width: 10 },
      { header: "Answer", width: 30 },
    ],
    report.openQuestions.map((q, i) => [i + 1, questions[i]!.question + (questions[i]!.parts.length ? `\n(${questions[i]!.parts.join("; ")})` : ""), q.whyItMatters, questions[i]!.countries, q.impact, refs(q.obligationIds), q.priority ? "Top 10" : "", ""]),
  );
  questions.forEach((q, i) => q.answerType === "yes_no" && listValidation(qs, 8, 1, ["Yes", "No"], i + 2));

  return wb;
}

/** Client follow-up questionnaire: open questions only, with an answer column. */
export function buildQuestionnaireWorkbook(input: ExportInput): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DataBorders";
  wb.created = new Date(`${input.report.assessmentDate}T00:00:00Z`);
  const rows = questionnaireRows(input.report);
  const ws = tableSheet(
    wb,
    "Follow-up questions",
    [
      { header: "#", width: 5, wrap: false },
      { header: "Question", width: 70 },
      { header: "Please give", width: 44 },
      { header: "Why it matters", width: 60 },
      { header: "Affected countries", width: 30 },
      { header: "Answer", width: 40 },
    ],
    rows.map((r) => [r.n, r.question, r.parts.map((x) => `${x[0]!.toUpperCase()}${x.slice(1)}`).join("\n"), r.why, r.countries, ""]),
  );
  rows.forEach((r, i) => r.answerType === "yes_no" && listValidation(ws, 6, 1, ["Yes", "No"], i + 2));
  aboutSheet(wb, "About", [
    ...aboutRows(input, "Client follow-up questionnaire").filter(([k]) => k !== "Tailored text"),
    ["How to answer", "Approximate answers are enough; exact figures are not needed. Where the answer cell offers a list, choose Yes or No."],
  ]);
  return wb;
}
