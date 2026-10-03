import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jurisdictionSchema, type Obligation } from "@/lib/kb/schema";

import { editObligation, formatValue, obligationSpan, setFields } from "./json-edit";
import { logExcerpt, reviewQueue } from "./queue";
import { applyReview, renderReviewLog, reviewConsoleEnabled, type ReviewDeps } from "./review";

const kbDir = path.join(process.cwd(), "content", "jurisdictions");
const original = readFileSync(path.join(kbDir, "CN.json"), "utf8");
const cn = jurisdictionSchema.parse(JSON.parse(original));
const target = cn.obligations.find((o) => o.id === "CN-TRANSFER-04")!;

/* ── Text-level edits ─────────────────────────────────────────────────────── */

describe("editing a knowledge-base file in place", () => {
  const changedLines = (a: string, b: string) => {
    const [x, y] = [a.split("\n"), b.split("\n")];
    return y.filter((line, i) => line !== x[i]).length + Math.abs(x.length - y.length);
  };

  it("finds one obligation's text", () => {
    const { start, end } = obligationSpan(original, "CN-TRANSFER-04");
    const parsed = JSON.parse(original.slice(start, end)) as Obligation;
    expect(parsed.id).toBe("CN-TRANSFER-04");
    expect(() => obligationSpan(original, "CN-NOPE-99")).toThrow(/not found/);
  });

  it("changes only the lines of the fields it sets and keeps the file valid", () => {
    const next = editObligation(original, "CN-TRANSFER-04", { confidence: "verified", verifiedBy: "A. Reviewer", lastVerified: "2026-10-04" });
    expect(changedLines(original, next)).toBe(3);
    const o = jurisdictionSchema.parse(JSON.parse(next)).obligations.find((x) => x.id === "CN-TRANSFER-04")!;
    expect(o).toMatchObject({ confidence: "verified", verifiedBy: "A. Reviewer", lastVerified: "2026-10-04" });
    // every other obligation is byte-for-byte the same
    expect(JSON.parse(next).obligations.filter((x: Obligation) => x.id !== "CN-TRANSFER-04")).toEqual(JSON.parse(original).obligations.filter((x: Obligation) => x.id !== "CN-TRANSFER-04"));
    // the hand formatting of rules is untouched
    expect(next).toContain('"appliesIf": {');
    expect(next.length - original.length).toBeLessThan(40);
  });

  it("inserts a new property after a given one, and removes it again cleanly", () => {
    const flagged = editObligation(original, "CN-TRANSFER-04", { reviewNote: "Check the 60-day renewal period." }, "confidence");
    const lines = flagged.split("\n");
    const at = lines.findIndex((l) => l.includes('"reviewNote"'));
    expect(lines[at - 1]).toMatch(/"confidence": "needs_review",$/);
    expect(JSON.parse(flagged).obligations.find((x: Obligation) => x.id === "CN-TRANSFER-04").reviewNote).toBe("Check the 60-day renewal period.");
    expect(editObligation(flagged, "CN-TRANSFER-04", { reviewNote: undefined })).toBe(original);
  });

  it("removes a property in the middle or at the end of an object", () => {
    const obj = '{\n  "a": 1,\n  "b": "x",\n  "c": [1, 2]\n}';
    expect(JSON.parse(setFields(obj, { b: undefined }))).toEqual({ a: 1, c: [1, 2] });
    expect(JSON.parse(setFields(obj, { c: undefined }))).toEqual({ a: 1, b: "x" });
    expect(JSON.parse(setFields(obj, { a: undefined }))).toEqual({ b: "x", c: [1, 2] });
    expect(setFields(obj, { missing: undefined })).toBe(obj);
  });

  it("writes lists one item per line and sources as inline objects, and copes with quotes and braces in text", () => {
    expect(formatValue(["one"], "    ")).toBe('["one"]');
    expect(formatValue(["one", "two"], "    ")).toBe('[\n      "one",\n      "two"\n    ]');
    expect(formatValue([{ url: "https://a.example", pinpoint: "Art. 1" }], "  ")).toBe('[{ "url": "https://a.example", "pinpoint": "Art. 1" }]');
    const tricky = 'He said "stop" } ] { and left, with a \\ backslash.';
    const next = editObligation(original, "CN-TRANSFER-04", { requirement: tricky, actionSteps: ['Step with "quotes" and } brace', "Second step, with [brackets]"] });
    const o = JSON.parse(next).obligations.find((x: Obligation) => x.id === "CN-TRANSFER-04");
    expect(o.requirement).toBe(tricky);
    expect(o.actionSteps).toEqual(['Step with "quotes" and } brace', "Second step, with [brackets]"]);
    // and a later edit still finds the right span
    expect(JSON.parse(editObligation(next, "CN-TRANSFER-04", { confidence: "verified" })).obligations).toHaveLength(cn.obligations.length);
  });
});

