/* Export catalogue and file names: [label]-[report type]-[assessmentDate].[ext] */

export const EXPORTS = [
  { id: "executive-pdf", label: "Executive report", format: "PDF", type: "executive-report", ext: "pdf" },
  { id: "full-pdf", label: "Full report", format: "PDF", type: "full-report", ext: "pdf" },
  { id: "executive-docx", label: "Executive report", format: "Word", type: "executive-report", ext: "docx" },
  { id: "full-docx", label: "Full report", format: "Word", type: "full-report", ext: "docx" },
  { id: "workbook-xlsx", label: "Checklist workbook", format: "Excel", type: "workbook", ext: "xlsx" },
  { id: "questionnaire-docx", label: "Client follow-up questionnaire", format: "Word", type: "follow-up-questionnaire", ext: "docx" },
  { id: "questionnaire-xlsx", label: "Client follow-up questionnaire", format: "Excel", type: "follow-up-questionnaire", ext: "xlsx" },
] as const;

export type ExportId = (typeof EXPORTS)[number]["id"];

const slug = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "assessment";

export function exportFileName(id: ExportId, label: string, assessmentDate: string, internal = false): string {
  const e = EXPORTS.find((x) => x.id === id)!;
  return `${slug(label)}-${e.type}${internal ? "-internal" : ""}-${assessmentDate}.${e.ext}`;
}
