import { providerRegionLabels } from "@/lib/intake/options";
import { anchorId, copy } from "@/lib/intake/questions";
import type { Intake } from "@/lib/intake/schema";
import type { EuTransfers } from "@/lib/kb/eu-transfers";
import type { Jurisdiction, JurisdictionId, Obligation } from "@/lib/kb/schema";

import type { JurisdictionReport, OpenQuestion, TransferFlow } from "./types";

/*
 * Transfer flows: one per origin → destination, with the mechanism the
 * exporting country requires.
 *   - Exporter in the EEA: the mechanism depends on the destination (inside the
 *     EEA, adequacy decision, Data Privacy Framework for certified US
 *     recipients, otherwise standard contractual clauses plus a transfer impact
 *     assessment). The adequacy list comes from content/config/eu-transfers.json.
 *   - Any other exporter: its own cross-border transfer items, whatever the destination.
 * An unknown destination or unknown DPF status gives an "assumed" flow and an open question.
 */

type Entity = Intake["footprint"]["entities"][number];
type Seed = Omit<OpenQuestion, "obligationIds" | "jurisdictions" | "impact" | "priority">;
export type FlowQuestion = { seed: Seed; obligationIds: string[] };

/** Country code of an assessed jurisdiction ("US-CA" → "US"). */
const countryOf = (j: string) => j.slice(0, 2);

type Destination = TransferFlow["destination"] & { entity?: Entity };

function destinationsOf(e: Entity, intake: Intake, name: (j: string) => string): Destination[] {
  const hqEntity = intake.footprint.entities.find((x) => x.role === "hq");
  const hq: Destination = hqEntity
    ? { kind: "hq", code: countryOf(hqEntity.jurisdiction), name: `${name(hqEntity.jurisdiction)} (headquarters)`, entity: hqEntity }
    : { kind: "hq", code: intake.company.hqCountry, name: `Headquarters (${intake.company.hqCountry})` };
  const answer = e.transfers.destinations;
  const out: Destination[] = [];
  if (answer.status === "known") {
    if (answer.value.hq && e.role !== "hq") out.push(hq);
    for (const g of answer.value.group) {
      const entity = intake.footprint.entities.find((x) => x.jurisdiction === g);
      if (entity && g !== e.jurisdiction) out.push({ kind: "group", code: countryOf(g), name: `${name(g)} entity`, entity });
    }
    for (const p of answer.value.providers) out.push({ kind: "provider", code: p, name: `Service providers in ${providerRegionLabels[p]}` });
  } else if (answer.status === "unknown") {
    out.push({ kind: "unknown", code: "?", name: "Destination not known" });
  }
  // Remote access from abroad is itself a transfer to headquarters.
  if (intake.infrastructure.groupAccessFromAbroad && e.role !== "hq" && !out.some((d) => d.kind === "hq")) out.push({ ...hq, remoteAccess: true });
  return out;
}

const ownerOf = (items: Obligation[]): Obligation["owner"] | undefined => {
  const owners = new Set(items.map((o) => o.owner));
  return owners.size === 0 ? undefined : owners.size === 1 ? [...owners][0] : "both";
};

