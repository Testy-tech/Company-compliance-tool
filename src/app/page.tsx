import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ListChecks,
  Network,
  Scale,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";

import { SampleReportPreview } from "@/components/landing/sample-report-preview";
import { DeltaBadge } from "@/components/legal/delta-badge";
import { SectionHeading } from "@/components/legal/section-heading";
import { Button } from "@/components/ui/button";

const audiences: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Building2,
    title: "Group privacy and legal teams",
    body: "Headquarters teams extending an existing GDPR programme to subsidiaries, branches and planned market entries.",
  },
  {
    icon: Scale,
    title: "Outside counsel and advisers",
    body: "Scope a multi-jurisdiction engagement quickly. Anonymised mode lets you assess a client without naming them.",
  },
  {
    icon: Users,
    title: "Compliance leads in expanding companies",
    body: "Understand what a new country adds before you open the entity, not after the first regulator letter.",
  },
];

const steps: { num: string; title: string; body: string }[] = [
  {
    num: "1",
    title: "Describe your footprint",
    body: "Headquarters, current and target countries, the data you process, where it goes and which GDPR artefacts you already maintain. Bands, not exact figures, and “Don't know” is always an answer.",
  },
  {
    num: "2",
    title: "Rules are applied, not guessed",
    body: "Each obligation in the knowledge base carries an explicit condition, checked against your answers by fixed rules. Where an answer is open, the item is included and marked as an assumption.",
  },
  {
    num: "3",
    title: "Receive a checklist you can act on",
    body: "A jurisdiction-by-jurisdiction checklist with owners, priorities and sources, a transfer map and a 30/60/90-day roadmap, with open questions to take back to the business. Export to PDF, Word and Excel.",
  },
];

const deliverables: {
  icon: LucideIcon;
  title: string;
  body: string;
  headline?: boolean;
}[] = [
  {
    icon: ScrollText,
    title: "GDPR delta",
    body: "Every obligation is marked covered, partial or new relative to GDPR, with the GDPR equivalent named. You see precisely what your programme already does, and what it does not.",
    headline: true,
  },
  {
    icon: Network,
    title: "Transfer map",
    body: "Each data flow, subsidiary to headquarters, headquarters to subsidiary, and out to vendors, with the transfer mechanism the exporting country requires.",
  },
  {
    icon: Building2,
    title: "Governance recommendation",
    body: "Where a purely centralised model breaks down (local officers, representatives, filings) and what a hub-and-spoke model would look like for your group.",
  },
  {
    icon: CalendarClock,
    title: "Prioritised roadmap",
    body: "Critical and new items in the first 30 days, high priority by 60, the remainder by 90, each with an owner.",
  },
];

const principles: { title: string; body: string }[] = [
  {
    title: "Sourced, or not stated",
    body: "Every obligation cites an official source with a pinpoint reference and shows the date it was last verified. Unverified content is labelled as such.",
  },
  {
    title: "Deterministic first",
    body: "Applicability is decided by versioned rules. AI is used only to explain findings in your context, never to add or alter legal substance.",
  },
  {
    title: "Your answers stay with you",
    body: "Nothing you enter is stored on our servers. Reports are calculated in your browser and exported from it. A limited set of facts goes to an AI model only if you opt in.",
  },
  {
    title: "Not legal advice",
    body: "The output is a structured starting point for qualified counsel in each jurisdiction, not a substitute for it.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section
        aria-labelledby="hero-title"
        className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-8 lg:pt-24 lg:pb-24"
      >
        <div className="flex flex-col justify-center">
          <p className="eyebrow">Cross-border data protection compliance</p>
          <h1
            id="hero-title"
            className="mt-4 text-4xl leading-[1.1] font-semibold text-primary sm:text-5xl"
          >
            What every jurisdiction asks of you, measured against the GDPR
            programme you already run.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Describe where your group operates and what data it handles.
            DataBorders returns a country-by-country checklist of obligations,
            each marked against GDPR, with owners, deadlines and official
            sources.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href="/assess">
                Start an assessment
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/methodology">How we source the law</Link>
            </Button>
          </div>
          <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Every obligation is marked</span>
            <span className="inline-flex gap-2">
              <DeltaBadge delta="covered" />
              <DeltaBadge delta="partial" />
              <DeltaBadge delta="new" />
            </span>
          </p>
        </div>
        <SampleReportPreview />
      </section>

      <div className="border-t border-border bg-card/60">
        {/* § 1 Who it is for */}
        <section
          aria-labelledby="audience"
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
        >
          <SectionHeading id="audience" number={1}>
            Who it is for
          </SectionHeading>
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {audiences.map(({ icon: Icon, title, body }) => (
              <li key={title} className="space-y-2">
                <Icon className="size-5 text-brass" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* § 2 How it works */}
      <section
        aria-labelledby="how"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <SectionHeading id="how" number={2}>
          How it works
        </SectionHeading>
        <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step) => (
            <li key={step.num} className="border-t border-border pt-5">
              <p className="font-heading text-3xl text-brass tabular-nums">
                {step.num}.
              </p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* § 3 What you receive */}
      <div className="border-y border-border bg-card/60">
        <section
          aria-labelledby="receive"
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
        >
          <SectionHeading id="receive" number={3}>
            What you receive
          </SectionHeading>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
            {deliverables.map(({ icon: Icon, title, body, headline }) => (
              <li key={title} className="space-y-2 bg-background p-6 sm:p-8">
                <div className="flex items-center gap-2">
                  <Icon className="size-5 text-brass" aria-hidden="true" />
                  <h3 className="text-lg font-semibold text-foreground">
                    {title}
                  </h3>
                  {headline ? (
                    <span className="ml-auto eyebrow text-brass">Core</span>
                  ) : null}
                </div>
                <p className="text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* § 4 Principles */}
      <section
        aria-labelledby="principles"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <SectionHeading id="principles" number={4}>
          Principles
        </SectionHeading>
        <ol className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {principles.map((p, i) => (
            <li key={p.title} className="grid grid-cols-[2.5rem_1fr] gap-x-2">
              <span className="para-num pt-1">4.{i + 1}</span>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-1 text-muted-foreground">{p.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-10">
          <Link
            href="/methodology"
            className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline decoration-brass-rule underline-offset-4 hover:decoration-2"
          >
            Read the full methodology
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </p>
      </section>

      {/* Closing call to action */}
      <section
        aria-labelledby="cta"
        className="border-t border-border bg-primary text-primary-foreground"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="max-w-xl space-y-2">
            <h2 id="cta" className="text-2xl font-semibold sm:text-3xl">
              Start with the countries you already operate in.
            </h2>
            <p className="text-primary-foreground/80">
              Add target markets as you go. Your answers are kept in this
              browser session only.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary dark:bg-transparent dark:hover:bg-primary-foreground"
          >
            <Link href="/assess">
              <ListChecks data-icon="inline-start" aria-hidden="true" />
              Begin the questionnaire
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
