import { exportFileName, type ExportId } from "./files";
import { buildExecutiveReport, buildFullReport, buildQuestionnaire, type ExportDoc, type ExportInput } from "./model";

/*
 * Generating exports in the browser. The libraries are loaded on demand, the
 * file is built in memory and handed to the browser as a download: no request
 * is made, so the assessment never leaves the device.
 */

const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

type PdfMake = { addVirtualFileSystem(vfs: unknown): void; createPdf(definition: unknown): { getBlob(): Promise<Blob> } };

async function pdfBlob(doc: ExportDoc): Promise<Blob> {
  const [{ pdfDefinition }, engine, fonts] = await Promise.all([import("./pdf"), import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
  const pdfMake = ((engine as { default?: unknown }).default ?? engine) as PdfMake;
  pdfMake.addVirtualFileSystem((fonts as { default?: unknown }).default ?? fonts);
  return pdfMake.createPdf(pdfDefinition(doc)).getBlob();
}

async function docxBlob(doc: ExportDoc): Promise<Blob> {
  const [{ docxDocument }, { Packer }] = await Promise.all([import("./docx"), import("docx")]);
  return Packer.toBlob(docxDocument(doc));
}

async function xlsxBlob(which: "workbook" | "questionnaire", input: ExportInput): Promise<Blob> {
  const { buildWorkbook, buildQuestionnaireWorkbook } = await import("./xlsx");
  const wb = which === "workbook" ? buildWorkbook(input) : buildQuestionnaireWorkbook(input);
  return new Blob([await wb.xlsx.writeBuffer()], { type: MIME.xlsx });
}

export async function generateExport(id: ExportId, input: ExportInput): Promise<{ blob: Blob; fileName: string }> {
  const fileName = exportFileName(id, input.intake.company.label, input.report.assessmentDate, input.reviewer);
  switch (id) {
    case "executive-pdf":
      return { blob: await pdfBlob(buildExecutiveReport(input)), fileName };
    case "full-pdf":
      return { blob: await pdfBlob(buildFullReport(input)), fileName };
    case "executive-docx":
      return { blob: await docxBlob(buildExecutiveReport(input)), fileName };
    case "full-docx":
      return { blob: await docxBlob(buildFullReport(input)), fileName };
    case "questionnaire-docx":
      return { blob: await docxBlob(buildQuestionnaire(input)), fileName };
    case "workbook-xlsx":
      return { blob: await xlsxBlob("workbook", input), fileName };
    case "questionnaire-xlsx":
      return { blob: await xlsxBlob("questionnaire", input), fileName };
  }
}

export function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
