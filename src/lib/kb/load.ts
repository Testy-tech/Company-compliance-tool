import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { FxTable } from "@/lib/intake/money";

import { knowledgeBase } from "./repository";

/** Knowledge base plus the conversion table, for pages that evaluate on the client. */
export async function loadKnowledge() {
  const [kb, fxRaw] = await Promise.all([
    knowledgeBase.list(),
    readFile(path.join(process.cwd(), "content", "config", "fx.json"), "utf8"),
  ]);
  return { kb, fx: JSON.parse(fxRaw) as FxTable };
}
