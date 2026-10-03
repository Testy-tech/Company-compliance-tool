/* Shared helpers for the dev-only AI scripts: load .env.local and the KB without the Next.js runtime. */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";

import { jurisdictionSchema, type Jurisdiction } from "../../src/lib/kb/schema";

export function loadEnv(): void {
  let text = "";
  try {
    text = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && m[2] && !process.env[m[1]!]) process.env[m[1]!] = m[2].replace(/^["']|["']$/g, "");
  }
}

export function loadKb(): Jurisdiction[] {
  const dir = path.join(process.cwd(), "content", "jurisdictions");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => jurisdictionSchema.parse(JSON.parse(readFileSync(path.join(dir, f), "utf8"))));
}

export function client(): Anthropic {
  if (process.env.NODE_ENV === "production") throw new Error("Dev-only script: refusing to run with NODE_ENV=production.");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set (put it in .env.local).");
  return new Anthropic();
}

/** Value of "--name=value" on the command line. */
export const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
