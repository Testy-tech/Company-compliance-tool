import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { Packer } from "docx";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { beforeAll, describe, expect, it } from "vitest";

import { evaluate } from "@/lib/engine/evaluate";
import { entityOf, referenceAssessment } from "@/lib/engine/fixtures";
import type { FxTable } from "@/lib/intake/money";
import { jurisdictionSchema } from "@/lib/kb/schema";

import { docxDocument } from "./docx";
import { exportFileName, EXPORTS, type ExportId } from "./files";
import { buildExecutiveReport, buildFullReport, buildQuestionnaire, COVER_PLACEHOLDER, INTERNAL_LABEL, questionnaireRows, type ExportDoc, type ExportInput } from "./model";
import { pdfDefinition, pdfPageCount } from "./pdf";
import { buildQuestionnaireWorkbook, buildWorkbook, STATUS_OPTIONS } from "./xlsx";

/*
 * Generates every export for both reference fixtures, with the same code the
 * browser runs (only the PDF engine differs: pdfmake's Node build here). The
 * files are written to exports-out/ so they can be opened or converted and inspected.
 */

const require = createRequire(import.meta.url);
const content = path.join(process.cwd(), "content");
const kb = readdirSync(path.join(content, "jurisdictions")).map((f) => jurisdictionSchema.parse(JSON.parse(readFileSync(path.join(content, "jurisdictions", f), "utf8"))));
const fx = JSON.parse(readFileSync(path.join(content, "config", "fx.json"), "utf8")) as FxTable;

const pdfmake = require("pdfmake") as { setFonts(f: unknown): void; createPdf(d: unknown): { getBuffer(): Promise<Buffer> } };
pdfmake.setFonts(require("pdfmake/fonts/Roboto"));

function inputFor(variant: "unknown" | "low", extra: Partial<ExportInput> = {}): ExportInput {
  const assessment = referenceAssessment(variant);
  return { report: evaluate(assessment, kb, fx), intake: assessment.intake, kb, reviewer: false, ...extra };
}

async function generate(id: ExportId, input: ExportInput): Promise<Buffer> {
  const pdf = (doc: ExportDoc) => pdfmake.createPdf(pdfDefinition(doc)).getBuffer();
  const docx = (doc: ExportDoc) => Packer.toBuffer(docxDocument(doc));
  const xlsx = async (wb: ExcelJS.Workbook) => Buffer.from(await wb.xlsx.writeBuffer());
  switch (id) {
    case "executive-pdf": return pdf(buildExecutiveReport(input));
    case "full-pdf": return pdf(buildFullReport(input));
    case "executive-docx": return docx(buildExecutiveReport(input));
    case "full-docx": return docx(buildFullReport(input));
    case "workbook-xlsx": return xlsx(buildWorkbook(input));
    case "questionnaire-docx": return docx(buildQuestionnaire(input));
    case "questionnaire-xlsx": return xlsx(buildQuestionnaireWorkbook(input));
  }
}

const docxXml = async (bytes: Buffer, part: string) => (await (await JSZip.loadAsync(bytes)).file(`word/${part}.xml`)?.async("string")) ?? "";
const readXlsx = async (bytes: Buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  return wb;
};

