import { aiConfig } from "@/lib/ai/config";
import { readStoredDevelopments, type StoredDevelopments } from "@/lib/ai/developments";
import { json, limited } from "@/lib/ai/http";
import { coveredJurisdictions } from "@/lib/intake/schema";
import { getStore } from "@/lib/store/kv";

/*
 * GET /api/developments — the stored results of the scheduled developments
 * check, per jurisdiction. Read-only: it never runs a search and receives no
 * assessment data. The check itself runs from /api/cron/developments/[jurisdiction].
 */

export async function GET(request: Request) {
  const refused = await limited(request, "developments-read", aiConfig.developments.readRateLimit);
  if (refused) return refused;

  const store = getStore();
  const results: Record<string, StoredDevelopments | null> = {};
  try {
    await Promise.all(coveredJurisdictions.map(async (id) => void (results[id] = await readStoredDevelopments(store, id))));
  } catch {
    return json({ ok: false, failure: "store_unavailable" }, 503);
  }
  return json({ ok: true, results });
}
