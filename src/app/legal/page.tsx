import type { Metadata } from "next";
import Link from "next/link";

import { SectionHeading } from "@/components/legal/section-heading";

export const metadata: Metadata = {
  title: "Legal",
  description: "Disclaimer, privacy policy and imprint for DataBorders: what the tool is, exactly which data it handles and where, and who operates it.",
  alternates: { canonical: "/legal" },
};

/*
 * The privacy section describes what this application actually does with data,
 * derived from its code (session storage, the opt-in tailoring request, the
 * scheduled job, rate limiting). It is not adapted from any template. Anything
 * that depends on the operator's own decisions or contracts is left as a marked
 * placeholder for the operator to complete before launch.
 */

/** A field the operator must fill in before launch. */
function Todo({ children }: { children: React.ReactNode }) {
  return <span className="rounded-sm border border-dashed border-status-new px-1.5 py-0.5 text-sm font-medium text-status-new">To be completed by the operator: {children}</span>;
}

const P = ({ children }: { children: React.ReactNode }) => <p className="mt-4 max-w-prose">{children}</p>;
const H3 = ({ children }: { children: React.ReactNode }) => <h3 className="mt-8 text-lg font-semibold text-primary">{children}</h3>;
const List = ({ children }: { children: React.ReactNode }) => <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5">{children}</ul>;

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <p className="eyebrow">Draft for the operator&apos;s review</p>
      <h1 className="mt-3 text-3xl font-semibold text-primary sm:text-4xl">Legal</h1>
      <hr className="rule-brass mt-5 w-16" />
      <nav aria-label="On this page" className="mt-6 text-sm">
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          <li><a href="#disclaimer" className="underline underline-offset-4">Disclaimer</a></li>
          <li><a href="#privacy" className="underline underline-offset-4">Privacy policy</a></li>
          <li><a href="#imprint" className="underline underline-offset-4">Imprint</a></li>
        </ul>
      </nav>

      <section aria-labelledby="disclaimer" className="mt-12">
        <SectionHeading id="disclaimer" number={1}>
          Disclaimer
        </SectionHeading>
        <P>
          DataBorders is an informational tool. It does not give legal advice, and using it does not create a lawyer–client relationship with anyone.
        </P>
        <P>
          Reports are produced by applying fixed rules to your answers and to a knowledge base of obligations. That knowledge base was checked against official
          sources by research and is awaiting review by qualified counsel; no entry has been verified by counsel yet. Laws change, and how a law applies depends
          on facts this tool does not ask about.
        </P>
        <P>
          Before acting on any item, have it checked by qualified counsel in the jurisdiction concerned. Where the report marks an item as an assumption, or a
          date as not firm, treat it as an open point.
        </P>
        <P>
          Optional AI features reword existing content or list possible developments for review. Their output is not reviewed by a lawyer. See the{" "}
          <Link href="/methodology#ai" className="underline underline-offset-4">
            methodology
          </Link>{" "}
          for what they can and cannot do.
        </P>
      </section>

      <section aria-labelledby="privacy" className="mt-12">
        <SectionHeading id="privacy" number={2}>
          Privacy policy
        </SectionHeading>
        <P>This section describes what the tool does with data. It has no user accounts, no analytics and no advertising.</P>

        <H3>Who is responsible</H3>
        <P>
          <Todo>name and contact details of the operator (controller), and of a data protection officer if one is appointed</Todo>
        </P>

        <H3>Your assessment answers stay in your browser</H3>
        <List>
          <li>
            Everything you enter in the questionnaire, the report&apos;s checklist ticks and your report settings are kept in your browser&apos;s session storage
            (entries named <code>databorders.intake.v1</code> and <code>databorders.report.v1</code>).
          </li>
          <li>They are not sent to our server and we cannot see them. The report is calculated on your device.</li>
          <li>Session storage is cleared by the browser when you close the tab or window. “Start over” in the questionnaire deletes it at once.</li>
          <li>PDF, Word and Excel exports are generated on your device. Nothing is uploaded to create them.</li>
        </List>

        <H3>Your display preference</H3>
        <P>
          If you switch between light and dark mode, your choice is kept in your browser&apos;s local storage (an entry named <code>theme</code>) so the site looks
          the same next time. It holds only the word “light”, “dark” or “system”.
        </P>

        <H3>What reaches our server</H3>
        <List>
          <li>
            <strong className="font-semibold">Ordinary page requests.</strong> As with any website, loading a page sends your IP address, browser type and the
            page requested to the hosting provider, which keeps technical logs. <Todo>log retention period at the hosting provider</Todo>
          </li>
          <li>
            <strong className="font-semibold">Request limits.</strong> To prevent abuse, two functions count requests per IP address: tailoring, and reading the
            stored “recent developments”. The counter is kept in a key-value store under your IP address for ten minutes and then expires. It holds a number,
            nothing else.
          </li>
        </List>

        <H3>Optional: tailoring with an AI model</H3>
        <P>
          Tailoring is off by default. Nothing is sent unless you tick the consent box on the report and press “Tailor the report”. You can untick the box at
          any time; tailored text already shown can be removed with one button.
        </P>
        <P>If you use it, the following is sent to our server and passed on to Anthropic, the provider of the Claude model, to produce the tailored wording:</P>
        <List>
          <li>the knowledge-base text of the obligations that apply to you, one jurisdiction at a time;</li>
          <li>your industry, headquarters country, type and status of the local entity, and governance model;</li>
          <li>the kinds of people, sensitive data and processing you ticked, and which GDPR artefacts you have;</li>
          <li>your label, only if you marked it as anonymised.</li>
        </List>
        <P>
          Never sent: a company name, headcount or revenue, numbers of individuals, transfer volumes, the other countries you listed, or your checklist. The
          questionnaire asks for no names of individuals, and none are sent.
        </P>
        <P>
          Our server does not store the request or the answer. It logs the jurisdiction code, the model used, the number of tokens, the duration and, if the
          request fails, the provider&apos;s request identifier. The tailored text is returned to your browser and kept in session storage with the rest of your
          report.
        </P>
        <P>
          Anthropic is based in the United States. <Todo>the contract terms that apply to this processing, Anthropic&apos;s retention period for API requests, and the transfer mechanism relied on</Todo>
        </P>

        <H3>Scheduled check for recent developments</H3>
        <P>
          Once a week our server asks the same AI provider to search official sources for legal changes in each jurisdiction. That request contains the
          jurisdiction, the laws already covered and the date of the last review. It contains nothing about any visitor. The result is stored on our side and
          shown to everyone in the report.
        </P>

        <H3>Where it runs</H3>
        <List>
          <li>
            The site is configured to run on Vercel with its server functions in Frankfurt, Germany (region <code>fra1</code>). <Todo>confirm the hosting provider, region and data processing agreement at deployment</Todo>
          </li>
          <li>
            The key-value store for request counters and stored developments is Upstash Redis or Vercel KV. <Todo>provider and region of the key-value store</Todo>
          </li>
        </List>

        <H3>Cookies and trackers</H3>
        <P>
          The site sets no cookies. It uses no analytics, advertising or social-media trackers, and loads no fonts, scripts or images from third parties. The
          browser storage described above is used only to provide the service you asked for, which is why there is no cookie banner.
        </P>

        <H3>Legal bases, your rights and how to complain</H3>
        <P>
          <Todo>the legal basis for each processing activity above, how to exercise data protection rights, and the competent supervisory authority</Todo>
        </P>

        <H3>Changes to this policy</H3>
        <P>
          This policy is updated when the tool&apos;s data flows change. <Todo>date of this version</Todo>
        </P>
      </section>

      <section aria-labelledby="imprint" className="mt-12">
        <SectionHeading id="imprint" number={3}>
          Imprint
        </SectionHeading>
        <dl className="mt-6 grid max-w-prose gap-x-6 gap-y-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
          {[
            ["Operator", "legal name and legal form"],
            ["Address", "registered address"],
            ["Represented by", "name of the authorised representative"],
            ["Contact", "email address and telephone number"],
            ["Register entry", "register, court and registration number, if any"],
            ["VAT identification number", "if any"],
            ["Responsible for content", "name and address of the person responsible, where the law requires one"],
            ["Professional rules", "professional title, chamber and applicable rules, if the operator is a regulated professional"],
          ].map(([term, hint]) => (
            <div key={term} className="contents">
              <dt className="font-medium">{term}</dt>
              <dd>
                <Todo>{hint}</Todo>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