for (const variant of ["unknown", "low"] as const) {
  describe(`exports for the ${variant} fixture`, () => {
    const input = inputFor(variant);
    const files = {} as Record<ExportId, Buffer>;
    const outDir = path.join(process.cwd(), "exports-out", variant);

    beforeAll(async () => {
      mkdirSync(outDir, { recursive: true });
      for (const e of EXPORTS) {
        files[e.id] = await generate(e.id, input);
        writeFileSync(path.join(outDir, exportFileName(e.id, input.intake.company.label, input.report.assessmentDate)), files[e.id]);
      }
    }, 120_000);

    it("does not modify the report or the knowledge base while generating", async () => {
      const before = JSON.stringify([input.report, kb]);
      await generate("full-pdf", input);
      expect(JSON.stringify([input.report, kb])).toBe(before);
    });

    it("generates every export as a non-empty file with the agreed name", () => {
      expect(Object.keys(files)).toHaveLength(7);
      for (const e of EXPORTS) expect(files[e.id].length, e.id).toBeGreaterThan(2000);
      expect(exportFileName("executive-pdf", "Client A", "2026-10-03")).toBe("client-a-executive-report-2026-10-03.pdf");
      expect(exportFileName("questionnaire-xlsx", "Rossi Engineering S.p.A.", "2026-10-03")).toBe("rossi-engineering-s-p-a-follow-up-questionnaire-2026-10-03.xlsx");
      expect(exportFileName("full-docx", "Client A", "2026-10-03", true)).toBe("client-a-full-report-internal-2026-10-03.docx");
    });

    it("keeps the executive PDF within 15 pages; the full PDF is longer", () => {
      const executive = pdfPageCount(files["executive-pdf"]);
      const full = pdfPageCount(files["full-pdf"]);
      console.info(`[exports] ${variant}: executive PDF ${executive} pages, full PDF ${full} pages`);
      expect(executive).toBeGreaterThan(2);
      expect(executive).toBeLessThanOrEqual(15);
      expect(full).toBeGreaterThan(executive);
    });

    it("executive report covers the agreed sections and carries date, review dates, label and disclaimer", () => {
      const doc = buildExecutiveReport(input);
      const headings = doc.blocks.filter((b) => b.kind === "heading" && b.level === 1).map((b) => (b.kind === "heading" ? b.text : ""));
      expect(headings).toEqual(expect.arrayContaining(["Executive summary", "Coverage matrix", "Top actions per jurisdiction", "Transfer map", "Governance findings", "30/60/90-day roadmap", "Disclaimer"]));
      expect(headings.some((x) => x.startsWith("Open questions"))).toBe(true);
      const text = JSON.stringify(doc.blocks);
      expect(text).toContain("Client A");
      expect(text).toContain("3 October 2026");
      expect(text).toContain("CN 27 September 2026");
      // a date the KB marks for review is never shown as firm
      expect(text).toContain("1 December 2026 *");
      expect(text).toContain("Entry-into-force date subject to amending legislation, under review");
      expect(text).toContain("not legal advice");
      expect(text).toContain(COVER_PLACEHOLDER);
      expect(text.includes("[Assumption]")).toBe(variant === "unknown");
    });

    it("Word report uses real headings, numbered lists and footnotes, a cover placeholder, and no tracked changes", async () => {
      const document = await docxXml(files["full-docx"], "document");
      const footnotes = await docxXml(files["full-docx"], "footnotes");
      const numbering = await docxXml(files["full-docx"], "numbering");
      expect(document).toContain('w:val="Heading1"');
      expect(document).toContain('w:val="Heading2"');
      expect(document).toContain("LETTERHEAD / COVER");
      expect(document).toContain("<w:numPr>");
      expect(numbering).toContain("w:abstractNum");
      // one footnote per cited source, each referenced from the text
      const sources = input.report.jurisdictions.flatMap((j) => j.results).reduce((n, r) => n + r.obligation.sources.length, 0);
      expect((document.match(/<w:footnoteReference /g) ?? []).length).toBe(sources);
      expect((footnotes.match(/<w:footnote /g) ?? []).length).toBeGreaterThanOrEqual(sources);
      expect(document).not.toMatch(/<w:(ins|del|moveFrom|moveTo) /);
      expect(document).toContain("§ 2.1");
      expect(document).toContain("Entry-into-force date subject to amending legislation, under review");
      expect(document).toContain("first Board is not yet confirmed");
      expect(document).not.toContain(INTERNAL_LABEL);
      expect(document).not.toContain("[Tailored]");
    });

    it("workbook has a summary, one sheet per jurisdiction, the transfer map and the open questions", async () => {
      const wb = await readXlsx(files["workbook-xlsx"]);
      expect(wb.worksheets.map((w) => w.name)).toEqual(["Summary", ...input.report.jurisdictions.map((j) => j.jurisdiction), "Transfer map", "Open questions"]);
      const cn = wb.getWorksheet("CN")!;
      const headers = (cn.getRow(1).values as string[]).slice(1);
      expect(headers.slice(0, 14)).toEqual(["ID", "§", "Title", "Category", "Priority", "Owner", "Timeline", "GDPR equivalent", "Delta vs GDPR", "Applicability", "Assumption", "Status", "Notes", "Source URL"]);
      expect(cn.rowCount - 1).toBe(input.report.jurisdictions.find((j) => j.jurisdiction === "CN")!.results.length);
      expect(cn.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
      expect(cn.autoFilter).toBeTruthy();
      expect(cn.getColumn(3).width).toBeGreaterThan(30);
      const status = cn.getCell("L2");
      expect(status.value).toBe("Not started");
      expect(status.dataValidation).toMatchObject({ type: "list", formulae: [`"${STATUS_OPTIONS.join(",")}"`] });
      expect(headers.join("|")).not.toMatch(/KB confidence|Tailored/);
      const summary = wb.getWorksheet("Summary")!;
      const summaryText = JSON.stringify(summary.getSheetValues());
      expect(summaryText).toContain("Client A");
      expect(summaryText).toContain("3 October 2026");
      expect(summaryText).toContain("not legal advice");
      expect(wb.getWorksheet("Transfer map")!.rowCount - 1).toBe(input.report.flows.length);
      expect(wb.getWorksheet("Open questions")!.rowCount - 1).toBe(input.report.openQuestions.length);
      if (variant === "unknown") expect(JSON.stringify(cn.getSheetValues())).toContain("Assumed");
    });

    it("questionnaire lists open questions only (impact > 0), with an answer column", async () => {
      const rows = questionnaireRows(input.report);
      expect(rows).toHaveLength(input.report.openQuestions.length);
      const wb = await readXlsx(files["questionnaire-xlsx"]);
      const ws = wb.getWorksheet("Follow-up questions")!;
      expect((ws.getRow(1).values as string[]).slice(1)).toEqual(["#", "Question", "Please give", "Why it matters", "Affected countries", "Answer"]);
      expect(ws.rowCount - 1).toBe(rows.length);
      expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
      expect(JSON.stringify(wb.getWorksheet("About")!.getSheetValues())).toContain("not legal advice");
      const document = await docxXml(files["questionnaire-docx"], "document");
      expect(document).toContain("Client follow-up questionnaire");
      expect((document.match(/Question \d+</g) ?? []).length).toBe(rows.length);
      if (variant === "unknown") {
        // a grouped total is asked once, with its parts; a yes/no question offers a list
        const grouped = rows.find((r) => r.parts.length > 0)!;
        expect(grouped.parts.length).toBe(3);
        const yesNo = rows.findIndex((r) => r.answerType === "yes_no");
        expect(ws.getCell(yesNo + 2, 6).dataValidation).toMatchObject({ type: "list", formulae: ['"Yes,No"'] });
        expect(document).toContain("☐ Yes");
      } else {
        expect(rows).toHaveLength(0);
        expect(document).toContain("There are no open questions");
      }
    });
  });
}

describe("precision questions, tailored text and reviewer copies", () => {
  it("asks a precision question as yes/no in the questionnaire", () => {
    const assessment = referenceAssessment("low", (i) => {
      const pe = entityOf(i, "PE");
      pe.people = { ...pe.people, staff: { status: "known", value: "10k-99999" }, business: { status: "known", value: "10k-99999" }, sensitive: { status: "known", value: "0" } };
    });
    const rows = questionnaireRows(evaluate(assessment, kb, fx));
    expect(rows).toEqual([expect.objectContaining({ question: "Is the total number of individuals located in Peru 100,000 or more?", answerType: "yes_no", countries: "Peru" })]);
  });

  it("includes tailored text only when it is passed in, labelled Tailored", async () => {
    const tailored = { "DE-GOVERNANCE-01": { explanation: "Tailored explanation for the German subsidiary.", steps: ["Tailored step one.", "Tailored step two."] } };
    const input = inputFor("low", { tailored });
    const document = await docxXml(await generate("full-docx", input), "document");
    expect(document).toContain("[Tailored] For your situation (AI-generated, not reviewed)");
    expect(document).toContain("Tailored step one.");
    const wb = await readXlsx(await generate("workbook-xlsx", input));
    const headers = (wb.getWorksheet("DE")!.getRow(1).values as string[]).slice(1);
    expect(headers).toContain("[Tailored] Explanation");
    expect(JSON.stringify(wb.getWorksheet("DE")!.getSheetValues())).toContain("Tailored step one.");
    // the executive report notes that tailored text is present
    expect(JSON.stringify(buildExecutiveReport(input).blocks)).toContain("reworded for this company by an AI model");
  });

  it("includes reviewer fields only in a reviewer export, which is labelled internal", async () => {
    const input = inputFor("low", { reviewer: true });
    const doc = buildFullReport(input);
    expect(doc.internal).toBe(true);
    expect(doc.running).toContain(INTERNAL_LABEL);
    const document = await docxXml(await generate("full-docx", input), "document");
    expect(document).toContain(INTERNAL_LABEL);
    expect(document).toContain("Needs counsel review");
    const wb = await readXlsx(await generate("workbook-xlsx", input));
    expect((wb.getWorksheet("DE")!.getRow(1).values as string[]).slice(1)).toEqual(expect.arrayContaining(["KB confidence", "Verified by", "Last verified"]));
    expect(JSON.stringify(wb.getWorksheet("Summary")!.getSheetValues())).toContain(INTERNAL_LABEL);
    // and not otherwise
    expect(JSON.stringify(buildFullReport(inputFor("low")).blocks)).not.toContain("Needs counsel review");
  });
});
