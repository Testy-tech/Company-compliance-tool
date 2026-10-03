"use client";

import Link from "next/link";
import { Check, CircleAlert, CircleHelp, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { bandSets, type BandSetId } from "@/lib/intake/bands";
import {
  countUnresolved, isUS, needsDataStaff, needsTxSale, needsUnionQuestion, sendsNothing, straddledThresholds, toIntake, type Draft,
} from "@/lib/intake/draft";
import { formatUSD } from "@/lib/intake/money";
import {
  consentBannerLabels, employeeRepLabels, entityTypeLabels, frameworkLabels, governanceLabels, hostingLabels, hrOnlyLabels,
  industryLabels, processingLabels, sensitiveLabels, subjectLabels, trackerLabels, vendorLabels,
} from "@/lib/intake/options";
import type { Answer } from "@/lib/intake/schema";
import type { WizardConfig } from "@/lib/kb/wizard-config";

import { countryName, type StepDef, type StepProps } from "../types";

/* Step indexes for the "Edit" buttons — keep in the order of steps/index.ts. */
const STEP = { company: 0, footprint: 1, people: 2, processing: 3, infrastructure: 4, website: 5, framework: 6, governance: 7 } as const;

type Row = { label: string; value: string; open?: boolean };
type Section = { title: string; step: number; rows: Row[] };

const MISSING = "Not answered";
/** A question the wizard skipped; shown as such, never as an answer. */
const NOT_APPLICABLE = "Not applicable";
const lookup = (labels: Record<string, string>) => (v: string) => labels[v] ?? v;
const list = (values: string[], labels: Record<string, string>) => (values.length ? values.map(lookup(labels)).join(", ") : "None");
const flags = (record: Record<string, boolean>, labels: Record<string, string>) => list(Object.keys(record).filter((k) => record[k]), labels);
const yesNo = (v: boolean | undefined) => (v === undefined ? MISSING : v ? "Yes" : "No");

/** One row for an Answer<T>; unresolved answers are flagged as open questions. */
function answerRow<T>(label: string, a: Answer<T> | undefined, format: (v: T) => string): Row {
  if (!a) return { label, value: MISSING };
  if (a.status === "known") return { label, value: format(a.value) };
  if (a.status === "not_asked") return { label, value: NOT_APPLICABLE };
  return { label, value: a.status === "unknown" ? "Don't know" : "Prefer not to say", open: true };
}
const band = (set: BandSetId) => (id: string) => bandSets[set].bands.find((b) => b.id === id)?.label ?? id;
const bool = (v: boolean) => (v ? "Yes" : "No");

function summarize(draft: Draft, config: WizardConfig): Section[] {
  const c = draft.company;
  const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
  const sections: Section[] = [
    {
      title: "Company",
      step: STEP.company,
      rows: [
        { label: c.anonymized ? "Anonymised label" : "Company", value: c.label || MISSING },
        { label: "Headquarters", value: c.hqCountry ? regionNames.of(c.hqCountry) ?? c.hqCountry : MISSING },
        { label: "GDPR-based programme", value: c.gdprBaseline ? bool(c.gdprBaseline === "yes") : MISSING },
        { label: "Industry", value: c.industry ? lookup(industryLabels)(c.industry) : MISSING },
        answerRow("Group headcount", c.groupHeadcount, band("headcount")),
        answerRow("Group revenue", c.groupRevenue, band("revenueEUR")),
      ],
    },
  ];

  for (const e of draft.footprint.entities) {
    const name = countryName(config, e.jurisdiction);
    sections.push({
      title: `${name} — entity`,
      step: STEP.footprint,
      rows: [
        { label: "Status", value: e.role === "hq" ? "Headquarters" : e.status ? (e.status === "planned" ? "Planned" : "Operating now") : MISSING },
        ...(e.role === "hq" ? [] : [{ label: "Entity type", value: e.entityType ? lookup(entityTypeLabels)(e.entityType) : MISSING }]),
        answerRow("Headcount", e.headcount, band("headcount")),
        ...(needsDataStaff(e) ? [answerRow("People regularly working with personal data", e.dataStaff, band("headcount"))] : []),
        answerRow("Revenue", e.revenue, band("revenueEUR")),
        ...straddledThresholds(draft, e, config).map(({ threshold, scope }) =>
          answerRow(
            `${scope === "group" ? "Group" : "Entity"} revenue above ${formatUSD(threshold.amount)}`,
            scope === "group" ? c.groupRevenueAbove[threshold.id] : e.revenueAbove[threshold.id],
            bool,
          ),
        ),
        answerRow("Employee representation", e.employeeRep, lookup(employeeRepLabels)),
        ...(needsUnionQuestion(e) ? [answerRow("Processes union membership information", e.unionData, bool)] : []),
        ...(isUS(e) ? [answerRow("SBA small business", e.smallBusinessSBA, bool)] : []),
      ],
    });
    sections.push({
      title: `${name} — individuals per year`,
      step: STEP.people,
      rows: [
        answerRow("Employees & contractors", e.people.staff, band("people")),
        answerRow("Business contacts", e.people.business, band("people")),
        answerRow("Other individuals", e.people.other, band("people")),
        answerRow("With sensitive data", e.people.sensitive, band("sensitiveHeld")),
        answerRow("Sold or shared for advertising", e.people.soldShared, band("people")),
        ...(e.jurisdiction === "US-TX"
          ? [answerRow("Exchanged for money or other value", needsTxSale(e) ? e.txSale : { status: "not_asked" }, bool)]
          : []),
      ],
    });
    sections.push({
      title: `${name} — data sent abroad per year`,
      step: STEP.infrastructure,
      rows: [
        answerRow("Non-sensitive data (individuals)", e.transfers.nonSensitive, band("transfersNonSensitive")),
        answerRow("Sensitive data (individuals)", e.transfers.sensitive, band("transfersSensitive")),
        answerRow("Mainly HR data", sendsNothing(e.transfers) ? { status: "not_asked" } : e.transfers.hrOnly, lookup(hrOnlyLabels)),
        ...(e.jurisdiction === "CN"
          ? [answerRow("Notified as a CIIO", e.cn.ciio, bool), answerRow("Handles potential ‘important data’", e.cn.importantData, bool)]
          : []),
      ],
    });
  }

  const w = draft.website;
  const inf = draft.infrastructure;
  sections.push(
    ...(draft.footprint.otherCountries.trim()
      ? [{ title: "Other countries (not assessed)", step: STEP.footprint, rows: [{ label: "Listed", value: draft.footprint.otherCountries.trim() }] }]
      : []),
    {
      title: "People and data",
      step: STEP.people,
      rows: [
        { label: "Whose data", value: flags(draft.data.subjects, subjectLabels) },
        { label: "Sensitive categories", value: flags(draft.data.sensitive, sensitiveLabels) },
      ],
    },
    { title: "Processing", step: STEP.processing, rows: [{ label: "Activities", value: flags(draft.processing.processing, processingLabels) }] },
    {
      title: "Infrastructure and flows",
      step: STEP.infrastructure,
      rows: [
        { label: "Hosting", value: inf.hosting.length ? list(inf.hosting, hostingLabels) : MISSING },
        { label: "Access from abroad by group entities", value: yesNo(inf.groupAccessFromAbroad) },
        { label: "Local entities process for the group", value: yesNo(inf.localProcessesForGroup) },
        { label: "Service providers", value: list(inf.vendors, vendorLabels) },
      ],
    },
    {
      title: "Website and tracking",
      step: STEP.website,
      rows: [
        answerRow("Trackers", w.trackers, (v) => list(v, trackerLabels)),
        answerRow("Consent banner", w.consentBanner, lookup(consentBannerLabels)),
        w.countrySitesChoice === "unknown"
          ? { label: "Country-specific sites", value: "Don't know", open: true }
          : {
              label: "Country-specific sites",
              value: !w.countrySitesChoice ? MISSING : w.countrySitesChoice === "no" ? "No" : w.countrySites.map((id) => countryName(config, id)).join(", "),
            },
      ],
    },
    { title: "Existing GDPR framework", step: STEP.framework, rows: [{ label: "In place", value: flags(draft.framework.framework, frameworkLabels) }] },
    {
      title: "Governance",
      step: STEP.governance,
      rows: [
        { label: "Model", value: draft.governance.model ? lookup(governanceLabels)(draft.governance.model) : MISSING },
        { label: "Named local privacy contacts", value: yesNo(draft.governance.localContacts) },
      ],
    },
  );
  return sections;
}

function ReviewStep({ draft, config, goTo }: StepProps) {
  const result = toIntake(draft);
  const sections = summarize(draft, config);
  const missing = sections.flatMap((s) => s.rows.filter((r) => r.value === MISSING).map((r) => ({ ...r, section: s })));

  return (
    <div className="space-y-8">
      {result.success && missing.length === 0 ? (
        <div role="status" className="rounded-lg border bg-card p-4">
          <p className="flex items-center gap-2 font-medium text-status-covered">
            <Check aria-hidden="true" className="size-4" />
            All questions are answered.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {countUnresolved(result.data) === 0
              ? "There are no open questions."
              : `${countUnresolved(result.data)} answers are “Don't know” or “Prefer not to say”. The report treats them conservatively: where one affects an obligation, the item is marked as an assumption and a follow-up question is listed.`}{" "}
            Your answers stay saved in this browser session.
          </p>
          <Button asChild className="mt-4">
            <Link href="/report">View the report</Link>
          </Button>
        </div>
      ) : (
        <div role="alert" className="rounded-lg border border-destructive bg-card p-4">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <CircleAlert aria-hidden="true" className="size-4" />
            Some questions still need an answer
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
            {missing.map((m) => (
              <li key={`${m.section.title}-${m.label}`}>
                <button type="button" className="underline underline-offset-4" onClick={() => goTo(m.section.step)}>
                  {m.section.title}: {m.label}
                </button>
              </li>
            ))}
            {missing.length === 0 ? <li>Go back through the steps with “Next” to find the gap.</li> : null}
          </ul>
        </div>
      )}

      {sections.map((s) => (
        <section key={s.title} className="rounded-lg border bg-card p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-primary">{s.title}</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => goTo(s.step)}>
              <Pencil aria-hidden="true" data-icon="inline-start" />
              Edit<span className="sr-only"> {s.title}</span>
            </Button>
          </div>
          <dl className="mt-3 divide-y text-sm">
            {s.rows.map((r) => (
              <div key={r.label} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className={r.value === MISSING ? "font-medium text-destructive" : r.value === NOT_APPLICABLE ? "text-muted-foreground" : undefined}>
                  {r.value}
                  {r.open ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-status-partial">
                      <CircleHelp aria-hidden="true" className="size-3.5" />
                      Open question
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export const reviewStep: StepDef = {
  id: "review",
  title: "Review",
  intro: "Check your answers. Anything marked as an open question can be resolved now or left for the report's follow-up list.",
  questionIds: [],
  validate: () => [],
  Component: ReviewStep,
};
