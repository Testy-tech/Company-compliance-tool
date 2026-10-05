import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleHelp } from "lucide-react";

import { SectionHeading } from "@/components/legal/section-heading";
import { Button } from "@/components/ui/button";
import { coveredJurisdictions } from "@/lib/intake/schema";
import { datesToWatch, describe, displayDate, lawStatusLabels, obligationsByCategory, sources } from "@/lib/kb/library";
import { DemoBanner } from "@/components/site/demo-banner";
import { demoNoticeOn } from "@/lib/demo";
import { libraryIsPublic, publishable } from "@/lib/kb/publication";
import { knowledgeBase } from "@/lib/kb/repository";
import type { JurisdictionId } from "@/lib/kb/schema";
import { formatDate, priorityLabels } from "@/lib/report/labels";

/* Public library page for one jurisdiction, generated statically from the knowledge base. */

export const dynamicParams = false;
export const generateStaticParams = () => coveredJurisdictions.map((id) => ({ id }));

async function load(id: string) {
  if (!(coveredJurisdictions as readonly string[]).includes(id)) return null;
  return knowledgeBase.get(id as JurisdictionId);
}

export async function generateMetadata({ params }: PageProps<"/jurisdictions/[id]">): Promise<Metadata> {
  const { id } = await params;
  const j = await load(id);
  if (!j) return {};
  const title = `Data protection in ${j.name}`;
  return {
    title,
    description: describe(j),
    alternates: { canonical: `/jurisdictions/${j.id}` },
    openGraph: { title, description: describe(j), type: "article" },
    // Kept out of search engines until the library is released (PUBLIC_LIBRARY=true).
    robots: libraryIsPublic() ? undefined : { index: false, follow: false },
  };
}

/** Marker for anything whose date is not settled: icon and words, not colour alone. */
function NotFirm({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1 flex items-start gap-1.5 text-sm font-medium text-status-partial">
      <CircleHelp aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </span>
  );
}