const pickEditable = (id: string) => {
  const o = cn.obligations.find((x) => x.id === id)!;
  return { requirement: o.requirement, actionSteps: o.actionSteps, sources: o.sources, deadlineOrTimeline: o.deadlineOrTimeline, penaltyNote: o.penaltyNote };
};

/* ── Saving a review ──────────────────────────────────────────────────────── */

describe("applyReview", () => {
  let dir: string;
  let deps: ReviewDeps;
  const read = () => readFileSync(path.join(dir, "kb", "CN.json"), "utf8");
  const item = () => jurisdictionSchema.parse(JSON.parse(read())).obligations.find((o) => o.id === "CN-TRANSFER-04")!;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "review-"));
    cpSync(kbDir, path.join(dir, "kb"), { recursive: true });
    deps = {
      kbDir: path.join(dir, "kb"),
      logJson: path.join(dir, "review-log.json"),
      logMarkdown: path.join(dir, "docs", "review-log.md"),
      reviewer: "Avv. Test Reviewer",
      now: () => new Date("2026-10-04T09:30:00Z"),
      runChecks: vi.fn(async () => ({ ok: true, output: "" })),
    };
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("Verify sets confidence, verifiedBy from the configured reviewer and today's date, and logs before and after", async () => {
    const result = await applyReview({ action: "verify", id: "CN-TRANSFER-04" }, deps);
    expect(result.ok).toBe(true);
    expect(item()).toMatchObject({ confidence: "verified", verifiedBy: "Avv. Test Reviewer", lastVerified: "2026-10-04" });
    expect(deps.runChecks).toHaveBeenCalledTimes(1);
    const log = JSON.parse(readFileSync(deps.logJson, "utf8"));
    expect(log).toEqual([
      expect.objectContaining({
        at: "2026-10-04T09:30:00.000Z",
        reviewer: "Avv. Test Reviewer",
        action: "verify",
        id: "CN-TRANSFER-04",
        before: expect.objectContaining({ confidence: "needs_review", verifiedBy: target.verifiedBy, lastVerified: target.lastVerified }),
        after: expect.objectContaining({ confidence: "verified", verifiedBy: "Avv. Test Reviewer", lastVerified: "2026-10-04" }),
      }),
    ]);
    const md = readFileSync(deps.logMarkdown, "utf8");
    expect(md).toContain("## 2026-10-04 09:30 UTC — verify — CN-TRANSFER-04");
    expect(md).toContain("| confidence | needs_review | verified |");
    expect(md).toContain("**Reviewer:** Avv. Test Reviewer");
  });

  it("Flag sets needs_review with a note; verifying later removes the note", async () => {
    expect((await applyReview({ action: "flag", id: "CN-TRANSFER-04", note: "Renewal period: check against the 2024 provisions." }, deps)).ok).toBe(true);
    expect(item()).toMatchObject({ confidence: "needs_review", reviewNote: "Renewal period: check against the 2024 provisions." });
    await applyReview({ action: "verify", id: "CN-TRANSFER-04" }, deps);
    expect(item().reviewNote).toBeUndefined();
    expect(JSON.parse(readFileSync(deps.logJson, "utf8")).map((e: { action: string }) => e.action)).toEqual(["flag", "verify"]);
    expect((await applyReview({ action: "flag", id: "CN-TRANSFER-04", note: "no" }, deps)).ok).toBe(false); // a note is required
  });

  it("Edit updates requirement, steps, timeline, penalty and sources", async () => {
    const fields = {
      requirement: "A reworded requirement that is long enough to pass validation and says the same thing more plainly.",
      actionSteps: ["Confirm volumes.", "File the application."],
      deadlineOrTimeline: "Before the first transfer",
      penaltyNote: "",
      sources: [{ url: "https://www.cac.gov.cn/2024-03/22/c_1712776611775634.htm", pinpoint: "CBDF Provisions Art. 7" }],
    };
    const result = await applyReview({ action: "edit", id: "CN-TRANSFER-04", fields }, deps);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const o = item();
    expect(o).toMatchObject({ requirement: fields.requirement, actionSteps: fields.actionSteps, deadlineOrTimeline: "Before the first transfer", sources: fields.sources });
    expect(o.penaltyNote).toBeUndefined(); // cleared
    expect(o.confidence).toBe("needs_review"); // editing is not verifying
  });

  it("Edit changes priority, owner and GDPR comparison through the same checks", async () => {
    const fields = { requirement: target.requirement, actionSteps: target.actionSteps, sources: target.sources, deadlineOrTimeline: target.deadlineOrTimeline, penaltyNote: target.penaltyNote };
    const result = await applyReview({ action: "edit", id: "CN-TRANSFER-04", fields: { ...fields, priority: "high", owner: "HQ", gdprDelta: "partial" } }, deps);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(item()).toMatchObject({ priority: "high", owner: "HQ", gdprDelta: "partial", exclusiveGroup: target.exclusiveGroup, strictness: target.strictness });
    expect(deps.runChecks).toHaveBeenCalledTimes(1);
    expect(result.ok && result.entry.before).toMatchObject({ priority: "critical" });
    expect(result.ok && result.entry.after).toMatchObject({ priority: "high" });
    const bad = await applyReview({ action: "edit", id: "CN-TRANSFER-04", fields: { ...fields, priority: "urgent" } }, deps);
    expect(bad).toMatchObject({ ok: false, stage: "input" });
  });

  it("Edit changes the exclusive tier, and the validator refuses a tier that breaks its group", async () => {
    const fields = { requirement: target.requirement, actionSteps: target.actionSteps, sources: target.sources, deadlineOrTimeline: target.deadlineOrTimeline, penaltyNote: target.penaltyNote };
    const before = read();
    // strictness 1 is taken by the other tier of the group
    expect(await applyReview({ action: "edit", id: "CN-TRANSFER-04", fields: { ...fields, strictness: 1 } }, deps)).toMatchObject({ ok: false, stage: "validator" });
    // removing the group leaves a one-tier group behind
    expect(await applyReview({ action: "edit", id: "CN-TRANSFER-04", fields: { ...fields, exclusiveGroup: null, strictness: null } }, deps)).toMatchObject({ ok: false, stage: "validator" });
    // a group without strictness
    expect(await applyReview({ action: "edit", id: "CN-TRANSFER-04", fields: { ...fields, strictness: null } }, deps)).toMatchObject({ ok: false, stage: "validator" });
    expect(read()).toBe(before);
    expect(deps.runChecks).not.toHaveBeenCalled();

    const ok = await applyReview({ action: "edit", id: "CN-TRANSFER-04", fields: { ...fields, strictness: 3 } }, deps);
    expect(ok.ok, JSON.stringify(ok)).toBe(true);
    expect(item()).toMatchObject({ exclusiveGroup: "CN-TRANSFER_MECHANISM", strictness: 3 });

    // adding a tier to an item that had none puts both properties after the rule note, group first
    const added = await applyReview({ action: "edit", id: "CN-TRANSFER-01", fields: { ...pickEditable("CN-TRANSFER-01"), exclusiveGroup: "CN-TRANSFER_MECHANISM", strictness: 4 } }, deps);
    expect(added.ok, JSON.stringify(added)).toBe(true);
    const lines = read().split(String.fromCharCode(10));
    const at = lines.findIndex((l, i) => l.includes('"exclusiveGroup"') && lines[i + 1]!.includes('"strictness": 4'));
    expect(at).toBeGreaterThan(0);
    expect(lines[at - 1]).toContain('"appliesIfNote"');
  });

  it("rejects an invalid edit without touching the file", async () => {
    const before = read();
    const bad = await applyReview({ action: "edit", id: "CN-TRANSFER-04", fields: { requirement: "too short", actionSteps: [], sources: [{ url: "http://not-https.example", pinpoint: "" }] } }, deps);
    expect(bad).toMatchObject({ ok: false, stage: "input" });
    expect(bad.ok === false && bad.errors.join(" ")).toMatch(/requirement/);
    expect(read()).toBe(before);
    expect(deps.runChecks).not.toHaveBeenCalled();
  });

  it("rejects a change the KB validator refuses (no official source left)", async () => {
    const before = read();
    const fields = { requirement: target.requirement, actionSteps: target.actionSteps, sources: [{ url: "https://lawfirm.example.com/post", pinpoint: "Blog post" }] };
    const result = await applyReview({ action: "edit", id: "CN-TRANSFER-04", fields }, deps);
    expect(result).toMatchObject({ ok: false, stage: "validator" });
    expect(read()).toBe(before);
  });

  it("restores the file and reports the output when the engine tests fail", async () => {
    const before = read();
    deps.runChecks = vi.fn(async () => ({ ok: false, output: "FAIL src/lib/engine/evaluate.test.ts" }));
    const result = await applyReview({ action: "verify", id: "CN-TRANSFER-04" }, deps);
    expect(result).toMatchObject({ ok: false, stage: "tests" });
    expect(result.ok === false && result.errors.join("\n")).toContain("FAIL src/lib/engine/evaluate.test.ts");
    expect(read()).toBe(before);
    expect(() => readFileSync(deps.logJson)).toThrow(); // nothing logged
  });

  it("needs a reviewer name, a known id and an actual change", async () => {
    expect(await applyReview({ action: "verify", id: "CN-TRANSFER-04" }, { ...deps, reviewer: undefined })).toMatchObject({ ok: false, stage: "config" });
    expect(await applyReview({ action: "verify", id: "CN-NOPE-99" }, deps)).toMatchObject({ ok: false, stage: "input" });
    await applyReview({ action: "verify", id: "CN-TRANSFER-04" }, deps);
    expect(await applyReview({ action: "verify", id: "CN-TRANSFER-04" }, deps)).toMatchObject({ ok: false, stage: "input", errors: [expect.stringMatching(/Nothing to change/)] });
  });

  it("renders an empty log", () => {
    expect(renderReviewLog([])).toContain("No changes recorded yet");
  });
});

