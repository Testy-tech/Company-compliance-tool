import { bandInterval, type BandSetId } from "@/lib/intake/bands";
import { revenueBandToUSD, type FxTable } from "@/lib/intake/money";
import type { Answer, Intake } from "@/lib/intake/schema";

/*
 * Intake answers → facts for one jurisdiction.
 *
 * A fact is either exact, a numeric range (a band, or 0–∞ when the answer is
 * unresolved), or a set of options (an unresolved yes/no or choice). The
 * evaluator tests each rule over every combination of the non-exact facts.
 * Skipped questions ("not_asked") become neutral exact values: 0, false or null.
 */

export type Scalar = string | number | boolean | null;

export type FactValue =
  | { kind: "exact"; value: Scalar }
  /** `unresolved` = the answer was "Don't know" / "Prefer not to say" (as opposed to a known band). */
  | { kind: "range"; min: number; max: number; unresolved: boolean }
  /** Always an unresolved answer. */
  | { kind: "options"; values: Scalar[] };

export type BaseFacts = Record<string, FactValue>;
export type Entity = Intake["footprint"]["entities"][number];

export type DeriveContext = {
  fx: FxTable;
  /** Amount of a KB monetary threshold in effect on the assessment date (any jurisdiction). */
  thresholdAmount: (id: string) => number | undefined;
};

const EEA = new Set(
  "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO".split(" "),
);

const exact = (value: Scalar): FactValue => ({ kind: "exact", value });
const range = (min: number, max: number, unresolved: boolean): FactValue =>
  min >= max ? exact(min) : { kind: "range", min, max, unresolved };
const UNKNOWN_COUNT: FactValue = { kind: "range", min: 0, max: Number.POSITIVE_INFINITY, unresolved: true };

const isUnresolved = (a: Answer<unknown> | undefined) => a?.status === "unknown" || a?.status === "withheld";

function bandFact(set: BandSetId, a: Answer<string> | undefined): FactValue {
  if (a?.status === "known") return range(...bandInterval(set, a.value), false);
  return isUnresolved(a) ? UNKNOWN_COUNT : exact(0);
}

function boolFact(a: Answer<boolean> | undefined): FactValue {
  if (a?.status === "known") return exact(a.value);
  return isUnresolved(a) ? { kind: "options", values: [true, false] } : exact(false);
}

function enumFact(a: Answer<string> | undefined, values: readonly string[]): FactValue {
  if (a?.status === "known") return exact(a.value);
  return isUnresolved(a) ? { kind: "options", values: [...values] } : exact(null);
}

/** EUR revenue band → USD range, narrowed by any answered "Is revenue above US$X?" follow-ups. */
function revenueFact(a: Answer<string>, above: Record<string, Answer<boolean>>, ctx: DeriveContext): FactValue {
  if (a.status !== "known") return UNKNOWN_COUNT;
  const [lo, hiExclusive] = revenueBandToUSD(a.value, ctx.fx);
  let min = Math.round(lo);
  let max = Number.isFinite(hiExclusive) ? Math.round(hiExclusive) - 1 : hiExclusive;
  for (const id of Object.keys(above).sort()) {
    const answer = above[id]!;
    const amount = ctx.thresholdAmount(id);
    if (amount === undefined || answer.status !== "known" || amount <= min || amount > max) continue;
    if (answer.value) min = amount;
    else max = amount - 1;
  }
  return range(min, max, false);
}

const upper = (f: FactValue) => (f.kind === "exact" ? (f.value as number) : f.kind === "range" ? f.max : Number.POSITIVE_INFINITY);

const trackerFacts = {
  "web.analytics": "analytics",
  "web.adPixels": "ad_pixels",
  "web.sessionReplay": "session_replay",
  "web.chat": "chat",
  "web.embeds": "embeds",
} as const;

