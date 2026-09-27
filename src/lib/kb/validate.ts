import jsonLogic from "json-logic-js";

import { factPaths, type EvaluationContext } from "./facts";
import { jurisdictionSchema, type Jurisdiction, type JsonLogic } from "./schema";

/* Cross-field checks that zod alone cannot express. Pure: used by the build
 * script and by unit tests. */

const KNOWN_OPS = new Set([
  "var", "missing", "missing_some", "if", "==", "===", "!=", "!==", "!", "!!",
  "or", "and", ">", ">=", "<", "<=", "max", "min", "+", "-", "*", "/", "%",
  "in", "cat", "substr", "merge", "map", "filter", "reduce", "all", "none", "some",
]);

/** Official domains per jurisdiction. Other sources produce a warning, not an error. */
export const OFFICIAL_DOMAINS: Record<Jurisdiction["id"], string[]> = {
  IT: ["garanteprivacy.it", "normattiva.it", "gazzettaufficiale.it", "eur-lex.europa.eu", "edpb.europa.eu", "commission.europa.eu"],
  DE: ["gesetze-im-internet.de", "bfdi.bund.de", "datenschutzkonferenz-online.de", "eur-lex.europa.eu", "curia.europa.eu", "edpb.europa.eu", "bundesgesetzblatt.de", "recht.bund.de"],
  CN: ["cac.gov.cn", "gov.cn", "npc.gov.cn", "flk.npc.gov.cn", "samr.gov.cn", "std.samr.gov.cn", "tc260.org.cn"],
  SG: ["pdpc.gov.sg", "sso.agc.gov.sg", "agc.gov.sg", "dnc.gov.sg"],
  PE: ["gob.pe", "minjus.gob.pe", "elperuano.pe", "spij.minjus.gob.pe", "leyes.congreso.gob.pe"],
  CL: ["bcn.cl", "leychile.cl", "diariooficial.interior.gob.cl", "gob.cl", "camara.cl", "senado.cl"],
  "US-CA": ["cppa.ca.gov", "oag.ca.gov", "leginfo.legislature.ca.gov", "law.cornell.edu", "govt.westlaw.com", "ca.gov"],
  "US-TX": ["statutes.capitol.texas.gov", "texasattorneygeneral.gov", "capitol.texas.gov", "sos.state.tx.us", "texreg.sos.state.tx.us"],
  KR: ["pipc.go.kr", "law.go.kr", "elaw.klri.re.kr", "kisa.or.kr", "privacy.go.kr", "commission.europa.eu"],
  IN: ["meity.gov.in", "egazette.gov.in", "indiacode.nic.in", "dpb.gov.in", "pib.gov.in"],
};

export type Issue = { level: "error" | "warning"; where: string; message: string };

function collectVars(logic: JsonLogic, out: string[] = []): string[] {
  if (Array.isArray(logic)) logic.forEach((l) => collectVars(l, out));
  else if (logic && typeof logic === "object") {
    for (const [op, arg] of Object.entries(logic)) {
      if (!KNOWN_OPS.has(op)) out.push(`__unknown_op__:${op}`);
      if (op === "var") {
        const path = Array.isArray(arg) ? arg[0] : arg;
        if (typeof path === "string") out.push(path);
      } else collectVars(arg, out);
    }
  }
  return out;
}

/** A neutral context used to smoke-test that every rule evaluates without throwing. */
export const smokeContext: EvaluationContext = {
  j: { id: "XX", role: "current", entityType: "subsidiary", status: "operating", headcount: 100, individuals: 1000, sensitiveIndividuals: 100, consumers: 0, localRevenueUSD: null, employeeRepresentation: true },
  hq: { country: "IT", isEU: true },
  group: { headcount: 5000, revenueUSD: null, industry: "engineering", b2c: false },
  subjects: { employees: true, contractors: true, applicants: true, b2bContacts: true, consumers: false, siteVisitors: true },
  sensitive: { health: true, biometrics: true, criminal: false, union: false, children: false, preciseLocation: false, financialAccounts: true, nationalId: true },
  processing: { hrPayroll: true, recruiting: true, siteAccess: true, cctv: true, marketing: false, crm: true, rnd: true, employeeMonitoring: false, automatedDecisions: false, sellsOrSharesData: false, websiteTracking: true },
  flows: { exportsOut: true, groupAccessFromAbroad: true, localProcessesForGroup: false, hostedLocally: false, usesProcessors: true },
  framework: { ropa: true, dpia: true, sccs: true, tia: true, dpo: true, breachProcedure: true, dsarProcedure: true, vendorDpas: true, privacyNotices: true, training: true, retentionSchedule: true },
  governance: { model: "centralized", localContacts: false },
};

export function validateJurisdiction(
  raw: unknown,
  fileId: string,
  today = new Date().toISOString().slice(0, 10),
): { data?: Jurisdiction; issues: Issue[] } {
  const issues: Issue[] = [];
  const parsed = jurisdictionSchema.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues)
      issues.push({ level: "error", where: `${fileId}:${i.path.join(".")}`, message: i.message });
    return { issues };
  }
  const j = parsed.data;
  if (j.id !== fileId) issues.push({ level: "error", where: fileId, message: `id "${j.id}" does not match file name` });
  if (j.lastReviewed > today) issues.push({ level: "error", where: fileId, message: "lastReviewed is in the future" });

  const official = OFFICIAL_DOMAINS[j.id];
  const isOfficial = (u: string) => {
    const host = new URL(u).hostname;
    return official.some((d) => host === d || host.endsWith(`.${d}`));
  };
  for (const law of j.laws)
    if (!isOfficial(law.officialUrl))
      issues.push({ level: "warning", where: `${fileId}:laws`, message: `non-official URL for ${law.shortName}: ${law.officialUrl}` });

  const seen = new Set<string>();
  for (const o of j.obligations) {
    const where = `${fileId}:${o.id}`;
    if (seen.has(o.id)) issues.push({ level: "error", where, message: "duplicate obligation id" });
    seen.add(o.id);
    if (!o.id.startsWith(`${j.id}-`)) issues.push({ level: "error", where, message: `id must start with "${j.id}-"` });
    if (o.lastVerified > today) issues.push({ level: "error", where, message: "lastVerified is in the future" });
    if (o.confidence === "verified" && /claude|automated|research/i.test(o.verifiedBy))
      issues.push({ level: "error", where, message: "confidence 'verified' is reserved for counsel review" });
    if (o.gdprDelta !== "new" && !o.gdprEquivalent)
      issues.push({ level: "error", where, message: "covered/partial obligations must name a gdprEquivalent" });

    for (const v of collectVars(o.appliesIf)) {
      if (v.startsWith("__unknown_op__:"))
        issues.push({ level: "error", where, message: `unknown JsonLogic operator "${v.slice(15)}"` });
      else if (!factPaths.has(v))
        issues.push({ level: "error", where, message: `appliesIf references unknown fact "${v}"` });
    }
    try {
      const r = jsonLogic.apply(o.appliesIf as never, smokeContext);
      if (typeof r !== "boolean")
        issues.push({ level: "error", where, message: `appliesIf must evaluate to a boolean, got ${JSON.stringify(r)}` });
    } catch (e) {
      issues.push({ level: "error", where, message: `appliesIf failed to evaluate: ${String(e)}` });
    }

    const officialCount = o.sources.filter((s) => isOfficial(s.url)).length;
    if (officialCount === 0)
      issues.push({ level: o.confidence === "unverified" ? "warning" : "error", where, message: "no official source; mark unverified or add one" });
  }
  return { data: j, issues };
}
