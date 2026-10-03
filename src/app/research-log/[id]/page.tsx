import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { coveredJurisdictions } from "@/lib/intake/schema";

/* Research log for one jurisdiction, for the lawyer reviewing the knowledge base
 * (linked from the report's reviewer mode). Shown as written, without formatting. */

export const dynamicParams = false;
export const generateStaticParams = () => coveredJurisdictions.map((id) => ({ id }));

export async function generateMetadata({ params }: PageProps<"/research-log/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Research log — ${id}`, robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/research-log/[id]">) {
  const { id } = await params;
  if (!(coveredJurisdictions as readonly string[]).includes(id)) notFound();
  const log = await readFile(path.join(process.cwd(), "content", "research-logs", `${id}.md`), "utf8");
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <p className="eyebrow">Reviewer material · {id}</p>
      <h1 className="mt-3 text-3xl font-semibold text-primary">Research log</h1>
      <hr className="rule-brass mt-5 w-16" />
      <p className="mt-6 text-sm text-muted-foreground">
        Notes from the research pass behind this jurisdiction&apos;s knowledge-base entries: sources consulted, judgement calls and open points for counsel.{" "}
        <Link href="/report" className="underline underline-offset-4">
          Back to the report
        </Link>
      </p>
      <pre className="mt-8 overflow-x-auto rounded-lg border bg-card p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">{log}</pre>
    </div>
  );
}