export function transferFlows(
  intake: Intake,
  reports: readonly JurisdictionReport[],
  kb: readonly Jurisdiction[],
  eu: EuTransfers,
): { flows: TransferFlow[]; questions: FlowQuestion[] } {
  const name = (j: string) => kb.find((k) => k.id === j)?.name ?? j;
  const flows: TransferFlow[] = [];
  const questions: FlowQuestion[] = [];

  for (const report of reports) {
    const origin = report.jurisdiction;
    const e = intake.footprint.entities.find((x) => x.jurisdiction === origin)!;
    const originCode = countryOf(origin);
    const exporterInEEA = eu.eea.includes(originCode);
    const items = report.results.filter((r) => r.obligation.category === "cross_border_transfer");
    const obligationIds = items.map((r) => r.obligation.id);
    const itemsAssumed = items.some((r) => r.applicability === "assumed");
    const base = { origin, originName: report.name, obligationIds, owner: ownerOf(items.map((r) => r.obligation)) };

    if (e.transfers.destinations.status === "unknown")
      questions.push({
        obligationIds,
        seed: {
          id: `transfers-destinations:${origin}`,
          kind: "unresolved",
          questionId: "transfers-destinations",
          facts: [],
          jurisdiction: origin,
          question: `Where does the ${report.name} entity's personal data go: group headquarters, other group entities, or service providers (and in which countries)?`,
          whyItMatters: copy("transfers-destinations", { country: report.name }).why,
          resolveHref: `/assess#${anchorId("transfers-destinations", origin)}`,
        },
      });

    for (const d of destinationsOf(e, intake, name)) {
      const { entity, ...destination } = d;
      const id = `${origin}>${d.kind}${d.kind === "group" || d.kind === "provider" ? `:${entity?.jurisdiction ?? d.code}` : ""}`;
      const flow = (rest: Pick<TransferFlow, "crossBorder" | "mechanism" | "status"> & Partial<TransferFlow>): TransferFlow => ({
        id, ...base, destination, openQuestionIds: [], ...rest,
      });
      const sameCountry = d.code === originCode || (d.code === "EEA" && exporterInEEA);

      if (!exporterInEEA) {
        if (sameCountry) flows.push(flow({ crossBorder: false, mechanism: "Within the same country: no cross-border transfer", status: "none", obligationIds: [], owner: undefined }));
        else if (!items.length) flows.push(flow({ crossBorder: true, mechanism: "No transfer item applies on your answers", status: "none" }));
        else
          flows.push(
            flow({
              crossBorder: true,
              mechanism: items.map((r) => r.obligation.title).join("; "),
              status: itemsAssumed || d.kind === "unknown" ? "assumed" : "applies",
              openQuestionIds: d.kind === "unknown" ? [`transfers-destinations:${origin}`] : [],
            }),
          );
        continue;
      }

      // Exporter in the EEA: the mechanism depends on the destination.
      const m = eu.mechanisms;
      const owner = base.owner ?? "HQ";
      const adequate = eu.adequacy.countries.find((c) => c.code === d.code);
      if (d.kind === "unknown") {
        flows.push(
          flow({
            crossBorder: true, owner, status: "assumed",
            mechanism: m.sccs.label,
            note: "Assumed that the destination is outside the EEA and has no adequacy decision.",
            sources: [m.sccs.source],
            openQuestionIds: [`transfers-destinations:${origin}`],
          }),
        );
      } else if (sameCountry || eu.eea.includes(d.code)) {
        flows.push(flow({ crossBorder: d.code !== originCode && d.code !== "EEA", owner: undefined, obligationIds: [], status: "none", mechanism: m.none.label, sources: [m.none.source] }));
      } else if (adequate && !adequate.certifiedOnly) {
        flows.push(
          flow({
            crossBorder: true, owner, status: "applies",
            mechanism: `${m.adequacy.label} (${adequate.name})`,
            note: adequate.scope,
            sources: [m.adequacy.source, eu.adequacy.source],
          }),
        );
      } else if (adequate?.certifiedOnly && entity) {
        // A US group entity: certified recipients fall under the adequacy decision.
        const certified = entity.dpfCertified;
        if (certified?.status === "known" && certified.value)
          flows.push(flow({ crossBorder: true, owner, status: "applies", mechanism: m.dpf.label, sources: [m.dpf.source, eu.adequacy.source] }));
        else if (certified?.status === "known")
          flows.push(flow({ crossBorder: true, owner, status: "applies", mechanism: m.sccs.label, note: "The recipient is not certified under the Data Privacy Framework.", sources: [m.sccs.source] }));
        else {
          const qid = `entity-dpf:${entity.jurisdiction}`;
          const country = name(entity.jurisdiction);
          questions.push({
            obligationIds,
            seed: {
              id: qid,
              kind: "unresolved",
              questionId: "entity-dpf",
              facts: [],
              jurisdiction: entity.jurisdiction,
              question: copy("entity-dpf", { country }).label,
              whyItMatters: copy("entity-dpf", { country }).why,
              resolveHref: `/assess#${anchorId("entity-dpf", entity.jurisdiction)}`,
            },
          });
          flows.push(
            flow({
              crossBorder: true, owner, status: "assumed",
              mechanism: m.sccs.label,
              note: "Assumed that the recipient is not certified under the Data Privacy Framework; if it is, the framework applies instead.",
              sources: [m.sccs.source, m.dpf.source],
              openQuestionIds: [qid],
            }),
          );
        }
      } else if (adequate?.certifiedOnly) {
        // US service providers: certification is a fact about each provider, which the assessment does not ask.
        flows.push(
          flow({
            crossBorder: true, owner, status: "applies",
            mechanism: `${m.sccs.label}, unless the provider is certified under the Data Privacy Framework`,
            note: adequate.scope,
            sources: [m.sccs.source, m.dpf.source],
          }),
        );
      } else {
        flows.push(flow({ crossBorder: true, owner, status: "applies", mechanism: m.sccs.label, note: "No adequacy decision covers this destination.", sources: [m.sccs.source, eu.adequacy.source] }));
      }
    }
  }
  return { flows, questions };
}

/** Jurisdiction ids as a readable list of names. */
export const namesOf = (ids: readonly JurisdictionId[], kb: readonly Jurisdiction[]) => ids.map((id) => kb.find((k) => k.id === id)?.name ?? id);
