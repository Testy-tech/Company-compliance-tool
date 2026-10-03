/*
 * Fact registry: everything an obligation's `appliesIf` rule may reference.
 *
 * The engine (Phase 4) derives one evaluation context per assessed jurisdiction
 * from the intake answers. Numeric facts are derived as intervals (a known band
 * → [min, max]; "Don't know" / "Prefer not to say" → [0, ∞]) and the engine
 * evaluates each rule at the interval edges and at any threshold inside it.
 * Rules therefore see plain numbers, booleans and strings, as below.
 *
 * The KB validator rejects any `var` path not declared here, so rules cannot
 * depend on questions the wizard never asks.
 */

export type FactKind =
  | { kind: "bool" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "count"; bandSet: "people" | "sensitiveHeld" | "transfersNonSensitive" | "transfersSensitive" | "headcount" }
  | { kind: "money"; currency: "USD" }
  | { kind: "string" };

type FactMeta = {
  path: string;
  /** Noun phrase used in assumption sentences; "{country}" is replaced by the jurisdiction name. */
  label: string;
  /** Wizard question this fact comes from (anchor id used by "Resolve" links). */
  questionId?: string;
  /** Can the answer be unresolved ("Don't know" / "Prefer not to say")? */
  resolvable?: boolean;
  /** Client-facing follow-up question when unresolved. */
  followUp?: string;
  /** Computed by the engine from other facts, not asked directly. */
  derived?: boolean;
};

export type FactDef = FactKind & FactMeta;

const bool = (path: string, label: string, extra: Partial<FactMeta> = {}): FactDef => ({ kind: "bool", ...extra, path, label });

