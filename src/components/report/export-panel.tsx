"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

import { EXPORTS, exportFileName, type ExportId } from "@/lib/export/files";
import { INTERNAL_LABEL, type ExportInput } from "@/lib/export/model";

/* Export buttons. Files are generated in the browser (see lib/export/browser.ts). */

const GROUPS: { title: string; ids: ExportId[] }[] = [
  { title: "Executive report (about 6 pages)", ids: ["executive-pdf", "executive-docx"] },
  { title: "Full report", ids: ["full-pdf", "full-docx"] },
  { title: "Checklist workbook", ids: ["workbook-xlsx"] },
  { title: "Client follow-up questionnaire", ids: ["questionnaire-docx", "questionnaire-xlsx"] },
];

export function ExportPanel({ input, tailoredCount }: { input: ExportInput; tailoredCount: number }) {
  const [busy, setBusy] = useState<ExportId | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function run(id: ExportId) {
    setBusy(id);
    setMessage(null);
    try {
      const { generateExport, download } = await import("@/lib/export/browser");
      const { blob, fileName } = await generateExport(id, input);
      download(blob, fileName);
      setMessage({ text: `Saved ${fileName}` });
    } catch {
      setMessage({ text: "The export could not be generated. Nothing was saved.", error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="export-heading" className="no-print mt-8 rounded-lg border bg-card p-4 sm:p-6">
      <h2 id="export-heading" className="flex items-center gap-2 text-lg font-semibold text-primary">
        <Download aria-hidden="true" className="size-4 text-brass" />
        Export
      </h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Files are generated in your browser; nothing is uploaded. Each one carries the assessment date, the knowledge-base review dates, your label and the
        disclaimer.
        {input.reviewer ? ` Reviewer mode is on: exports include knowledge-base confidence fields and are labelled “${INTERNAL_LABEL}”.` : ""}
        {tailoredCount ? ` ${tailoredCount} tailored ${tailoredCount === 1 ? "item is" : "items are"} included, labelled “Tailored”.` : ""}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <h3 className="font-sans text-sm font-semibold">{g.title}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.ids.map((id) => {
                const e = EXPORTS.find((x) => x.id === id)!;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => run(id)}
                    title={exportFileName(id, input.intake.company.label, input.report.assessmentDate, input.reviewer)}
                    aria-label={`${e.label} as ${e.format}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-medium hover:bg-secondary disabled:opacity-60"
                  >
                    {busy === id ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <Download aria-hidden="true" className="size-3.5" />}
                    {e.format}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p role="status" className={`mt-3 min-h-5 text-sm ${message?.error ? "font-medium text-destructive" : "text-muted-foreground"}`}>
        {busy ? "Generating…" : message?.text ?? ""}
      </p>
    </section>
  );
}
