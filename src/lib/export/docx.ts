import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, FootnoteReferenceRun, Header, HeadingLevel, LevelFormat, PageNumber, Paragraph, ShadingType,
  Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType, type IParagraphOptions,
} from "docx";

import type { Block, ExportDoc } from "./model";

/*
 * ExportDoc → Word document, built to be edited by a lawyer: real heading
 * styles (so the navigation pane and a table of contents work), real numbered
 * lists for action steps, real footnotes for sources, ordinary tables. No
 * tracked changes, no content controls.
 *
 * Section numbers ("§ 2.8") are written as text, not as automatic heading
 * numbers: the transfer map, roadmap and questions refer to them, and automatic
 * numbering would silently change those references when an item is added or removed.
 */

const INK = "1B2A4A";
const MUTED = "555A60";
const FONT = "Calibri";
const TEXT_WIDTH_DXA = 9638; // A4 with 2 cm margins
const HEADINGS = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const;

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const hairline = { style: BorderStyle.SINGLE, size: 4, color: "C9C2B2" };

export function docxDocument(doc: ExportDoc): Document {
  const footnotes: Record<number, { children: Paragraph[] }> = {};
  let footnoteId = 0;
  let listInstance = 0;

  const cell = (text: string, width: number, opts: { bold?: boolean; color?: string; header?: boolean; borders?: boolean } = {}) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      margins: { top: 50, bottom: 50, left: 80, right: 80 },
      shading: opts.header ? { type: ShadingType.CLEAR, fill: "EDE7DA", color: "auto" } : undefined,
      borders: opts.borders === false ? { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder } : { top: hairline, bottom: hairline, left: noBorder, right: noBorder },
      children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: 18 })] })],
    });

  function render(block: Block): (Paragraph | Table)[] {
    switch (block.kind) {
      case "heading":
        return [new Paragraph({ heading: HEADINGS[block.level], text: block.text, keepNext: true, pageBreakBefore: block.pageBreak })];

      case "paragraph": {
        const children: IParagraphOptions["children"] = block.runs.map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic }));
        for (const s of block.sources ?? []) {
          footnoteId++;
          footnotes[footnoteId] = {
            children: [
              new Paragraph({
                children: s.url ? [new ExternalHyperlink({ link: s.url, children: [new TextRun({ text: s.text, style: "Hyperlink" })] })] : [new TextRun(s.text)],
              }),
            ],
          };
          (children as unknown[]).push(new FootnoteReferenceRun(footnoteId));
        }
        if (block.style === "placeholder")
          return [
            new Paragraph({
              children,
              alignment: AlignmentType.CENTER,
              spacing: { before: 240, after: 360 },
              shading: { type: ShadingType.CLEAR, fill: "FFF2CC", color: "auto" },
              border: { top: hairline, bottom: hairline, left: hairline, right: hairline },
            }),
          ];
        return [new Paragraph({ children, style: block.style && block.style !== "body" ? block.style : undefined })];
      }

      case "list": {
        const instance = ++listInstance;
        return block.items.map(
          (text) => new Paragraph({ text, numbering: block.ordered ? { reference: "steps", level: 0, instance } : undefined, bullet: block.ordered ? undefined : { level: 0 }, spacing: { after: 60 } }),
        );
      }

      case "facts": {
        const widths = [2600, TEXT_WIDTH_DXA - 2600];
        return [
          new Table({
            width: { size: TEXT_WIDTH_DXA, type: WidthType.DXA },
            columnWidths: widths,
            layout: TableLayoutType.FIXED,
            rows: block.rows.map(([k, v]) => new TableRow({ cantSplit: true, children: [cell(k, widths[0]!, { color: MUTED, borders: false }), cell(v, widths[1]!, { borders: false })] })),
          }),
          new Paragraph({ spacing: { after: 60 }, children: [] }),
        ];
      }

      case "table": {
        const total = block.columns.reduce((n, c) => n + c.width, 0);
        const widths = block.columns.map((c) => Math.floor((c.width / total) * TEXT_WIDTH_DXA));
        return [
          new Table({
            width: { size: TEXT_WIDTH_DXA, type: WidthType.DXA },
            columnWidths: widths,
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({ tableHeader: true, cantSplit: true, children: block.columns.map((c, i) => cell(c.header, widths[i]!, { bold: true, color: INK, header: true })) }),
              ...block.rows.map((row) => new TableRow({ cantSplit: true, children: row.map((text, i) => cell(text, widths[i]!)) })),
            ],
          }),
          new Paragraph({ spacing: { after: 120 }, children: [] }),
        ];
      }
    }
  }

  const body = doc.blocks.flatMap(render);
  const small = (text: string, alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    new Paragraph({ alignment, spacing: { after: 0 }, children: [new TextRun({ text, size: 15, color: MUTED })] });

  return new Document({
    creator: "DataBorders",
    title: `${doc.title} — ${doc.reportType}`,
    description: doc.running,
    footnotes,
    numbering: {
      config: [
        {
          reference: "steps",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 500, hanging: 300 } } } }],
        },
      ],
    },
    styles: {
      default: {
        document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { after: 120, line: 276 } } },
        title: { run: { font: FONT, size: 48, bold: true, color: INK }, paragraph: { spacing: { after: 60 } } },
        heading1: { run: { font: FONT, size: 32, bold: true, color: INK }, paragraph: { spacing: { before: 360, after: 120 } } },
        heading2: { run: { font: FONT, size: 25, bold: true, color: INK }, paragraph: { spacing: { before: 280, after: 80 } } },
        heading3: { run: { font: FONT, size: 22, bold: true }, paragraph: { spacing: { before: 200, after: 60 } } },
      },
      paragraphStyles: [
        { id: "small", name: "Small note", basedOn: "Normal", run: { size: 18, color: MUTED } },
        { id: "assumption", name: "Assumption", basedOn: "Normal", run: { size: 20, color: "7A4A0E" }, paragraph: { indent: { left: 240 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: "C28A2B", space: 8 } } } },
        { id: "tailored", name: "Tailored text", basedOn: "Normal", run: { size: 20, color: "6A5020" }, paragraph: { indent: { left: 240 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: "A8874A", space: 8 } } } },
        { id: "reviewer", name: "Reviewer note", basedOn: "Normal", run: { size: 18, color: "8E2C2C" } },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        headers: { default: new Header({ children: [small(doc.running)] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 0 },
                children: [new TextRun({ size: 15, color: MUTED, children: ["Informational tool, not legal advice.    Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] })],
              }),
            ],
          }),
        },
        children: [new Paragraph({ heading: HeadingLevel.TITLE, text: doc.title }), new Paragraph({ style: "small", text: doc.reportType }), ...body],
      },
    ],
  });
}
