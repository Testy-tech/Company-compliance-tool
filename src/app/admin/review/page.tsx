import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReviewConsole } from "@/components/admin/review-console";
import { defaultDeps, readLog, reviewConsoleEnabled } from "@/lib/admin/review";
import { knowledgeBase } from "@/lib/kb/repository";

/*
 * /admin/review — the counsel review console. Development only: it edits the
 * knowledge-base files on disk, so in a production build this page is a 404.
 */

export const metadata: Metadata = { title: "Review console", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!reviewConsoleEnabled()) notFound();

  const kb = await knowledgeBase.list();
  const logs: Record<string, string> = {};
  await Promise.all(
    kb.map(async (j) => {
      logs[j.id] = await readFile(path.join(process.cwd(), "content", "research-logs", `${j.id}.md`), "utf8").catch(() => "");
    }),
  );
  const deps = defaultDeps();
  const changes = (await readLog(deps)).length;

  return (
    <div className="mx-auto max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
      <ReviewConsole
        jurisdictions={kb.map((j) => ({ id: j.id, name: j.name, obligations: j.obligations }))}
        researchLogs={logs}
        reviewer={deps.reviewer ?? null}
        changes={changes}
      />
    </div>
  );
}
