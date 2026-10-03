/*
 * Automated accessibility check (axe-core) for the wizard and the report.
 * Needs a running server: `npm run dev` (or `npm start`), then `npm run test:a11y`.
 * BASE_URL overrides http://localhost:3000. Uses the installed Edge.
 * Exits 1 on any serious or critical finding; writes the full result to a11y-results.json.
 */
import { writeFileSync } from "node:fs";

import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Page } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Finding = { page: string; id: string; impact: string; help: string; nodes: number; targets: string[] };
const findings: Finding[] = [];
const checked: { page: string; violations: number; passes: number }[] = [];

async function check(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(tags).exclude("nextjs-portal").analyze();
  checked.push({ page: label, violations: result.violations.length, passes: result.passes.length });
  for (const v of result.violations)
    findings.push({ page: label, id: v.id, impact: v.impact ?? "unknown", help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) });
}

const browser = await chromium.launch({ channel: "msedge" });

async function session(scheme: "light" | "dark" = "light") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
  return { context, page: await context.newPage() };
}

async function loadSample(page: Page, sample: "unknown" | "low") {
  await page.goto(`${base}/report`);
  await page.getByRole("button", { name: sample === "unknown" ? /every threshold/ : /known low/ }).click();
  // A session that already has answers asks for confirmation first.
  const confirm = page.getByRole("button", { name: "Replace with the sample" });
  if (await confirm.isVisible().catch(() => false)) {
    await check(page, "/report sample confirmation dialog");
    await confirm.click();
  }
  await page.waitForSelector("#summary");
}

// ── Wizard: empty first step with its error summary, then every step filled in ──
{
  const { context, page } = await session();
  await page.goto(`${base}/assess`);
  await page.waitForSelector("form h2");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await check(page, "/assess step 1 (empty, with error summary)");

  await loadSample(page, "unknown");
  await page.goto(`${base}/assess`);
  await page.waitForSelector("form h2");
  const steps = page.locator("form nav ol button");
  const count = await steps.count();
  for (let i = 0; i < count; i++) {
    await steps.nth(i).click();
    await page.waitForTimeout(150);
    // open one "Why we ask" panel so its content is checked too
    const why = page.locator("form button", { hasText: "Why we ask" }).first();
    if (await why.count()) await why.click();
    await check(page, `/assess step ${i + 1}: ${await page.locator("form h2").innerText()}`);
  }
  await context.close();
}

// ── Report: both samples, reviewer mode off and on, plus dark mode ──
for (const sample of ["unknown", "low"] as const) {
  const { context, page } = await session();
  await loadSample(page, sample);
  await check(page, `/report sample "${sample}", client view`);
  await page.getByRole("switch", { name: "Reviewer mode" }).check();
  await check(page, `/report sample "${sample}", reviewer mode`);
  await context.close();
}
// ── Report with the AI features in use (both routes stubbed: no API call is made) ──
{
  const { context, page } = await session();
  await page.route("**/api/tailor", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as { obligations: { id: string }[] };
    await route.fulfill({
      json: { ok: true, model: "stub", items: body.obligations.slice(0, 2).map((o) => ({ id: o.id, tailoredExplanation: "Stubbed tailored explanation for the accessibility check.", tailoredSteps: ["First stubbed step.", "Second stubbed step."] })) },
    });
  });
  await page.route("**/api/developments", (route) =>
    route.fulfill({
      json: {
        ok: true,
        results: {
          CL: {
            jurisdiction: "CL", checkedAt: "2026-10-05T05:25:00Z", since: "2026-09-27", model: "stub", searchedDomains: ["gob.cl"],
            usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0 },
            items: [{ title: "Stubbed development", date: "2026-10-01", summary: "A stubbed one-sentence summary.", url: "https://www.gob.cl/stub" }],
          },
        },
      },
    }),
  );
  await loadSample(page, "low");
  await page.getByRole("checkbox", { name: /I agree that this report may send/ }).check();
  await page.getByRole("button", { name: "Tailor the report" }).click();
  await page.getByRole("button", { name: "Tailor again" }).waitFor();
  await page.locator("#dev-CL").locator("xpath=..").getByText("Stubbed development").waitFor();
  await check(page, "/report with tailored items and a developments panel (stubbed)");
  await context.close();
}
{
  const { context, page } = await session("dark");
  await loadSample(page, "unknown");
  await check(page, `/report sample "unknown", dark mode`);
  await page.goto(`${base}/assess`);
  await page.waitForSelector("form h2");
  await page.locator("form nav ol button").nth(1).click();
  await check(page, "/assess step 2, dark mode");
  await context.close();
}
{
  const { context, page } = await session();
  await page.goto(`${base}/report`);
  await page.waitForSelector("h1");
  await check(page, "/report empty state");
  await context.close();
}

await browser.close();

const blocking = findings.filter((f) => f.impact === "serious" || f.impact === "critical");
writeFileSync("a11y-results.json", JSON.stringify({ base, tags, checked, findings }, null, 2));
for (const c of checked) console.log(`${c.violations === 0 ? "ok  " : "FAIL"} ${c.page} — ${c.violations} violations, ${c.passes} rules passed`);
for (const f of findings) console.log(`  [${f.impact}] ${f.page}: ${f.id} — ${f.help} (${f.nodes} nodes) e.g. ${f.targets[0]}`);
console.log(`\n${checked.length} pages checked, ${findings.length} violations, ${blocking.length} serious or critical`);
process.exit(blocking.length ? 1 : 0);
