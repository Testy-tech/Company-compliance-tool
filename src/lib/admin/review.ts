import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Obligation } from "@/lib/kb/schema";
import { validateJurisdiction } from "@/lib/kb/validate";

import { reviewActionSchema, type ReviewLogEntry, type ReviewResult } from "./actions";
import { editObligation } from "./json-edit";

export { reviewActionSchema, type ReviewAction, type ReviewLogEntry, type ReviewResult } from "./actions";

/*
 * Review console back end (development only). A reviewer verifies, edits or
 * flags one obligation; the change is written to the jurisdiction's JSON file,
 * then the KB validator and the engine tests run. If anything fails the file
 * is restored, so broken data never stays on disk. Every accepted change is
 * appended to a review log (who, what, when, before and after).
 */

/** The console exists only in development; production builds answer 404. */
export const reviewConsoleEnabled = (env: Record<string, string | undefined> = process.env) => env.NODE_ENV === "development";

export type ReviewDeps = {
  kbDir: string;
  /** Machine-readable log; the Markdown log is rendered from it. */
  logJson: string;
  logMarkdown: string;
  reviewer: string | undefined;
  now: () => Date;
  /** Runs the engine and KB tests against the files on disk. */
  runChecks: () => Promise<{ ok: boolean; output: string }>;
};

export function defaultDeps(root = process.cwd()): ReviewDeps {
  return {
    kbDir: path.join(root, "content", "jurisdictions"),
    logJson: path.join(root, "content", "review-log.json"),
    logMarkdown: path.join(root, "docs", "review-log.md"),
    reviewer: process.env.REVIEWER_NAME?.trim() || undefined,
    now: () => new Date(),
    runChecks: () => runTests(root),
  };
}

/** The engine and KB test suites, run in a child process so they see the files as written. */
function runTests(root: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(root, "node_modules", "vitest", "vitest.mjs"), "run", "src/lib/engine", "src/lib/kb", "--reporter=dot"], {
      cwd: root,
      env: { ...process.env, NODE_ENV: "test" },
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("error", (e) => resolve({ ok: false, output: String(e) }));
    child.on("close", (code) => resolve({ ok: code === 0, output: output.slice(-4000) }));
  });
}

async function findFile(kbDir: string, id: string): Promise<{ file: string; text: string; obligation: Obligation } | null> {
  for (const name of (await readdir(kbDir)).filter((f) => f.endsWith(".json")).sort()) {
    const file = path.join(kbDir, name);
    const text = await readFile(file, "utf8");
    const obligation = (JSON.parse(text) as { obligations: Obligation[] }).obligations.find((o) => o.id === id);
    if (obligation) return { file, text, obligation };
  }
  return null;
}

const pick = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map((k) => [k, o[k]]));

export async function applyReview(input: unknown, deps: ReviewDeps): Promise<ReviewResult> {
  if (!deps.reviewer) return { ok: false, stage: "config", errors: ["Set REVIEWER_NAME in .env.local to the reviewer's name; it is recorded as verifiedBy and in the review log."] };
  const parsed = reviewActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, stage: "input", errors: parsed.error.issues.map((i) => `${i.path.slice(1).join(".") || "request"}: ${i.message}`) };
  const action = parsed.data;

  const found = await findFile(deps.kbDir, action.id);
  if (!found) return { ok: false, stage: "input", errors: [`Obligation ${action.id} not found`] };
  const { file, text, obligation } = found;
  const today = deps.now().toISOString().slice(0, 10);

  // Field changes for this action. `undefined` removes a property.
  const fields: Record<string, unknown> =
    action.action === "verify"
      ? { confidence: "verified", verifiedBy: deps.reviewer, lastVerified: today, reviewNote: undefined }
      : action.action === "flag"
        ? { confidence: "needs_review", reviewNote: action.note }
        : {
            requirement: action.fields.requirement,
            actionSteps: action.fields.actionSteps,
            deadlineOrTimeline: action.fields.deadlineOrTimeline || undefined,
            penaltyNote: action.fields.penaltyNote || undefined,
            sources: action.fields.sources,
          };

  let next: string;
  try {
    next = editObligation(text, action.id, fields, "confidence");
  } catch (e) {
    return { ok: false, stage: "input", errors: [String(e)] };
  }
  if (next === text) return { ok: false, stage: "input", errors: ["Nothing to change: the item already has these values."] };

  // Validate the new text before it touches the disk.
  let raw: unknown;
  try {
    raw = JSON.parse(next);
  } catch (e) {
    return { ok: false, stage: "validator", errors: [`The edited file is not valid JSON: ${String(e)}`] };
  }
  const { issues } = validateJurisdiction(raw, path.basename(file, ".json"), today);
  const errors = issues.filter((i) => i.level === "error").map((i) => `${i.where}: ${i.message}`);
  if (errors.length) return { ok: false, stage: "validator", errors };

  await writeFile(file, next, "utf8");
  const checks = await deps.runChecks();
  if (!checks.ok) {
    await writeFile(file, text, "utf8"); // restore: broken data is never left on disk
    return { ok: false, stage: "tests", errors: ["The engine or KB tests failed with this change; the file was restored.", checks.output] };
  }

  const keys = Object.keys(fields);
  const updated = (JSON.parse(next) as { obligations: Obligation[] }).obligations.find((o) => o.id === action.id)!;
  const entry: ReviewLogEntry = {
    at: deps.now().toISOString(),
    reviewer: deps.reviewer,
    action: action.action,
    id: action.id,
    title: obligation.title,
    note: action.action === "flag" ? action.note : undefined,
    before: pick(obligation as Record<string, unknown>, keys),
    after: pick(updated as Record<string, unknown>, keys),
  };
  const log = await readLog(deps);
  log.push(entry);
  await writeFile(deps.logJson, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  await exportReviewLog(deps);
  return { ok: true, entry };
}

export async function readLog(deps: Pick<ReviewDeps, "logJson">): Promise<ReviewLogEntry[]> {
  try {
    return JSON.parse(await readFile(deps.logJson, "utf8")) as ReviewLogEntry[];
  } catch {
    return [];
  }
}

const show = (v: unknown) => (v === undefined ? "_(not set)_" : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : `${(x as { pinpoint: string }).pinpoint} — ${(x as { url: string }).url}`)).join(" / ") : String(v));

/** Render the review log as Markdown: who, what, when, before and after. */
export function renderReviewLog(log: readonly ReviewLogEntry[]): string {
  const lines = ["# Knowledge-base review log", "", "Every change made through the review console, oldest first. Generated from `content/review-log.json`; do not edit by hand.", ""];
  if (!log.length) lines.push("_No changes recorded yet._", "");
  for (const e of log) {
    lines.push(`## ${e.at.slice(0, 16).replace("T", " ")} UTC — ${e.action} — ${e.id}`, "", `- **Reviewer:** ${e.reviewer}`, `- **Item:** ${e.title}`);
    if (e.note) lines.push(`- **Note:** ${e.note}`);
    lines.push("", "| Field | Before | After |", "|---|---|---|");
    for (const key of Object.keys(e.after)) lines.push(`| ${key} | ${show(e.before[key]).replace(/\|/g, "\\|")} | ${show(e.after[key]).replace(/\|/g, "\\|")} |`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function exportReviewLog(deps: Pick<ReviewDeps, "logJson" | "logMarkdown">): Promise<{ path: string; entries: number }> {
  const log = await readLog(deps);
  await mkdir(path.dirname(deps.logMarkdown), { recursive: true });
  await writeFile(deps.logMarkdown, renderReviewLog(log), "utf8");
  return { path: deps.logMarkdown, entries: log.length };
}
