import { defaultDeps, exportReviewLog, reviewConsoleEnabled } from "@/lib/admin/review";

/* POST /api/admin/review/export — write docs/review-log.md from the recorded changes (development only). */

export const dynamic = "force-dynamic";

export async function POST() {
  if (!reviewConsoleEnabled()) return new Response("Not found", { status: 404 });
  const { entries } = await exportReviewLog(defaultDeps());
  return Response.json({ ok: true, path: "docs/review-log.md", entries });
}