export default async function Page({ params }: PageProps<"/jurisdictions/[id]">) {
  const { id } = await params;
  const j = await load(id);
  if (!j) notFound();
  const dates = datesToWatch(j);
  const isPublic = libraryIsPublic();
  const demo = demoNoticeOn();
  const { shown, reviewed, pending } = publishable(j.obligations, isPublic);
  // Only what is shown on the page is grouped and cited.
  const visible = { ...j, obligations: shown };
  const groups = obligationsByCategory(visible);
  const cited = sources(visible);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <p className="eyebrow">
        <Link href="/jurisdictions" className="underline underline-offset-4">
          Jurisdictions
        </Link>{" "}
        · last reviewed {formatDate(j.lastReviewed)}
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-primary sm:text-4xl">Data protection in {j.name}</h1>
      <hr className="rule-brass mt-5 w-16" />
      {demo ? <DemoBanner className="mt-6 max-w-prose" /> : null}
      <p className="mt-6 max-w-prose text-muted-foreground">{j.scopeNotes}</p>
      <p className="marginal-note mt-4 max-w-prose">
        Informational, not legal advice. {reviewed} of {j.obligations.length} obligations for this jurisdiction{" "}
        {demo ? "have had a preliminary review and are not yet verified by counsel" : "have been reviewed by qualified counsel"}; {pending}{" "}
        {pending === 1 ? "is" : "are"} still under review{isPublic ? " and marked as such below" : " and not shown yet"}.
      </p>

      {j.contextNotes.length ? (
        <div className="mt-8 space-y-3">
          {j.contextNotes.map((n) => (
            <aside key={n.title} className="rounded-lg border border-status-partial/40 bg-status-partial/8 p-4 text-sm">
              <p className="font-medium text-status-partial">{n.title}</p>
              <p className="mt-1">{n.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.source.pinpoint} —{" "}
                <a href={n.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  source
                </a>{" "}
                · checked {formatDate(n.lastVerified)}
              </p>
            </aside>
          ))}
        </div>
      ) : null}

      <nav aria-label="On this page" className="mt-8 rounded-lg border bg-card p-4 text-sm">
        <p className="eyebrow">On this page</p>
        <ol className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {[["laws", "Laws"], ["regulators", "Regulators"], ["dates", "Dates to watch"], ["obligations", "Key obligations"], ...(j.definedTerms.length ? [["terms", "Defined terms"]] : []), ["sources", "Sources"]].map(([href, label]) => (
            <li key={href}>
              <a href={`#${href}`} className="underline underline-offset-4">
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section aria-labelledby="laws" className="mt-12">
        <SectionHeading id="laws" number={1}>
          Laws
        </SectionHeading>
        <ul className="mt-6 divide-y border-y">
          {j.laws.map((law) => (
            <li key={law.shortName} className="py-4">
              <h3 className="font-sans text-base font-semibold">{law.shortName}</h3>
              <p className="text-sm text-muted-foreground">{law.title}</p>
              <p className="mt-1 text-sm">{law.citation}</p>
              <p className="mt-1 text-sm">
                <span className="font-medium">{lawStatusLabels[law.status]}</span>
                {law.effectiveDate ? ` · ${law.status === "in_force" ? "since" : "from"} ${formatDate(law.effectiveDate)}` : ""} ·{" "}
                <a href={law.officialUrl} target="_blank" rel="noreferrer" className="text-brass underline underline-offset-4">
                  official text
                </a>
              </p>
              {law.effectiveDateSource ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Date from:{" "}
                  <a href={law.effectiveDateSource.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {law.effectiveDateSource.pinpoint}
                  </a>
                </p>
              ) : null}
              {law.effectiveDateConfidence && law.effectiveDateConfidence !== "verified" ? <NotFirm>Not a firm date: under review.</NotFirm> : null}
              {law.effectiveDateNote ? <p className="mt-1 text-sm text-muted-foreground">Note: {law.effectiveDateNote}.</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="regulators" className="mt-12">
        <SectionHeading id="regulators" number={2}>
          Regulators
        </SectionHeading>
        <ul className="mt-6 list-disc space-y-2 pl-5">
          {j.regulators.map((r) => (
            <li key={r.name}>
              <a href={r.url} target="_blank" rel="noreferrer" className="underline decoration-brass-rule underline-offset-4">
                {r.name}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dates" className="mt-12">
        <SectionHeading id="dates" number={3}>
          Dates to watch
        </SectionHeading>
        {dates.length ? (
          <ul className="mt-6 divide-y border-y">
            {dates.map((d, i) => (
              <li key={i} className="grid gap-1 py-4 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6">
                <div>
                  <p className="font-medium">{displayDate(d)}</p>
                  {!d.firm ? <NotFirm>No fixed date.</NotFirm> : null}
                  {d.note ? <p className="mt-1 text-sm text-muted-foreground">Note: {d.note}.</p> : null}
                  {d.lastVerified ? <p className="mt-1 text-xs text-muted-foreground">Status checked {formatDate(d.lastVerified)}</p> : null}
                </div>
                <div className="text-sm">
                  <p className="font-medium">{d.title}</p>
                  {d.summary ? <p className="mt-1 text-muted-foreground">{d.summary}</p> : null}
                  <a href={d.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-brass underline underline-offset-4">
                    source<span className="sr-only"> for {d.title}</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-muted-foreground">No upcoming changes are recorded for this jurisdiction.</p>
        )}
      </section>

      <section aria-labelledby="obligations" className="mt-12">
        <SectionHeading id="obligations" number={4}>
          Key obligations
        </SectionHeading>
        <p className="mt-6 max-w-prose text-sm text-muted-foreground">
          The general position, in plain language. Whether an obligation applies to a particular group depends on its facts; the{" "}
          <Link href="/assess" className="underline underline-offset-4">
            assessment
          </Link>{" "}
          works that out.
        </p>
        {!isPublic && pending ? (
          <p className="mt-4 max-w-prose rounded-lg border border-dashed p-3 text-sm">
            <span className="font-medium">{pending} {pending === 1 ? "obligation is" : "obligations are"} under review</span> and will be published here once
            counsel has confirmed {pending === 1 ? "it" : "them"}. {reviewed === 0 ? "None has been released yet." : ""}
          </p>
        ) : null}
        {groups.map((g) => (
          <div key={g.category} className="mt-8">
            <h3 className="text-lg font-semibold text-primary">{g.category}</h3>
            <ul className="mt-3 space-y-5">
              {g.items.map((o) => (
                <li key={o.id} id={o.id} className="border-l border-brass-rule pl-4">
                  <h4 className="font-sans text-base font-semibold">{o.title}</h4>
                  <p className="mt-1 max-w-prose text-sm">{o.requirement}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {priorityLabels[o.priority]} priority
                    {o.deadlineOrTimeline ? ` · ${o.deadlineOrTimeline}` : ""} ·{" "}
                    {o.sources.map((s, i) => (
                      <span key={i}>
                        {i ? "; " : ""}
                        <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                          {s.pinpoint}
                        </a>
                      </span>
                    ))}{" "}
                    · last verified {formatDate(o.lastVerified)}
                    {demo && o.confidence === "verified" ? " · preliminary review" : ""}
                    {o.confidence === "needs_review" ? " · under review by counsel" : ""}
                    {o.confidence === "unverified" ? " · official text not confirmed; do not rely on this entry" : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {j.definedTerms.length ? (
        <section aria-labelledby="terms" className="mt-12">
          <SectionHeading id="terms" number={5}>
            Defined terms
          </SectionHeading>
          <dl className="mt-6 divide-y border-y">
            {j.definedTerms.map((t) => (
              <div key={`${t.law}-${t.term}`} className="grid gap-1 py-4 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6">
                <dt>
                  <span className="font-medium">“{t.term}”</span>
                  <span className="block text-sm text-muted-foreground">{t.law}</span>
                </dt>
                <dd className="text-sm">
                  {t.definition}
                  <a href={t.source.url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-muted-foreground underline underline-offset-2">
                    {t.source.pinpoint}
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="sources" className="mt-12">
        <SectionHeading id="sources" number={j.definedTerms.length ? 6 : 5}>
          Sources
        </SectionHeading>
        <p className="mt-6 max-w-prose text-sm text-muted-foreground">
          {cited.length} sources are cited on this page. Official sources for this jurisdiction: {j.officialDomains.join(", ")}.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {cited.map((s) => (
            <li key={s.url} className="break-words">
              <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {s.host}
              </a>
              {s.official ? "" : " (not an official source)"} — <span className="text-muted-foreground">{s.pinpoints.slice(0, 6).join("; ")}{s.pinpoints.length > 6 ? `; and ${s.pinpoints.length - 6} more` : ""}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-3 border-t pt-8">
        <Button asChild>
          <Link href="/assess">Check what applies to your group</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/methodology">How this is sourced and reviewed</Link>
        </Button>
      </div>
    </div>
  );
}
