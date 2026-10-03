/*
 * Question copy and "Why we ask" lines, keyed by question id. The same ids are
 * used as DOM anchors (`q-<id>` / `q-<id>-<jurisdiction>`) so the report's
 * "Resolve" action can jump back to a question. Never use the word
 * "consumers" in UI copy — it means different things under different laws.
 */

export type QuestionCopy = { label: string; why: string; help?: string };

export const questions = {
  "company-label": {
    label: "Company name or anonymised label",
    why: "Appears only on your report. Use an anonymised label (e.g. “Client A”) if you are assessing on someone's behalf.",
  },
  "hq-country": {
    label: "Headquarters country",
    why: "The headquarters' law is usually the baseline for group policies and for data sent out to subsidiaries.",
  },
  "hq-us-state": {
    label: "Headquarters state",
    why: "US privacy law is largely state law; California and Texas are assessed individually.",
  },
  "gdpr-baseline": {
    label: "Does the group run a privacy programme based on the EU GDPR?",
    why: "If so, every obligation is compared with GDPR and marked covered, partial or new.",
  },
  industry: {
    label: "Industry",
    why: "Some sectors carry extra rules (e.g. critical infrastructure in China).",
  },
  "group-headcount": {
    label: "Group headcount (worldwide)",
    why: "Some duties and size exemptions depend on how many people an organisation employs.",
  },
  "group-revenue": {
    label: "Annual revenue of the whole group (worldwide)",
    why: "Some laws only apply above a revenue threshold (e.g. California), and several cap fines as a % of revenue.",
  },
  "revenue-above": {
    label: "Is annual revenue above {amount}?",
    why: "Your revenue band straddles a legal threshold; a yes/no answer resolves it without disclosing the figure.",
  },
  footprint: {
    label: "Where does the group operate, or plan to?",
    why: "Each country's law is assessed only where you have, or plan, an entity or activity.",
  },
  "other-countries": {
    label: "Other countries you operate in (not yet assessed)",
    why: "Listed on your report as not assessed, so the gap is visible.",
  },
  "entity-type": {
    label: "Type of entity in {country}",
    why: "Registration, local officer and representative duties depend on whether there is a local legal entity.",
  },
  "entity-status": {
    label: "Status in {country}",
    why: "Planned entries get a pre-launch checklist rather than remediation items.",
  },
  "entity-headcount": {
    label: "Headcount of the {country} entity",
    why: "Several laws switch on duties (e.g. a data protection officer) above local headcount thresholds.",
  },
  "entity-data-staff": {
    label: "How many people at the {country} entity regularly work with personal data on computers?",
    why: "In Germany a data protection officer is mandatory once 20 or more people regularly process personal data automatically (BDSG § 38).",
  },
  "entity-revenue": {
    label: "Annual revenue of the {country} entity",
    why: "Some laws only apply above a revenue threshold, and several cap fines as a % of revenue.",
  },
  "entity-employee-rep": {
    label: "Does the {country} entity have a works council, union, or other employee representative body?",
    why: "In some countries (e.g. Germany) introducing HR, monitoring or IT tools legally requires agreement with employee representatives.",
  },
  "entity-union-data": {
    label: "Does the {country} entity process union membership information (e.g. deducting union dues)?",
    why: "Union membership is sensitive data almost everywhere and needs extra safeguards.",
  },
  "entity-sba": {
    label: "Does the {country} entity qualify as a small business under US SBA size standards?",
    why: "The Texas Data Privacy and Security Act does not apply to SBA-defined small businesses (except for selling sensitive data).",
    help: "SBA size standards depend on your industry code (NAICS); engineering services are usually revenue-based. Check with the SBA size standards tool: https://www.sba.gov/size-standards",
  },
  "people-staff": {
    label: "Employees & contractors located in {country}",
    why: "Several laws switch on extra duties above certain headcounts, and in California even employees and business contacts count.",
  },
  "people-business": {
    label: "Business contacts located in {country} (clients, suppliers, partners)",
    why: "Several laws switch on extra duties above certain headcounts, and in California even employees and business contacts count.",
  },
  "people-other": {
    label: "Other individuals located in {country} (end users, site visitors, members of the public)",
    why: "Several laws switch on extra duties above certain headcounts; some (e.g. Texas) only cover people acting in a private capacity.",
  },
  "people-sensitive": {
    label: "Individuals located in {country} whose sensitive personal data you hold, per year",
    why: "Some duties (e.g. California cybersecurity audits) start above a number of people whose sensitive data is processed.",
  },
  "people-sold-shared": {
    label: "Individuals located in {country} whose data is sold or shared with third parties for advertising (e.g. via ad pixels), per year",
    why: "In California the law applies to any business that buys, sells or shares data of 100,000+ residents, even below the revenue threshold.",
  },
  "data-subjects": {
    label: "Whose personal data does the group process?",
    why: "Different groups of people trigger different notices, rights and exemptions.",
  },
  "data-sensitive": {
    label: "Which sensitive categories do you process?",
    why: "Sensitive data needs consent or a specific legal ground in almost every jurisdiction.",
  },
  processing: {
    label: "Which processing activities take place?",
    why: "Monitoring, CCTV, biometrics and AI trigger impact assessments, works-council rights and specific notices.",
  },
  hosting: {
    label: "Where is personal data hosted?",
    why: "Hosting location drives localisation rules and whether data counts as leaving a country.",
  },
  "flows-group-access": {
    label: "Can HQ or other group entities abroad access local personal data (e.g. shared HR or CRM systems)?",
    why: "Remote access from abroad usually counts as a cross-border transfer.",
  },
  "flows-local-for-group": {
    label: "Do local entities process personal data on behalf of HQ or other group entities?",
    why: "Processing on another entity's behalf needs a processor agreement and changes who is responsible.",
  },
  vendors: {
    label: "Which kinds of external service providers handle personal data?",
    why: "Vendors need processor contracts, and foreign vendors add transfer duties.",
  },
  "transfers-nonsensitive": {
    label: "Roughly how many individuals' non-sensitive personal data does the {country} entity send outside {country} per calendar year?",
    why: "Some countries (notably China) set different transfer procedures depending on how many people's data leaves the country each year.",
  },
  "transfers-sensitive": {
    label: "…and sensitive personal data (e.g. health, biometrics, precise location, financial accounts, ID numbers, data of minors)?",
    why: "Some countries (notably China) set different transfer procedures depending on how many people's data leaves the country each year.",
  },
  "transfers-hr-only": {
    label: "Is this data mainly employee/HR data needed to manage staff?",
    why: "Transfers needed for group HR management are exempt from some transfer procedures (e.g. in China).",
  },
  "cn-ciio": {
    label: "Has the China entity been notified that it is a Critical Information Infrastructure Operator (CIIO)?",
    why: "These statuses can trigger a mandatory government security assessment regardless of volume.",
  },
  "cn-important-data": {
    label: "Does the China entity handle data that could be classified as ‘important data’ (e.g. infrastructure, energy, geographic or large-scale project data)?",
    why: "These statuses can trigger a mandatory government security assessment regardless of volume.",
  },
  "web-trackers": {
    label: "Which of these are on your website(s)?",
    why: "Trackers trigger consent duties in the EU and opt-out duties in California and Texas, even for B2B websites.",
  },
  "web-consent-banner": {
    label: "Is there a cookie consent banner?",
    why: "Trackers trigger consent duties in the EU and opt-out duties in California and Texas, even for B2B websites.",
  },
  "web-country-sites": {
    label: "Do you run country-specific versions of the website?",
    why: "Trackers trigger consent duties in the EU and opt-out duties in California and Texas, even for B2B websites.",
  },
  framework: {
    label: "Which GDPR artefacts are already in place?",
    why: "Existing artefacts are reused: obligations they satisfy are marked covered or partial rather than new.",
  },
  "governance-model": {
    label: "How is privacy governed across the group?",
    why: "Local officer, representative and filing duties can break a purely centralised model.",
  },
  "governance-local-contacts": {
    label: "Are there named privacy contacts in local entities?",
    why: "Several countries require a named local contact or officer.",
  },
} satisfies Record<string, QuestionCopy>;

export type QuestionId = keyof typeof questions;

export function copy(id: QuestionId, vars: Record<string, string> = {}): QuestionCopy {
  const q: QuestionCopy = questions[id];
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
  return { label: fill(q.label), why: fill(q.why), help: q.help ? fill(q.help) : undefined };
}

/** DOM id for a question, optionally scoped to a jurisdiction. */
export const anchorId = (id: string, jurisdiction?: string) => `q-${id}${jurisdiction ? `-${jurisdiction}` : ""}`;