export function deriveBaseFacts(intake: Intake, e: Entity, ctx: DeriveContext): BaseFacts {
  const c = intake.company;
  const headcount = bandFact("headcount", e.headcount);

  // Germany (BDSG § 38): people regularly working with personal data cannot exceed headcount.
  // If the question was not asked or answered "Don't know", headcount is the upper bound.
  const staffMax = upper(headcount);
  const dataStaff: FactValue =
    e.dataStaff?.status === "known"
      ? (() => {
          const [min, max] = bandInterval("headcount", e.dataStaff.value);
          return range(Math.min(min, staffMax), Math.min(max, staffMax), false);
        })()
      : range(0, staffMax, isUnresolved(e.dataStaff));

  const w = intake.website;
  const facts: BaseFacts = {
    "j.id": exact(e.jurisdiction),
    "j.role": exact(e.role),
    "j.entityType": exact(e.entityType),
    "j.status": exact(e.status),
    "j.headcount": headcount,
    "j.dataStaff": dataStaff,
    "j.revenueUSD": revenueFact(e.revenue, e.revenueAbove, ctx),
    "j.employeeRep": enumFact(e.employeeRep, ["works_council", "union", "both", "none"]),
    "j.unionData": boolFact(e.unionData),
    "j.smallBusinessSBA": boolFact(e.smallBusinessSBA),
    "j.countryWebsite":
      w.countrySites.status === "known" ? exact(w.countrySites.value.includes(e.jurisdiction)) : { kind: "options", values: [true, false] },
    "j.people.staff": bandFact("people", e.people.staff),
    "j.people.business": bandFact("people", e.people.business),
    "j.people.other": bandFact("people", e.people.other),
    "j.people.sensitive": bandFact("sensitiveHeld", e.people.sensitive),
    "j.people.soldShared": bandFact("people", e.people.soldShared),
    "j.transfers.nonSensitive": bandFact("transfersNonSensitive", e.transfers.nonSensitive),
    "j.transfers.sensitive": bandFact("transfersSensitive", e.transfers.sensitive),
    "j.transfers.hrOnly": enumFact(e.transfers.hrOnly, ["only_hr", "mixed", "no"]),
    "j.tx.sale": boolFact(e.txSale),
    "j.cn.ciio": boolFact(e.cn?.ciio),
    "j.cn.importantData": boolFact(e.cn?.importantData),

    "hq.country": exact(c.hqCountry),
    "hq.isEU": exact(EEA.has(c.hqCountry)),
    "hq.gdprBaseline": exact(c.gdprBaseline === "yes"),
    "group.headcount": bandFact("headcount", c.groupHeadcount),
    "group.revenueUSD": revenueFact(c.groupRevenue, c.groupRevenueAbove, ctx),
    "group.industry": exact(c.industry),

    "web.consentBanner": enumFact(w.consentBanner, ["blocking", "informational", "none"]),

    "flows.groupAccessFromAbroad": exact(intake.infrastructure.groupAccessFromAbroad),
    "flows.localProcessesForGroup": exact(intake.infrastructure.localProcessesForGroup),
    "flows.hostedLocally": exact(intake.infrastructure.hosting.includes("local")),
    "flows.usesProcessors": exact(intake.infrastructure.vendors.length > 0),

    "governance.model": exact(intake.governance.model),
    "governance.localContacts": exact(intake.governance.localContacts),
  };

  for (const [path, tracker] of Object.entries(trackerFacts))
    facts[path] = w.trackers.status === "known" ? exact(w.trackers.value.includes(tracker)) : { kind: "options", values: [true, false] };

  const flagGroups = { subjects: intake.data.subjects, sensitive: intake.data.sensitive, processing: intake.processing.processing, framework: intake.framework.framework };
  for (const [prefix, flags] of Object.entries(flagGroups))
    for (const [key, on] of Object.entries(flags)) facts[`${prefix}.${key}`] = exact(on);

  return facts;
}

/** Facts computed from other facts, per evaluated combination. */
export const derivedFacts: Record<string, { deps: readonly string[]; compute: (get: (path: string) => Scalar) => Scalar }> = {
  "j.people.total": {
    deps: ["j.people.staff", "j.people.business", "j.people.other"],
    compute: (get) => (get("j.people.staff") as number) + (get("j.people.business") as number) + (get("j.people.other") as number),
  },
  "web.nonEssential": {
    deps: Object.keys(trackerFacts),
    compute: (get) => Object.keys(trackerFacts).some((p) => get(p) === true),
  },
  "flows.exportsOut": {
    deps: ["j.transfers.nonSensitive", "j.transfers.sensitive"],
    compute: (get) => (get("j.transfers.nonSensitive") as number) > 0 || (get("j.transfers.sensitive") as number) > 0,
  },
};
