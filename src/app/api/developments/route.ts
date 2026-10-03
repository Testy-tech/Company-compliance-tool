import { z } from "zod";

import { aiConfig } from "@/lib/ai/config";
import { runDevelopments } from "@/lib/ai/developments";
import { getClient, json, readJson } from "@/lib/ai/http";
import { coveredJurisdictions } from "@/lib/intake/schema";
import { knowledgeBase } from "@/lib/kb/repository";

/*
 * POST /api/developments — look for changes since the KB's last review, searching
 * only the jurisdiction's official domains. The body names a jurisdiction and
 * nothing else: no assessment data is sent. Results are cached for 24 hours.
 */

export const maxDuration = 200;

const bodySchema = z.object({ consent: z.literal(true), jurisdiction: z.enum(coveredJurisdictions) }).strict();

export async function POST(request: Request) {
  const read = await readJson(request, "developments", aiConfig.developments);
  if ("response" in read) return read.response;

  const parsed = bodySchema.safeParse(read.body);
  if (!parsed.success) return json({ ok: false, failure: "bad_request" }, 400);

  // Domains and review date come from the server's own KB, never from the request.
  const jurisdiction = await knowledgeBase.get(parsed.data.jurisdiction);
  if (!jurisdiction) return json({ ok: false, failure: "bad_request" }, 400);
  const unavailable = `Developments check unavailable for ${jurisdiction.name}`;

  const client = getClient();
  if (!client) return json({ ok: false, failure: "not_configured", message: unavailable }, 503);

  const result = await runDevelopments(client, jurisdiction);
  if (!result.ok) return json({ ok: false, failure: result.failure, message: unavailable });
  return json({
    ok: true,
    items: result.items,
    checkedAt: result.checkedAt,
    since: result.since,
    cached: result.cached,
    searchedDomains: jurisdiction.officialDomains,
    usage: result.usage,
    model: result.model,
  });
}
