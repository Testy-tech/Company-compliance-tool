"use client";

import { hasDestination, needsDpf, sendsNothing, type Destinations, type Draft, type EntityDraft } from "@/lib/intake/draft";
import { hostingLabels, hrOnlyLabels, providerRegionLabels, vendorLabels } from "@/lib/intake/options";
import type { Answer } from "@/lib/intake/schema";
import type { WizardConfig } from "@/lib/kb/wizard-config";
import { anchorId } from "@/lib/intake/questions";

import { AnswerRadio, BandQuestion, CheckList, CountrySection, QuestionGroup, YesNoAnswer, YesNoRadio } from "../fields";
import { countryName, issueCollector, type StepDef, type StepProps } from "../types";

const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const toggle = (list: string[], value: string, on: boolean) => (on ? [...list, value] : list.filter((v) => v !== value));

const subLegend = "text-sm font-medium";
const noDestinations: Destinations = { hq: false, group: [], providers: [] };

/** "Where does this entity's data go?" — headquarters, other group entities, provider locations, or "Don't know". */
function DestinationsQuestion({
  e, draft, config, error, onChange,
}: { e: EntityDraft; draft: Draft; config: WizardConfig; error?: string; onChange: (a: Answer<Destinations> | undefined) => void }) {
  const j = e.jurisdiction;
  const answer = e.transfers.destinations;
  const value = answer?.status === "known" ? answer.value : noDestinations;
  const unknown = answer?.status === "unknown";
  const others = draft.footprint.entities.filter((x) => x.jurisdiction !== j && x.role !== "hq");
  const hasHq = e.role !== "hq" && draft.company.hqCountry !== "";
  const name = anchorId("transfers-destinations", j);
  // Choosing any destination clears "Don't know"; clearing the last one leaves the question unanswered.
  const set = (next: Destinations) => onChange(hasDestination(next) ? { status: "known", value: next } : undefined);

  return (
    <QuestionGroup qid="transfers-destinations" jurisdiction={j} vars={{ country: countryName(config, j) }} error={error} hint="Select all that apply.">
      <div className="space-y-4">
        {hasHq ? (
          <CheckList name={`${name}-hq`} options={[{ value: "hq", label: "Group headquarters" }]} values={value.hq ? ["hq"] : []} onToggle={(_, on) => set({ ...value, hq: on })} />
        ) : null}
        {others.length ? (
          <fieldset>
            <legend className={subLegend}>Other group entities in:</legend>
            <div className="mt-2">
              <CheckList
                name={`${name}-group`}
                options={others.map((x) => ({ value: x.jurisdiction, label: countryName(config, x.jurisdiction) }))}
                values={value.group}
                onToggle={(v, on) => set({ ...value, group: toggle(value.group, v, on) })}
              />
            </div>
          </fieldset>
        ) : null}
        <fieldset>
          <legend className={subLegend}>Service providers or cloud located in:</legend>
          <div className="mt-2">
            <CheckList name={`${name}-providers`} options={toOptions(providerRegionLabels)} values={value.providers} onToggle={(v, on) => set({ ...value, providers: toggle(value.providers, v, on) })} />
          </div>
        </fieldset>
        <CheckList
          name={`${name}-unknown`}
          options={[{ value: "unknown", label: "Don't know" }]}
          values={unknown ? ["unknown"] : []}
          onToggle={(_, on) => onChange(on ? { status: "unknown" } : undefined)}
        />
      </div>
    </QuestionGroup>
  );
}