/* ── Queue, excerpts, and the development-only guard ──────────────────────── */

describe("review queue", () => {
  const o = (id: string, priority: Obligation["priority"], confidence: Obligation["confidence"] = "needs_review") => ({ id, priority, confidence });

  it("orders unreviewed items by priority, with China, Chile and California first within a priority", () => {
    const queue = reviewQueue([
      o("IT-TRANSFER-01", "critical"),
      o("US-CA-NOTICE-01", "critical"),
      o("DE-EMPLOYEE-01", "high"),
      o("CL-GOVERNANCE-01", "critical"),
      o("CN-TRANSFER-04", "critical"),
      o("CN-NOTICE-01", "high"),
      o("CN-LEGAL_BASIS-01", "critical", "verified"),
      o("KR-TRANSFER-01", "critical"),
    ]);
    expect(queue.map((x) => x.id)).toEqual(["CN-TRANSFER-04", "CL-GOVERNANCE-01", "US-CA-NOTICE-01", "IT-TRANSFER-01", "KR-TRANSFER-01", "CN-NOTICE-01", "DE-EMPLOYEE-01"]);
  });

  it("picks the parts of a research log that concern one obligation", () => {
    const log = readFileSync(path.join(process.cwd(), "content", "research-logs", "US-TX.md"), "utf8");
    const excerpt = logExcerpt(log, "US-TX-SENSITIVE-03");
    expect(excerpt).toContain("Mentions of US-TX-SENSITIVE-03");
    expect(excerpt).toContain("Open questions for counsel");
    expect(logExcerpt(log, "US-TX-AI-01")).toContain("does not mention US-TX-AI-01 by id");
  });
});

describe("the console is development-only", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is enabled only when NODE_ENV is development", () => {
    expect(reviewConsoleEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(reviewConsoleEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(reviewConsoleEnabled({ NODE_ENV: "test" })).toBe(false);
    expect(reviewConsoleEnabled({})).toBe(false);
  });

  it("the page and both API routes answer 404 in a production build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { default: Page } = await import("@/app/admin/review/page");
    await expect(Page()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    const { POST } = await import("@/app/api/admin/review/route");
    const res = await POST(new Request("http://localhost/api/admin/review", { method: "POST", body: JSON.stringify({ action: "verify", id: "CN-TRANSFER-04" }) }));
    expect(res.status).toBe(404);
    const { POST: exportLog } = await import("@/app/api/admin/review/export/route");
    expect((await exportLog()).status).toBe(404);
    // and nothing was written
    expect(readFileSync(path.join(kbDir, "CN.json"), "utf8")).toBe(original);
  });
});
