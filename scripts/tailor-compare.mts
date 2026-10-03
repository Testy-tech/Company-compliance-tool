/*
 * Dev-only: tailor one jurisdiction of the known-low reference case on two
 * models and print both outputs with token usage, to choose TAILOR_MODEL.
 * Makes one real API call per model.
 *
 *   npm run dev:tailor-compare -- DE claude-sonnet-5 claude-opus-5 [--out=file.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadEnv, loadKb, client, arg } from "./lib/dev-env.mts";

loadEnv();
const { runTailor } = await import("../src/lib/ai/tailor");
const { buildTailorRequests } = await import("../src/lib/ai/build-request");
const { evaluate } = await import("../src/lib/engine/evaluate");
const { referenceAssessment } = await import("../src/lib/engine/fixtures");

const [id, ...models] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!id || models.length < 1) throw new Error("Usage: tailor-compare <jurisdiction id> <model> [<model> …]");

const assessment = referenceAssessment("low");
const fx = JSON.parse(readFileSync(path.join(process.cwd(), "content", "config", "fx.json"), "utf8"));
const report = evaluate(assessment, loadKb(), fx);
const section = report.jurisdictions.find((j) => j.jurisdiction === id);
if (!section) throw new Error(`No report section for "${id}"`);
const [request] = buildTailorRequests(section, assessment.intake);

const info = console.info;
console.info = () => {};
const anthropic = client();
const runs = [];
for (const model of models) {
  const started = Date.now();
  const result = await runTailor(anthropic, request!, { model });
  runs.push({ model, seconds: Math.round((Date.now() - started) / 100) / 10, result });
}
console.info = info;

console.log(`Tailoring ${section.name} (${request!.obligations.length} obligations), known-low reference case\n`);
for (const o of request!.obligations) {
  console.log(`━━ ${o.id} — ${o.title}`);
  console.log(`STANDARD steps:\n${o.actionSteps.map((s, i) => `   ${i + 1}. ${s}`).join("\n")}`);
  for (const run of runs) {
    const item = run.result.ok ? run.result.items.find((x) => x.id === o.id) : undefined;
    console.log(`\n[${run.model}]`);
    if (!run.result.ok) console.log(`   failed: ${run.result.failure}`);
    else if (!item) console.log("   (left as standard text)");
    else console.log(`   ${item.tailoredExplanation}\n${item.tailoredSteps.map((s, i) => `   ${i + 1}. ${s}`).join("\n")}`);
  }
  console.log("");
}
console.log("Usage");
for (const run of runs) {
  if (!run.result.ok) continue;
  const u = run.result.usage;
  console.log(`  ${run.model}: ${run.result.items.length} items · input ${u.inputTokens} + cache write ${u.cacheWriteTokens} + cache read ${u.cacheReadTokens} · output ${u.outputTokens} tokens · ${run.seconds}s`);
}
const out = arg("out");
if (out) writeFileSync(out, JSON.stringify({ jurisdiction: id, request, runs }, null, 2));
