import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DemoBanner } from "@/components/site/demo-banner";
import { demoNoticeOn, PRELIMINARY } from "@/lib/demo";
import { datesToWatch, lawStatusLabels } from "@/lib/kb/library";
import { libraryIsPublic, publishable, reviewSplit } from "@/lib/kb/publication";
import { knowledgeBase } from "@/lib/kb/repository";
import { formatDate } from "@/lib/report/labels";

export const metadata: Metadata = {
  title: "Jurisdictions",
  description: "The jurisdictions covered by DataBorders: applicable data protection laws, regulators, key obligations with official sources, and the date each was last reviewed.",
  alternates: { canonical: "/jurisdictions" },
  // Kept out of search engines until the library is released (PUBLIC_LIBRARY=true).
  robots: libraryIsPublic() ? undefined : { index: false, follow: false },
};

export default async function Page() {
  const kb = await knowledgeBase.list();
  const isPublic = libraryIsPublic();
  const split = reviewSplit(kb);
  const demo = demoNoticeOn();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <p className="eyebrow">Library</p>
      <h1 className="mt-3 text-3xl font-semibold text-primary sm:text-4xl">Jurisdictions</h1>
      <hr className="rule-brass mt-5 w-16" />
      {demo ? <DemoBanner className="mt-6 max-w-prose" /> : null}
      <p className="mt-6 max-w-prose text-lg text-muted-foreground">
        {kb.length} jurisdictions and {split.total} obligations, each written in plain language and tied to an official source. The United States is covered state by
        state; California and Texas are in so far.
      </p>
      <p className="marginal-note mt-4 max-w-prose">
        {demo
          ? `${split.reviewed} of ${split.total} obligations have had a preliminary review and are not yet verified by counsel; ${split.pending} are still under review.`
          : `${split.reviewed} of ${split.total} obligations have been reviewed by qualified counsel; ${split.pending} are still under review.`}{" "}
        {isPublic ? "Entries under review are marked as such." : "Only reviewed obligations are shown here; the rest appear once their review is complete."} This is
        information, not legal advice.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {kb.map((j) => {
          const pending = j.laws.filter((l) => l.status !== "in_force");
          const next = datesToWatch(j).find((d) => /^\d{4}-\d{2}-\d{2}/.test(d.date));
          return (
            <li key={j.id} className="rounded-lg border bg-card p-5">
              <h2 className="text-xl font-semibold text-primary">
                <Link href={`/jurisdictions/${j.id}`} className="underline decoration-brass-rule underline-offset-4 hover:decoration-2">
                  {j.name}
                </Link>
              </h2>
              <p className="mt-2 text-sm">{j.laws.map((l) => l.shortName).join(" · ")}</p>
              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Obligations</dt>
                <dd className="tabular-nums">
                  {publishable(j.obligations, isPublic).reviewed} {demo ? PRELIMINARY.toLowerCase() : "reviewed"} · {publishable(j.obligations, isPublic).pending} under review
                </dd>
                {pending.length ? (
                  <>
                    <dt className="text-muted-foreground">Not yet in force</dt>
                    <dd>{pending.map((l) => `${l.shortName} (${lawStatusLabels[l.status].toLowerCase()})`).join("; ")}</dd>
                  </>
                ) : null}
                {next ? (
                  <>
                    <dt className="text-muted-foreground">Next date</dt>
                    <dd>
                      {formatDate(next.date.slice(0, 10))}
                      {next.firm ? "" : " (not firm)"}: {next.title}
                    </dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Last reviewed</dt>
                <dd>{formatDate(j.lastReviewed)}</dd>
              </dl>
              <Link href={`/jurisdictions/${j.id}`} className="mt-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary underline underline-offset-4">
                Laws, obligations and sources<span className="sr-only"> for {j.name}</span>
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