export const facts: readonly FactDef[] = [
  // ── The jurisdiction being evaluated ────────────────────────────────────────
  { kind: "string", path: "j.id", label: "jurisdiction" },
  { kind: "enum", path: "j.role", values: ["hq", "current", "target"], label: "role of {country} in the group" },
  { kind: "enum", path: "j.entityType", values: ["hq", "subsidiary", "branch", "rep_office", "none"], label: "type of entity in {country}", questionId: "entity-type" },
  { kind: "enum", path: "j.status", values: ["operating", "planned"], label: "status of the {country} entity" },
  {
    kind: "count", bandSet: "headcount", path: "j.headcount", label: "headcount of the {country} entity",
    questionId: "entity-headcount", resolvable: true,
    followUp: "Roughly how many people does the {country} entity employ?",
  },
  {
    kind: "count", bandSet: "headcount", path: "j.dataStaff", label: "number of people at the {country} entity who regularly work with personal data on computers",
    questionId: "entity-data-staff", resolvable: true,
    followUp: "How many people at the {country} entity regularly work with personal data on computers?",
  },
  {
    kind: "money", currency: "USD", path: "j.revenueUSD", label: "annual revenue of the {country} entity",
    questionId: "entity-revenue", resolvable: true,
    followUp: "What is the annual revenue of the {country} entity (band is enough)?",
  },
  {
    kind: "enum", values: ["works_council", "union", "both", "none"], path: "j.employeeRep", label: "employee representation at the {country} entity",
    questionId: "entity-employee-rep", resolvable: true,
    followUp: "Does the {country} entity have a works council, union or other employee representative body?",
  },
  bool("j.unionData", "processing of union membership information at the {country} entity", {
    questionId: "entity-union-data", resolvable: true,
    followUp: "Does the {country} entity process union membership information (e.g. deducting union dues)?",
  }),
  bool("j.smallBusinessSBA", "US SBA small-business status of the {country} entity", {
    questionId: "entity-sba", resolvable: true,
    followUp: "Does the {country} entity qualify as a small business under US SBA size standards?",
  }),
  bool("j.countryWebsite", "a {country}-specific website", { questionId: "web-country-sites", resolvable: true }),

  // People located in the jurisdiction (per calendar year)
  {
    kind: "count", bandSet: "people", path: "j.people.staff", label: "number of employees and contractors located in {country}",
    questionId: "people-staff", resolvable: true, followUp: "Roughly how many employees and contractors located in {country} do you hold personal data about?",
  },
  {
    kind: "count", bandSet: "people", path: "j.people.business", label: "number of business contacts located in {country}",
    questionId: "people-business", resolvable: true, followUp: "Roughly how many business contacts (clients, suppliers, partners) located in {country} do you hold personal data about?",
  },
  {
    kind: "count", bandSet: "people", path: "j.people.other", label: "number of other individuals (end users, site visitors, public) located in {country}",
    questionId: "people-other", resolvable: true, followUp: "Roughly how many other individuals (end users, site visitors, members of the public) located in {country} do you hold personal data about?",
  },
  { kind: "count", bandSet: "people", path: "j.people.total", label: "total number of individuals located in {country}", derived: true },
  {
    kind: "count", bandSet: "sensitiveHeld", path: "j.people.sensitive", label: "number of individuals located in {country} whose sensitive data you hold",
    questionId: "people-sensitive", resolvable: true, followUp: "Roughly how many individuals located in {country} do you hold sensitive personal data about per year?",
  },
  {
    kind: "count", bandSet: "people", path: "j.people.soldShared", label: "number of individuals located in {country} whose data is sold or shared for advertising",
    questionId: "people-sold-shared", resolvable: true,
    followUp: "Roughly how many individuals located in {country} have their data sold or shared with third parties for advertising (e.g. via ad pixels)?",
  },

  // Transfers out of the jurisdiction (per calendar year)
  {
    kind: "count", bandSet: "transfersNonSensitive", path: "j.transfers.nonSensitive", label: "number of individuals whose non-sensitive data {country} sends abroad per year",
    questionId: "transfers-nonsensitive", resolvable: true, followUp: "Roughly how many individuals' non-sensitive personal data does the {country} entity send outside {country} per calendar year?",
  },
  {
    kind: "count", bandSet: "transfersSensitive", path: "j.transfers.sensitive", label: "number of individuals whose sensitive data {country} sends abroad per year",
    questionId: "transfers-sensitive", resolvable: true, followUp: "Roughly how many individuals' sensitive personal data does the {country} entity send outside {country} per calendar year?",
  },
  {
    kind: "enum", values: ["only_hr", "mixed", "no"], path: "j.transfers.hrOnly", label: "whether data sent abroad from {country} is only HR data",
    questionId: "transfers-hr-only", resolvable: true, followUp: "Is the data the {country} entity sends abroad mainly employee/HR data needed to manage staff?",
  },
  bool("j.tx.sale", "exchange of Texas residents' personal data with third parties for money or other valuable consideration", {
    questionId: "tx-sale", resolvable: true,
    followUp: "Do you exchange personal data of Texas residents with third parties for money or other valuable consideration?",
  }),
  bool("j.cn.ciio", "Critical Information Infrastructure Operator status of the China entity", {
    questionId: "cn-ciio", resolvable: true, followUp: "Has the China entity been notified that it is a Critical Information Infrastructure Operator (CIIO)?",
  }),
  bool("j.cn.importantData", "handling of potential 'important data' by the China entity", {
    questionId: "cn-important-data", resolvable: true,
    followUp: "Does the China entity handle data that could be classified as 'important data' (e.g. infrastructure, energy, geographic or large-scale project data)?",
  }),

  // ── Headquarters and group ──────────────────────────────────────────────────
  { kind: "string", path: "hq.country", label: "headquarters country" },
  bool("hq.isEU", "EU/EEA headquarters"),
  bool("hq.gdprBaseline", "a GDPR-based privacy programme", { questionId: "gdpr-baseline" }),
  {
    kind: "count", bandSet: "headcount", path: "group.headcount", label: "group headcount",
    questionId: "group-headcount", resolvable: true, followUp: "Roughly how many people does the group employ worldwide?",
  },
  {
    kind: "money", currency: "USD", path: "group.revenueUSD", label: "worldwide annual revenue of the group",
    questionId: "group-revenue", resolvable: true, followUp: "What is the group's worldwide annual revenue (band is enough)?",
  },
  { kind: "string", path: "group.industry", label: "industry" },

  // ── Data subjects (group-level) ─────────────────────────────────────────────
  bool("subjects.employees", "processing of employee data"),
  bool("subjects.contractors", "processing of contractor data"),
  bool("subjects.applicants", "processing of job applicant data"),
  bool("subjects.b2bContacts", "processing of business contact data"),
  bool("subjects.endUsers", "processing of end-user or member-of-the-public data (individuals acting privately)"),
  bool("subjects.siteVisitors", "processing of site visitor data"),

  // ── Sensitive data categories ───────────────────────────────────────────────
  bool("sensitive.health", "health data"),
  bool("sensitive.biometrics", "biometric data"),
  bool("sensitive.criminal", "criminal record data"),
  bool("sensitive.union", "union membership data"),
  bool("sensitive.children", "children's data"),
  bool("sensitive.preciseLocation", "precise location data"),
  bool("sensitive.financialAccounts", "financial account data"),
  bool("sensitive.nationalId", "national ID numbers"),

  // ── Processing activities ───────────────────────────────────────────────────
  bool("processing.hrPayroll", "HR and payroll processing"),
  bool("processing.recruiting", "recruiting"),
  bool("processing.siteAccess", "site safety and access control"),
  bool("processing.cctv", "CCTV"),
  bool("processing.marketing", "marketing"),
  bool("processing.crm", "CRM"),
  bool("processing.rnd", "R&D / engineering data"),
  bool("processing.employeeMonitoring", "employee monitoring"),
  bool("processing.automatedDecisions", "AI or automated decision-making"),

  // ── Website and tracking ────────────────────────────────────────────────────
  bool("web.analytics", "website analytics", { questionId: "web-trackers", resolvable: true, followUp: "Which trackers run on your website(s): analytics, advertising pixels, session recording, chat widgets, embedded videos/maps?" }),
  bool("web.adPixels", "advertising/retargeting pixels", { questionId: "web-trackers", resolvable: true, followUp: "Do your website(s) use advertising or retargeting pixels (e.g. LinkedIn Insight Tag, Meta Pixel)?" }),
  bool("web.sessionReplay", "session recording or heatmaps", { questionId: "web-trackers", resolvable: true }),
  bool("web.chat", "a chat widget", { questionId: "web-trackers", resolvable: true }),
  bool("web.embeds", "embedded videos or maps", { questionId: "web-trackers", resolvable: true }),
  bool("web.nonEssential", "non-essential website trackers", { derived: true }),
  {
    kind: "enum", values: ["blocking", "informational", "none"], path: "web.consentBanner", label: "cookie consent banner",
    questionId: "web-consent-banner", resolvable: true, followUp: "Is there a cookie consent banner, and does it block trackers until consent?",
  },

  // ── Infrastructure and flows ────────────────────────────────────────────────
  bool("flows.exportsOut", "personal data leaving {country}", { derived: true }),
  bool("flows.groupAccessFromAbroad", "access to {country} data by group entities abroad", { questionId: "flows-group-access" }),
  bool("flows.localProcessesForGroup", "the {country} entity processing data on behalf of other group entities"),
  bool("flows.hostedLocally", "hosting of {country} data inside {country}"),
  bool("flows.usesProcessors", "use of external service providers"),

  // ── Existing GDPR framework ─────────────────────────────────────────────────
  ...(["ropa", "dpia", "sccs", "tia", "dpo", "breachProcedure", "dsarProcedure", "vendorDpas", "privacyNotices", "training", "retentionSchedule"] as const)
    .map((k) => bool(`framework.${k}`, `existing GDPR artefact: ${k}`)),

  // ── Governance ──────────────────────────────────────────────────────────────
  { kind: "enum", values: ["centralized", "hub_and_spoke", "decentralized"], path: "governance.model", label: "privacy governance model" },
  bool("governance.localContacts", "local privacy contacts"),
];

export const factsByPath: ReadonlyMap<string, FactDef> = new Map(facts.map((f) => [f.path, f]));

/** Every dotted path a JsonLogic `var` may reference (leaf facts only). */
export const factPaths: ReadonlySet<string> = new Set(facts.map((f) => f.path));

/** Plain-object evaluation context as rules see it (after the engine picks a point in each interval). */
export type EvaluationContext = {
  [K: string]: string | number | boolean | EvaluationContext;
};

/** Build a nested context object from a flat {path: value} map. */
export function buildContext(flat: Record<string, string | number | boolean>): EvaluationContext {
  const root: EvaluationContext = {};
  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split(".");
    let node = root;
    for (const k of keys.slice(0, -1)) node = (node[k] ??= {}) as EvaluationContext;
    node[keys.at(-1)!] = value;
  }
  return root;
}
