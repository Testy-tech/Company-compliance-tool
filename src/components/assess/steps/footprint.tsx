"use client";

import {
  emptyEntity, hqJurisdiction, isUS, needsDataStaff, needsUnionQuestion, straddledThresholds, type Draft, type EntityDraft,
} from "@/lib/intake/draft";
import { formatUSD } from "@/lib/intake/money";
import { employeeRepLabels, entityTypeLabels } from "@/lib/intake/options";
import { anchorId } from "@/lib/intake/questions";
import type { CoveredJurisdiction } from "@/lib/intake/schema";

import { AnswerRadio, BandQuestion, CheckList, CountrySection, QuestionField, QuestionGroup, RadioList, TextInput, YesNoAnswer } from "../fields";
import { countryName, issueCollector, type StepDef, type StepProps } from "../types";

const statusOptions = [
  { value: "current", label: "We operate there now" },
  { value: "target", label: "Planned" },
];
const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

/** Find the entity for a jurisdiction inside an `update` callback. */
const entityOf = (d: Draft, id: string) => d.footprint.entities.find((e) => e.jurisdiction === id)!;

function FootprintStep({ draft, update, config, errors }: StepProps) {
  const covered = config.jurisdictions.map((j) => j.id);
  const hq = hqJurisdiction(draft.company, covered);
  const selected = draft.footprint.entities.map((e) => e.jurisdiction);
  // Keep the country cards in the same order as the checklist.
  const entities = config.jurisdictions.flatMap((j) => draft.footprint.entities.filter((e) => e.jurisdiction === j.id));

  return (
    <div className="space-y-8">
      <QuestionGroup
        qid="footprint"
        error={errors["q-footprint"]}
        hint="Only these ten jurisdictions are assessed so far (the United States as California and Texas)."
      >
        <CheckList
          name="footprint"
          options={config.jurisdictions.map((j) => ({ value: j.id, label: j.id === hq ? `${j.name} (headquarters)` : j.name }))}
          values={selected}
          disabled={hq ? [hq] : []}
          onToggle={(id, checked) =>
            update((d) => {
              if (checked) d.footprint.entities.push(emptyEntity(id as CoveredJurisdiction, "current"));
              else d.footprint.entities = d.footprint.entities.filter((e) => e.jurisdiction !== id);
            })
          }
        />
      </QuestionGroup>

      <QuestionField qid="other-countries" hint="Optional. Separate countries with commas.">
        {(ids) => (
          <TextInput
            {...ids}
            maxLength={500}
            value={draft.footprint.otherCountries}
            onChange={(e) => update((d) => void (d.footprint.otherCountries = e.target.value))}
          />
        )}
      </QuestionField>

      {entities.map((e) => (
        <EntityQuestions key={e.jurisdiction} e={e} draft={draft} update={update} config={config} errors={errors} />
      ))}
    </div>
  );
}