function InfrastructureStep({ draft, update, config, errors }: StepProps) {
  const inf = draft.infrastructure;
  return (
    <div className="space-y-8">
      <QuestionGroup qid="hosting" error={errors["q-hosting"]} hint="Select all that apply.">
        <CheckList name="hosting" options={toOptions(hostingLabels)} values={inf.hosting}
          onToggle={(v, on) => update((d) => void (d.infrastructure.hosting = toggle(d.infrastructure.hosting, v, on)))} />
      </QuestionGroup>

      <QuestionGroup qid="flows-group-access" error={errors["q-flows-group-access"]}>
        <YesNoRadio name="flows-group-access" value={inf.groupAccessFromAbroad} onChange={(v) => update((d) => void (d.infrastructure.groupAccessFromAbroad = v))} />
      </QuestionGroup>

      <QuestionGroup qid="flows-local-for-group" error={errors["q-flows-local-for-group"]}>
        <YesNoRadio name="flows-local-for-group" value={inf.localProcessesForGroup} onChange={(v) => update((d) => void (d.infrastructure.localProcessesForGroup = v))} />
      </QuestionGroup>

      <QuestionGroup qid="vendors" hint="Select all that apply. Leave empty if none.">
        <CheckList name="vendors" options={toOptions(vendorLabels)} values={inf.vendors}
          onToggle={(v, on) => update((d) => void (d.infrastructure.vendors = toggle(d.infrastructure.vendors, v, on)))} />
      </QuestionGroup>

      {draft.footprint.entities.map((e, i) => {
        const j = e.jurisdiction;
        const country = countryName(config, j);
        const q = { jurisdiction: j, vars: { country } };
        return (
          <CountrySection key={j} name={country} note={`Personal data sent from ${country} to other countries, including remote access from abroad.`}>
            <BandQuestion qid="transfers-nonsensitive" {...q} set="transfersNonSensitive" value={e.transfers.nonSensitive}
              error={errors[anchorId("transfers-nonsensitive", j)]}
              onChange={(a) => update((d) => void (d.footprint.entities[i]!.transfers.nonSensitive = a))} />
            <BandQuestion qid="transfers-sensitive" {...q} set="transfersSensitive" value={e.transfers.sensitive}
              error={errors[anchorId("transfers-sensitive", j)]}
              onChange={(a) => update((d) => void (d.footprint.entities[i]!.transfers.sensitive = a))} />
            {!sendsNothing(e.transfers) ? (
              <QuestionGroup qid="transfers-hr-only" {...q} error={errors[anchorId("transfers-hr-only", j)]}>
                <AnswerRadio name={anchorId("transfers-hr-only", j)} options={toOptions(hrOnlyLabels)} value={e.transfers.hrOnly}
                  onChange={(a) => update((d) => void (d.footprint.entities[i]!.transfers.hrOnly = a))} />
              </QuestionGroup>
            ) : null}

            {!sendsNothing(e.transfers) ? (
              <DestinationsQuestion
                e={e}
                draft={draft}
                config={config}
                error={errors[anchorId("transfers-destinations", j)]}
                onChange={(a) => update((d) => void (d.footprint.entities[i]!.transfers.destinations = a))}
              />
            ) : null}

            {needsDpf(e, draft) ? (
              <QuestionGroup qid="entity-dpf" {...q} error={errors[anchorId("entity-dpf", j)]}>
                <YesNoAnswer name={anchorId("entity-dpf", j)} value={e.dpfCertified} onChange={(a) => update((d) => void (d.footprint.entities[i]!.dpfCertified = a))} />
              </QuestionGroup>
            ) : null}

            {j === "CN" ? (
              <>
                <QuestionGroup qid="cn-ciio" {...q} error={errors[anchorId("cn-ciio", j)]}>
                  <YesNoAnswer name={anchorId("cn-ciio", j)} value={e.cn.ciio} onChange={(a) => update((d) => void (d.footprint.entities[i]!.cn.ciio = a))} />
                </QuestionGroup>
                <QuestionGroup qid="cn-important-data" {...q} error={errors[anchorId("cn-important-data", j)]}>
                  <YesNoAnswer name={anchorId("cn-important-data", j)} value={e.cn.importantData}
                    onChange={(a) => update((d) => void (d.footprint.entities[i]!.cn.importantData = a))} />
                </QuestionGroup>
              </>
            ) : null}
          </CountrySection>
        );
      })}
    </div>
  );
}

export const infrastructureStep: StepDef = {
  id: "infrastructure",
  title: "Infrastructure and flows",
  intro: "Where data is hosted, who can reach it from abroad, and how much leaves each country per calendar year.",
  questionIds: [
    "hosting", "flows-group-access", "flows-local-for-group", "vendors",
    "transfers-nonsensitive", "transfers-sensitive", "transfers-hr-only", "transfers-destinations", "entity-dpf", "cn-ciio", "cn-important-data",
  ],
  validate: (draft, config) => {
    const v = issueCollector(config);
    const inf = draft.infrastructure;
    v.require(inf.hosting.length > 0, "hosting", undefined, "Select at least one hosting location.");
    v.require(inf.groupAccessFromAbroad === undefined ? undefined : true, "flows-group-access", undefined, "Please choose Yes or No.");
    v.require(inf.localProcessesForGroup === undefined ? undefined : true, "flows-local-for-group", undefined, "Please choose Yes or No.");
    for (const e of draft.footprint.entities) {
      const j = e.jurisdiction;
      v.require(e.transfers.nonSensitive, "transfers-nonsensitive", j);
      v.require(e.transfers.sensitive, "transfers-sensitive", j);
      if (!sendsNothing(e.transfers)) {
        v.require(e.transfers.hrOnly, "transfers-hr-only", j);
        v.require(e.transfers.destinations, "transfers-destinations", j, "Select at least one destination, or “Don't know”.");
      }
      if (needsDpf(e, draft)) v.require(e.dpfCertified, "entity-dpf", j);
      if (j === "CN") {
        v.require(e.cn.ciio, "cn-ciio", j);
        v.require(e.cn.importantData, "cn-important-data", j);
      }
    }
    return v.issues;
  },
  Component: InfrastructureStep,
};
