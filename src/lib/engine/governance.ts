import type { Intake } from "@/lib/intake/schema";
import type { JurisdictionId } from "@/lib/kb/schema";

import type { GovernanceFinding, ObligationResult } from "./types";

/*
 * Governance findings: what the applicable obligations imply for how privacy is
 * organised across the group. Derived only from each obligation's owner and
 * category in the knowledge base and from the two governance answers — no legal
 * content is added here.
 */

const unique = <T,>(xs: T[]) => [...new Set(xs)];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function governanceFindings(results: readonly ObligationResult[], governance: Intake["governance"]): GovernanceFinding[] {
  const findings: GovernanceFinding[] = [];
  const add = (id: string, title: string, detail: string, subset: readonly ObligationResult[]) => {
    if (!subset.length) return;
    findings.push({
      id,
      title,
      detail,
      jurisdictions: unique(subset.map((r) => r.jurisdiction)).sort() as JurisdictionId[],
      obligationIds: subset.map((r) => r.obligation.id).sort(),
    });
  };

  const officer = results.filter((r) => r.obligation.category === "dpo_representative");
  add(
    "local-officer",
    `Officer or representative duties in ${plural(unique(officer.map((r) => r.jurisdiction)).length, "jurisdiction", "jurisdictions")}`,
    governance.localContacts
      ? "You have named local privacy contacts. Check that each one meets the appointment, publication and notification requirements of the items listed."
      : "You have no named local privacy contacts. Each of these jurisdictions has an officer or representative item that needs a named person or body.",
    officer,
  );

  const local = results.filter((r) => r.obligation.owner === "local_entity");
  add(
    "local-ownership",
    `${plural(local.length, "item", "items")} must be carried out by the local entity`,
    governance.model === "centralized"
      ? "Privacy is run centrally at headquarters, but these items are owned by the local entity. Headquarters can supply templates and oversight; someone locally has to do the work and be accountable for it."
      : governance.model === "hub_and_spoke"
        ? "These items are owned by the local entity. Make sure each one is assigned to the local contact in your hub-and-spoke model."
        : "These items are owned by the local entity, which fits a decentralised model. Check that each entity has the capacity to deliver them.",
    local,
  );

  const shared = results.filter((r) => r.obligation.owner === "both");
  add(
    "shared-ownership",
    `${plural(shared.length, "item", "items")} need headquarters and the local entity to act together`,
    governance.model === "decentralized"
      ? "These items need action at group level as well as locally. In a decentralised model, agree who at headquarters coordinates them."
      : "These items need action at group level as well as locally. Agree for each one who leads and who supports.",
    shared,
  );

  const filings = results.filter((r) => r.obligation.category === "registration_filing");
  add(
    "local-filings",
    `Registrations or filings with a local authority in ${plural(unique(filings.map((r) => r.jurisdiction)).length, "jurisdiction", "jurisdictions")}`,
    "Filings are made with the local authority, usually in the local language and through a local account or representative. Decide who files and who keeps the registration up to date.",
    filings,
  );

  return findings;
}
