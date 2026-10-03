import type { JurisdictionReport } from "@/lib/engine/types";
import { entityTypeLabels, frameworkLabels, industryLabels, processingLabels, sensitiveLabels, subjectLabels } from "@/lib/intake/options";
import type { Intake } from "@/lib/intake/schema";
import { governanceModelLabels, ownerLabels } from "@/lib/report/labels";

import { MAX_OBLIGATIONS_PER_REQUEST, type TailorRequest } from "./tailor-schema";

/*
 * What leaves the browser when the user opts in to tailoring. Deliberately
 * narrow: knowledge-base text for the applicable obligations plus coarse facts
 * about the company. Never sent: a company name, headcount or revenue bands,
 * counts of individuals, transfer volumes, the "other countries" text.
 */

const on = (flags: Record<string, boolean>, labels: Record<string, string>) => Object.keys(flags).filter((k) => flags[k]).map((k) => labels[k] ?? k);
const label = (labels: Record<string, string>, key: string) => labels[key] ?? key;

export function buildTailorRequests(section: JurisdictionReport, intake: Intake): TailorRequest[] {
  const entity = intake.footprint.entities.find((e) => e.jurisdiction === section.jurisdiction)!;
  const base = {
    consent: true as const,
    jurisdiction: { id: section.jurisdiction, name: section.name },
    company: {
      // The label is sent only if the user marked it as anonymised; a real name never leaves the browser.
      ...(intake.company.anonymized && intake.company.label ? { anonymisedLabel: intake.company.label } : {}),
      industry: label(industryLabels, intake.company.industry),
      hqCountry: intake.company.hqCountry,
      gdprBaseline: intake.company.gdprBaseline === "yes",
      governanceModel: governanceModelLabels[intake.governance.model],
      localContacts: intake.governance.localContacts,
    },
    entity: {
      role: entity.role === "hq" ? "headquarters" : entity.role === "target" ? "planned entry" : "current operations",
      entityType: entity.entityType === "hq" ? "headquarters" : label(entityTypeLabels, entity.entityType),
      status: entity.status,
    },
    facts: {
      subjects: on(intake.data.subjects, subjectLabels),
      sensitiveData: on(intake.data.sensitive, sensitiveLabels),
      processing: on(intake.processing.processing, processingLabels),
      gdprArtefactsInPlace: on(intake.framework.framework, frameworkLabels),
    },
  };
  const obligations = section.results.map((r) => ({
    id: r.obligation.id,
    title: r.obligation.title,
    requirement: r.obligation.requirement,
    whyItApplies: r.obligation.appliesIfNote,
    actionSteps: r.obligation.actionSteps,
    applicability: r.applicability,
    assumptions: r.assumptions.map((a) => a.sentence),
    owner: ownerLabels[r.obligation.owner],
    ...(r.obligation.gdprEquivalent ? { gdprEquivalent: r.obligation.gdprEquivalent } : {}),
  }));
  const requests: TailorRequest[] = [];
  for (let i = 0; i < obligations.length; i += MAX_OBLIGATIONS_PER_REQUEST)
    requests.push({ ...base, obligations: obligations.slice(i, i + MAX_OBLIGATIONS_PER_REQUEST) });
  return requests;
}

/** Changes whenever an answer changes, so tailored text is never shown for a different assessment. */
export function assessmentSignature(intake: Intake, assessmentDate: string): string {
  const text = JSON.stringify([assessmentDate, intake]);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${text.length}:${h >>> 0}`;
}
