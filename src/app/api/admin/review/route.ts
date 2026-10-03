import { applyReview, defaultDeps, reviewConsoleEnabled } from "@/lib/admin/review";

/*
 * POST /api/admin/review — verify, edit or flag one obligation (development only).
 * Writes to the knowledge-base JSON files on the developer's machine; in any
 * other environment the route does not exist.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!reviewConsoleEnabled()) return new Response("Not found", { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, stage: "input", errors: ["The request was not valid JSON."] }, { status: 400 });
  }
  const result = await applyReview(body, defaultDeps());
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
