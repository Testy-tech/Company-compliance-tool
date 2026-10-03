import type { Obligation } from "@/lib/kb/schema";
import { priorityRank } from "@/lib/report/labels";

/* Review order and research-log excerpts. Pure functions, shared by the console (browser) and its tests. */

const FIRST = ["CN", "CL", "US-CA"];
const jurisdictionOf = (id: string) => id.replace(/-[A-Z_]+-\d{2}$/, "");

/** Unreviewed items in review order: by priority, and within a priority China, Chile and California first. */
export function reviewQueue<T extends Pick<Obligation, "id" | "priority" | "confidence">>(obligations: readonly T[]): T[] {
  const rank = (id: string) => {
    const i = FIRST.indexOf(jurisdictionOf(id));
    return i < 0 ? FIRST.length : i;
  };
  return obligations
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => o.confidence !== "verified")
    .sort((a, b) => priorityRank[a.o.priority] - priorityRank[b.o.priority] || rank(a.o.id) - rank(b.o.id) || a.i - b.i)
    .map(({ o }) => o);
}

/** The parts of a research log that concern one obligation: paragraphs naming it, plus the open questions for counsel. */
export function logExcerpt(log: string, id: string): string {
  const blocks = log.split(/\n(?=\s*(?:- |\d+\. |## |\| ))|\n\n+/).map((b) => b.trim()).filter(Boolean);
  const naming = blocks.filter((b) => b.includes(id));
  const questionsAt = log.search(/^## Open questions for counsel/m);
  const questions = questionsAt >= 0 ? log.slice(questionsAt).split(/\n## /)[0]!.trim() : "";
  const findingsAt = log.search(/^## Findings and judgement calls/m);
  const findings = findingsAt >= 0 ? log.slice(findingsAt).split(/\n## /)[0]!.trim() : "";
  const parts = [naming.length ? `Mentions of ${id}:\n\n${naming.join("\n\n")}` : `The log does not mention ${id} by id.`, naming.length ? "" : findings, questions];
  return parts.filter(Boolean).join("\n\n");
}
