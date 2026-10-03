import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import type { Block, ExportDoc } from "./model";

/*
 * ExportDoc → pdfmake document definition. The definition is plain data; the
 * browser build of pdfmake turns it into a PDF on the user's device (see
 * browser.ts), and the Node build does the same in tests.
 */

const INK = "#1b2a4a";
const MUTED = "#555a60";
const RULE = "#c9c2b2";
const TEXT_WIDTH = 515; // A4 minus 40pt side margins

function content(block: Block): Content[] {
  switch (block.kind) {
    case "heading":
      return [{ text: block.text, style: `h${block.level}`, headlineLevel: block.level, pageBreak: block.pageBreak ? "before" : undefined }];

    case "paragraph": {
      const sources = block.sources ?? [];
      const text: Content[] = block.runs.map((r) => ({ text: r.text, bold: r.bold, italics: r.italic }));
      // pdfmake has no footnotes: sources are numbered after the text and listed directly below it.
      sources.forEach((_, i) => text.push({ text: ` ${i + 1}`, fontSize: 6.5, color: MUTED, sup: true } as Content));
      const out: Content[] = [{ text, style: block.style ?? "body" }];
      if (sources.length)
        out.push({
          stack: sources.map((s, i) => ({ text: [{ text: `${i + 1}  `, color: MUTED }, s.url ? { text: s.text, link: s.url, decoration: "underline" } : s.text] })),
          style: "sources",
        });
      return out;
    }

    case "list":
      // pdfmake rewrites the arrays it is given, so it always gets copies, never the report's own data.
      return [block.ordered ? { ol: [...block.items], style: "list" } : { ul: [...block.items], style: "list" }];

    case "facts":
      return [
        {
          table: { widths: [130, "*"], body: block.rows.map(([k, v]) => [{ text: k, color: MUTED }, v]) },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingTop: () => 1.5, paddingBottom: () => 1.5 },
          style: "facts",
        },
      ];

    case "table": {
      const total = block.columns.reduce((n, c) => n + c.width, 0);
      // Leave room for cell padding (8pt per column) so the table never exceeds the text width.
      const usable = TEXT_WIDTH - block.columns.length * 8 - 2;
      return [
        {
          table: {
            headerRows: 1,
            dontBreakRows: true,
            widths: block.columns.map((c) => Math.floor((c.width / total) * usable)),
            body: [block.columns.map((c) => ({ text: c.header, bold: true, color: INK })), ...block.rows.map((row) => [...row])],
          },
          layout: {
            hLineWidth: (i: number) => (i === 1 ? 0.8 : 0.4),
            vLineWidth: () => 0,
            hLineColor: () => RULE,
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 3,
            paddingBottom: () => 3,
          },
          style: "table",
        },
      ];
    }
  }
}

export function pdfDefinition(doc: ExportDoc): TDocumentDefinitions {
  const definition: TDocumentDefinitions = {
    info: { title: `${doc.title} — ${doc.reportType}`, subject: doc.running },
    pageSize: "A4",
    pageMargins: [40, 52, 40, 48],
    header: () => ({ text: doc.running, style: "running", margin: [40, 24, 40, 0] }),
    footer: (page: number, pages: number) => ({
      columns: [
        { text: "Informational tool, not legal advice.", style: "running" },
        { text: `Page ${page} of ${pages}`, style: "running", alignment: "right" },
      ],
      margin: [40, 16, 40, 0],
    }),
    content: [{ text: doc.title, style: "title" }, { text: doc.reportType, style: "subtitle" }, ...doc.blocks.flatMap(content)],
    defaultStyle: { font: "Roboto", fontSize: 9.5, lineHeight: 1.25, color: "#1e2329" },
    styles: {
      title: { fontSize: 22, bold: true, color: INK, margin: [0, 0, 0, 2] },
      subtitle: { fontSize: 12, color: MUTED, margin: [0, 0, 0, 12] },
      h1: { fontSize: 15, bold: true, color: INK, margin: [0, 16, 0, 6] },
      h2: { fontSize: 11.5, bold: true, color: INK, margin: [0, 12, 0, 3] },
      h3: { fontSize: 10, bold: true, margin: [0, 8, 0, 2] },
      body: { margin: [0, 0, 0, 5] },
      small: { fontSize: 8.5, color: MUTED, margin: [0, 0, 0, 5] },
      assumption: { fontSize: 9, color: "#7a4a0e", margin: [8, 2, 0, 6] },
      tailored: { fontSize: 9, color: "#6a5020", margin: [8, 2, 0, 6] },
      reviewer: { fontSize: 8.5, color: "#8e2c2c", margin: [0, 0, 0, 5] },
      placeholder: { fontSize: 10, color: MUTED, italics: true, alignment: "center", margin: [0, 18, 0, 24] },
      sources: { fontSize: 7.5, color: MUTED, margin: [0, 0, 0, 5] },
      list: { margin: [0, 0, 0, 5] },
      facts: { margin: [0, 2, 0, 8] },
      table: { fontSize: 8, margin: [0, 2, 0, 8] },
      running: { fontSize: 7.5, color: MUTED },
    },
  };
  // Keep a heading with the text that follows it: move it to the next page if nothing else fits below it.
  (definition as unknown as { pageBreakBefore: unknown }).pageBreakBefore = (
    node: { headlineLevel?: number },
    nodes: { getFollowingNodesOnPage: () => unknown[] },
  ) => !!node.headlineLevel && nodes.getFollowingNodesOnPage().length === 0;
  return definition;
}

/** Number of pages in a generated PDF (counts page objects, not the page tree). */
export function pdfPageCount(bytes: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(bytes);
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}
