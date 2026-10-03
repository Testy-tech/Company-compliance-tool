import { aiConfig } from "@/lib/ai/config";
import { getClient, json, readJson } from "@/lib/ai/http";
import { runTailor, tailorRequestSchema } from "@/lib/ai/tailor";

/*
 * POST /api/tailor — reword one jurisdiction's obligations for the company.
 * Opt-in only (the body must carry consent: true). Nothing is stored. Every
 * failure answers { ok: false } so the report quietly keeps its standard text.
 */

export const maxDuration = 150;

export async function POST(request: Request) {
  const read = await readJson(request, "tailor", aiConfig.tailor);
  if ("response" in read) return read.response;

  const parsed = tailorRequestSchema.safeParse(read.body);
  // Field paths only, never values, so a rejected request is diagnosable without echoing its content.
  if (!parsed.success) return json({ ok: false, failure: "bad_request", fields: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.code}`) }, 400);

  const client = getClient();
  if (!client) return json({ ok: false, failure: "not_configured" }, 503);

  const result = await runTailor(client, parsed.data);
  if (!result.ok) return json({ ok: false, failure: result.failure });
  return json({ ok: true, items: result.items, usage: result.usage, model: result.model });
}