function EntityQuestions({ e, draft, update, config, errors }: { e: EntityDraft } & Omit<StepProps, "goTo">) {
  const j = e.jurisdiction;
  const country = countryName(config, j);
  const q = { jurisdiction: j, vars: { country } };
  const err = (qid: string) => errors[anchorId(qid, j)];

  return (
    <CountrySection name={country} note={e.role === "hq" ? "Headquarters" : undefined}>
      {e.role !== "hq" ? (
        <>
          <QuestionGroup qid="entity-status" {...q} error={err("entity-status")}>
            <RadioList
              name={anchorId("entity-status", j)}
              options={statusOptions}
              value={e.status ? e.role : undefined}
              onChange={(v) =>
                update((d) => Object.assign(entityOf(d, j), { role: v, status: v === "target" ? "planned" : "operating" }))
              }
            />
          </QuestionGroup>
          <QuestionGroup qid="entity-type" {...q} error={err("entity-type")}>
            <RadioList
              name={anchorId("entity-type", j)}
              columns
              options={toOptions(entityTypeLabels)}
              value={e.entityType}
              onChange={(v) => update((d) => void (entityOf(d, j).entityType = v as EntityDraft["entityType"]))}
            />
          </QuestionGroup>
        </>
      ) : null}

      <BandQuestion qid="entity-headcount" {...q} set="headcount" value={e.headcount} error={err("entity-headcount")}
        onChange={(a) => update((d) => void (entityOf(d, j).headcount = a))} />

      {needsDataStaff(e) ? (
        <BandQuestion qid="entity-data-staff" {...q} set="headcount" value={e.dataStaff} error={err("entity-data-staff")}
          onChange={(a) => update((d) => void (entityOf(d, j).dataStaff = a))} />
      ) : null}

      <BandQuestion qid="entity-revenue" {...q} set="revenueEUR" withheld value={e.revenue} error={err("entity-revenue")}
        onChange={(a) => update((d) => void (entityOf(d, j).revenue = a))} />

      {straddledThresholds(draft, e, config).map(({ threshold, scope }) => {
        const anchor = anchorId("revenue-above", threshold.id);
        return (
          <QuestionGroup
            key={threshold.id}
            qid="revenue-above"
            jurisdiction={threshold.id}
            vars={{ amount: formatUSD(threshold.amount) }}
            hint={scope === "group" ? "This refers to the whole group's worldwide revenue." : `This refers to the ${country} entity's revenue.`}
            error={errors[anchor]}
          >
            <YesNoAnswer
              name={anchor}
              value={scope === "group" ? draft.company.groupRevenueAbove[threshold.id] : e.revenueAbove[threshold.id]}
              onChange={(a) =>
                update((d) => {
                  if (scope === "group") d.company.groupRevenueAbove[threshold.id] = a;
                  else entityOf(d, j).revenueAbove[threshold.id] = a;
                })
              }
            />
          </QuestionGroup>
        );
      })}

      <QuestionGroup qid="entity-employee-rep" {...q} error={err("entity-employee-rep")}>
        <AnswerRadio
          name={anchorId("entity-employee-rep", j)}
          options={toOptions(employeeRepLabels)}
          value={e.employeeRep}
          onChange={(a) => update((d) => void (entityOf(d, j).employeeRep = a))}
        />
      </QuestionGroup>

      {needsUnionQuestion(e) ? (
        <QuestionGroup qid="entity-union-data" {...q} error={err("entity-union-data")}>
          <YesNoAnswer name={anchorId("entity-union-data", j)} value={e.unionData} onChange={(a) => update((d) => void (entityOf(d, j).unionData = a))} />
        </QuestionGroup>
      ) : null}

      {isUS(e) ? (
        <QuestionGroup qid="entity-sba" {...q} error={err("entity-sba")}>
          <YesNoAnswer name={anchorId("entity-sba", j)} value={e.smallBusinessSBA} onChange={(a) => update((d) => void (entityOf(d, j).smallBusinessSBA = a))} />
        </QuestionGroup>
      ) : null}
    </CountrySection>
  );
}

export const footprintStep: StepDef = {
  id: "footprint",
  title: "Footprint",
  intro: "The countries you operate in or plan to enter, and a few facts about each local entity.",
  questionIds: [
    "footprint", "other-countries", "entity-status", "entity-type", "entity-headcount", "entity-data-staff", "entity-revenue",
    "revenue-above", "entity-employee-rep", "entity-union-data", "entity-sba",
  ],
  validate: (draft, config) => {
    const v = issueCollector(config);
    v.require(draft.footprint.entities.length > 0, "footprint", undefined, "Select at least one country.");
    for (const e of draft.footprint.entities) {
      const j = e.jurisdiction;
      if (e.role !== "hq") {
        v.require(e.status, "entity-status", j, "Please choose one.");
        v.require(e.entityType, "entity-type", j, "Please choose one.");
      }
      v.require(e.headcount, "entity-headcount", j);
      if (needsDataStaff(e)) v.require(e.dataStaff, "entity-data-staff", j);
      v.require(e.revenue, "entity-revenue", j);
      for (const { threshold, scope } of straddledThresholds(draft, e, config))
        v.require(
          scope === "group" ? draft.company.groupRevenueAbove[threshold.id] : e.revenueAbove[threshold.id],
          "revenue-above", threshold.id, undefined, { amount: formatUSD(threshold.amount) },
        );
      v.require(e.employeeRep, "entity-employee-rep", j);
      if (needsUnionQuestion(e)) v.require(e.unionData, "entity-union-data", j);
      if (isUS(e)) v.require(e.smallBusinessSBA, "entity-sba", j);
    }
    return v.issues;
  },
  Component: FootprintStep,
};
