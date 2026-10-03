import type { Metadata } from "next";
import Link from "next/link";

import { SectionHeading } from "@/components/legal/section-heading";
import { aiConfig } from "@/lib/ai/config";
import { euTransfers } from "@/lib/kb/eu-transfers";
import { reviewSplit } from "@/lib/kb/publication";
import { knowledgeBase } from "@/lib/kb/repository";
import { formatDate } from "@/lib/report/labels";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How DataBorders sources and verifies obligations, how its rules engine decides what applies and handles unknown answers, what the AI features do and do not do, how often content is updated, and what the tool cannot tell you.",
  alternates: { canonical: "/methodology" },
};

const P = ({ children }: { children: React.ReactNode }) => <p className="mt-4 max-w-prose">{children}</p>;
const List = ({ children }: { children: React.ReactNode }) => <ul className="mt-4 max-w-prose list-disc space-y-2 pl-5">{children}</ul>;

export default async function Page() {
  const kb = await knowledgeBase.list();
  const obligations = kb.flatMap((j) => j.obligations);
  const count = (c: string) => obligations.filter((o) => o.confidence === c).length;
  const reviewed = kb.map((j) => j.lastReviewed).sort();
  const split = reviewSplit(kb);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <p className="eyebrow">How it works underneath</p>
      <h1 className="mt-3 text-3xl font-semibold text-primary sm:text-4xl">Methodology</h1>
      <hr className="rule-brass mt-5 w-16" />
      <p className="mt-6 max-w-prose text-lg text-muted-foreground">
        The report is produced by fixed rules applied to a sourced knowledge base. AI is optional, comes after the rules, and cannot change what they decide.
      </p>

      <section aria-labelledby="sources" className="mt-12">
        <SectionHeading id="sources" number={1}>
          Sources and verification
        </SectionHeading>
        <P>
          The knowledge base holds {obligations.length} obligations across {kb.length} jurisdictions. Each one is written in plain language in our own words and
          cites at least one source by article or section number with a link. Statute text is not reproduced.
        </P>
        <List>
          <li>
            <strong className="font-semibold">Official sources first.</strong> Every jurisdiction has a list of official domains (legislation portals, regulators,
            government). A citation outside that list is flagged when the knowledge base is built.
          </li>
          <li>
            <strong className="font-semibold">Three confidence levels.</strong> “Verified” means confirmed by qualified counsel. “Needs review” means checked
            against the official text by research and awaiting counsel. “Unverified” means the official text could not be confirmed and the entry should not be
            relied on.
          </li>
          <li>
            <strong className="font-semibold">Where it stands today.</strong> {split.reviewed} of {split.total} obligations have been reviewed by counsel and{" "}
            {split.pending} are pending ({count("needs_review")} awaiting review, {count("unverified")} unverified). Until counsel has reviewed an entry, treat it as
            a lead to check, not a conclusion. Public pages show reviewed entries only until the library is released.
          </li>
          <li>
            <strong className="font-semibold">Dates.</strong> Each obligation shows when it was last verified and each jurisdiction when it was last reviewed
            (currently between {formatDate(reviewed[0]!)} and {formatDate(reviewed.at(-1)!)}). A date that depends on pending legislation is marked as not firm.
          </li>
          <li>
            <strong className="font-semibold">Research logs.</strong> For every jurisdiction there is a log of the sources consulted, judgement calls and open
            points for counsel. A reviewing lawyer can open it from the report&apos;s reviewer mode.
          </li>
        </List>
      </section>

      <section aria-labelledby="engine" className="mt-12">
        <SectionHeading id="engine" number={2}>
          The rules engine
        </SectionHeading>
        <P>
          Each obligation carries an explicit condition, such as “the entity sends personal data of a million or more people abroad per year”. The engine checks
          every condition against your answers. The same answers always produce the same report; nothing is generated or guessed at this stage.
        </P>
        <List>
          <li>
            <strong className="font-semibold">Bands, not figures.</strong> Numeric questions are answered in bands. The bands are aligned with the legal thresholds,
            and an automated test fails if a threshold ever falls inside a band.
          </li>
          <li>
            <strong className="font-semibold">Dated thresholds.</strong> Monetary thresholds that are adjusted over time are stored with their effective dates. An
            assessment uses the amount in force on the date it was started.
          </li>
          <li>
            <strong className="font-semibold">Comparison with GDPR.</strong> If you run a GDPR-based programme, each obligation is marked covered, partly covered or
            new relative to it. That marking is part of the knowledge base, set per obligation, not inferred per report.
          </li>
          <li>
            <strong className="font-semibold">Transfers.</strong> For each flow the report names the mechanism required by the exporting country. For exporters in
            the EEA it depends on the destination, using the European Commission&apos;s list of adequacy decisions (last checked{" "}
            {formatDate(euTransfers.lastVerified)}).
          </li>
        </List>
      </section>

      <section aria-labelledby="assumptions" className="mt-12">
        <SectionHeading id="assumptions" number={3}>
          Unknown answers and assumptions
        </SectionHeading>
        <P>
          Every threshold question accepts “Don&apos;t know”. The engine then tests the condition across everything the answer could be.
        </P>
        <List>
          <li>If the obligation applies whatever the answer, it is reported as applying. If it never applies, it is left out.</li>
          <li>
            If it applies for some answers only, it is included and marked “Assumption”, with the assumed case stated in a sentence. The report errs towards
            including an obligation, not omitting it.
          </li>
          <li>An exemption is never assumed. If it depends on an unknown answer, the obligation stays in.</li>
          <li>Where several tiers exclude each other, the strictest tier that could apply is shown and the others are listed as alternatives.</li>
          <li>
            Each open answer that affects at least one obligation becomes an open question, ranked by how many obligations it affects, with a link back to the
            question. Answers that affect nothing are listed separately and not counted.
          </li>
        </List>
      </section>

      <section aria-labelledby="ai" className="mt-12">
        <SectionHeading id="ai" number={4}>
          What the AI does, and does not do
        </SectionHeading>
        <P>Two features use a Claude model from Anthropic. Neither can add, remove or change an obligation.</P>
        <h3 className="mt-6 text-lg font-semibold text-primary">Tailoring (optional, off by default)</h3>
        <List>
          <li>It runs only after you tick a box that lists exactly what is sent, and only when you press the button.</li>
          <li>
            The model receives the text of the obligations that apply to you and coarse facts (industry, entity type, kinds of data). It returns a short
            explanation and a reworded version of each action step.
          </li>
          <li>
            The output is checked by code before it is shown. It must refer only to obligations that were sent, leave applicability unchanged, and give exactly
            one step for each standard step, in the same order.
          </li>
          <li>
            A tailored item is discarded if it mentions an article, deadline, date, document, authority or abbreviation that is not in the obligation&apos;s own
            text. Anything else the model suggests is shown apart, under “Points to discuss with counsel”.
          </li>
          <li>If anything fails, the standard text is shown. Tailored text is labelled, and the standard text is one click away.</li>
        </List>
        <h3 className="mt-6 text-lg font-semibold text-primary">Recent developments (scheduled)</h3>
        <List>
          <li>
            Once a week, a job searches each jurisdiction&apos;s official domains for changes since the knowledge base was last reviewed. It sends nothing about any
            user.
          </li>
          <li>An item is kept only if its link was actually returned by the search and is on an official domain.</li>
          <li>
            Results appear in a separate panel marked “not yet reviewed”, with the date of the last check. They are never merged into the checklist; a person
            has to review them and update the knowledge base.
          </li>
        </List>
        <p className="mt-4 max-w-prose text-sm text-muted-foreground">
          Models in use: {aiConfig.tailor.model} for tailoring, {aiConfig.developments.model} for the developments check.
        </p>
      </section>

      <section aria-labelledby="updates" className="mt-12">
        <SectionHeading id="updates" number={5}>
          Update cadence
        </SectionHeading>
        <List>
          <li>The developments check runs weekly. It produces leads for review, not changes.</li>
          <li>The knowledge base changes only when a person edits it, records the source and the date, and the build checks pass.</li>
          <li>The list of adequacy decisions is flagged for re-checking when it is more than 180 days old.</li>
          <li>There is no fixed schedule yet for counsel review of each jurisdiction. Review dates are shown wherever content appears, so staleness is visible.</li>
        </List>
      </section>

      <section aria-labelledby="limits" className="mt-12">
        <SectionHeading id="limits" number={6}>
          Limitations
        </SectionHeading>
        <List>
          <li>
            This is an informational tool, not legal advice. {split.reviewed === 0 ? "No entry has yet been verified by counsel." : `${split.pending} of ${split.total} entries are still awaiting counsel review.`}
          </li>
          <li>Ten jurisdictions are covered. In the United States only California and Texas are. Other countries you list are shown as not assessed.</li>
          <li>The focus is general data protection law. Sector rules (for example financial, health or telecoms regulation) are mostly out of scope.</li>
          <li>The engine only knows what the questionnaire asks. Facts it does not ask about cannot affect the result.</li>
          <li>Bands trade precision for confidentiality. Where bands cannot settle a threshold, the report asks a yes/no question instead of guessing.</li>
          <li>Penalties are quoted as the law states them. No exposure figure is calculated.</li>
          <li>The transfer map shows the exporting country&apos;s requirement. Duties on the importing side are in that country&apos;s own section.</li>
          <li>Laws change. Check the review dates, and the “dates to watch” for each jurisdiction, before relying on anything here.</li>
        </List>
        <p className="mt-6">
          <Link href="/jurisdictions" className="font-medium text-primary underline decoration-brass-rule underline-offset-4">
            Browse the jurisdiction library
          </Link>
        </p>
      </section>
    </div>
  );
}
