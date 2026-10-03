import { isAuthorisedCron, runScheduledDevelopments } from "@/lib/ai/developments";
import { getClient, json } from "@/lib/ai/http";
import { coveredJurisdictions } from "@/lib/intake/schema";
import { knowledgeBase } from "@/lib/kb/repository";
import type { JurisdictionId } from "@/lib/kb/schema";
import { getStore } from "@/lib/store/kv";

/*
 * GET /api/cron/developments/[jurisdiction] — the scheduled developments check
 * for one jurisdiction. Called by Vercel Cron (see vercel.json), which sends
 * "Authorization: Bearer <CRON_SECRET>". One jurisdiction per invocation keeps
 * each run well inside the function time limit.
 */

export const maxDuration = 200;

export async function GET(request: Request, { params }: RouteContext<"/api/cron/developments/[jurisdiction]">) {
  if (!isAuthorisedCron(request)) return json({ ok: false, failure: "unauthorised" }, 401);

  const { jurisdiction: id } = await params;
  if (!(coveredJurisdictions as readonly string[]).includes(id)) return json({ ok: false, failure: "unknown_jurisdiction" }, 404);
  const jurisdiction = await knowledgeBase.get(id as JurisdictionId);
  if (!jurisdiction) return json({ ok: false, failure: "unknown_jurisdiction" }, 404);

  const client = getClient();
  if (!client) return json({ ok: false, failure: "not_configured" }, 503);

  const store = getStore();
  const result = await runScheduledDevelopments(store, client, jurisdiction);
  if (!result.ok) return json({ ok: false, jurisdiction: id, failure: result.failure }, 502);
  return json({ ok: true, jurisdiction: id, checkedAt: result.checkedAt, items: result.items.length, model: result.model, usage: result.usage, store: store.kind });
}
