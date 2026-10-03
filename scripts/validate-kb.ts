/* Validates /content/jurisdictions/*.json. Runs before every build (prebuild). */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { euTransfersSchema } from "../src/lib/kb/eu-transfers";
import { validateJurisdiction, type Issue } from "../src/lib/kb/validate";

const dir = path.join(process.cwd(), "content", "jurisdictions");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const all: Issue[] = [];
let obligations = 0;

for (const file of files) {
  const id = file.replace(/\.json$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  } catch (e) {
    all.push({ level: "error", where: file, message: `invalid JSON: ${String(e)}` });
    continue;
  }
  const { data, issues } = validateJurisdiction(raw, id);
  all.push(...issues);
  if (data) {
    obligations += data.obligations.length;
    const byConf = data.obligations.reduce<Record<string, number>>((acc, o) => {
      acc[o.confidence] = (acc[o.confidence] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`  ${id.padEnd(6)} ${String(data.obligations.length).padStart(3)} obligations  ${JSON.stringify(byConf)}`);
  }
}

// EU/EEA transfer data (adequacy list, mechanisms): schema plus a staleness warning.
try {
  const eu = euTransfersSchema.parse(JSON.parse(readFileSync(path.join(process.cwd(), "content", "config", "eu-transfers.json"), "utf8")));
  const ageDays = (Date.now() - new Date(eu.lastVerified).getTime()) / 86_400_000;
  if (ageDays > 180) all.push({ level: "warning", where: "eu-transfers.json", message: `adequacy list last verified ${eu.lastVerified}; re-check the Commission page` });
  console.log(`  EU transfers: ${eu.adequacy.countries.length} adequacy decisions, last verified ${eu.lastVerified} (${eu.confidence})`);
} catch (e) {
  all.push({ level: "error", where: "eu-transfers.json", message: String(e) });
}

for (const i of all) console.log(`${i.level === "error" ? "ERROR" : "warn "} ${i.where}  ${i.message}`);
const errors = all.filter((i) => i.level === "error").length;
console.log(`\nKB: ${files.length} jurisdictions, ${obligations} obligations, ${errors} errors, ${all.length - errors} warnings`);
if (errors > 0) process.exit(1);
